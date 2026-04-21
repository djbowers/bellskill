# Agent Guardrails

This section defines what the automated agents (Bellskill PM and Bellskill Builder) are allowed and not allowed to do. Both agents read this file at the start of every run. Update here, not in the routine prompts.

## Current critical path

**Movement selection UI.** Replaces free-text movement entry with structured selection from the movements database. Blocks all downstream analytics and gamification work. The PM agent should bias toward tickets that move this forward until it ships.

When the critical path changes, update this section — the agents will pick up the new focus on their next run.

## Off-limits code paths

The Builder MUST NOT modify code in these areas. If a ticket's acceptance criteria require touching them, that's a spec error — the Builder stops and posts to Discord for human handling.

- **Authentication and session handling** — anything under `src/auth/`, Supabase auth client setup, or code that issues/validates tokens.
- **Payment and billing** — there isn't any yet, but when there is, same rule.
- **Database migrations** — anything in `supabase/migrations/` or equivalent. Schema changes are a human-only call.
- **Secrets, env handling, and CI config** — `.env*` files, `.github/workflows/`, anything that handles API keys or deployment configuration.
- **Supabase Row-Level Security policies** — security boundaries are human-only.

Refactors that incidentally touch these paths are also off-limits. The Builder should keep diffs focused on the acceptance criteria; drive-by changes are never allowed, but especially not here.

## Size and scope caps

- **Per-ticket work cap:** roughly one day of human work (around 300 lines of net new code, give or take). Tickets above this must be marked `agent-ready` by a human to bypass the cap (see below), or be split by the PM.
- **Files changed per PR:** soft cap of 15. If a ticket legitimately needs more, the Builder notes this in the PR description.
- **No multi-ticket PRs.** One Linear ticket per PR, always.
- **No drive-by changes.** No formatting churn, dependency bumps unrelated to the ticket, or refactors outside the acceptance criteria's scope.

## The `agent-ready` marker

A Linear label meaning "a human has looked at this and confirmed it's safe for an agent to build, even if it exceeds normal caps or touches sensitive areas."

- Only a human applies this label. Neither bot applies or removes it.
- The Builder treats an `agent-ready` ticket as having the size cap waived. Off-limits paths are **never** waived — `agent-ready` does not unlock auth/payments/migrations.
- The PM may still decline to triage an `agent-ready` ticket if the acceptance criteria are unclear.

## PR conventions

- Branch naming: `claude/<ticket-id>-<short-slug>`, e.g. `claude/BEL-42-movement-selector-ui`.
- PR title: `[<ticket-id>] <ticket title>`.
- PR description must include:
  - Linear ticket link
  - Checked acceptance criteria with per-item notes
  - Summary of approach
  - Any deviations from the Implementation Plan comment
  - Any criteria partially satisfied or needing manual verification
- Open as **draft** if confidence is low, if tests are incomplete, or if the diff touches anything unusual.
- Never push to `main`. Always a feature branch, always a PR.

## Testing expectations

- Every acceptance criterion is covered by at least one test.
- Tests live next to the code they cover (`*.test.ts`, `*.test.tsx`) and run under Vitest.
- `npm test` must pass locally before opening the PR, or the PR is opened as draft with a note.
- The GitHub PR pipeline is the final word — if it fails there, that's a build failure regardless of local state.
- For UI components, add or update Storybook stories where reasonable (see Storybook conventions below).
- If a criterion is genuinely untestable in the current harness (e.g., visual regression without a snapshot tool), note it explicitly in the PR description rather than faking a test.

## Stack and conventions

- **Runtime:** Vite + React + TypeScript. Strict TS; no `any` unless justified in a comment.
- **Backend:** Supabase (Postgres + Auth + Storage). Type-safe client via generated types — run `npm run fetch-types` after any schema change that a human makes.
- **Testing:** Vitest + React Testing Library. Test behavior, not implementation.
- **Storybook:** component-level stories in `*.stories.tsx` files. New user-facing components should ship with at least a default story.
- **State management:** keep it as local as possible. Lift only when a second consumer appears.
- **Styling:** match the existing patterns in neighboring files. Don't introduce a new styling approach without human sign-off.
- **Dev scripts** (reference for the agents):
  - `npm run dev` — Vite dev server on port 5173
  - `npm test` — Vitest
  - `npm run storybook` — Storybook on port 6006
  - `npm run fetch-types` — regenerate Supabase types

## Hands-off rules (both agents)

- Never modify a ticket assigned to a human user.
- Never modify a ticket assigned to the other bot.
- Never act on tickets in `In Review` or `Done` status.
- If unsure whether to touch a ticket: don't. Post to Discord asking.

## Audit trail requirements

Every state change an agent makes to a Linear ticket must be accompanied by a comment from that agent explaining what it did and why. No silent modifications.

Required comment moments:
- **PM** after triaging a ticket (acceptance criteria added, assigned to self).
- **Builder** when picking up a ticket (Implementation Plan).
- **Builder** when opening a PR (link + summary).
- **Either** on any failure or early exit related to the ticket.

## Discord notification rules

- Every run ends with a Discord post — success, failure, or "nothing to do."
- Failure posts include enough context to debug: which step failed, which ticket (if any) was involved, and the error message.
- Usage-limit exhaustion is a failure — post to Discord and exit non-zero so I know to consider upgrading or waiting for the cap to reset.

## When agents should stop and ask

Both agents should prefer stopping and asking to improvising when they hit:
- Ambiguous or contradictory acceptance criteria
- Missing context (e.g., a ticket references a document they can't find)
- A required change in an off-limits path
- An unexpected repo state (uncommitted changes on `main`, failing baseline tests, etc.)
- Any situation not clearly covered by this file or the routine prompt

"Ask" means: post to Discord with what was found and what's blocked, leave ticket state in a way that makes it obvious a human needs to look, exit non-zero.

---

*Last updated: 2026-04-21. Both agents read this file at the start of every run — edit here to change their behavior.*
