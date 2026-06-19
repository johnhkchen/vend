# T-013-02 — Progress

*What was implemented, against the plan. Deviations and their rationale.*

## Status: implementation complete, all gates green

| Step | State | Notes |
|------|-------|-------|
| 1 — `recalibrate.ts` constants/types/`percentile` | ✅ | nearest-rank ceil, `positiveInt` helper |
| 2 — `recalibrate` + `formatEnvelopeLabel` | ✅ | per §Algorithm, no deviation |
| 3 — `recalibrate.test.ts` | ✅ | 21 tests, every AC branch |
| 4 — `cli.ts` envelope command | ✅ | parse arm + dispatch arm + USAGE line |
| 5 — `cli.test.ts` parse coverage | ✅ | 4 tests |
| 6 — gates + smoke | ✅ | typecheck clean, 383 tests pass, live smoke confirmed |

## Files

- **created** `src/ledger/recalibrate.ts` — the pure core. `TIER_PERCENTILE`
  (keystone .95 / high .92 / standard .90 / leaf .75), `COLD_START_MIN_SUCCESSES = 3`,
  `DEFAULT_WINDOW = 100`, `percentile`, `recalibrate`, `formatEnvelopeLabel`. Type-only
  imports of `Budget`/`ValueTier`; pure-helper imports (`forPlay`/`totalTokens`/
  `wallClockMs`) from `run-log.ts`. The zero-coupling discipline holds — the Ledger is
  the consumer where run-log ⊥ budget meet, and nothing imports it back.
- **created** `src/ledger/recalibrate.test.ts` — 21 fixtured tests (the AC #3 gate).
- **modified** `src/cli.ts` — `envelope` `ParsedCommand` arm, `parseEnvelopeArgs`, the
  `parseArgs` route, `VALUE_TIERS` + `ValueTier` type import, USAGE line, the lazy
  read-only dispatch arm (loadRunLog → recalibrate → print, always exit 0).
- **modified** `src/cli.test.ts` — 4 envelope parse tests.

## Gates

- `bun run check:typecheck` — clean.
- `bun test` — **383 pass / 0 fail** (was 358; +21 recalibrate, +4 cli).

## Live smoke (against the real `.vend/runs.jsonl`, 10 records)

```
$ vend envelope decompose-epic
decompose-epic [standard]: 227464 tokens / 130316 ms — measured · 3 casts · p90 · 2 andon'd
$ vend envelope decompose-epic --tier keystone
decompose-epic [keystone]: 227464 tokens / 130316 ms — measured · 3 casts · p95 · 2 andon'd
$ vend envelope no-such-play
no-such-play [standard]: 25000 tokens / 3600000 ms — estimate (no data)
$ vend envelope            # → "missing <play>" + usage, exit 2
```

Verified by hand against the log: decompose-epic has 3 `success` records (token totals
`{73523, 78341, 227464}`), 1 `budget-exhausted` + 1 `timed-out` (the 2 censored), and 1
`gate-failed` (correctly counted in **neither**). p90 of the success totals = the 227464
rank — the censored runs' costs never inflated it. The cold-start path returns the
standard tier prior (1h/25k) labelled "estimate (no data)".

## Deviations from the plan

**None of substance.** Two clarifications worth recording:

1. **`high` tier percentile fixed at p92** (Risk R2 in the plan): placed between keystone
   (p95) and standard (p90), documented inline as an interpolation of IA-12's andon-budget
   ladder. The ticket names three tiers; the board carries four. Not load-bearing —
   `--tier` defaults to `standard`.
2. **The surface is read-only** (Design §E): `vend envelope` *displays* the measured
   default; it does **not** actuate it into the press/dispatch budget. That actuation
   (deadband + asymmetric hysteresis) is IA-14, a later rung — and the ticket explicitly
   scopes this slice to "reads the andon rate into confidence; it does not yet auto-tune
   or act on it." Wiring measured envelopes into the live dispatch path is deferred to the
   Confirm-screen / IA-14 work.

## Not committed

Per the loop convention, the source is left uncommitted for the `on-clear` step to land
atomically once the RDSPI cycle (through Review) completes — no mid-cycle commit that
could race it.
