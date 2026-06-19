# T-011-01 Research — chain-primitive-and-output-threading

Descriptive map of the codebase territory this ticket touches. What exists, where, how it
connects. No solutions here.

## The ticket in one line

Build the engine's first composition primitive — `castChain(steps)` — that runs a sequence
of plays via `castPlay`, threading each play's **produced** output into the next play's input,
and halting the chain on any non-success (STOP). The minimal enabler: a play's effect must
*surface what it produced* so the next step can consume it.

## The casting engine today (single-play spine)

`src/engine/cast.ts` (`castPlay<I, O>`) is the single IMPURE orchestrator. Its fixed spine:
`render → dispense (the claude seam, under a wall-clock budget) → meter (budget.check) →
parse → gates → classify → on pass effect → appendRunLog`. It branches on the pure `classify`
verdict (timeout / budget / gate). Every cast appends **exactly one** run-log record
(`appendRunLog`, line 143). Returns a `RunSummary`.

- `RunSummary` (cast.ts:53-59) carries `{ runId, outcome, materialized }` today. This is the
  shape the ticket extends with `produced`.
- `CastOptions` (cast.ts:34-51): the per-cast runtime values — `subject` (stamped on the
  run-log `epic` field), `projectRoot`, `model`, `runId`, `transcriptDir`, `runLogPath`.
- The effect runs only on a CLEAR verdict (`verdict.materialize && output !== null`,
  cast.ts:129). `materialized = eff.ok`; an `eff.outcome` RELABELS the run outcome (e.g.
  `id-collision`). This is the exact site where a `produced` reference would be lifted off the
  `EffectResult` and carried into the returned `RunSummary`.

`src/engine/cast-core.ts` is the PURE decision core (classify, castGateRows, makeStreamSink,
resolveLoggedModel). cast.ts re-exports it (`export * from "./cast-core.ts"`) so callers have
one engine entry. The house split is rigid: **judgment is pure and tested in `*-core.ts`; the
impure shell is the single untested verb whose logic lives in the core.** `castPlay` itself is
deliberately NOT unit-tested — its logic is cast-core.ts, proven live when a play casts.

`cast-core.test.ts` imports ONLY `./cast-core.ts` (never `./cast.ts`) so the test process loads
no native addon and spawns nothing. The pure-function test discipline. `makeStreamSink` is the
template for purity-given-injected-edges: a pure function returning a closure over injected
`write`/`sink`, testable with fakes.

## The Play contract

`src/engine/play.ts` (PURE — types + a Map, no fs/clock/process). The `Play<I, O>` interface
(play.ts:119-134) collects the six per-play variation points: `render`, `parse`, `gates`,
`effect`, `budget`, `card`.

- `EffectResult` (play.ts:99-104): `{ ok, outcome?, detail?, artifacts? }`. This is the shape
  the ticket extends with `produced`. NOTE: `artifacts?: readonly string[]` already exists —
  the FULL list of files an effect wrote (provenance). `produced` is a DIFFERENT concept: the
  single canonical handle the *next play* threads on.
- `GateVerdict` (play.ts:73-75): play-generic clear/stop union. A `stop` names `gate`/`unit`/
  `reason`. The cast loop refuses to materialize on a stop.
- `CastContext<I>` (play.ts:85-88): `{ inputs, projectRoot }` — assembled once, passed to both
  `gates` and `effect`.
- `registry` / `PlayRegistry`: the `name → Play` singleton. Plays self-register at module load.
  `AnyPlay = Play<any, any>` (play.ts:145) — the documented, justified `any` for a heterogeneous
  map that cannot preserve each play's type parameters. A chain of heterogeneous steps faces the
  same type-erasure reality.

## The three registered plays (effect shapes)

All three effects already report back as DATA (`EffectResult`), and all three set `artifacts`:

1. **propose-epic** (`src/play/propose-epic.ts` + `src/play/propose-effect.ts`). The Blue
   permanent. `proposeEpicEffect` (propose-effect.ts:65-87) mints the authoritative next epic id
   against the LIVE board (`nextEpicId`), writes `docs/active/epic/<minted>.md`, and returns
   `{ ok: true, detail, artifacts: [path] }`. **This is the play the chain threads FROM** — the
   ticket's cited example is "the minted epic path". T-011-02 will adapt that path into
   DecomposeEpic's `epicPath` input.
2. **capture-note** (`src/play/note.ts` + `src/play/note-core.ts`). The Red sorcery.
   `captureNoteEffect` (note-core.ts:112-119) writes `docs/active/notes/<slug>.md`, returns
   `{ ok: true, detail, artifacts: [path] }`.
3. **decompose-epic** (`src/play/decompose-epic.ts`). The Azorius mythic. `decomposeEffect`
   (line 121) writes a story + tickets; its `artifacts` is MANY files. **This is the play the
   chain threads TO** in T-011-02 — `DecomposeEpic takes an epicPath` (per T-011-02's cites).

Each cast verb (`castProposeEpic`, `castCaptureNote`, `runDecomposeEpic`) is a thin IMPURE
wrapper: assemble typed inputs → `castPlay(play, inputs, budget, opts)` → return `RunSummary`.

## The run log (one record per cast)

`src/log/run-log.ts`. `appendRunLog` is the single impure fs verb; `buildRunRecord` /
`serializeRunRecord` are the pure pair. `RunOutcome` (run-log.ts:41) =
`success | gate-failed | timed-out | budget-exhausted | id-collision`. **Only `success`
materializes.** Every cast — pass or fail — writes exactly one JSONL line. So "one run-log
record per step" is satisfied structurally by calling `castPlay` once per step; the chain need
not log separately.

## Boundary with T-011-02 (the sibling)

`docs/active/tickets/T-011-02.md` (`depends_on: [T-011-01]`) is the WIRING + gesture:
- Defines the *concrete* propose→decompose chain via `castChain`: ProposeEpic's `produced` epic
  path → adapter → DecomposeEpic's `epicPath`.
- Wires a `vend chain <signal>` gesture (cli.ts / shelf/press.ts).
- A fixture test proving signal → epic → tickets end to end.

So **T-011-01 owns the PRIMITIVE and the produced-surfacing only** — `castChain`, the pure
threading/halt core, and `produced` on `EffectResult` + `RunSummary` (set by `proposeEpicEffect`
to the minted path). The real propose→decompose adapter and the gesture are explicitly T-011-02.
T-011-01's own test is a synthetic two-step fixture, NOT the live propose→decompose wiring.

## Constraints and assumptions

- **Acyclic dependency direction (E-007 keystone):** a concrete play depends UP onto the engine;
  the engine never imports `src/play/`. `chain.ts` lives in `src/engine/` and may import
  `castPlay`/`Play` — but must NOT import any concrete play (T-011-02 assembles concrete steps).
- **Purity discipline:** the threading + halt JUDGMENT must be pure and unit-tested (AC#3),
  spawning nothing. This forces a `chain-core.ts` (pure, type-only imports) + `chain.ts` (impure
  shell calling `castPlay`) split — the cast-core/cast mirror. The pure core can be tested with
  *injected fake casts* returning canned `RunSummary`s, exactly as `makeStreamSink` is tested
  with fake edges.
- **Backward compatibility (AC#2, AC#4):** `produced` must be an OPTIONAL field on both
  `EffectResult` and `RunSummary` so existing single-play casts and effects are unaffected and
  `bun run check:*` stays green.
- `verbatimModuleSyntax` is on: a `import type { RunSummary } from "./cast.ts"` is fully erased,
  so a pure `chain-core.ts` can name the type without pulling cast.ts's runtime (executor seam)
  into a test process.
- The heterogeneous-steps reality: a chain holds plays with different `I`/`O`. The same
  `AnyPlay`/`Play<any, any>` type-erasure that the registry documents applies — type safety
  lives at each step's internally-consistent construction and at the adapter boundary.
