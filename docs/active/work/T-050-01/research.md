# T-050-01 — Research: pure funding-headroom core

Descriptive map of the code this ticket extends. No solutions here — those land in `design.md`.

## The gap, stated precisely

Two distinct numbers are conflated today:

- **The price** — the value-tier percentile (`recalibrate`) over a play's SUCCESSFUL runs. What
  the shelf QUOTES, what affordability reads. Must stay an honest p90 (IA-8).
- **The envelope a run is FUNDED under** — the budget guard the cast actually runs with. Today
  this is just the price handed straight back, so an under-bounding prior censors the run, the
  censored run contributes nothing to the percentile, and the next run is funded at the same thin
  guess → the **censoring ratchet** (named verbatim in `budget.ts:82-94` and `recalibrate.ts:14-16`).

`budget.ts` already broke this ratchet for the **wall-clock kill-switch** via `TIMEOUT_HEADROOM`
(`timeoutMsFor = price × 2`). The token dimension has **no analogous guard** — this ticket adds the
pure core for it, and unifies both dimensions under one measurement-funding function.

## Key files & coordinates (confirmed by read, not grep)

### `src/ledger/recalibrate.ts` — the module to EXTEND (the funding fn lives beside `recalibrate`)
- `recalibrate(play, records, tier, prior, opts) → RecalibrateResult` — `:124`. Windows `forPlay`
  to the last `window`, bounds tokens & wall-clock INDEPENDENTLY at `TIER_PERCENTILE[tier]` over
  successes; censored runs counted not averaged; cold-start (`< minSuccesses`) returns the prior.
- `RecalibrateResult` — `:76`: `{ envelope: Budget; confidence: Confidence; source: "measured" | "prior" }`.
- `Confidence` — `:64`: `{ successes; censored; percentile }`. **Both counts are already windowed**,
  so the censored RATE is derivable from `result.confidence` with no recomputation.
- `CENSORED_OUTCOMES` — `:60`: `["budget-exhausted", "timed-out"]` (module-private, reusable here).
- `COLD_START_MIN_SUCCESSES` — `:48` = 3; `DEFAULT_WINDOW` — `:53` = 100.
- `positiveInt(n)` — `:94`: `Math.max(1, Math.ceil(n))` — the budget-dimension coercion to reuse.
- `percentile`, `learnBiasFactor`, `calibrate`, `formatEnvelopeLabel`, `formatCorrectionLabel` —
  the rest of the module; **none of these may change** (AC: don't touch percentile math / label).
- The IA-14 deferral comment (`:14-16`): "READS that rate into the confidence; it does not yet
  ACTUATE on it (IA-14 — auto-widen … a later rung)." **This ticket actuates exactly that.**
- Imports already present: `forPlay`, `totalTokens`, `wallClockMs`, `RunRecord`, `RunOutcome`
  from run-log; type-only `Budget`, `ValueTier`. Everything `fundingEnvelope` needs is in scope.

### `src/budget/budget.ts` — the GUARD-≠-PRICE pattern to MIRROR (read-only reference)
- `Budget` — `:17`: `{ timeMs: number; tokens: number }` — positive-int dimensions.
- `TIMEOUT_HEADROOM = 2` — `:95`. The headroom the wall-clock kill-switch gets ABOVE the price.
  Its doc comment IS the rationale for this whole ticket: the censoring ratchet, why raising the
  percentile can't fix it, why headroom lets a heavy cast finish and land a SUCCESS.
- `timeoutMsFor(budget) → ceil(timeMs × TIMEOUT_HEADROOM)` — `:106`. The shape to mirror onto
  tokens: "per-cast runaway-guard, NOT the price." The ticket says mirror this with a LOCAL
  `MEASUREMENT_HEADROOM` const, NOT by importing `timeoutMsFor` (keep the type-only `budget` import).
- `check`/`countTokens` — the token-ceiling enforcement; `BUDGET_EXHAUSTED` andon code. Not changed.

### `src/log/run-log.ts` — the record helpers (read-only, already imported by recalibrate)
- `totalTokens(r)` — `:509`: sum of the four usage sub-counts. The censored run's logged actual.
- `wallClockMs(r)` — `:497`: `endedAt − startedAt`, or `null` if a stamp is unparseable.
- `forPlay(records, play, opts?)` — `:479`: filter to a play (and optionally outcome/project).
- `RunOutcome` — `:54`; `CENSORED_OUTCOMES` are a subset (`budget-exhausted`, `timed-out`).
- **The load-bearing fact:** a censored run STILL logs its usage. `totalTokens` over a
  `budget-exhausted` record returns the real magnitude burned before the wall (E-049 decompose:
  ~265k before a 120k ceiling). That magnitude is a strong LOWER BOUND on true cost, currently
  discarded by `recalibrate` (it's right-censored OUT of the percentile sample, correctly — but
  nothing reads it back as a funding floor).

### `src/ledger/recalibrate.test.ts` — the test patterns to extend
- `recordOf({ tokens, durationMs, outcome, play, ...rest })` — `:26`: builds a real frozen
  `RunRecord` via `buildRunRecord`; `tokens` → `input_tokens`, `durationMs` → `endedAt − startedAt`.
- `PRIOR: Budget = { timeMs: 999, tokens: 888 }` — `:45`.
- Censored fixtures: `recordOf({ tokens: 999_999, outcome: "budget-exhausted" })` (`:94`).
- The suite is pure (no fs/clock/spawn); new `fundingEnvelope` tests slot in the same way.

## Constraints & invariants (from the code, the ticket, and the charter)

1. **PURE / TOTAL.** Plain values in, fresh `Budget` out. No fs, clock, network, process. Must not
   throw on empty/degenerate input (mirrors `recalibrate`'s totality). House pattern, module-wide.
2. **Guard ≠ price (IA-8, P7).** Must NOT mutate `recalibrate`'s returned `envelope`, the percentile
   math, or `formatEnvelopeLabel`. The quoted estimate stays the honest p90. The headroom is a
   bounded (finite, ≥2) runaway-tolerant FUNDING guard, exactly as `TIMEOUT_HEADROOM` is.
3. **Per dimension, independently.** Tokens and wall-clock each get their own `max(priced, …)`
   (as `recalibrate` and `learnBiasFactor` both do). Wall-clock can be `null` per record.
4. **Window consistency.** `result.confidence` counts are windowed at `recalibrate`'s `window`; any
   re-windowing of censored records here must use the SAME window so the rate and the magnitudes agree.
5. **Reuse, don't re-import.** `positiveInt`, `CENSORED_OUTCOMES`, `forPlay/totalTokens/wallClockMs`
   are all in-module or already-imported. Add a LOCAL `MEASUREMENT_HEADROOM` mirroring `TIMEOUT_HEADROOM`;
   do NOT import `timeoutMsFor` (keeps the type-only `budget` import discipline).
6. **Back-compat.** A well-calibrated play (measured source, low censored rate) must be UNCHANGED:
   funding == priced, `widened: false`.

## Open questions carried into Design
- Signature: `fundingEnvelope(play, records, result, opts?)` vs threading records through
  `RecalibrateResult`. (Ticket leaves this to design.)
- Is "under-calibrated" a scalar gate (shared `source`/rate) or per-dimension? (`source` and the
  confidence counts are scalar; only the `max` is per-dimension — design must state this.)
- Shape/semantics of `widened` (single bool vs per-dim) and the exact `CENSORED_WIDEN_RATE` value.
