# T-048-03 — Plan: ordered, verifiable steps

> Small, independently-verifiable steps. Each maps to an acceptance criterion.

## Step 1 — Run the gate, capture the result (AC-1)

- Run `bun run check` (`baml:gen` → `tsc --noEmit` → `bun test`).
- Record: pass/fail, test count, expect() count, file count, wall-clock.
- **Verify:** exit 0; numbers captured verbatim.
- *Status: DONE in Research — 1127 pass / 0 fail / 3026 expect / 77 files / ~1.5s.*

## Step 2 — Map IA-8 behaviors to covering tests (AC-2)

For each of the three contract facets, locate the asserting test in `wallet.test.ts`:
- **wall-clock HARD WALL** (`canAfford` refuses over-time, per-denomination) →
  `canAfford` block (refuses over wall-clock; fits-tokens-not-time IA-8; exact-fit
  boundary; depleted affords nothing).
- **tokens DETECT-AFTER** (`debit` floors at 0, surfaces overshoot) →
  `debit — token overshoot (IA-8 detect-after)`; `debit — sequence … then floor`.
- **`debit` sums BOTH denominations per cast** → `debit — fitting Budget actual`
  ("depletes both denominations by the exact amount").
- **Verify:** every facet has a named test or is explicitly marked "gap".

## Step 3 — Pin the back-compat anchor (AC-3)

- State whether the current per-cast `debit` both-denomination behavior is pinned, and
  name the test (`debit — fitting Budget actual` / "depletes both denominations …").
- Note that this is the assertion `debitWave([oneActual])` must equal for a single-node
  wave in T-048-01.
- **Verify:** the anchor is named; if it were absent, it would be flagged as the top gap.

## Step 4 — Surface the one gap; decide disposition

- Identify the documented-but-untested behavior: `canAfford` non-finite "safe-refuse".
- Per Design Option B: add a single test-only characterization adjacent to the existing
  `canAfford` block (no new imports, no production change).
- **Verify:** `bun run check` still green; new test counted (expect ~1131 pass).
- **Fallback (Option A):** if the test does NOT pass first try (documented behavior is
  false), drop the test and report the discrepancy as a finding — do NOT edit production.

## Step 5 — Write `audit.md` (AC-2, AC-3, AC-4)

- Compose the note: gate result, coverage table, anchor call-out, gaps, conclusion.
- Use the **verified** post-Step-4 numbers.
- **Verify:** every acceptance criterion has a home in the note.

## Step 6 — Commit

- Stage `docs/active/work/T-048-03/*` and (if Option B) `src/budget/wallet.test.ts`.
- Commit message scoped to T-048-03, audit-only.
- **Verify:** `git status` shows only the audit artifacts + at most the test-only edit.

## Step 7 — Write `review.md` (Review phase)

- Summarize what changed, test coverage verdict, open concerns. Handoff doc.

## Testing strategy

- No unit tests are *required* (the work is an audit). The single optional
  characterization test is the only code change, and it is verified by re-running the
  full gate. No integration tests; the wallet is pure. Verification criterion for the
  whole ticket: `bun run check` green + every AC mapped in `audit.md`.

## What could go wrong (pre-mortem)

- *The optional test fails* → means a documented behavior is false; fallback to note-only
  + finding. (Low risk: `canAfford` uses `<=`, and any comparison with `NaN` is `false`,
  `Infinity <= finite` is `false` — the documented safe-refuse holds.)
- *Scope creep into wave generalization* → guard: that is T-048-01/02, explicitly out.
- *Touching production `wallet.ts`* → guard: forbidden by the ticket; the only edit is a
  test file.
