#!/usr/bin/env node
// Chalk RAG knowledge-corpus ingestion (PROD-248).
//
// Gathers the coaching corpus, chunks it, embeds each chunk via the embed-text
// Edge Function (so ingestion-time and query-time vectors come from the exact
// same model + runtime — see supabase/functions/_shared/embeddings.ts), and
// upserts into chalk_documents / chalk_chunks.
//
// Sources:
//   1. Published catalog programs — programs.description plus each session's
//      notes, read live from the database. One document per program.
//   2. Scoring-model docs — docs/pattern-debt-scoring-model.md and
//      docs/modality-debt-scoring-model.md, chunked by heading.
//   3. Authored protocol articles — docs/chalk-knowledge/*.md, with
//      `title:` / `tags:` frontmatter. These replace the protocol knowledge the
//      Chalk system prompt used to hard-code as unretrieved model priors.
//
// Chunking: heading-aware, ~CHUNK_TARGET_CHARS per chunk with sentence-safe
// splits and a one-line breadcrumb prefix so every chunk is self-describing
// for both FTS and the model. The size ceiling is a real model constraint:
// gte-small embeds at most 512 tokens, so a chunk must fit whole.
//
// Unlike ingest-movements.mjs (which emits migration SQL), this writes to the
// database directly: embeddings don't belong in committed migrations. Run it
// against local after `supabase db reset`, and against staging/prod after
// deploying the chalk-rag migrations and edge functions.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/ingest-chalk-knowledge.mjs
//   node scripts/ingest-chalk-knowledge.mjs --dry-run   print chunk boundaries, write nothing
//   (URL defaults to the local stack; get the local service key from `supabase status`.
//    Hosted projects also need EMBED_TEXT_TOKEN — the secret set on the
//    embed-text function via `supabase secrets set EMBED_TEXT_TOKEN=...`.)

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// embed-text authorizes against its own EMBED_TEXT_TOKEN secret on hosted
// projects; the service key doubles as the token on the local stack.
const EMBED_TOKEN = process.env.EMBED_TEXT_TOKEN ?? SERVICE_ROLE_KEY;

const DRY_RUN = process.argv.includes('--dry-run');

// ~300 tokens. gte-small truncates past 512 tokens, so chunks must fit whole;
// the breadcrumb prefix is included in the budget.
const CHUNK_TARGET_CHARS = 1200;
const CHUNK_OVERLAP_CHARS = 180; // ~15%
const EMBED_BATCH_SIZE = 50;

const SCORING_DOCS = [
  'docs/pattern-debt-scoring-model.md',
  'docs/modality-debt-scoring-model.md',
];
const ARTICLES_DIR = 'docs/chalk-knowledge';

// --- Chunking ---------------------------------------------------------------

/** Split markdown into (heading path, body) sections at h1-h3. */
export const splitByHeadings = (markdown) => {
  const lines = markdown.split('\n');
  const sections = [];
  // Depth-tagged so an h2 replaces the previous h2 rather than nesting under
  // it when the document has no h1 (frontmatter carries the title instead).
  let headings = [];
  let body = [];
  const flush = () => {
    const text = body.join('\n').trim();
    if (text) sections.push({ path: headings.map((h) => h.text), text });
    body = [];
  };
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.*)$/);
    if (m) {
      flush();
      const depth = m[1].length;
      headings = [
        ...headings.filter((h) => h.depth < depth),
        { depth, text: m[2].trim() },
      ];
    } else {
      body.push(line);
    }
  }
  flush();
  return sections;
};

/** Sentence-safe splits of one section body into <= target-size pieces. */
export const splitLongText = (text, target, overlap) => {
  if (text.length <= target) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const pieces = [];
  let current = '';
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > target) {
      pieces.push(current);
      current = current.slice(Math.max(0, current.length - overlap));
    }
    current = current ? `${current} ${sentence}` : sentence;
  }
  if (current.trim()) pieces.push(current);
  return pieces;
};

/**
 * Chunk one document: heading-aware first, size-bounded second, and every
 * chunk prefixed with a "Title — Heading path:" breadcrumb so it stands alone.
 */
export const chunkDocument = (title, sections) => {
  const chunks = [];
  for (const section of sections) {
    const breadcrumb = [title, ...section.path].join(' — ');
    const bodyBudget = CHUNK_TARGET_CHARS - breadcrumb.length - 2;
    for (const piece of splitLongText(
      section.text.replace(/\s+/g, ' ').trim(),
      bodyBudget,
      CHUNK_OVERLAP_CHARS,
    )) {
      chunks.push(`${breadcrumb}: ${piece}`);
    }
  }
  return chunks;
};

// --- Sources ----------------------------------------------------------------

const parseFrontmatter = (raw) => {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
};

const gatherPrograms = async (admin) => {
  // Official catalog programs only (owner_id IS NULL, how seeds create them).
  // Any authenticated user can flip is_public/released_at on their OWN row,
  // so ingesting user-owned programs would let a user plant text in the
  // shared corpus that chalk-chat renders into every lifter's prompt.
  const { data: programs, error } = await admin
    .from('programs')
    .select('id, title, description')
    .is('owner_id', null)
    .eq('is_public', true)
    .not('released_at', 'is', null);
  if (error) throw error;

  const docs = [];
  for (const program of programs ?? []) {
    const { data: sessions, error: sessErr } = await admin
      .from('program_sessions')
      .select('week_number, day_number, title, notes')
      .eq('program_id', program.id)
      .order('sequence_index');
    if (sessErr) throw sessErr;

    const sessionNotes = (sessions ?? [])
      .filter((s) => s.notes && s.notes.trim())
      .map(
        (s) =>
          `### Week ${s.week_number}, Day ${s.day_number}: ${s.title}\n${s.notes.trim()}`,
      );

    const parts = [];
    if (program.description?.trim()) {
      parts.push(`## About this program\n${program.description.trim()}`);
    }
    if (sessionNotes.length > 0) {
      parts.push(`## Session notes\n\n${sessionNotes.join('\n\n')}`);
    }
    if (parts.length === 0) continue;

    docs.push({
      source_type: 'program',
      source_id: program.id,
      title: program.title,
      markdown: parts.join('\n\n'),
      metadata: { title: program.title },
    });
  }
  return docs;
};

const gatherScoringDocs = () =>
  SCORING_DOCS.filter((rel) => existsSync(resolve(ROOT, rel))).map((rel) => {
    const raw = readFileSync(resolve(ROOT, rel), 'utf8');
    const title = raw.match(/^#\s+(.*)$/m)?.[1] ?? basename(rel, '.md');
    return {
      source_type: 'doc',
      source_id: basename(rel),
      title,
      markdown: raw,
      metadata: { title },
    };
  });

const gatherArticles = () => {
  const dir = resolve(ROOT, ARTICLES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const { meta, body } = parseFrontmatter(
        readFileSync(resolve(dir, file), 'utf8'),
      );
      const title = meta.title ?? basename(file, '.md');
      return {
        source_type: 'protocol',
        source_id: basename(file, '.md'),
        title,
        markdown: body,
        metadata: { title, tags: meta.tags ?? '' },
      };
    });
};

// --- Embedding + persistence -------------------------------------------------

const embedBatch = async (texts) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/embed-text`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${EMBED_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    throw new Error(`embed-text ${res.status}: ${await res.text()}`);
  }
  const { embeddings } = await res.json();
  return embeddings;
};

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

// Bump to force re-chunking/re-embedding of unchanged documents after a
// chunking-strategy or embedding-model change.
const CHUNKER_VERSION = '2';

const upsertDocument = async (admin, doc, chunks) => {
  const contentHash = sha256(`${CHUNKER_VERSION}\n${doc.markdown}`);

  const { data: existing } = await admin
    .from('chalk_documents')
    .select('id, content_hash')
    .eq('source_type', doc.source_type)
    .eq('source_id', doc.source_id)
    .maybeSingle();

  if (existing?.content_hash === contentHash) {
    return { id: existing.id, skipped: true };
  }

  const embeddings = [];
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    embeddings.push(...(await embedBatch(chunks.slice(i, i + EMBED_BATCH_SIZE))));
  }

  // The hash is written LAST: the delete + insert below are separate,
  // non-transactional calls, and a partial failure with the new hash already
  // stored would make the skip-check treat a half-ingested document as up to
  // date forever. 'pending' never equals a sha256, so an interrupted run
  // re-ingests on the next pass.
  const { data: docRow, error: docErr } = await admin
    .from('chalk_documents')
    .upsert(
      {
        source_type: doc.source_type,
        source_id: doc.source_id,
        title: doc.title,
        content_hash: 'pending',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_type,source_id' },
    )
    .select('id')
    .single();
  if (docErr) throw docErr;

  // Delete-and-reinsert keeps chunk_index dense and drops chunks the new
  // content no longer produces.
  const { error: delErr } = await admin
    .from('chalk_chunks')
    .delete()
    .eq('document_id', docRow.id);
  if (delErr) throw delErr;

  const { error: insErr } = await admin.from('chalk_chunks').insert(
    chunks.map((content, chunk_index) => ({
      scope: 'knowledge',
      document_id: docRow.id,
      chunk_index,
      content,
      metadata: doc.metadata,
      embedding: JSON.stringify(embeddings[chunk_index]),
    })),
  );
  if (insErr) throw insErr;

  const { error: hashErr } = await admin
    .from('chalk_documents')
    .update({ content_hash: contentHash })
    .eq('id', docRow.id);
  if (hashErr) throw hashErr;

  return { id: docRow.id, skipped: false };
};

// --- Main ---------------------------------------------------------------------

const main = async () => {
  if (!SERVICE_ROLE_KEY && !DRY_RUN) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY is required (local: `supabase status`).',
    );
    process.exit(1);
  }

  const admin = SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;
  if (!admin) {
    console.warn('(dry run without a key — program documents skipped)');
  }

  const docs = [
    ...(admin ? await gatherPrograms(admin) : []),
    ...gatherScoringDocs(),
    ...gatherArticles(),
  ];

  let totalChunks = 0;
  let written = 0;
  let skipped = 0;

  for (const doc of docs) {
    const chunks = chunkDocument(doc.title, splitByHeadings(doc.markdown));
    totalChunks += chunks.length;

    if (DRY_RUN) {
      console.log(`\n[${doc.source_type}] ${doc.title} → ${chunks.length} chunks`);
      for (const c of chunks) {
        console.log(`  · (${c.length} chars) ${c.slice(0, 100)}…`);
      }
      continue;
    }

    const result = await upsertDocument(admin, doc, chunks);
    if (result.skipped) {
      skipped += 1;
    } else {
      written += 1;
      console.log(`✓ ${doc.title} (${chunks.length} chunks)`);
    }
  }

  console.log(
    DRY_RUN
      ? `\n(dry run) ${docs.length} documents, ${totalChunks} chunks — nothing written.`
      : `\nDone: ${written} documents ingested, ${skipped} unchanged, ${totalChunks} chunks total.`,
  );
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
