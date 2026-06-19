# T-007-02 — Review: generic-cast-loop

Handoff for a human reviewer. This ticket extracted the **play-agnostic spine** of
`runDecomposeEpic` into one generic `castPlay`, the convergence node of E-007's casting
engine: every play is now cast through one fixed orchestration, with the play-specific
bits behind the `Play<I, O>` interface (T-007-01). No existing module was touched — the
play/CLI re-wire is T-007-03 (R4 file-ownership).

## What changed

**Created (3 files, 0 modified, 0 deleted):**

- `src/engine/cast.ts` (~140 lines incl. docs) — `castPlay<I, O>` (the impure
  orchestrator), `CastOptions`, `RunSummary`, private `stopReason`. Re-exports the pure
  core via `export *`.
- `src/engine/cast-core.ts` (~120 lines incl. docs) — the PURE decision core: `classify`,
  `castGateRows`, `formatMessage`, `makeStreamSink`, `resolveLoggedModel`, `DEFAULT_MODEL`.
  Addon-free (all `import type`).
- `src/engine/cast-core.test.ts` (~95 lines) — 12 pure-function tests.

Commit: `5abe19e`.

## Exported surface

- `castPlay<I, O>(play, inputs, budget, opts): Promise<RunSummary>` — the
  render→dispense→meter→parse→gate→classify→effect→log loop.
- `CastOptions` (`subject`, `projectRoot?`, `model?`, `runId?`, `transcriptDir?`,
  `runLogPath?`), `RunSummary` (`runId`, `outcome`, `materialized`).
- Re-exported from cast-core: `classify`, `castGateRows`, `ClassifyInput`, `Verdict`,
  `formatMessage`, `makeStreamSink`, `resolveLoggedModel`, `DEFAULT_MODEL`.

## How the spine maps to the welded runner

| `runDecomposeEpic` step | `castPlay` equivalent |
|---|---|
| `assembleInputs` + `epicIdOf` | caller's job (T-007-03); loop takes `inputs: I` + `opts.subject` |
| `b.request.DecomposeEpic` → `extractPromptText` | `play.render(inputs)` |
| stream sink (both surfaces) | `makeStreamSink` — identical |
| `dispense` + `ClaudeTimeoutError` latch | identical |
| `check(budget, usage)` | identical |
| `b.parse.DecomposeEpic` | `play.parse(result.result)` |
| `clear(plan, {epic, charter})` | `play.gates(output, ctx)` |
| `classify` (pure) | `classify` (pure, generic over `GateVerdict`) |
| `materialize` + `lisaValidate` + collision catch | `play.effect(output, ctx)`; relabel via `EffectResult.outcome` (data, not a caught throw) |
| `resolveLoggedModel` | identical |
| one `appendRunLog` | identical (`play: play.name`, `epic: opts.subject`) |

## Acceptance criteria — all met

- **AC#1 — `castPlay(play, inputs, budget, opts) -> RunSummary`, the generic loop
  branching on the reused pure `classify`; streams to both surfaces; one countable
  run-log record per cast.** ✓ The sequence is the runner's, generalized; `makeStreamSink`
  fans every message to stdout + transcript; a single `appendRunLog` is reached on every
  terminal path (timeout, exhausted, gate-stop, collision-relabel, success).
- **AC#2 — play-agnostic; no DecomposeEpic-specific code; touches the `Play` interface
  only.** ✓ Verified mechanically: `grep` for `../play`, `../gate`, `baml_client` in both
  engine files returns nothing. cast.ts imports the seam, budget, run log, and the `Play`
  interface only.
- **AC#3 — impure orchestration is the single untested verb; its decision core stays
  pure and tested.** ✓ `castPlay` (spawns `claude`, touches fs) is untested, mirroring
  `runDecomposeEpic`/`dispense`/`appendRunLog`/`materialize`; cast-core (the judgment) has
  12 tests.
- **AC#4 — `check:test` / `check:typecheck` green.** ✓ `tsc --noEmit` exit 0; `bun test`
  248 pass / 0 fail / 17 files (236 prior + 12 new).

## Test coverage

- **Covered:** `classify`'s full priority lattice (timeout > budget > gate-stop > success)
  + the P7 budget-beats-clear pin; `castGateRows` all three arms (stop row / clear `[]` /
  null `[]`); `formatMessage` known + unknown + empty; `makeStreamSink` two-surface
  ordering; `resolveLoggedModel` real → pinned → sentinel. The cast-core test loads no BAML
  addon and spawns nothing (the gates.test.ts discipline).
- **Not covered, by design:** `castPlay` itself — the impure verb. Its play-agnostic
  correctness is proven by `tsc` (it compiles against the generic `Play<I, O>` with zero
  `src/play/`/BAML import) and goes LIVE in T-007-03 when DecomposeEpic is registered and
  cast (the analogue of T-002-04 for the welded runner). No fake-`dispense` injection was
  added — the house pattern keeps the impure verb untested rather than widening its API for
  testability.

## Open concerns / things for a reviewer to weigh

1. **"Reuse the pure decision core" was satisfied by MIRRORING, not importing.** The ticket
   says reuse `src/play/decompose-epic-core.ts`. A literal import is impossible: T-007-03
   makes `play → engine`, so any `engine → play` import is a cycle; and the runner's
   `classify` is typed against gates.ts's `GateResult` (`gate: GateName`, opaque-carrying
   `cleared`), which the play-generic `GateVerdict` is NOT assignable to. So cast-core
   re-implements the same split + decision logic over `GateVerdict`. This is the one place
   the implementation departs from a literal reading of the ticket — justified in design.md
   §D1/D2 against the layering reality. **Reviewer call:** accept the mirror, or mandate the
   shared-module DRY now (which would require editing the T-002-03-owned core, against R4).
2. **Duplicated stream/model helpers** (`makeStreamSink`/`formatMessage`/`resolveLoggedModel`,
   ~35 lines) now exist in both cast-core.ts and decompose-epic-core.ts. Deliberate, flagged
   tech-debt: a kaizen ticket can extract a shared lower module once T-007-03 has established
   the `play → engine` direction. They are independently tested on both sides.
3. **Successful DecomposeEpic runs will log `gateResults: []`** once wired through `castPlay`
   (D3 — `GateVerdict.clear` is opaque, so the generic loop has no gate names on a pass),
   where the welded runner logged 4 passed rows. The top-level `outcome: "success"` is
   unchanged, so countability is intact, but the per-gate success detail is dropped. **For
   the T-007-03 author:** accept this, or enrich `GateVerdict.clear` to carry
   `cleared: string[]` and have `castGateRows` read it (a one-line, isolated change). This is
   the same downstream seam T-007-01 review concern #1 flagged.
4. **`opts.subject` → run-log `epic`.** The log schema's `epic` field is DecomposeEpic
   vocabulary; the generic loop populates it from a caller-supplied `subject`. An empty
   subject throws via `appendRunLog`'s `assertNonEmpty` (a caller wiring error, surfaced
   loudly — the house rule). A future log schema rename (`epic` → `subject`) is out of scope.

## Known limitations (in scope, by design)

- No play registered, no `vend <name>` dispatch, no CLI/press re-wire — all T-007-03. The
  loop is implementable and compiles against the generic contract, but is unexercised by a
  real play until then.
- The effect's id-collision throw→data conversion lives in DecomposeEpic's `effect` wrapper
  (T-007-03), not here; `castPlay` only reads `EffectResult.outcome`.

## Risk assessment: low

Additive only (three new files in a fresh subtree), no existing behavior altered, full
suite green, play-agnosticism proven mechanically. The forward-looking items (concerns 1–3)
are isolated to the engine's own pure core or surface at a compile/wiring boundary in
T-007-03, not at runtime here.
