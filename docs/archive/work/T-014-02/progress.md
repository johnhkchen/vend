# T-014-02 — Progress

*What landed, against plan.md. Deviations noted with rationale.*

## Status: implementation complete, `bun run check` green.

| Step | Plan | Status |
|---|---|---|
| 1 | `skipGates` option + guard on `castPlay` | ✅ done |
| 2 | Thread `--no-gates` through dispatch + CLI; update `cli.test.ts` | ✅ done |
| 3 | Pure variance core (`src/probe/variance.ts`) | ✅ done |
| 4 | Unit tests (`src/probe/variance.test.ts`) | ✅ done |
| 5 | Sweep harness (`src/probe/run-probe.ts`) | ✅ done |
| 6 | Final gate + progress | ✅ done (this file) |

## What changed

- **`src/engine/cast.ts`** — `CastOptions.skipGates?: boolean`; the one gate call guarded
  `gateVerdict = opts.skipGates ? null : play.gates(output, ctx)`, plus an honest
  `· gates skipped (--no-gates)` stdout line. A null `gateVerdict` already flows through
  `classify` as success → materialize, so no downstream branch was needed. Gated path
  unchanged when the flag is absent.
- **`src/play/decompose-epic.ts`** — `RunOptions.skipGates?`; `assembleAndCast` forwards it
  into `castPlay`'s `CastOptions`.
- **`src/cli.ts`** — `run` `ParsedCommand` carries optional `skipGates`; `parseRunArgs`
  detects `--no-gates` (presence flag, order-independent vs `--budget`, spread only when
  present); `USAGE` updated; the run dispatch arm forwards `skipGates`.
- **`src/cli.test.ts`** — three parse tests: `--no-gates` ⇒ `skipGates:true`, order-independent,
  and absence ⇒ no `skipGates` key (gated default shape preserved).
- **`src/probe/variance.ts`** (new, PURE) — `lineSet`, `lineJaccardDistance`, `dispersion`,
  `varianceReduction`, `formatVarianceReport` + the `PairDiff`/`SetDispersion`/`VarianceReport`
  types. Mean pairwise line-set Jaccard distance; reduction ratio with a divide-by-zero guard;
  censored counts surfaced.
- **`src/probe/variance.test.ts`** (new) — 68 assertions across the metric, dispersion, the
  reduction edge cases (identical, zero-baseline, negative, censoring), and the formatter
  caveats.
- **`src/probe/run-probe.ts`** (new, IMPURE, `import.meta.main`) — the sweep instrument:
  seeds a disposable temp project (fixed epic + real charter), casts 5× gated and 5× ungated
  clearing the board between runs (collision-safe), redirects the ledger into the temp root
  (no live-ledger pollution), collects each run's materialized output, and prints
  `formatVarianceReport`. Not unit-tested (house rule for impure verbs).

## Verification

- `bun run check:typecheck` — clean.
- `bun test src/probe/variance.test.ts src/cli.test.ts` — 68 pass, 0 fail.
- `bun test` (full suite, combined with the concurrent T-014-01 thread) — **467 pass, 0 fail**.

## Deviations from plan

- **`vend run --no-gates` wired (not just the probe).** Plan/Design D2 chose to expose the
  run mode on `vend run` as the literal reading of AC#1 ("a run mode"). The probe still drives
  `castPlay` directly (it needs ledger + output-root redirection the public path does not
  expose). No deviation in substance — both reuse the single `skipGates` option.
- **Harness drives `castPlay` directly, not `assembleAndCast`.** As designed (D4): the probe
  needs `runLogPath` redirection (avoid polluting `.vend/runs.jsonl`) and a per-run cleared
  board, neither of which `assembleAndCast`/`vend run` expose. It composes the exported
  `assembleInputs` + `castPlay` + `decomposeEpicPlay` — the whole real pipeline, no new
  orchestration.

## Concurrency note (read before reviewing the diff)

T-014-01 (the E1 trust arm) runs **in parallel** on the same branch and shares three files —
`src/engine/cast.ts`, `src/play/decompose-epic.ts`, `src/cli.ts`. Both arms' additive edits
coexist (its `intervened`/`audit`; this arm's `skipGates`), and the combined tree is green.
The shared files therefore carry both arms' changes; commit serialization is the loop's job
(file-locked, per rdspi-workflow.md "Concurrency"). The variance probe (`src/probe/`) is this
arm's alone.

## Not done here (correctly out of scope)

- The **live 5×2 run** is the human step at sweep (AC#3) — not run in CI (it spawns `claude`).
- The **findings note + go/reroute** read is **T-014-03** (consumes this number + E1's).
