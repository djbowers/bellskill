#!/usr/bin/env node
// Chalk RAG retrieval eval (PROD-248).
//
// For every golden-set item with expected groundings, embeds the question via
// the embed-text Edge Function (the production model), runs chalk_hybrid_search
// in all three modes — hybrid, dense-only, lexical-only — and scores hit-rate
// and recall@k, so the value of hybrid fusion over either single retriever is
// a measured number.
//
//   hit@k    — at least one expected substring appears in the top-k chunks
//   recall@k — fraction of expected substrings covered by the top-k chunks
//
// Out-of-corpus items measure score separation: vector search always returns
// SOME nearest neighbors, so "nothing relevant" cannot be read from ranks
// alone. We report the mean top-1 score for groundable vs out-of-corpus
// queries per mode — a small gap documents that retrieval scores alone cannot
// gate relevance (which is why the prompt instructs the model to say when the
// reference does not cover the question).
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/eval/run-retrieval-eval.mjs
// Writes scripts/eval/results/<date>-retrieval.json and prints a summary table.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const HERE = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (local: `supabase status`).');
  process.exit(1);
}

const MODES = ['hybrid', 'dense', 'lexical'];
const KS = [2, 4, 6];
const MAX_K = Math.max(...KS);

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EMBED_BATCH_SIZE = 50;

const embedBatch = async (texts, attempt = 0) => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/embed-text`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ texts }),
  });
  if (!res.ok) {
    // The local edge runtime occasionally recycles a worker mid-burst; one
    // retry covers it without masking real failures.
    if (attempt === 0 && res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      return embedBatch(texts, 1);
    }
    throw new Error(`embed-text ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).embeddings;
};

/** Embed every question once, up front — reused across all three modes. */
const embedAll = async (items) => {
  const byQuestion = new Map();
  for (let i = 0; i < items.length; i += EMBED_BATCH_SIZE) {
    const batch = items.slice(i, i + EMBED_BATCH_SIZE);
    const embeddings = await embedBatch(batch.map((it) => it.question));
    batch.forEach((it, j) => byQuestion.set(it.id, embeddings[j]));
  }
  return byQuestion;
};

const search = async (embedding, question, mode) => {
  const { data, error } = await admin.rpc('chalk_hybrid_search', {
    query_embedding: JSON.stringify(embedding),
    query_text: question,
    match_scope: 'knowledge',
    match_count: MAX_K,
    search_mode: mode,
  });
  if (error) throw error;
  return data ?? [];
};

const scoreItem = (item, rows, k) => {
  const top = rows.slice(0, k);
  const haystack = top.map((r) => r.content.toLowerCase()).join('\n');
  const expected = item.expected_substrings.map((s) => s.toLowerCase());
  const found = expected.filter((s) => haystack.includes(s));
  return {
    hit: found.length > 0,
    recall: expected.length ? found.length / expected.length : null,
    missing: expected.filter((s) => !found.includes(s)),
  };
};

const pct = (n) => `${Math.round(n * 100)}%`;

const main = async () => {
  const golden = JSON.parse(
    readFileSync(resolve(HERE, 'golden-set.json'), 'utf8'),
  );
  const groundable = golden.items.filter(
    (i) => i.expected_substrings.length > 0,
  );
  const outOfCorpus = golden.items.filter((i) => i.category === 'out-of-corpus');

  const results = { run_at: new Date().toISOString(), modes: {} };
  const embeddings = await embedAll(golden.items);

  for (const mode of MODES) {
    const perItem = [];
    for (const item of groundable) {
      const started = Date.now();
      const rows = await search(embeddings.get(item.id), item.question, mode);
      const latency_ms = Date.now() - started;
      perItem.push({
        id: item.id,
        category: item.category,
        latency_ms,
        top_ids: rows.map((r) => r.id),
        top_scores: rows.map((r) => r.rrf_score),
        at_k: Object.fromEntries(
          KS.map((k) => [k, scoreItem(item, rows, k)]),
        ),
      });
    }

    const oocTopScores = [];
    for (const item of outOfCorpus) {
      const rows = await search(embeddings.get(item.id), item.question, mode);
      oocTopScores.push({ id: item.id, top_score: rows[0]?.rrf_score ?? 0 });
    }
    const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

    results.modes[mode] = {
      summary: Object.fromEntries(
        KS.map((k) => {
          const hits = perItem.filter((i) => i.at_k[k].hit).length;
          const recalls = perItem
            .map((i) => i.at_k[k].recall)
            .filter((r) => r !== null);
          return [
            k,
            {
              hit_rate: hits / perItem.length,
              mean_recall:
                recalls.reduce((a, b) => a + b, 0) / (recalls.length || 1),
            },
          ];
        }),
      ),
      mean_latency_ms: Math.round(
        perItem.reduce((a, i) => a + i.latency_ms, 0) / perItem.length,
      ),
      mean_top1_groundable: mean(perItem.map((i) => i.top_scores[0] ?? 0)),
      mean_top1_ooc: mean(oocTopScores.map((o) => o.top_score)),
      items: perItem,
      ooc_top_scores: oocTopScores,
    };
  }

  const date = new Date().toISOString().slice(0, 10);
  const outDir = resolve(HERE, 'results');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${date}-retrieval.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));

  console.log(`\nRetrieval eval — ${groundable.length} groundable items\n`);
  console.log(
    'mode     | hit@2 | hit@4 | hit@6 | recall@4 | top1 in/out | latency',
  );
  console.log(
    '---------|-------|-------|-------|----------|-------------|--------',
  );
  for (const mode of MODES) {
    const m = results.modes[mode];
    const sep = `${m.mean_top1_groundable.toFixed(3)}/${m.mean_top1_ooc.toFixed(3)}`;
    console.log(
      `${mode.padEnd(8)} | ${pct(m.summary[2].hit_rate).padEnd(5)} | ${pct(
        m.summary[4].hit_rate,
      ).padEnd(5)} | ${pct(m.summary[6].hit_rate).padEnd(5)} | ${pct(
        m.summary[4].mean_recall,
      ).padEnd(8)} | ${sep.padEnd(11)} | ${m.mean_latency_ms}ms`,
    );
  }

  const misses = results.modes.hybrid.items.filter((i) => !i.at_k[4].hit);
  if (misses.length > 0) {
    console.log('\nhybrid misses @4:');
    for (const miss of misses) {
      console.log(`  - ${miss.id}: missing ${miss.at_k[4].missing.join(' | ')}`);
    }
  }
  console.log(`\nWrote ${outPath}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
