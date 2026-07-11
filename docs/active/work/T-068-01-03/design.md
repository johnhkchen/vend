# T-068-01-03 — Design

## The decision

Replace `totalTokens`' parity sum with a **cost-weighted sum** over the four buckets, using an
**inline weight vector local to run-log.ts** (a deliberate mirror of budget's `COST_WEIGHTS`),
preserving the run-log ⊥ budget zero-coupling invariant. Update the one parity assertion in
run-log.test.ts to the cost-weighted expectation, and add tests that (a) prove the cache-dominated
fixture recomputes to a cost figure and (b) prove `recalibrate` returns cost-denominated p90
envelopes over historical records with no re-run.

## Options considered

### A. Import `COST_WEIGHTS` from budget.ts (rejected)

Directly reuse the single source: `import { COST_WEIGHTS } from "../budget/budget.ts"`. Zero
drift risk — one vector, one definition.

**Rejected:** violates the module's central invariant. run-log.ts's entire header (lines 19-24)
and its local re-declarations of `UsageInput`/`Envelope` exist precisely so it imports nothing
from `src/budget/`. `totalTokens`' own docstring commits to the inline-not-import choice, and
recalibrate.ts (line 364) documents the same "no-shared-util idiom." Importing here would be a
regression of a settled architectural decision (E-001 AC #4, the honest DAG edge), and the story
explicitly frames this ticket as the *inline* mirror. The DAG's disjoint-files/zero-coupling
claim depends on run-log not reaching into budget.

### B. Inline a local weight vector, weight the sum (CHOSEN)

Add a module-private `const COST_WEIGHTS` (or equivalently named local) in run-log.ts carrying
the same frozen `{input:1.0, cache_read:0.1, cache_creation:1.25, output:5.0}`, documented as a
deliberate mirror of budget's vector with a pointer to the zero-coupling rationale, and rewrite
`totalTokens` as `input·w.input + output·w.output + cache_read·w.cache_read +
cache_creation·w.cache_creation`.

**Chosen:** it is the exact pattern the codebase already sanctions (inline `totalTokens` mirrors
inline `countTokens`; now both carry inline weights). Keeps run-log a pure leaf. Drift risk is
mitigated by a test that pins the same literals budget.test.ts pins — a silent divergence fails
one side's guard.

**Naming:** mirror budget's name (`COST_WEIGHTS`) so the parallel is greppable and obvious to a
future reader diffing the two mirrors. Keep it **module-private** (not exported) — run-log's
public surface is its record API; the weights are an implementation detail of the derivation,
exactly as the private `num` helper is. Freeze it (`Object.freeze`) to match budget's frozen
singleton and the module's immutability posture.

### C. Weight inline without a named vector (rejected)

Bury the literals directly in the `totalTokens` expression:
`u.input_tokens*1.0 + u.output_tokens*5.0 + ...`.

**Rejected:** magic numbers with no cited basis, no single place a reader (or a drift-guard test)
can point at, and no structural parallel to budget's named `COST_WEIGHTS`. The whole E-068 story
is that these four numbers are a *confirmed pricing vector* with a rationale — they deserve a
named, commented home on both sides of the mirror.

## Proving the `recalibrate` AC clause (design of the test, not the code)

The AC's second half — "recalibrate over historical records returns cost-denominated p90
envelopes with no history re-run (unit test)" — needs a proof that doesn't collide with
T-068-01-04 (which edits recalibrate.ts's FUNDING constants) or T-068-01-02 (countTokens).

**Approach:** import the **real `recalibrate()`** (read-only import from recalibrate.ts — reading
a module is not modifying it, no file overlap) into run-log.test.ts and drive it over a fixture
of cache-dominated `success` records. `recalibrate()`'s token dimension is
`positiveInt(percentile(successes.map(totalTokens).sort, p))` — it reads the *existing* records,
never re-executes anything ("no history re-run" is inherent). Assert:
- the returned `envelope.tokens` equals `Math.ceil` of the hand-computed cost-weighted p90, and
- it is **strictly less than** the parity p90 of the same records (the cost reweight bit).

This is faithful (it exercises the actual recalibrate path, the real consumer) and
**order-independent**:
- `recalibrate()` uses `totalTokens` (which I change) — never `countTokens` — so T-068-01-02's
  ordering is irrelevant.
- `recalibrate()` returns the **raw percentile, unclamped**; the FUNDING_FLOOR/CEILING band lives
  only in `fundingEnvelope()`, which this test never calls — so T-068-01-04's constant changes
  cannot break it. Fixture magnitudes are chosen so the point stands regardless of any band.

Rejected alternative: re-implement recalibrate's percentile inline in the test. Less faithful
("recalibrate returns…" would really be "my re-implementation returns…") and duplicative. The
read-only import of the genuine function is the honest proof and carries no coupling risk.

## Fixture choice

Use boilerplate-demo's recorded E-008 buckets as the cache-dominated fixture
(`input=14, output=23,965, cache_read=443,711, cache_creation=57,490`), matching the epic/story
narrative (parity 525,180). Cost-weighted:
`14·1 + 23,965·5 + 443,711·0.1 + 57,490·1.25 = 14 + 119,825 + 44,371.1 + 71,862.5 = 236,072.6`.
So the same record recomputes from **525,180 parity → ~236,073 cost** — measurably smaller and
"fits a saner ceiling," proving the reweight from real logged buckets. The test computes the
expectation from the weight literals (self-checking), not a frozen magic number.

## What stays untouched (non-goals honored)

- Buckets are read, never mutated; no schema bump (`RUN_LOG_SCHEMA_VERSION` stays 1); write/read
  faces unchanged.
- No consumer edited (recalibrate/walk-away/spend/wallet recompute for free).
- No import added from `src/budget/` or `src/executor/`.
- `check`/`countTokens`/the ceilings are other tickets' files — not touched here.

## Risk / mitigation

- **Drift between the two inline vectors** → a run-log.test.ts guard test pins the same literals
  budget.test.ts pins; either side drifting fails its own guard.
- **A fractional `totalTokens`** → verified no integer contract on `totalTokens` exists;
  consumers `Math.ceil`/divide. Documented in the docstring.
