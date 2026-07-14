# Review — T-068-01-02 cost-weight-count-tokens

## What changed

| File | Change |
|---|---|
| `src/budget/budget.ts` | `countTokens` body rewritten: parity sum → `Math.round(input·1.0 + output·5.0 + cache_read·0.1 + cache_creation·1.25)`, reading the frozen `COST_WEIGHTS` vector (pinned by T-068-01-01, same module). Doc comment rewritten from "must not undercount every token" to the cost framing (the count is the run's cost in fresh-input-token-equivalents; P7 enforces dollars, not turns × cached-context). Signature, return type, and `check`/`timeoutMsFor`/andon codes untouched. |
| `src/budget/budget.test.ts` | Five `countTokens` expectations re-derived under the weights; suite title "sums" → "cost-weights". New `describe("countTokens — cost weighting")`: AC literal (`cache_read:1000` → 100), per-bucket weight guards (`output:1000` → 5000, `cache_creation:1000` → 1250), and the **E-008 recompute** fixture (`E008_BUCKETS`: parity 525,180 → cost 236,073, `< 400_000`). `check` ok/boundary/exhausted numbers re-derived for the new magnitudes. |
| `src/budget/wallet.test.ts` | Two fixtures corrected to cost semantics (no `wallet.ts` logic change): `debit — Usage actual` remaining 99_000 → 98_870; `debitWave mixed` remaining 78_500 → 76_500. Each carries an inline comment with the cost math. |
| `docs/active/work/T-068-01-02/` | RDSPI artifacts (research, design, structure, plan, progress, this review). |

No files created or deleted in `src/`. No new exports. Purity of `budget.ts` preserved (reads an
in-module frozen constant; no new imports).

## Why it's correct

- **Reads the single source of truth.** The weights come from `COST_WEIGHTS`, not inline
  literals — exactly what S-068-01's DAG built (T-068-01-01 alone first, consumers share the
  vector). A future silent revert to parity is caught by the `output:1000 → 5000` guard test.
- **AC #1 satisfied, verbatim:** `countTokens({cache_read_input_tokens:1000}) === 100` ✓; the
  E-008 four buckets recompute to **236,073** cost units (not 525,180 parity), asserted `< 400k`
  ("a sane ceiling") ✓; `budget.test.ts` updated and green ✓.
- **Integer contract preserved.** `Math.round` keeps every downstream balance/ledger figure
  whole; the canonical `cache_read` case is exact (100.0).

## Test coverage

- **Owned (`budget.test.ts`, the gate for `check:test`):** every `countTokens` branch (each
  bucket present, empty, non-finite coercion); the weighting itself (per-bucket weight applied);
  the AC literal; the E-008 recompute (headline proof number); `check`'s ok/boundary/exhausted
  branches under new magnitudes. `COST_WEIGHTS`/`timeoutMsFor`/invalid-ceiling suites unchanged.
- **Collateral (`wallet.test.ts`):** the two cost fixtures corrected; all `Budget`-actual wallet
  cases are unaffected (they bypass `countTokens`).
- **Gate:** `bun run check` (baml:gen + `tsc --noEmit` + full suite) → **1584 pass / 1 skip /
  0 fail**, deterministic across re-runs. No separate `lint` script exists in this repo.
- **Gap:** none for this ticket's unit surface. No integration/live test — deliberate: the
  recompute is pure and free (buckets → number); the epic's live metered decompose is deferred,
  authorized at the counter (S-068-01 honest boundary). Nothing here spends a token.

## Open concerns / flags for the reviewer

1. **Ceilings still parity-denominated after this ticket alone (expected).** `countTokens` now
   returns cost units, but `recalibrate.ts`'s `FUNDING_*_TOKENS` band and `gather.ts`'s
   `TIER_BUDGET` priors are still parity-magnitude — their re-denomination is **T-068-01-04**.
   Until that lands and merges, a ceiling compares a cost-unit `spent` against a parity-unit
   ceiling. This is the story's designed fan-out; it closes as a whole, not per-ticket. No
   action needed on this ticket, but the sweep should confirm all three S-068-01 consumers
   landed before the story is called done.
2. **cache_creation for E-008 is derived, not independently recorded.** The field report cites
   input/output/cache_read and the 525,180 total; cache_creation (57,490) is computed to close
   that total. Documented in the fixture comment. If a canonical boilerplate-demo `runs.jsonl`
   line later surfaces with a different split, the recompute number moves — but the *method*
   (cost-weighted sum) and the parity baseline (525,180) are unaffected.
3. **Concurrent-branch commit interleaving (process note, not a code concern).** T-068-01-02 and
   T-068-01-03 ran on the same branch simultaneously; Lisa's commit serialization swept this
   ticket's staged files into sibling commits rather than a single self-titled T-068-01-02
   commit. All content is in the committed tree and the gate is green; the per-commit attribution
   is blurred by the concurrency model (CLAUDE.md: file-locking serialization, agents don't
   coordinate). Flagged so a reviewer reading `git log` isn't surprised that the countTokens
   change rides under a T-068-01-03 commit header. A transient full-suite `walk-away` test flake
   observed mid-run traced to the sibling actively editing `run-log.ts#totalTokens`, not to this
   change (walk-away reads `totalTokens`, which this ticket does not touch); it resolved once the
   sibling settled.

## Handoff verdict

Ready. AC met and unit-proven; gate green on the committed tree (including the sibling's
`totalTokens` change). The only cross-ticket coupling — parity ceilings vs cost `spent` — is
S-068-01's T-068-01-04, not a defect in this slice.
