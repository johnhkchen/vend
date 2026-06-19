# T-007-04 — Research: second-play-proves-agnostic

Descriptive map of the territory. The job: register a **second, non-DecomposeEpic play**
— a minimal-but-real **sorcery** — and cast it through the *same* `castPlay`, proving the
engine is genuinely play-agnostic (E-007's keystone done-signal: **≥2 plays through one
engine**). This maps what exists, where, and the seams the second play plugs into. No
solutions here.

## The engine the second play hangs on (T-007-01 / -02 / -03, all landed)

The casting engine is complete and the first play (`decompose-epic`) is registered on it.
The three load-bearing modules:

- **`src/engine/play.ts`** — the contract. `Play<I, O>` with six members: `name`,
  `render(I)→string`, `parse(string)→O`, `gates(O, ctx)→GateVerdict`, `effect(O,
  ctx)→Promise<EffectResult>`, `budget: Budget`, `card: Card`. Plus `GateVerdict`
  (`{status:"clear", cleared?:string[]}` | `{status:"stop", gate, unit, reason}`),
  `CastContext<I>` (`{inputs, projectRoot}`), `EffectResult` (`{ok, outcome?, detail?,
  artifacts?}`), `Card` (`{color[], type, rarity}`), and the `PlayRegistry` + the
  shelf-wide singleton `registry`. PURE — types + a `Map`, no fs/clock/addon.
- **`src/engine/cast.ts`** — `castPlay<I,O>(play, inputs, budget, opts): Promise<RunSummary>`.
  The single fixed orchestration: `render → dispense (claude -p seam, under wall-clock
  budget) → meter (budget.check) → parse → gates → classify → on success effect → one
  appendRunLog`. IMPURE shell; **already generic — has zero per-play branches**. Imports
  the seam, budget, run-log, and the `Play` *interface* only — never `src/play/`, never BAML.
- **`src/engine/cast-core.ts`** — the pure decision core: `classify` (outcome priority:
  timeout > budget-exhausted > gate-stop > success; `materialize` only on success),
  `castGateRows` (GateVerdict → run-log per-gate rows; clear → one passed row per `cleared`
  name, `[]` if absent), `makeStreamSink`, `resolveLoggedModel`, `DEFAULT_MODEL`.

**Key fact for AC#2:** `castPlay` is unchanged and play-agnostic. A second play casts
through it with **no new branches** — the "zero per-play branches" criterion is already
structural; this ticket only has to *exercise* it with a second `Play`.

## The first play — the template to mirror (`src/play/decompose-epic.ts`)

The registration model. `decomposeEpicPlay: Play<DecomposeInputs, WorkPlan>` collects the
six variation points:
- `render`: `extractPromptText(b.request.DecomposeEpic(epic, charter, project))`.
- `parse`: `b.parse.DecomposeEpic(text)` → `WorkPlan` (SAP parse).
- `gates`: `clear(plan, {epic, charter})` — gates.ts's `GateResult` is **structurally
  assignable** to `GateVerdict`; its `cleared: GateName[]` satisfies the optional
  `cleared?: string[]`.
- `effect`: `decomposeEffect` — `materialize(...)` + `lisaValidate(...)`, catching
  `IdCollisionError` and relabeling to `outcome:"id-collision"` as DATA (not a throw).
- `budget`: `{timeMs: 7_200_000, tokens: 50_000}` (high-tier permanent).
- `card`: `{color:["blue","white"], type:"permanent", rarity:"mythic"}` (Azorius WU).

`registry.register(decomposeEpicPlay)` runs **at module load** — any module that
value-imports `decompose-epic.ts` populates the singleton. `assembleAndCast(play, opts)`
reads the epic/charter/snapshot, builds `DecomposeInputs`, and calls `castPlay`.
`runDecomposeEpic = assembleAndCast(decomposeEpicPlay, …)`.

**The flagged seam:** decompose-epic.ts's own header says *"T-007-04's second play reveals
the seam to generalize [input] assembly per play."* `assembleAndCast`'s `RunOptions` carry
`epicPath` — DecomposeEpic-shaped. A note play's input is a *topic*, not an epic path.

## The BAML authoring pattern (`baml_src/`, `src/baml/`)

- **`baml_src/decompose.baml`** — the only authored function today: enums with `@alias`,
  output classes, `function DecomposeEpic(...) -> WorkPlan { client ClaudeStub; prompt … }`.
  `ClaudeStub` (`baml_src/clients.baml`) is **render-only** — never the transport; the live
  dispense rides `src/executor/claude.ts`.
- **`bun run baml:gen`** regenerates `baml_client/` (gitignored build product) — adding a
  BAML function makes `b.request.X` / `b.parse.X` available.
- **The BAML native-addon limit:** exactly ONE native call (`b.request`/`b.parse`) succeeds
  per `bun test` process — the addon's once-driven reactor hangs the second. So:
  - Any module that *value-imports* `b` is kept off every `bun test` path.
  - Render/parse are proven via a **subprocess bridge** (`src/baml/decompose-bridge.ts` +
    `decompose.test.ts`): batch ops, spawn one child `bun`, assert on its JSON.
  - `extractPromptText(req)` (in decompose-bridge.ts) is the pure reach-in that pulls the
    rendered prompt out of `b.request.X().body.json().messages`.

## The pure-core / impure-verb discipline (house pattern)

Every module splits PURE judgment (tested) from the IMPURE verb (untested; its logic lives
in the pure core). Examples the second play should mirror:
- **`gates.ts`** — pure gates, type-only BAML import → ordinary pure test.
- **`materialize.ts`** — pure `renderTicketFile`/`renderStoryFile` + the impure
  `materialize` verb (mkdir+writeFile), type-only BAML import, tested with **real-fs
  fixtures** (`materialize.test.ts`). This is the precedent for an effect that writes a
  markdown artifact and is still testable.
- **`decompose-epic-core.ts`** vs **`decompose-epic.ts`** — pure core split out because the
  orchestrator value-imports `b`.

## The run log (`src/log/run-log.ts`) — countability (AC#2)

`appendRunLog(record)` writes exactly one JSONL line per run. `RunRecord` carries `play`
(the play name — already generic), `epic` (the subject), `outcome`, `gateResults`, usage,
cost, timestamps. `castPlay` already calls it once per cast for ANY play. A second play's
run therefore appends its own countable record with `play:"<sorcery-name>"` — no run-log
change needed.

## Dispatch surfaces (`src/cli.ts`, `src/play/dispatch.ts`, `src/shelf/press.ts`)

- `dispatch.ts`: `runPlay(name, opts: RunOptions)` → `registry.get(name)` → `assembleAndCast`.
  `RunOptions.epicPath` is DecomposeEpic-shaped — by-name dispatch over a play with a
  *different* input shape is the un-generalized seam.
- `cli.ts`: `vend run <play> <epic.md> --budget` — `play` is parsed generically but the
  positional is `<epic.md>` and routing goes through `runPlay`'s epic-shaped `RunOptions`.
- `press.ts`: dispatches the constant `"decompose-epic"` through `runPlay`.

**Constraint:** fully generalizing by-name dispatch over *heterogeneous* input shapes is a
larger refactor than this slice needs. The keystone done-signal — ≥2 plays through one
`castPlay` — is met by a second play that assembles its own inputs and calls the same
generic `castPlay` (a parallel to `runDecomposeEpic`), without touching the epic-shaped
dispatch path.

## The card model (`docs/knowledge/card-model.md`) — what a sorcery is

A **sorcery** is a single-use play, cast once for the moment, cheap to author (needn't
generalize) — vs. a **permanent** (reusable, recast forever; DecomposeEpic). The color pie:
**Red** = speed, impulse, fast spikes / quick momentum dispenses. A minimal fast one-shot
that captures a real artifact is a Red sorcery — the natural shape for a "minimal but real"
second play, and a deliberate *contrast* to DecomposeEpic's Blue/White permanent (proving
the engine spans the axis, not just two points near each other).

## Constraints & assumptions carried into Design

1. `castPlay` must not change (AC#2 zero per-play branches is already true).
2. The second play needs: a new BAML function (render + SAP parse), its own gate(s), a real
   markdown-writing effect, a budget, a card — all behind the existing `Play` interface.
3. The module that value-imports `b` must stay off every `bun test` path; the gate + the
   effect's pure parts live in an addon-free core, tested directly (gate pass/stop, effect
   writes to a temp dir), mirroring gates.ts + materialize.ts.
4. Render/parse of the new BAML function proven via a subprocess bridge (decompose pattern).
5. "≥2 plays registered" is proven by a `bun -e` smoke (registration is an import side
   effect that loads the addon — cannot be a `bun:test`).
6. Existing 252 tests must stay green; the change is **additive** (new files + one BAML
   function), with no edit to DecomposeEpic or the engine.
