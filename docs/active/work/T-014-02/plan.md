# T-014-02 — Plan

*Ordered, independently-verifiable steps. Each is small enough to commit atomically. Testing
strategy is named per step.*

## Testing strategy (overview)

- **Pure core (`variance.ts`)** — exhaustive `bun test` over fabricated fixture strings: the
  distance metric, dispersion, the reduction ratio, censoring counts, and every total-over
  edge case. This is AC#3's unit-tested deliverable.
- **CLI parse (`cli.test.ts`)** — pure parse tests for `--no-gates` present/absent.
- **`skipGates` mechanism / harness** — **not** unit-tested (house rule: impure verbs;
  `castPlay` and the harness are proven live). The live 5×2 run is the human sweep step
  (AC#3). Verification of the gated-path-unchanged claim is by inspection (one guarded line)
  + the full suite staying green (AC#4).
- **Gate:** `bun run check` (`baml:gen → typecheck → test`) green after each code step;
  `check:committed` / `check:head` satisfied by committing.

---

## Step 1 — `skipGates` option + guard on `castPlay`

`src/engine/cast.ts`: add `readonly skipGates?: boolean` to `CastOptions` (doc per
structure.md). In the gate block, change `gateVerdict = play.gates(output, ctx)` to
`gateVerdict = opts.skipGates ? null : play.gates(output, ctx)`. Add the honest
`· gates skipped (--no-gates)` stdout line when skipping.

**Verify:** `bun run check:typecheck` clean; `bun test` still green (no behaviour change when
flag absent — the guarded path is identical). Commit: *"Add --no-gates skip to castPlay (E-014 E2 enabler)"*.

## Step 2 — Thread the run mode through dispatch + CLI

- `src/play/decompose-epic.ts`: `RunOptions += skipGates?`; `assembleAndCast` passes
  `skipGates: opts.skipGates` into the `castPlay` options.
- `src/cli.ts`: `ParsedCommand` `run` += `skipGates?`; `parseRunArgs` detects `--no-gates`
  (presence flag, order-independent vs `--budget`), spreads `skipGates:true` only when
  present; `USAGE` gains `[--no-gates]`; the run dispatch arm passes `skipGates`.
- `src/cli.test.ts`: add
  - `run … --budget … --no-gates` ⇒ object **with** `skipGates: true`;
  - `--no-gates` before `--budget` also ⇒ `skipGates: true` (order-independence);
  - existing happy-path (no flag) ⇒ object **without** a `skipGates` key (the spread idiom
    keeps current `toEqual` assertions valid).

**Verify:** `bun run check` green (new + existing parse tests pass; threading typechecks).
Commit: *"Wire `vend run --no-gates` through dispatch (E-014 E2 run mode)"*.

## Step 3 — The pure variance core

`src/probe/variance.ts` per structure.md: `lineSet`, `lineJaccardDistance`, `dispersion`
(+ internal `meanPairwise`), `varianceReduction`, `formatVarianceReport`, and the
`PairDiff` / `SetDispersion` / `VarianceReport` types. Pure; no imports.

Decisions baked in:
- `lineJaccardDistance`: both line sets empty ⇒ `0`; else `1 − |∩|/|∪|`.
- `dispersion`: `n < 2 ⇒ { n, dispersion: 0, pairs: [] }`.
- `varianceReduction`: partition `null`s into `censored*`; `reduction =
  ungated.dispersion === 0 ? 0 : (ungated.dispersion − gated.dispersion) / ungated.dispersion`.
- `formatVarianceReport`: `gate-driven variance reduction: NN% (ungated dispersion U over A ·
  gated G over B[, K censored])` with a `— but K/total gated censored` caveat when censoring
  is material.

**Verify:** `bun run check:typecheck` clean. Commit with Step 4 (core + its tests together).

## Step 4 — Unit tests for the variance core

`src/probe/variance.test.ts` (`bun test`, pure). Cases:
1. `lineJaccardDistance`: identical strings ⇒ 0; disjoint ⇒ 1; half-shared ⇒ expected ratio;
   blank-line / trailing-whitespace normalization; both-empty ⇒ 0.
2. `dispersion`: `n=0`/`n=1` ⇒ 0, `pairs:[]`; three identical ⇒ 0; known mixed set ⇒ the
   hand-computed mean; `pairs` length == C(n,2).
3. `varianceReduction`:
   - ungated varied, gated identical ⇒ `reduction === 1`, `censored* === 0`.
   - both identical ⇒ `reduction === 0`.
   - ungated dispersion 0 ⇒ `reduction === 0` (no NaN).
   - gates increase dispersion ⇒ `reduction < 0`.
   - `null`s counted into `censoredGated`/`censoredUngated`; dispersion computed over
     survivors only; gated censored to <2 survivors ⇒ `gated.dispersion === 0` (and the
     report still carries the censored count).
4. `formatVarianceReport`: contains the percentage, both raw dispersions, and the censored
   caveat when present.

**Verify:** `bun run check` green (full suite). Commit: *"Add pure variance/diff core + tests (E-014 KR3)"*.

## Step 5 — The sweep harness

`src/probe/run-probe.ts` per structure.md (`import.meta.main`). Impure; not unit-tested.
`seedTempRoot` / `collectOutput` / `castArm` / `main`. Argv: `<epic.md>` (default to a sensible
existing epic path with a usage line if absent). Prints per-run outcomes + the final
`formatVarianceReport` line.

**Verify:** `bun run check:typecheck` clean (it imports real modules; it must typecheck even
though it is not executed in CI). A **smoke** of the script is optional and gated on a live
executor (it spawns `claude`); the actual 5×2 run is the documented human sweep step, not a
CI gate. Commit: *"Add 5×2 variance probe harness (E-014 KR3 sweep instrument)"*.

## Step 6 — Final gate + progress

Run `bun run check` once more (typecheck + full test suite). Confirm `check:committed` (all
source committed) and `check:head` (HEAD builds). Update `progress.md` with what landed and
any deviations. Then Review.

## Risks & mitigations

- **`cli.test.ts` churn:** adding `skipGates` could break existing `toEqual` run assertions.
  *Mitigation:* spread `skipGates` only when true (Step 2) so absent-flag objects are
  byte-identical to today's expectations.
- **Ledger pollution by the probe:** the harness must pass `runLogPath` into a temp path
  (Research). *Mitigation:* `castArm` always sets `runLogPath: join(tmp, ".vend", "runs.jsonl")`.
- **Collision on repeated materialize:** *Mitigation:* `rm -rf` the output dirs each iteration
  before casting (D4).
- **Reduction inflated by censoring:** *Mitigation:* surface `censoredGated`/`n` and caveat
  in `formatVarianceReport` (D5); covered by a Step 4 test.
- **Budget-censoring confounding the gate signal:** *Mitigation:* the harness uses a generous
  fixed envelope so arms aren't stopped on budget — isolating the gate channel.

## Done-looks-like (maps to Acceptance Criteria)

- [x] `--no-gates` run mode skipping the gate phase; gated path unchanged when absent → Steps 1–2.
- [x] Variance harness: 5× ±gates, diff materialized output, single reduction number + raw
      per-run diffs → Steps 3 & 5.
- [x] Pure diff/variance unit-tested on fixtures; live 5×2 is the human sweep step → Steps 3–5.
- [x] `bun run check:*` green; gated path + existing casts unaffected → Step 6.
