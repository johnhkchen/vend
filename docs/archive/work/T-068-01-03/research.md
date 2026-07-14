# T-068-01-03 — Research

**Ticket:** cost-weight-total-tokens · **Story:** S-068-01 (price-true-cost-units) · **Epic:** E-068 (price-true-budget-units)

## Why this slice exists (from the story)

The story owns the whole token-accounting seam: budget.ts `countTokens` (the canonical
cost-weighted sum + the weight vector) and run-log.ts `totalTokens` (a *deliberate inline
mirror* of that sum). This ticket is the run-log leg. Its sibling T-068-01-02 cost-weights
`countTokens`; T-068-01-04 re-denominates the fixed ceilings. The three consumers fan out on
**disjoint files** once the weight vector (T-068-01-01, DONE) is pinned — so this ticket must
stay inside `src/log/run-log.ts` + `src/log/run-log.test.ts` and touch nothing else.

The core defect (epic): `totalTokens` (like `countTokens`) sums the four token buckets at
**parity**. On a grown board cache reads dominate the sum but cost ~a tenth of a fresh input
token, so a bigger board's meter inflates past any fixed ceiling while true dollar cost barely
moves. boilerplate-demo's failed E-008 decompose: `cache_read=443,711` vs `input=14 +
output=23,965`, `cache_creation=57,490`, summing to **525,180 parity units** — ~84% of that is
cheap cached context. Making `totalTokens` cost-weighted makes the meter measure cost.

## The target function

`src/log/run-log.ts:543-551` — `totalTokens(r: RunRecord): number`:

```ts
export function totalTokens(r: RunRecord): number {
  const u = r.usage;
  return u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
}
```

Its docstring already states the contract: *"the same definition as budget's `countTokens` (the
single notion of 'spent'); it is inlined here rather than imported to preserve run-log's
zero-coupling invariant."* That inline-mirror decision is load-bearing and pre-existing — this
ticket keeps the mirror, it just changes what both sides compute (parity → cost).

## The zero-coupling invariant (the hard constraint)

`run-log.ts` header (lines 19-24) and the `Envelope`/`UsageInput` local re-declarations exist so
run-log imports **NOTHING** from `src/budget/` or `src/executor/`. `NormalizedUsage`
(lines 77-82) guarantees every sub-count is a finite number before `totalTokens` ever runs, so
the weighting math needs no re-coercion. The canonical weight vector `COST_WEIGHTS`
(`budget.ts:146-151`, frozen `{input:1.0, cache_read:0.1, cache_creation:1.25, output:5.0}`,
T-068-01-01) is the single source — but importing it would break the invariant. The house
pattern is therefore **deliberate inline duplication**: run-log carries its own copy of the
weights, exactly as recalibrate.ts (line 364 comment) "inlines `totalTokens` rather than
coupling." Drift risk is accepted by the codebase in exchange for the decoupling.

## The COST_WEIGHTS vector (T-068-01-01, confirmed)

`budget.ts:116-151`. Priced relative to a fresh input token (numeraire 1.0), Opus 4.8 basis,
model-invariant across the current lineup:
- `input` 1.0 · `cache_read` 0.1 (0.1× read multiplier) · `cache_creation` 1.25 (1.25× write
  multiplier at default TTL) · `output` 5.0 (lineup-wide 1:5 input:output).

budget.test.ts:50-79 already pins these (`COST_WEIGHTS` guard test) — so the run-log inline copy
must match those literals byte-for-byte or the two mirrors silently diverge.

## Consumers of `totalTokens` (all recompute for free — no edits)

`grep totalTokens`:
- `recalibrate.ts:152` — `successes.map(totalTokens).sort(...)` → `percentile(...)` is the
  **token envelope**. `recalibrate()` (lines 124-164) returns this raw percentile with **no
  clamp** (the FUNDING_FLOOR/CEILING band is only applied later in `fundingEnvelope`,
  lines 279+, which T-068-01-04 owns). So once `totalTokens` is cost-weighted, `recalibrate`'s
  p90 token envelope is automatically cost-denominated, over the *existing* runs.jsonl records,
  **with no history re-run** — this is the ticket's second AC clause, provable via `recalibrate`
  without touching recalibrate.ts.
- `recalibrate.ts:313,494` — censored lower bounds + funding ratios: recompute for free.
- `walk-away.ts:183` — `totalTokens(r) / r.envelope.tokens` ratio: recomputes for free.
- `spend.ts:142` — ledger-sourced token spend: recomputes for free.

None of these are edited by this ticket (story: "recalibrate/walk-away/spend/wallet are NOT
edited — they read `totalTokens`/`countTokens` and recompute for free").

## The read/write faces are untouched

`totalTokens` is a *derivation* over an already-normalized `RunRecord.usage`. The write face
(`buildRunRecord`/`normalizeUsage`) and read face (`reviveRecord`/`readRuns`) store the four raw
buckets unchanged — buckets are **read, never mutated** (story out-of-slice: "rewriting
historical runs.jsonl"). So no schema-version bump, no back-compat surface: every existing
record recomputes to a new cost figure purely by the changed derivation. `RUN_LOG_SCHEMA_VERSION`
stays 1.

## Test surface

`run-log.test.ts:590-615` — `describe("derivations — wallClockMs and totalTokens")`. The one
existing `totalTokens` assertion (line 612-614) asserts the **parity sum** `100+50+1000+20` and
**will break** — it must be updated to the cost-weighted expectation. This is the single
red-going-in test. All other tests exercise build/serialize/revive/forPlay and are agnostic to
the derivation, so they stay green (AC: "run-log.test.ts stays green").

## Constraints / assumptions surfaced

1. **Must not import budget.ts** — inline the weight literals; matching budget's `COST_WEIGHTS`
   is a convention pinned by test, not by a shared symbol.
2. **Order-independence** — this ticket depends only on T-068-01-01 (DONE), and runs in parallel
   with T-068-01-02 (countTokens) and T-068-01-04 (constants). Nothing here may assume
   `countTokens` is already cost-weighted, and nothing may assert against FUNDING_FLOOR/CEILING
   (those move under 04). Proving the recalibrate clause must use `recalibrate()` (unclamped),
   never `fundingEnvelope()`.
3. **Fractional results** — cost weights are fractional (0.1, 1.25, 5.0), so `totalTokens` can
   now return a non-integer. Consumers already tolerate this: `recalibrate.positiveInt` does
   `Math.ceil`; ratios divide. No integer contract on `totalTokens` exists to violate.
4. **`NormalizedUsage` guarantees finite inputs** — no NaN can enter the weighting.
