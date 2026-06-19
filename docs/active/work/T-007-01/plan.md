# T-007-01 — Plan: play-registry-and-interface

Sequence the work. The ticket is small (two files, pure) but the RDSPI discipline
holds: ordered steps, each independently verifiable, testing strategy stated. The
whole deliverable is one atomically committable change (R2) — there is no partial
state worth committing between the contract and its test.

## Testing strategy

- **What gets unit tests:** the **registry** behavior — `register`/`get`
  round-trip, the unknown-name typed error (no undefined-deref), duplicate-register
  throw, `has`/`names`, and instance isolation (AC#3). The test is an ordinary
  pure-function test: it builds a *stub* `Play` (no BAML), so no native addon ever
  loads into the `bun test` process (the discipline `gates.test.ts` follows).
- **What is NOT unit-tested:** the pure *type* declarations (`Play`, `Card`,
  `GateVerdict`, `EffectResult`, `CastContext`) — they have no runtime behavior;
  `tsc --noEmit` is their check. A concrete play's `render`/`parse`/`gates`/
  `effect` are tested where the play is registered (T-007-03/04), not here — this
  ticket ships no concrete play.
- **Verification criteria (AC#4):** `bun run check:typecheck` exit 0 **and**
  `bun run check:test` green (existing suite unchanged + the new `play.test.ts`).
- **Type-level guard:** the stub play in the test is typed `Play<unknown,
  unknown>`, so `tsc` confirms the interface is *implementable* — a structural
  proof the contract is coherent, beyond the runtime registry assertions.

## Steps

### Step 1 — Write `src/engine/play.ts`
Create the new `src/engine/` dir's first file. Author top-down per structure.md:
header comment (purity statement) → two `import type` lines → card types
(`Color`, `CardType`, `Rarity`, `Card` + the `COLORS`/`CARD_TYPES`/`RARITIES`
tuples) → `GateVerdict` → `CastContext<I>` → `EffectResult` → `Play<I, O>` +
`AnyPlay` → `PlayNotFoundError` / `DuplicatePlayError` → `PlayLookup` →
`PlayRegistry` → the `registry` singleton.
- **Verify:** `bun run check:typecheck` is green (the file compiles standalone;
  `verbatimModuleSyntax` satisfied by `import type`).

### Step 2 — Write `src/engine/play.test.ts`
Add the `makeStubPlay` helper and the five test groups from structure.md
(round-trip, unknown-name error, duplicate throw, has/names, isolation). Assert
with `toBe`/`toEqual` for exact pins.
- **Verify:** `bun run check:test` — new tests pass, full suite still green.

### Step 3 — Run both gates together (AC#4)
`bun run check:typecheck && bun run check:test`. Both must be green. Record the
test count delta in `progress.md`.

### Step 4 — Record progress
Update `progress.md`: steps done, the contract's exported surface, the test
count, any deviation from this plan with rationale.

## Sequencing & atomicity

- Steps 1–2 are one logical unit (the contract and the test that pins it) — the
  test references the exact exported names, so they are authored together and
  verified once in step 3. This is the single atomic change (R2).
- No dependency on `baml:gen` — the contract imports no generated values, so the
  build does not need a BAML codegen pass (unlike the runner path).
- **Commits:** left to the lisa loop / orchestration per the session contract —
  this run produces the real code + artifacts and proves the gates green; it does
  not manage git on the `main` branch.

## Risk / deviation watch

- **`GateVerdict` vs gates.ts assignability (D2):** the design claims gates.ts's
  `GateResult` is structurally assignable to `GateVerdict`. This ticket does not
  import or wire gates.ts, so it cannot *prove* the assignment here — that proof
  lands in **T-007-03** when DecomposeEpic's `clear()` return is handed to
  `Play.gates`. If the assignment fails there (e.g. an exactness surprise), the
  fix is local to `GateVerdict` and is flagged in this plan's review as the one
  cross-ticket assumption to re-check.
- **`any` in `AnyPlay`:** a deliberate, documented escape hatch for the
  type-erased map. `tsc` strict will not complain (it is an explicit `any`); the
  justification comment is the guard against it being read as sloppiness.
- **Effect's `RunOutcome` import:** confirm `run-log.ts` exports `RunOutcome` as a
  type with no transitive addon load (research confirms it imports only
  `node:fs/promises` + `node:path` — safe for a type-only import).
