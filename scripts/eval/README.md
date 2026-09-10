# Chalk RAG evaluation harness

> PROD-248. Measures the retrieval pipeline (`chalk_hybrid_search`) and the
> full chat loop (`chalk-chat`) against a fixed golden set, across five axes:
> **quality, hallucination risk, safety, latency, and cost.**

## The golden set

`golden-set.json` — ~28 questions in four categories:

| Category | What it tests | Scored by |
| --- | --- | --- |
| `protocol` | Retrieval + grounding of protocol facts (S&S standards, ROP ladders, snatch test…) | retrieval hit/recall + judge faithfulness |
| `app-concept` | Retrieval over the scoring-model docs (pattern balance, movement mix) | same |
| `safety` | The medical redirect (pain, dizziness, pregnancy) | judge `safety_ok` |
| `out-of-corpus` | Hallucination risk — questions the corpus cannot answer (barbell, nutrition, running) | retrieval score separation + judge `unsupported_claims` |

Each item carries `expected_substrings` (must appear in a retrieved chunk to
count as a hit) and `answer_notes` (what a correct reply does), so both scripts
run off one file.

## `npm run eval:retrieval`

Embeds every question with the production model (via `embed-text`), runs
`chalk_hybrid_search` in **hybrid, dense-only, and lexical-only** modes, and
reports hit-rate@k and recall@k (k = 2, 4, 6) plus per-mode latency — the
hybrid-vs-single-retriever delta is a measured number, not a claim.

Out-of-corpus questions report **top-1 score separation** (groundable vs
out-of-corpus mean): vector search always returns nearest neighbors, so a
small gap documents that retrieval scores alone cannot gate relevance — which
is why the prompt instructs the model to say when the reference doesn't cover
the question, and why the judge checks that it does.

Needs: local stack + `supabase functions serve`, corpus ingested
(`npm run chalk:ingest`), `SUPABASE_SERVICE_ROLE_KEY` (from `supabase status`).

## `npm run eval:faithfulness`

End-to-end: creates a premium eval user, sends every question through the
**real** `chalk-chat` function, reads the retrieval trace back from the
assistant row's `context` snapshot (the eval replays exactly what the model
saw), and grades each reply with an LLM judge (`claude-haiku-4-5`) on:

- **faithfulness** 1–5 — claims supported by the retrieved reference?
- **relevance** 1–5 — answers the question asked?
- **safety_ok** — medical redirect honored, no diagnosing/prescribing?
- `unsupported_claims` — quoted hallucinations, per item.

Per item it also logs latency, token counts, and dollar cost (Opus 5 turn +
Haiku judge), and prints a category breakdown.

Additional needs: `ANTHROPIC_API_KEY` in the environment (judge) and in
`supabase/functions/.env` (chalk-chat itself), `SUPABASE_ANON_KEY` (eval user
sign-in). Note chalk-chat's 50-messages/user/day cap — one full run uses ~28;
use `--only <category>` / `--limit N` for partial runs.

## `npm run eval:next-session`

Chalk's next-session recommender (`recommend-session`, PROD-85), run
**in-process**: the golden set `next-session-golden-set.json` holds ~12
`RecommenderInputs` snapshots (goal, readiness, history, balance targets,
equipment, skill tree) and the runner fills `candidates` from every row of `scripts/data/movements.csv`
(kettlebell and bodyweight) through the same `toCandidates()` the edge function uses, then
trims them with the item's `skill_tree` through the same `applySkillCeiling()` — no Supabase stack,
just `ANTHROPIC_API_KEY`. Each item is generated `--samples` times (default 2)
through the real prompt → `claude-haiku-4-5` structured output → validation →
corrective-retry pipeline, then scored three ways:

- **generation** — `first_attempt_valid_rate` and `retry_rate` (the pipeline's
  retry hides first-attempt failures, so the Anthropic fetch is wrapped to
  count attempts and keep the rejection reasons), `generation_errors`.
- **deterministic checks** — `format_circuit`, `ids_in_catalog`,
  `no_consecutive_repeats`, `equal_ladders`, `covers_targets`,
  `equipment_loadable`, `bodyweight_consistent`, `skill_ceiling` (every block's
  node is within the fixture's skill-tree reach), `no_debt_word`, plus the item's
  `within_duration` / `within_blocks` / `bodyweight_only` / `must_not_prescribe` bounds. Reported as `deterministic_pass_rate` and a
  `failures_by_check` histogram.
- **LLM judge** (`claude-haiku-4-5`, structured outputs) — `fit`,
  `rationale_grounding`, `specificity` 1–5, `names_targets`, and quoted
  `unsupported_claims`, graded against the item's `expect.notes`.

Unlike the other two scripts this one **enforces thresholds** (constant
`THRESHOLDS` in the runner: no generation errors, first-attempt ≥ 80%,
deterministic 100%, fit ≥ 4, grounding ≥ 4) and exits 1 on a breach, so it can
gate a prompt change. `--only <category>` / `--limit N` / `--samples N` for
partial runs; a full run costs a few cents.

## Results

Written to `scripts/eval/results/<date>-{retrieval,faithfulness,next-session}.json` and
committed as dated snapshots so regressions show up in review. Targets:
hybrid hit@4 ≥ 0.8 on protocol items; mean faithfulness ≥ 4/5; safety pass
rate 100%.

## Known limitations (v1)

- Expected-substring matching is a proxy for chunk relevance; a retrieval can
  be useful without containing the exact phrase (two current @4 misses are
  this).
- No query-rewrite stage: multi-turn follow-ups ("how heavy?") retrieve on the
  raw message plus a training-goal prefix. A haiku rewriter is the documented
  v2 if follow-ups underperform.
- The judge is a single model, single pass — good for regression tracking,
  not an absolute quality measure.
