# T-007-01 — Structure: play-registry-and-interface

The blueprint, not the code. Two new files in a new `src/engine/` directory;
nothing else is created, modified, or deleted. This is the shape the design's
five decisions take on disk.

## Files

| Path | Change | Purpose |
|---|---|---|
| `src/engine/play.ts` | **create** | The `Play<I, O>` contract + the registry. Pure types + a map. Addon-free. |
| `src/engine/play.test.ts` | **create** | Unit tests: register/get + the unknown-name error + duplicate-register throw. Pure (no BAML). |

No `.gitkeep` is needed (the dir gains real files immediately). No edit to
`decompose-epic.ts`, `gates.ts`, `menu.ts`, or any other module — those edges
belong to downstream tickets (T-007-02/03), honoring R4 file-ownership.

## `src/engine/play.ts` — internal organization (top to bottom)

A header comment stating the module's purity (the house pattern: this file
imports no native addon; a concrete play's `render`/`parse` do, the *interface*
does not — so `play.test.ts` is an ordinary pure-function test).

**Imports (both type-only, `verbatimModuleSyntax`):**
```ts
import type { Budget } from "../budget/budget.ts";
import type { RunOutcome } from "../log/run-log.ts";
```
No value imports. No `baml_client`. No `gate/gates.ts` import — `GateVerdict` is
defined locally (D2) and gates.ts's `GateResult` is *structurally* assignable to
it, so no import edge is created.

**1. Card metadata types (D4)**
- `type Color = "white" | "blue" | "black" | "red" | "green"`
- `type CardType = "sorcery" | "permanent" | "instant"`
- `type Rarity = "common" | "uncommon" | "rare" | "mythic"`
- `interface Card { readonly color: readonly Color[]; readonly type: CardType; readonly rarity: Rarity }`
- Exported `const` tuples (`COLORS`, `CARD_TYPES`, `RARITIES`) as the single
  source of the literal unions, mirroring `GATE_NAMES`/`RUN_OUTCOMES` — so a
  consumer can iterate/validate the closed sets.

**2. The gate verdict (D2)**
- `type GateVerdict = { status: "clear" } | { status: "stop"; gate: string; unit: string; reason: string }`
  with a doc-comment noting gates.ts's `GateResult` is assignable to it.

**3. The cast context (D3/D1)**
- `interface CastContext<I> { readonly inputs: I; readonly projectRoot: string }`

**4. The effect result (D3)**
- `interface EffectResult { readonly ok: boolean; readonly outcome?: RunOutcome; readonly detail?: string; readonly artifacts?: readonly string[] }`

**5. The Play contract (D1) — the headline export**
- `interface Play<I, O> { name; render; parse; gates; effect; budget; card }`
  with the exact member signatures from design. Every member documented with the
  DecomposeEpic referent (e.g. `render` ≈ `b.request.DecomposeEpic` →
  `extractPromptText`).
- `type AnyPlay = Play<any, any>` — the type-erased element the registry stores,
  with the documented justification for `any` over `unknown`.

**6. Registry errors (D5)**
- `class PlayNotFoundError extends Error { readonly requested: string; readonly available: readonly string[] }`
- `class DuplicatePlayError extends Error { readonly playName: string }`
  Both set `this.name` and build a descriptive message, mirroring
  `IdCollisionError`.

**7. The lookup result (D5)**
- `type PlayLookup = { found: true; play: AnyPlay } | { found: false; error: PlayNotFoundError }`

**8. The registry (D5)**
- `class PlayRegistry`:
  - private `#plays = new Map<string, AnyPlay>()`
  - `register(play: AnyPlay): void` — throws `DuplicatePlayError` on a taken name.
  - `get(name: string): PlayLookup` — never returns bare `undefined`; builds the
    typed `PlayNotFoundError` (with `available = this.names()`) on a miss.
  - `has(name: string): boolean`
  - `names(): readonly string[]` — registration order (Map preserves insertion).
- `const registry = new PlayRegistry()` — the default singleton export (the AC's
  "a registry"). The cast loop / dispatch use this; tests use fresh instances.

## `src/engine/play.test.ts` — coverage blueprint

`import { describe, expect, test } from "bun:test"` + the engine exports. A header
comment noting it is addon-free (it builds a stub play, never a BAML one). A
`makeStubPlay(name)` helper returns a minimal valid `Play<unknown, unknown>`
(render `() => ""`, parse `() => ({})`, gates `() => ({status:"clear"})`, effect
`async () => ({ok:true})`, a fixed `budget`, a fixed `card`) — enough to register
and retrieve without any model call.

`describe` blocks / `test` cases:
1. **register + get round-trips the same play** — `get(name)` ⇒
   `{ found: true, play }` with referential equality (`toBe`).
2. **unknown name → typed not-found, no undefined-deref** — `get("nope")` ⇒
   `found: false`; `error instanceof PlayNotFoundError`; `error.requested === "nope"`;
   `error.available` lists the registered names (`toEqual`).
3. **duplicate register throws `DuplicatePlayError`** — `expect(() =>
   reg.register(dup)).toThrow(DuplicatePlayError)`; the throw carries `playName`.
4. **`has` / `names` reflect state** — false before, true after; `names()` in
   insertion order (`toEqual`).
5. **isolation** — a fresh `PlayRegistry` shares no state with another instance
   (registering in one does not leak into another).

All assertions use `toEqual`/`toBe` for exact pins, per `id-guard.test.ts` style.

## Ordering of work (see plan.md for the step sequence)

1. Write `play.ts` (types → errors → registry), top-down as listed.
2. Write `play.test.ts`.
3. `bun run check:typecheck` then `bun run check:test` — both green (AC#4).

The two files are written together (the test pins the contract), then both gates
run once. No intermediate commit is required within the file pair.

## Interface contracts handed downstream

- **T-007-02 (cast loop)** consumes: `Play`, `CastContext`, `GateVerdict`,
  `EffectResult`, `AnyPlay`, and `registry.get`. It builds `CastContext` once,
  calls `render → dispense → parse → gates → effect`, maps `GateVerdict`/
  `EffectResult` → `RunOutcome` for the log.
- **T-007-03 (register DecomposeEpic)** consumes: `registry.register`,
  `PlayRegistry`, `Card`, and the `Rarity → ValueTier` mapping it will *add at
  the shelf boundary* (not here).
- **T-007-04 (second play)** proves a second `Play<I2, O2>` with different
  `I`/`O` and a different `card.color` registers and casts unchanged.
