# T-007-03 — Plan: register-decompose-epic-on-the-engine

Four ordered steps, each independently buildable + committable. The sequence keeps `tsc`
and `bun test` green at every commit boundary: enrich the engine first (pure, isolated),
then build the play entry + dispatch seam, then re-wire the two dispatch sites, then verify
end-to-end. Testing strategy is folded in per step.

## Step 1 — Enrich `GateVerdict.clear` to preserve the four success rows (D3)

**Edits.** `src/engine/play.ts`: add optional `cleared?: readonly string[]` to the
`GateVerdict` clear arm + doc-comment. `src/engine/cast-core.ts`: `castGateRows` clear
branch `return (g.cleared ?? []).map((gate) => ({ gate, passed: true }));` + doc-comment.

**Tests.** `src/engine/cast-core.test.ts`: add a `clearedNamed` fixture
(`{status:"clear", cleared:["value","allocation","bounds","structural"]}`); assert
`castGateRows(clearedNamed)` → four `{gate, passed:true}` rows and `classify` with it puts
those rows in `gateLog`. Leave the existing bare-`{status:"clear"}` cases (they prove the
`[]` default survives).

**Verify.** `bun test src/engine/` green (new + existing); `tsc` clean. This step is
behaviour-neutral on its own — no play uses the new field yet. Risk: LOW (purely additive;
the optional field can't break `GateResult → GateVerdict` assignability). **Commit 1.**

## Step 2 — Make DecomposeEpic a registry entry; rebuild the runner as `castPlay` (AC#1, AC#2)

**Edits.** Rewrite `src/play/decompose-epic.ts` per Structure:
- swap the import block (engine + gate + project-context + materialize + baml; drop seam/
  budget/run-log/core/fs imports);
- `export type { RunSummary } from "../engine/cast.ts";` (drop the local interface);
- add `decomposeEffect` (D4), `decomposeEpicPlay` (`Play<DecomposeInputs, WorkPlan>`),
  `registry.register(decomposeEpicPlay)`, `assembleAndCast(play, opts)`, and
  `runDecomposeEpic = (opts) => assembleAndCast(decomposeEpicPlay, opts)`;
- keep `PLAY`, `RunOptions`, `lisaValidate`, `epicIdOf`; remove `stopReason` (cast.ts owns
  the andon line now), the old orchestration body, and the dead `export *`.

**Add** `src/play/dispatch.ts`: `runPlay(name, opts)` → registry lookup → `assembleAndCast`
or `no-play` (D2).

**Tests.** None new here that load the addon (the BAML one-call limit forbids a bun-test
import of `decompose-epic.ts`). Correctness is `tsc` (the play typechecks as
`Play<DecomposeInputs, WorkPlan>`; `clear(...)`'s `GateResult` assigns to `GateVerdict`;
`decomposeEffect` returns `EffectResult`) plus the Step 4 smoke. Existing
`decompose-epic.test.ts` (imports the core) must stay green — confirm it still passes
unchanged.

**Verify.** `tsc` clean; `bun test` unchanged-green. Risk: MEDIUM — the assignability of
`clear()`'s return into `Play.gates`, and the `effect`'s relabel/throw parity, are the
load-bearing claims. Mitigated by Step 4's smoke + the engine being exercised by it.
**Commit 2.**

## Step 3 — Route both dispatch sites by name (AC#3)

**Edits.** `src/cli.ts`: widen `ParsedCommand.run.play` to `string`; generalize
`parseRunArgs` (drop the `decompose-epic` literal guard; `missing <play>` when absent);
update `USAGE`; replace the run-arm lazy `runDecomposeEpic` import with `runPlay` +
`no-play → exit 2`. `src/shelf/press.ts`: import `runPlay` (+ `type RunSummary` from
`decompose-epic.ts`); dispatch the constant `"decompose-epic"` per pick through `runPlay`,
throwing on the impossible `no-play`; refresh the header comment.

**Tests.** `src/cli.test.ts`: add the generic-play-name parse case; re-run the FULL
`cli.test.ts` to confirm every existing assertion still holds (the happy path, `run summon
→ usage`, missing-epic/budget, malformed budget). `press-core.test.ts` must stay green
untouched (it imports `type RunSummary`, still resolvable).

**Verify.** `bun test src/cli.test.ts src/shelf/` green; `tsc` clean. Risk: LOW for the
parser (assertions pre-checked in Design D5); LOW for press (constant name, always
registered). **Commit 3.**

## Step 4 — End-to-end verification + behaviour-preservation proof (AC#4)

**Full gates.** `bun run build` (tsc + bundle), `bun test` (whole suite — expect the prior
count + the new cast-core/cli cases, all green), `bun run lint`.

**Registration smoke** (plain `bun`, no addon limit — the `decompose-bridge` precedent): a
throwaway `bun -e` / script that imports `./src/play/dispatch.ts` and prints
`registry.names()` → must include `"decompose-epic"`; and asserts `registry.get(
"decompose-epic").found === true` with `play.card` = the Azorius mythic permanent and
`play.budget` = `2h/50k`. Confirms the side-effect registration + entry wiring without a
bun-test addon load. Not committed as a test (it would load BAML into the suite).

**Behaviour parity audit** (read, not run — a live model call may be unavailable): walk the
cast path against the welded runner and confirm each preserved invariant —
render/parse identical (`b.request`/`b.parse` via the play), gate STOP → `gate-failed` +
named row, budget exhaustion beats clear (P7), success → four passed rows (Step 1),
`IdCollisionError` → `id-collision` relabel, `lisaValidate` failure → `success` +
`materialized:false`, one `appendRunLog` per cast with `play:"decompose-epic"` and
`epic: epicIdOf`. Note any cosmetic stdout deltas (`· effect …` vs `· lisa validate …`).

**Verify.** All four ACs demonstrably met. Risk: LOW. **Commit 4** (if any final fixups);
otherwise Steps 1–3 stand.

## Testing strategy summary

- **New pure unit tests**: cast-core (gate-row enrichment), cli (generic play parsing) —
  addon-free, the only kind the bun-test runner tolerates here.
- **Unchanged-green regression**: `cli.test.ts`, `press-core.test.ts`, `cast-core.test.ts`,
  `play.test.ts`, `decompose-epic.test.ts`, `gather.test.ts` (AC#4).
- **Impure verbs** (`runPlay`, `runDecomposeEpic`, `assembleAndCast`, `decomposeEffect`):
  NOT unit-tested (house pattern — they spawn/touch fs/load BAML); proven by `tsc` + the
  registration smoke + the parity audit, going fully live in T-007-04's second-play proof.

## Rollback

Each commit is atomic and independently revertible. Step 1 is behaviour-neutral; reverting
Steps 2–3 restores the welded runner + direct dispatch with no schema/data migration (the
run log and menu cache shapes are unchanged throughout).

## Deviations

Recorded in `progress.md` as they arise, with rationale, before proceeding (RDSPI Implement
rule).
