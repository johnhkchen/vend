# T-019-01 — Progress: generalize the consistency probe

## Status: implementation complete, gate green

All plan steps executed. `bun run check` green (586 pass, 0 fail — was 576 + 10 new core tests).
`run-probe.ts` byte-for-byte unchanged (AC#3 verified via `git diff --stat`).

## Step-by-step

| Step | What | State |
|---|---|---|
| 1 | `src/probe/consistency.ts` — pure core (variance + outcome mix) | ✅ done, `tsc` clean |
| 2 | `src/probe/consistency.test.ts` — 10 cases, the 3 AC fixtures | ✅ 10/10 pass |
| 3 | `src/probe/run-consistency-probe.ts` — any-play sweep harness | ✅ done, `tsc` clean |
| 4 | Live smoke + AC#3 guard | ⚠ partial — see "deviations" |
| 5 | Final gate + progress/review | ✅ `bun run check` green |

## What was built

- **Pure core** `consistency.ts`: `ProbeOutcome` (signal / honest-empty / budget-exhausted),
  `ProbeResult`, `OutcomeMix` (counts + rates), `ConsistencyReport`; `outcomeMix`,
  `consistencyReport` (disperses the **signal arm only**, reusing `variance.ts`'s `dispersion`),
  `formatConsistencyReport` (one honest line, caveats a too-small signal arm). No fs/clock/addon.
- **Pure test** `consistency.test.ts`: the three AC fixtures (all-same → 0 variance; mixed
  outcomes counted; honest-empty rate computed) plus edges (empty input ⇒ no NaN; signal-only
  dispersion unperturbed by honest-empty/budget-exhausted; null-output signal dropped from
  dispersion but counted; `n < 2` caveat).
- **Impure harness** `run-consistency-probe.ts`: `ProbeTarget` table (first cut **decompose-epic
  + survey** — the two ends of the honest-empty polarity), temp-ledger isolation copied from
  run-probe (no import — AC#3), `classifyRun`, `castN` (clears output dirs per cast; threads the
  run log into the temp ledger; keeps a raw `RunOutcome` tally beside the probe outcomes), and a
  CLI `<play-name> [input.md] [N] [tokenBudget]` with arg validation.

## Verifications run

- `npx tsc --noEmit` — clean after both new modules.
- `bun test src/probe/consistency.test.ts` — 10/10.
- `bun run check` — 586 pass, 0 fail, typecheck clean.
- CLI guards: no-args / unsupported play / decompose-without-epic all print usage and exit 2.
- `git diff --stat -- src/probe/run-probe.ts` — empty (AC#3).
- `lisa init` in a fresh `mkdtemp` — produces the expected structure (CLAUDE.md, `.lisa`,
  `docs/active/{stories,tickets,work}`), proving the seeding half of the harness.

## Deviations from plan

- **Step 4 live N×sweep deferred to T-019-02** (the sweep ticket). A full cast invokes the real
  `claude` model (tokens + minutes per cast × N); per the run-probe house rule the impure verb is
  proven live AT SWEEP, not in this implementation pass. The seeding + dispatch wiring is verified
  by typecheck, the `lisa init` smoke, the CLI-guard smokes, and reasoning against the proven
  run-probe path it mirrors. `lisa` and `claude` are both present on PATH, so T-019-02 can run it.
- **Decompose `subject` derived from the epic basename** rather than `epicIdOf` (which needs the
  epic text and a sync callback): the run-log subject is cosmetic for the probe, and `epicIdOf`
  itself falls back to the basename. Documented inline.

## Commits

Left to Lisa / the loop (working on `main`; not committing from this session per session policy —
the artifacts and code are on disk for Lisa to detect and commit).
