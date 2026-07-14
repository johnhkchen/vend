# T-007-01 — Review: play-registry-and-interface

Handoff for a human reviewer. This ticket established the **shared contract** (R12)
the whole casting engine (E-007) hangs on: a typed `Play<I, O>` interface and a
`name → Play` registry, abstracting the six per-play variation points welded into
`runDecomposeEpic`. Pure types + a Map — no orchestration, no fs.

## What changed

**Created (2 files, 0 modified, 0 deleted):**

- `src/engine/play.ts` (~190 lines incl. docs) — the contract + registry. New
  `src/engine/` directory (its first occupant).
- `src/engine/play.test.ts` (~115 lines) — the pure registry test.

No existing module was touched. The edits to `decompose-epic.ts` (registering
DecomposeEpic) and `shelf/menu.ts` (the `Rarity → ValueTier` feed) are deliberately
deferred to T-007-03, which owns those files (R4 file-ownership).

## Exported surface (the contract)

- `Play<I, O>` — `name`, `render(I)=>string`, `parse(string)=>O`,
  `gates(O, CastContext<I>)=>GateVerdict`, `effect(O, CastContext<I>)=>Promise<EffectResult>`,
  `budget: Budget`, `card: Card`.
- `CastContext<I>`, `GateVerdict`, `EffectResult`, `AnyPlay`.
- `Card` + `Color`/`CardType`/`Rarity` (+ the `COLORS`/`CARD_TYPES`/`RARITIES` tuples).
- `PlayRegistry` (`register`/`get`/`has`/`names`) + the `registry` singleton.
- `PlayNotFoundError`, `DuplicatePlayError`, `PlayLookup`.

## Acceptance criteria — all met

- **AC#1 — `Play<I, O>` with the named members + budget + card.** ✓ All seven
  members present with the AC's signatures. `card` carries color/type/rarity. The
  gate context is a derived `CastContext<I>`, keeping the headline two-param
  signature the AC specifies (design D1).
- **AC#2 — registry name → Play with register/get; unknown name → typed error,
  never undefined-deref.** ✓ `get` returns a discriminated `PlayLookup`; a miss
  yields `found:false` + a `PlayNotFoundError` carrying `requested` + `available`.
  No code path returns a bare `undefined`. Tests pin both the populated-miss and
  empty-registry-miss cases.
- **AC#3 — pure (types + map only; no dispense, no fs); unit-tested (register/get
  + unknown-name error).** ✓ Module imports only two `import type`s (`Budget`,
  `RunOutcome`); no fs/clock/process/BAML. 7 tests cover register/get round-trip,
  the unknown-name error, duplicate-register, has/names, and instance isolation.
- **AC#4 — `check:test` / `check:typecheck` green.** ✓ `tsc --noEmit` exit 0;
  `bun test` 236 pass / 0 fail across 16 files (229 prior + 7 new).

## Test coverage

- **Covered:** every `PlayRegistry` method and both `PlayLookup` arms; both error
  classes (instance + carried evidence + descriptive name); insertion-order `names`;
  instance isolation; the default singleton. Assertions use `toBe`/`toEqual` for
  exact pins (id-guard.test.ts style).
- **Not covered, by design:** the pure type declarations (no runtime behavior —
  `tsc` is their check; the stub play typechecking as `Play<unknown, unknown>` is
  the structural proof the interface is implementable). A concrete play's
  `render`/`parse`/`gates`/`effect` are tested where a play is registered
  (T-007-03/04) — this ticket ships no concrete play.

## Open concerns / things for a reviewer to weigh

1. **`GateVerdict` ↔ gates.ts `GateResult` assignability (the one cross-ticket
   assumption).** Design D2 chose a play-generic `GateVerdict` (`gate: string`)
   over reusing gates.ts's `GateResult` (`gate: GateName`, the four
   decompose-specific names), and claims the latter is *structurally assignable* to
   the former. This ticket does not import or wire gates.ts, so the assignment is
   **not proven here** — it lands in T-007-03 when `clear()`'s return is handed to
   `Play.gates`. If an exactness surprise breaks it there, the fix is local to
   `GateVerdict`. Flagged as the single assumption to re-check downstream.
2. **`AnyPlay = Play<any, any>` uses explicit `any`.** Deliberate and documented:
   a heterogeneous registry cannot preserve each play's `I`/`O`; `unknown` would
   make `play.render(inputs)` uncallable. Type safety is at registration + each
   re-narrowing call site. This is the only `any` in `src/` (it does not appear as a
   bare type elsewhere) — a reviewer comfortable with the type-erasure rationale can
   accept it; otherwise the alternative is a tagged wrapper, heavier for no proven
   gain this slice.
3. **`EffectResult.outcome: RunOutcome` couples the engine to the log's
   vocabulary.** A pure type import (run-log pulls no addon). The alternative (a
   bare `code: string`) was rejected for costing the cast loop a type-checked
   switch. If E-007 later wants outcomes the log doesn't know, this is the seam to
   revisit.
4. **`card.rarity` is MTG-native (`common..mythic`), not menu.ts's `ValueTier`.**
   Chosen to keep the engine free of an upward dependency on the shelf. The
   `Rarity → ValueTier` mapping is a one-liner T-007-03 adds at the shelf boundary;
   until then the card's rarity is carried but not yet consumed by the menu.

## Known limitations (in scope, by design)

- No cast loop, dispense, classify, stream sink, or fs — all T-007-02.
- No registered plays yet — T-007-03/04. The contract is implementable (proven by
  the typechecking stub) but unexercised by a real play until then.
- The `registry` singleton is currently empty in production; nothing dispatches
  through it until T-007-03 wires `vend <n>`.

## Risk assessment: low

Additive only (two new files), no existing behavior altered, full suite green. The
sole forward-looking risk (concern 1) is isolated to a single type and surfaces at a
compile boundary in the very next ticket, not at runtime.
