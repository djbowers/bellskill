// Chalk next-session eval (PROD-85).
//
// Runs the REAL recommender pipeline (prompt → claude-haiku-4-5 with structured
// outputs → validation → one corrective retry) in-process against a golden set
// of RecommenderInputs snapshots, so no Supabase stack is needed. Candidates
// come from scripts/data/movements.csv through the same toCandidates() the
// edge function uses, so the model sees the production catalog.
//
// Each sample is scored three ways:
//   - generation: did the pipeline produce a recommendation, and on the first
//     attempt? (The built-in retry hides first-attempt failures, so the
//     Anthropic fetch is wrapped to count attempts.)
//   - deterministic checks: circuit format, catalog ids, no rep count repeated
//     on consecutive rungs, equal rungs, target coverage, equipment
//     loadability, the house ban on the word "debt", and the item's bounds.
//   - an LLM judge (claude-haiku-4-5, structured outputs) for what code can't
//     check: does the session fit the lifter, is the rationale grounded in the
//     inputs, is it specific rather than filler.
//
// Thresholds are enforced: the process exits 1 when any is breached, so the
// suite can gate a prompt change.
//
// Requirements: ANTHROPIC_API_KEY in the environment.
// Usage: npm run eval:next-session -- [--only <category>] [--limit N] [--samples N]
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  type EquipmentSummary,
  validateSessionWeights,
} from '../../src/utils/equipment.ts';
import { formatPatternLine } from '../../supabase/functions/_shared/patternDebtPrompt.ts';
import { toCandidates } from '../../supabase/functions/recommend-session/inputs.ts';
import { generateRecommendation } from '../../supabase/functions/recommend-session/llm.ts';
import type {
  CandidateMovement,
  Recommendation,
  RecommenderInputs,
} from '../../supabase/functions/recommend-session/types.ts';
import { ValidationError } from '../../supabase/functions/recommend-session/validate.ts';
import {
  parseCredits,
  parseCsv,
  parseUnilateral,
} from '../ingest-movements.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is required.');
  process.exit(1);
}

// The edge function reads its key through Deno; give it the Node env instead.
(globalThis as Record<string, unknown>).Deno = {
  env: { get: (key: string) => process.env[key] },
};

const GENERATOR_MODEL = 'claude-haiku-4-5';
const JUDGE_MODEL = 'claude-haiku-4-5';

// $ per MTok — for the cost axis of the eval report.
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
};
const cost = (model: string, inputTokens: number, outputTokens: number) => {
  const p = PRICES[model];
  return p ? (inputTokens * p.input + outputTokens * p.output) / 1_000_000 : 0;
};

const THRESHOLDS = {
  generation_errors: 0,
  first_attempt_valid_rate: 0.8,
  deterministic_pass_rate: 1,
  mean_fit: 4,
  mean_rationale_grounding: 4,
};

// --- Golden set -----------------------------------------------------------------

interface GoldenItem {
  id: string;
  category: string;
  inputs: Omit<RecommenderInputs, 'candidates'>;
  expect: {
    max_duration_minutes?: number;
    max_blocks?: number;
    must_cover?: string[];
    /** Every block must be a bodyweight movement (no bells available). */
    bodyweight_only?: boolean;
    notes: string;
  };
}

// --- Catalog --------------------------------------------------------------------

/**
 * A stable, opaque id per movement. Production ids are UUIDs the model has to
 * copy verbatim; a readable slug would let it guess ids and hide that failure.
 */
const catalogId = (name: string) => {
  const hex = createHash('md5').update(name).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Every row of the catalog CSV, shaped like the `movements` table. */
const loadCatalog = (): CandidateMovement[] => {
  const rows = parseCsv(
    readFileSync(resolve(HERE, '..', 'data', 'movements.csv'), 'utf8'),
  ) as string[][];
  const [header, ...records] = rows;
  const col = (record: string[], name: string) => record[header.indexOf(name)];
  return toCandidates(
    records.map((r) => ({
      id: catalogId(col(r, 'Movement')),
      Movement: col(r, 'Movement'),
      'Primary Equipment': col(r, 'Primary Equipment'),
      pattern_credits: parseCredits(col(r, 'Pattern Credits')),
      '# Primary Items': Number(col(r, '# Primary Items')),
      unilateral_lower: parseUnilateral(col(r, 'Unilateral Lower')),
    })),
  );
};

// --- Generation trace -----------------------------------------------------------

interface Attempt {
  input_tokens: number;
  output_tokens: number;
  /** The correction prompt this attempt was sent with — the previous attempt's rejection reasons. */
  correction?: string;
}

/**
 * Wraps fetch so each generateRecommendation call reports how many model
 * attempts it took and what they cost. Only Anthropic traffic is observed —
 * and the judge's SDK call goes through the same fetch, so callers snapshot
 * `attempts` before judging.
 */
let attempts: Attempt[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const res = await realFetch(input, init);
  if (String(input).includes('api.anthropic.com') && res.ok) {
    const usage = (await res.clone().json()).usage ?? {};
    const messages = JSON.parse(String(init?.body ?? '{}')).messages ?? [];
    attempts.push({
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      correction: messages.length > 1 ? messages.at(-1).content : undefined,
    });
  }
  return res;
};

/** The bullet reasons from a correction prompt, for the retry-reason histogram. */
const correctionReasons = (generation: Attempt[]) =>
  generation.flatMap((a) =>
    (a.correction ?? '')
      .split('\n')
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2)),
  );

// --- Deterministic checks -------------------------------------------------------

const DEBT_WORD = /\bdebt\b/i;

const consecutiveRepeat = (scheme: number[]) =>
  scheme.some((reps, i) => i > 0 && reps === scheme[i - 1]);

const runChecks = (
  rec: Recommendation,
  inputs: RecommenderInputs,
  expect: GoldenItem['expect'],
): Record<string, boolean> => {
  const byId = new Map(inputs.candidates.map((c) => [c.movement_id, c]));
  const rungCounts = new Set(rec.blocks.map((b) => b.rep_scheme.length));
  const covered = new Set(
    rec.blocks.flatMap((b) => byId.get(b.movement_id)?.pattern_credits ?? []),
  );
  const targets = [...inputs.balance_targets, ...(expect.must_cover ?? [])];
  const equipment =
    'description' in inputs.unlocked_weights
      ? (inputs.unlocked_weights as EquipmentSummary)
      : null;
  const prose = [rec.rationale, ...rec.blocks.map((b) => b.notes)].join(' ');

  return {
    format_circuit: rec.format === 'Circuit',
    ids_in_catalog: rec.blocks.every((b) => byId.has(b.movement_id)),
    no_consecutive_repeats: rec.blocks.every(
      (b) => !consecutiveRepeat(b.rep_scheme),
    ),
    equal_rungs: rungCounts.size <= 1,
    covers_targets: targets.every((t) => covered.has(t as never)),
    equipment_loadable:
      !equipment ||
      validateSessionWeights(
        equipment,
        rec.blocks
          .filter((b) => b.weight_kg > 0)
          .map((b) => ({ weight_kg: b.weight_kg, bells: b.bells ?? 1 })),
        rec.adjustable_settings_kg ?? [],
      ).length === 0,
    bodyweight_consistent: rec.blocks.every((b) =>
      byId.get(b.movement_id)?.bodyweight
        ? b.weight_kg === 0 && b.bells === 0
        : b.weight_kg > 0 && (b.bells ?? 1) >= 1,
    ),
    bodyweight_only:
      !expect.bodyweight_only ||
      rec.blocks.every((b) => byId.get(b.movement_id)?.bodyweight),
    no_debt_word: !DEBT_WORD.test(prose),
    within_duration:
      expect.max_duration_minutes === undefined ||
      rec.duration_minutes <= expect.max_duration_minutes,
    within_blocks:
      expect.max_blocks === undefined || rec.blocks.length <= expect.max_blocks,
  };
};

// --- Judge ----------------------------------------------------------------------

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fit: {
      type: 'integer',
      enum: [1, 2, 3, 4, 5],
      description:
        '5 = the session is what a good coach would give this lifter today (goal, readiness, time, history, targets, equipment all respected); 1 = ignores or contradicts them',
    },
    rationale_grounding: {
      type: 'integer',
      enum: [1, 2, 3, 4, 5],
      description:
        '5 = every claim in the rationale and notes is supported by the inputs; 1 = invents history, goals, or feelings the inputs do not contain',
    },
    specificity: {
      type: 'integer',
      enum: [1, 2, 3, 4, 5],
      description:
        '5 = concrete and tied to this lifter; 1 = generic filler that could go under any session',
    },
    names_targets: {
      type: 'boolean',
      description:
        'When target patterns exist, does the rationale name the patterns it is catching up? True when there are no targets.',
    },
    unsupported_claims: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short quotes of claims NOT supported by the inputs',
    },
    notes: { type: 'string', description: 'One sentence' },
  },
  required: [
    'fit',
    'rationale_grounding',
    'specificity',
    'names_targets',
    'unsupported_claims',
    'notes',
  ],
} as const;

interface Verdict {
  fit: number;
  rationale_grounding: number;
  specificity: number;
  names_targets: boolean;
  unsupported_claims: string[];
  notes: string;
}

const RUBRIC = `You are grading a kettlebell coach named Chalk on the next session it
prescribed for a lifter. You see everything Chalk saw about the lifter, the
catalog entries for the movements Chalk chose, the session, and a description
of what a good session looks like for this case. Judge whether the session fits
the lifter and whether the rationale is grounded in the inputs rather than
invented. Chalk must never use the word "debt".`;

const anthropic = new Anthropic();

const describeInputs = (inputs: RecommenderInputs, rec: Recommendation) => {
  const chosen = new Set(rec.blocks.map((b) => b.movement_id));
  const history = inputs.recent_history.length
    ? inputs.recent_history.map(
        (w) =>
          `- ${w.completed_at.slice(0, 10)} · ${w.goal}${w.rpe ? ` · RPE ${w.rpe}` : ''} · ${w.movements
            .map(
              (m) =>
                `${m.name} ${m.rep_scheme.join('/')}${m.weight_kg ? ` @ ${m.weight_kg}kg` : ''}`,
            )
            .join('; ')}`,
      )
    : ['- (no workouts logged — the lifter has no recent history)'];
  const debt = inputs.pattern_debt
    ? inputs.pattern_debt.patterns.map(formatPatternLine)
    : ['- (not available)'];
  return [
    `Training goal: ${inputs.training_goal ?? '(none)'}`,
    `How they feel today: ${inputs.readiness ?? '(not provided)'}`,
    `Days since last workout: ${inputs.days_since_last_workout ?? '(unknown)'}`,
    `Target patterns that MUST be trained: ${inputs.balance_targets.join(', ') || '(none)'}`,
    `Equipment: ${
      'description' in inputs.unlocked_weights
        ? `${inputs.unlocked_weights.description} — fixed bells can be used freely at their weight; each adjustable bell holds ONE setting for the whole session, declared in adjustable_settings_kg`
        : '(not recorded — any weight is fine)'
    }`,
    '',
    'Recent workouts (most recent first):',
    ...history,
    '',
    'Pattern balance (higher = more under-trained):',
    ...debt,
    '',
    'Catalog entries for the chosen movements:',
    ...inputs.candidates
      .filter((c) => chosen.has(c.movement_id))
      .map(
        (c) =>
          `- ${c.name}${c.pattern_credits ? ` · pays: ${c.pattern_credits.join(', ')}` : ''}${c.bodyweight ? ' · bodyweight' : ''}${c.supports_doubles ? ' · double-bell' : ''}${c.unilateral_lower ? ' · one leg at a time' : ''}`,
      ),
  ].join('\n');
};

const judge = async (
  item: GoldenItem,
  inputs: RecommenderInputs,
  rec: Recommendation,
) => {
  const content = [
    `CASE: ${item.id} (${item.category})`,
    `WHAT A GOOD SESSION LOOKS LIKE HERE: ${item.expect.notes}`,
    '',
    'WHAT CHALK KNEW ABOUT THE LIFTER:',
    describeInputs(inputs, rec),
    '',
    "CHALK'S SESSION:",
    JSON.stringify(rec, null, 2),
  ].join('\n');

  const response = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    system: RUBRIC,
    messages: [{ role: 'user', content }],
    output_config: { format: { type: 'json_schema', schema: VERDICT_SCHEMA } },
  } as never);
  const text = (response.content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
  return {
    verdict: JSON.parse(text) as Verdict,
    judge_cost_usd: cost(
      JUDGE_MODEL,
      response.usage.input_tokens,
      response.usage.output_tokens,
    ),
  };
};

// --- Main -----------------------------------------------------------------------

interface SampleResult {
  id: string;
  category: string;
  sample: number;
  error?: string;
  reasons?: string[];
  attempts: number;
  first_attempt_valid: boolean;
  /** Why the first attempt was rejected, when it was. */
  retry_reasons?: string[];
  recommendation?: Recommendation;
  checks?: Record<string, boolean>;
  verdict?: Verdict;
  latency_ms: number;
  generation_cost_usd: number;
  judge_cost_usd: number;
}

const flag = (name: string) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
};

const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

const main = async () => {
  const only = flag('--only');
  const limit = Number(flag('--limit') ?? Infinity);
  const samples = Number(flag('--samples') ?? 2);

  const golden = JSON.parse(
    readFileSync(resolve(HERE, 'next-session-golden-set.json'), 'utf8'),
  ) as { items: GoldenItem[] };
  const items = golden.items
    .filter((i) => !only || i.category === only)
    .slice(0, limit);
  const candidates = loadCatalog();
  console.log(
    `${items.length} items × ${samples} samples, ${candidates.length} catalog candidates\n`,
  );

  const results: SampleResult[] = [];
  for (const item of items) {
    const inputs: RecommenderInputs = { ...item.inputs, candidates };
    for (let sample = 1; sample <= samples; sample++) {
      process.stdout.write(`${item.id} #${sample} … `);
      attempts = [];
      const started = Date.now();
      const base = { id: item.id, category: item.category, sample };
      try {
        const recommendation = await generateRecommendation(inputs);
        const latency_ms = Date.now() - started;
        const generation = [...attempts];
        const checks = runChecks(recommendation, inputs, item.expect);
        const { verdict, judge_cost_usd } = await judge(
          item,
          inputs,
          recommendation,
        );
        const failed = Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([name]) => name);
        results.push({
          ...base,
          attempts: generation.length,
          first_attempt_valid: generation.length === 1,
          retry_reasons:
            generation.length > 1 ? correctionReasons(generation) : undefined,
          recommendation,
          checks,
          verdict,
          latency_ms,
          generation_cost_usd: generation.reduce(
            (sum, a) =>
              sum + cost(GENERATOR_MODEL, a.input_tokens, a.output_tokens),
            0,
          ),
          judge_cost_usd,
        });
        console.log(
          `fit ${verdict.fit}/5, grounding ${verdict.rationale_grounding}/5, ${generation.length} attempt(s), ${latency_ms}ms${failed.length ? ` — FAILED ${failed.join(', ')}` : ''}`,
        );
        if (generation.length > 1) {
          console.log(
            `    retried: ${correctionReasons(generation).join(' | ')}`,
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`ERROR: ${message}`);
        results.push({
          ...base,
          error: message,
          reasons: err instanceof ValidationError ? err.reasons : undefined,
          attempts: attempts.length,
          first_attempt_valid: false,
          retry_reasons:
            attempts.length > 1 ? correctionReasons(attempts) : undefined,
          latency_ms: Date.now() - started,
          generation_cost_usd: attempts.reduce(
            (sum, a) =>
              sum + cost(GENERATOR_MODEL, a.input_tokens, a.output_tokens),
            0,
          ),
          judge_cost_usd: 0,
        });
      }
    }
  }

  const ok = results.filter((r) => !r.error);
  const failuresByCheck: Record<string, number> = {};
  for (const r of ok) {
    for (const [name, passed] of Object.entries(r.checks ?? {})) {
      if (!passed) failuresByCheck[name] = (failuresByCheck[name] ?? 0) + 1;
    }
  }
  const allChecksPass = (r: SampleResult) =>
    Object.values(r.checks ?? {}).every(Boolean);

  // Bucket retry reasons by their rule text (after the block label) so the
  // histogram says which rule the first attempt keeps breaking.
  const retryReasons: Record<string, number> = {};
  for (const r of results) {
    for (const reason of r.retry_reasons ?? []) {
      const rule = reason.replace(
        /^(block \d+ \([^)]*\)|the session) (— )?/,
        '',
      );
      retryReasons[rule] = (retryReasons[rule] ?? 0) + 1;
    }
  }

  const summary = {
    items: items.length,
    samples: results.length,
    generation_errors: results.length - ok.length,
    first_attempt_valid_rate: mean(
      results.map((r) => (r.first_attempt_valid ? 1 : 0)),
    ),
    retry_rate: mean(results.map((r) => (r.attempts > 1 ? 1 : 0))),
    deterministic_pass_rate: mean(
      results.map((r) => (!r.error && allChecksPass(r) ? 1 : 0)),
    ),
    failures_by_check: failuresByCheck,
    retry_reasons: retryReasons,
    mean_fit: mean(ok.map((r) => r.verdict!.fit)),
    mean_rationale_grounding: mean(
      ok.map((r) => r.verdict!.rationale_grounding),
    ),
    mean_specificity: mean(ok.map((r) => r.verdict!.specificity)),
    names_targets_rate: mean(ok.map((r) => (r.verdict!.names_targets ? 1 : 0))),
    mean_latency_ms: Math.round(mean(ok.map((r) => r.latency_ms))),
    total_generation_cost_usd: results.reduce(
      (a, r) => a + r.generation_cost_usd,
      0,
    ),
    total_judge_cost_usd: results.reduce((a, r) => a + r.judge_cost_usd, 0),
    by_category: Object.fromEntries(
      [...new Set(results.map((r) => r.category))].map((category) => {
        const sub = results.filter((r) => r.category === category);
        const subOk = sub.filter((r) => !r.error);
        return [
          category,
          {
            n: sub.length,
            errors: sub.length - subOk.length,
            deterministic_pass_rate: mean(
              sub.map((r) => (!r.error && allChecksPass(r) ? 1 : 0)),
            ),
            mean_fit: mean(subOk.map((r) => r.verdict!.fit)),
            mean_rationale_grounding: mean(
              subOk.map((r) => r.verdict!.rationale_grounding),
            ),
          },
        ];
      }),
    ),
  };

  const breaches = [
    summary.generation_errors > THRESHOLDS.generation_errors &&
      `generation errors ${summary.generation_errors} > ${THRESHOLDS.generation_errors}`,
    summary.first_attempt_valid_rate < THRESHOLDS.first_attempt_valid_rate &&
      `first-attempt valid rate ${summary.first_attempt_valid_rate.toFixed(2)} < ${THRESHOLDS.first_attempt_valid_rate}`,
    summary.deterministic_pass_rate < THRESHOLDS.deterministic_pass_rate &&
      `deterministic pass rate ${summary.deterministic_pass_rate.toFixed(2)} < ${THRESHOLDS.deterministic_pass_rate}`,
    summary.mean_fit < THRESHOLDS.mean_fit &&
      `mean fit ${summary.mean_fit.toFixed(2)} < ${THRESHOLDS.mean_fit}`,
    summary.mean_rationale_grounding < THRESHOLDS.mean_rationale_grounding &&
      `mean rationale grounding ${summary.mean_rationale_grounding.toFixed(2)} < ${THRESHOLDS.mean_rationale_grounding}`,
  ].filter((b): b is string => Boolean(b));

  const date = new Date().toISOString().slice(0, 10);
  const outDir = resolve(HERE, 'results');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `${date}-next-session.json`);
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        run_at: new Date().toISOString(),
        thresholds: THRESHOLDS,
        summary,
        results,
      },
      null,
      2,
    ),
  );

  console.log('\nSummary:');
  console.log(
    `  first-attempt valid  ${Math.round(summary.first_attempt_valid_rate * 100)}%`,
  );
  console.log(
    `  deterministic pass   ${Math.round(summary.deterministic_pass_rate * 100)}%`,
  );
  console.log(`  generation errors    ${summary.generation_errors}`);
  console.log(`  fit                  ${summary.mean_fit.toFixed(2)}/5`);
  console.log(
    `  rationale grounding  ${summary.mean_rationale_grounding.toFixed(2)}/5`,
  );
  console.log(
    `  specificity          ${summary.mean_specificity.toFixed(2)}/5`,
  );
  console.log(`  mean latency         ${summary.mean_latency_ms}ms`);
  console.log(
    `  cost                 $${summary.total_generation_cost_usd.toFixed(4)} generation + $${summary.total_judge_cost_usd.toFixed(4)} judge`,
  );
  console.log(`\nWrote ${outPath}`);

  if (breaches.length) {
    console.error(
      `\nThresholds breached:\n${breaches.map((b) => `  - ${b}`).join('\n')}`,
    );
    process.exit(1);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
