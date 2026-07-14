# T-007-01 — Progress: play-registry-and-interface

## Status: implementation complete, both gates green

All four plan steps executed. The contract and its test are written; typecheck and
the full test suite are green.

## Steps completed

### Step 1 — `src/engine/play.ts` (created)
The `Play<I, O>` contract + registry, pure types + a Map. Exported surface:

- **Card metadata:** `COLORS`/`Color`, `CARD_TYPES`/`CardType`, `RARITIES`/`Rarity`,
  `Card { color: readonly Color[]; type: CardType; rarity: Rarity }`.
- **`GateVerdict`** — `{status:"clear"} | {status:"stop"; gate:string; unit; reason}`
  (play-generic; gates.ts's `GateResult` is structurally assignable to it).
- **`CastContext<I>`** — `{ inputs: I; projectRoot: string }`.
- **`EffectResult`** — `{ ok; outcome?: RunOutcome; detail?; artifacts? }`.
- **`Play<I, O>`** — `name; render; parse; gates; effect; budget; card` (the headline,
  AC#1).
- **`AnyPlay = Play<any, any>`** — the type-erased registry element (documented `any`).
- **`PlayNotFoundError { requested; available }`**,
  **`DuplicatePlayError { playName }`**.
- **`PlayLookup`** — `{found:true; play} | {found:false; error}`.
- **`PlayRegistry`** — `register` (throws on dup), `get` (typed lookup, never bare
  `undefined`), `has`, `names`; plus the default singleton **`registry`**.

Imports are both `import type` (`Budget`, `RunOutcome`) — no BAML, no runtime value,
so the module is addon-free.

### Step 2 — `src/engine/play.test.ts` (created)
7 tests across 4 `describe` groups, all pure (a `makeStubPlay` stub, no model call):
register/get round-trip + referential identity; `has`/`names` order; unknown-name →
`PlayNotFoundError` (with `requested`/`available`, no undefined-deref); empty-registry
miss; duplicate-register throw carrying `playName` (original survives); instance
isolation; the default `registry` singleton is usable.

### Step 3 — gates (AC#4)
- `bun run check:typecheck` → exit 0 (clean).
- `bun run check:test` → **236 pass, 0 fail** across 16 files (was 229; +7 new).
- Engine test alone: 7 pass, 24 `expect()` calls.

### Step 4 — this artifact.

## Deviations from plan

- **Removed a `biome-ignore` directive** on `AnyPlay`. The plan/structure did not call
  for one; I initially added it, then found the project configures no biome/eslint and
  no `lint` script — the directive referenced a tool that does not exist. Replaced with
  a plain explanatory comment. No behavior change; the explicit `any` is justified in
  the doc-comment and accepted by `tsc` strict.

No other deviations. Scope held to two new files; no existing module touched (R4).

## Carried to downstream tickets (assumptions to verify there)

- **T-007-02 (cast loop):** consumes `Play`/`CastContext`/`GateVerdict`/`EffectResult`/
  `AnyPlay` + `registry.get`. The `EffectResult.outcome` relabel channel is how
  id-collision survives the move off the welded runner.
- **T-007-03 (register DecomposeEpic):** the one cross-ticket assumption to confirm —
  that gates.ts's `GateResult` is assignable to `GateVerdict` when DecomposeEpic's
  `clear()` return is handed to `Play.gates`. Also owns the `Rarity → ValueTier`
  mapping at the shelf boundary (deliberately not built here).

## Commits

Left to the lisa loop / orchestration per the session contract (on `main`; this run
produced real code + artifacts and proved the gates green, but does not manage git).
