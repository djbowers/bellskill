# TODOS

## Create DESIGN.md via /design-consultation
- **What:** Run /design-consultation to produce a DESIGN.md capturing the app's design system (typography, color tokens incl. the `intensity-*` ramp, spacing, motion rules, component vocabulary).
- **Why:** No DESIGN.md exists; every design review and new surface re-derives the system from the codebase. Phase 2 of the pattern-debt ledger adds three new surfaces (delta screen, pays-down microcopy, sparklines) that should build against a written system.
- **Pros:** one source of truth; sharper future design reviews; consistent agent-built UI.
- **Cons:** a session of effort; the shadcn + intensity-ramp idiom is already fairly coherent.
- **Context:** Flagged by the 2026-08-03 /plan-design-review of the pattern-debt ledger plan (Step 0B). Start from `src/components/ui/`, `tailwind.config.js`, and the WeeklyBalance gauge idiom.
- **Effort:** S with CC. **Priority:** P3. **Depends on:** nothing; ideally before Phase 2 UI work.

## Window-scaled recency saturation for pattern debt
- **What:** Make the recency curve scale with the requested `windowDays` (or per-pattern cadence) instead of the hard-coded 14-day saturation in `recencyComponent`.
- **Why:** `pattern_debt_window` callers can pass any window, but recency always saturates at 14 days — a 7-day window flattens everything trained 8–13 days ago to identical max recency, so the model advertises tunability it doesn't have.
- **Pros:** honestly tunable model; prerequisite for the per-pattern cadence future X5 structured for.
- **Cons:** shifts scores again (another visible jump); worked examples in the scoring doc must be re-derived.
- **Context:** Surfaced by the 2026-08-03 eng review (outside-voice finding 7) of the pattern-debt ledger plan. Start from `docs/pattern-debt-scoring-model.md` §Constants and `src/utils/patternDebt.ts` (`recencyComponent`); the `OVERDUE_DAYS = 2 × TARGET_CADENCE_DAYS` derivation landing in Phase 1 is the seam to build on.
- **Effort:** S with CC. **Priority:** P3. **Depends on:** Pattern-debt ledger Phase 1 landing.

## Expand catalog coverage for thin patterns (carry, get_up)
- **What:** Add carry variations and get-up progressions to the movement catalog.
- **Why:** carry has 9 catalog movements and get_up 4 (vs squat 51 / push 66), so those patterns stay structurally prone to permanent "Overdue" in the Balance chart even after multi-pattern credit lands.
- **Pros:** honest ledger; less false pressure on the two thinnest patterns.
- **Cons:** editorial content work; requires catalog re-ingest.
- **Context:** Surfaced by the 2026-08-03 CEO review of pattern debt (see docs/designs/pattern-debt-ledger.md). Multi-pattern credit (TGU → get_up + rotation + push) reduces false debt but does not fatten the catalog. Start from scripts/data/movements.csv and docs/movement-catalog.md.
- **Effort:** M (human) → S with CC. **Priority:** P3. **Depends on:** Phase 1 taxonomy/credit re-tag landing.
