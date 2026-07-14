# T-014-02 — Review

*The handoff document: what changed, test coverage, open concerns. Enough to review without
reading every diff.*

## What this ticket delivered

The **E2 / consistency** arm of E-014 (PRD KR3): a minimal `--no-gates` run mode plus a pure
variance core and a sweep harness that, run live 5×2 on a fixed input, produces the
**single gate-driven variance-reduction number** the findings note (T-014-03) reads.

## Files changed

**Modified (shared with the concurrent T-014-01 thread — see Concurrency):**

- `src/engine/cast.ts` — `CastOptions.skipGates?: boolean`; the lone gate call guarded
  (`gateVerdict = opts.skipGates ? null : play.gates(output, ctx)`) + an honest
  `· gates skipped (--no-gates)` stdout line. Because a `null` `gateVerdict` already flows
  through `classify` as `success → materialize`, skipping the call IS the ungated path — no
  new downstream branch, and the gated path is byte-for-byte unchanged when the flag is absent.
- `src/play/decompose-epic.ts` — `RunOptions.skipGates?`; forwarded by `assembleAndCast`.
- `src/cli.ts` — `run` command carries optional `skipGates`; `parseRunArgs` detects
  `--no-gates` (presence flag, order-independent, spread-only-when-present); `USAGE` updated;
  dispatch arm forwards it.
- `src/cli.test.ts` — three parse tests (see Coverage).

**Created (this arm's alone):**

- `src/probe/variance.ts` — PURE diff/variance core (the unit-tested deliverable).
- `src/probe/variance.test.ts` — its tests.
- `src/probe/run-probe.ts` — IMPURE sweep harness (`bun run src/probe/run-probe.ts <epic.md>`).

All landed in commit **`2ab4e2b`** (see Concurrency for why under that message).

## How it satisfies the Acceptance Criteria

- **AC#1 — minimal `--no-gates` run mode, gated path unchanged when absent.** ✅ One guarded
  line in `castPlay` + `vend run --no-gates`. Absent flag ⇒ `opts.skipGates` falsy ⇒ identical
  gated behaviour.
- **AC#2 — variance harness: 5× ±gates, diff materialized output, one number + raw per-run
  diffs.** ✅ `run-probe.ts` casts both arms collision-safely and feeds `varianceReduction`,
  which returns the `reduction` ratio plus per-pair `PairDiff[]` for each arm.
- **AC#3 — pure diff/variance unit-tested on fixtures; live 5×2 is the human sweep step.** ✅
  `variance.ts` is pure and exhaustively tested; the live casting is the sweep instrument,
  run by a human (it spawns `claude`), ≤ the PRD's cast budget (5/arm).
- **AC#4 — `bun run check:*` green; gated path + existing casts unaffected.** ✅ typecheck
  clean, full suite **467 pass / 0 fail**, source committed. No existing behaviour touched
  (additive option, default off).

## Test coverage

- **`variance.test.ts`** — covers `lineSet` (trim/blank/dedupe), `lineJaccardDistance`
  (identical / disjoint / half-shared / empty-union / one-empty), `dispersion`
  (`n<2`, identical set, a hand-computed mixed mean, pair indexing), `varianceReduction`
  (reduction = 1 / 0 / negative, zero-baseline → no NaN, `null` censoring excluded from
  dispersion + counted, empty arms), and `formatVarianceReport` (percentage + dispersions +
  the censoring / no-baseline / small-arm caveats). 68 assertions, pure, addon-free.
- **`cli.test.ts`** — `--no-gates` ⇒ `skipGates:true`; order-independent vs `--budget`;
  absence ⇒ no `skipGates` key (proves the gated default's parsed shape is unchanged).

**Deliberately untested (house rule — impure verbs, proven live):** `castPlay`'s
`skipGates` branch, `assembleAndCast`/dispatch threading, and the entire `run-probe.ts`
harness. Their judgment lives in the tested pure core; the harness IS the documented human
sweep step.

## Open concerns / flags for the reviewer

1. **The headline number can be inflated by censoring.** Gates buy consistency by *censoring*
   (a gate-failed run materializes nothing), so the gated arm can shrink below 5. If gates
   censor almost everything, the 1–2 survivors are trivially consistent and `reduction → 1.0`.
   *Mitigation:* `VarianceReport` carries `censoredGated`/`n` and `formatVarianceReport`
   prints an explicit `⚠` caveat ("gated arm too small to disperse — reduction not
   meaningful"). **T-014-03 must read the number WITH its caveats**, not the bare percentage.
2. **Sample size is tiny (5/arm) and the input is one epic.** A directional signal, not a
   statistic — exactly the PRD's accepted constraint (§5). The number is a steer for the
   go/reroute call, not a publishable measurement.
3. **The metric is content-divergence, not semantic-quality.** Line-set Jaccard answers "how
   different are these outputs", not "are the gated ones *better*". That is correct for KR3
   (consistency, not quality), but a reviewer should not over-read it as a quality score.
4. **`run-probe.ts` is not exercised in CI** (it spawns a live executor). It typechecks and is
   the documented sweep instrument; its first real exercise is the human 5×2 run at sweep —
   that run, not this ticket, produces the actual KR3 number.

## Concurrency (important context for the diff)

T-014-01 (E1 trust) ran **in parallel on `main`** and shares the three plumbing files. The
two arms' additive edits coexist (`intervened`/`audit` vs `skipGates`). The shared git index
meant the concurrent thread's commit (`2ab4e2b`, "T-014-01: …") flushed **both** arms' staged
work together — including all of this ticket's files — which is why T-014-02's code lives
under that commit message rather than its own. This is the file-locked, same-branch model in
rdspi-workflow.md operating as designed; the combined HEAD builds and tests green. No code was
lost or duplicated; `src/probe/` is wholly this arm's.

## Suggested follow-ups (out of scope here)

- **T-014-03** consumes this `reduction` number + E1's walk-away rate → the go/reroute note.
- If the probe becomes a recurring instrument, generalize the harness off `decomposeEpicPlay`
  to any registered play (a deliberate non-goal now — "a switch, not a framework", PRD §7).
