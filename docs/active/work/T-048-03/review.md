# T-048-03 — Review: Budget Invariant Coverage Audit

> Handoff document. What changed, the coverage verdict, and open concerns — enough for a
> human reviewer to sign off without re-reading every file.

## What this ticket was

A **standalone audit** (no production change) confirming the macro-wallet's IA-8
two-denomination contract (`src/budget/wallet.ts`) is actually test-covered *before*
E-048's T-048-01 generalizes it to a concurrent wave. No `depends_on` → ran concurrently
with T-048-01 as a deliberate parallel ground-check.

## What changed

### Created (committed — `docs/active/work/T-048-03/`)
- `research.md` — map of `wallet.ts` algebra + `wallet.test.ts` surface + IA-8 contract.
- `design.md` — decided the verdict (green, covered) and chose Option B (note + one
  trivial additive test) over note-only / redundant-anchor.
- `structure.md` — file-level blueprint (docs + at most one test-only edit).
- `plan.md` — 7 ordered, verifiable steps mapped to acceptance criteria.
- `audit.md` — **the primary deliverable**: gate result + 13-row IA-8 coverage table +
  back-compat anchor call-out + gap disposition.
- `progress.md` — step tracking + two documented deviations.
- `review.md` — this file.

### Modified (test-only, NOT committed by this ticket — see Concerns)
- `src/budget/wallet.test.ts` — added one `canAfford` characterization block
  (`test.each([Infinity, NaN])` for timeMs and tokens; +4 passing cases) closing the
  documented "safe-refuse" gap. Test-only; uses only already-imported symbols.

### NOT touched
- `src/budget/wallet.ts` and all other production code — **zero edits** (audit
  constraint honored).

## Coverage verdict

**The IA-8 two-denomination contract is fully test-pinned.** Each facet maps to a named
test (full table in `audit.md` §2):

- **wall-clock = HARD WALL** via `canAfford` — refuses over-time; no conflation
  (fits-tokens-not-time still refuses); `<=` boundary; depleted-affords-nothing. ✅
- **tokens = DETECT-AFTER** via `debit` — floors at 0, surfaces per-denomination
  `overshoot`; load-bearing token-overshoot case + monotonic-depletion sequence. ✅
- **per-cast `debit` subtracts BOTH denominations** (back-compat anchor for
  `debitWave([one]) == debit`) — pinned by `debit — fitting Budget actual`. ✅
- **non-finite safe-refuse** — was documented-but-untested; **closed** test-only. ✅

## Gate

`bun run check` (`baml:gen` → `tsc --noEmit` → `bun test`) — **PASS, 0 fail** at every
observation. Count moved 1127 → 1131 (this ticket's +4) → 1147 as the concurrent
T-048-01 thread landed its own `debitWave` tests. The stable invariant is **0 fail**.

## Test coverage gaps (flagged, not closed)

None material to the IA-8 contract. Minor, intentionally out of audit scope:
- `formatWallet` token/ms formatting edge rounding (`fmtMs` `1h30m` vs `1h`) is covered
  by the `formatWallet` block; not re-audited beyond confirming presence.
- `debit(Usage)` *overshoot* path (a Usage actual that overshoots remaining tokens) is
  not separately asserted, but the overshoot arithmetic is identical to the Budget path
  (`overBy`) which IS pinned — low-value redundancy, not a real gap.

## Open concerns for a human reviewer

1. **Commit hygiene under concurrency (the one thing to check).** Because T-048-01 edits
   the SAME files (`wallet.ts`, `wallet.test.ts`, `spend-core.ts`) concurrently, this
   ticket committed **only its docs**. The additive characterization test currently sits
   uncommitted in `wallet.test.ts` and will be swept into the next commit of that file
   (T-048-01's thread or Lisa) under file-lock serialization. Reviewer should confirm
   that test (`// T-048-03` comment, lines ~77–86) lands and is attributed — it is
   additive and green, so no functional risk, only attribution.
2. **This audit pins T-048-01's contract, it does not validate T-048-01's code.** The
   `debitWave`/`authorizeWave` implementation the sibling thread is landing is reviewed
   under T-048-01, not here. This ticket only certifies the *baseline* it must preserve.
3. **No live cast, no production change** — by design. Nothing to roll back.

## Acceptance criteria — final status

- [x] `bun run check` run; result recorded (pass, 0 fail; count noted with concurrency caveat).
- [x] Coverage table written mapping each IA-8 behavior → covering test or gap (`audit.md` §2).
- [x] Back-compat anchor called out (`audit.md` §3 — pinned, named).
- [x] No production-code changes (test-only additive characterization is the sole `src` edit).

**Recommendation:** approve. The audit's purpose — certify the ground T-048-01 builds on
is green and characterized — is met, and it closed one real documented gap in passing.
