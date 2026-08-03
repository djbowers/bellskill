# TODOS

## Expand catalog coverage for thin patterns (carry, get_up)
- **What:** Add carry variations and get-up progressions to the movement catalog.
- **Why:** carry has 9 catalog movements and get_up 4 (vs squat 51 / push 66), so those patterns stay structurally prone to permanent "Overdue" in the Balance chart even after multi-pattern credit lands.
- **Pros:** honest ledger; less false pressure on the two thinnest patterns.
- **Cons:** editorial content work; requires catalog re-ingest.
- **Context:** Surfaced by the 2026-08-03 CEO review of pattern debt (see docs/designs/pattern-debt-ledger.md). Multi-pattern credit (TGU → get_up + rotation + push) reduces false debt but does not fatten the catalog. Start from scripts/data/movements.csv and docs/movement-catalog.md.
- **Effort:** M (human) → S with CC. **Priority:** P3. **Depends on:** Phase 1 taxonomy/credit re-tag landing.
