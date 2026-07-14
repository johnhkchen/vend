# Plan — T-004-01 pure-id-collision-detector

Ordered, independently-verifiable steps. The work is small (one pure function +
its test), so the plan is short by design — the value of the phase is the
explicit verification matrix, not step count.

## Testing strategy

- **Unit only.** The deliverable is a pure function; a `bun:test` pure-function
  test is the complete strategy (no integration test — there are no edges to
  integrate). T-004-02 owns the integration into `runDecomposeEpic`.
- **Coverage target:** every branch of `detectCollisions` — collision present,
  none present, empty inputs, dedup path, order path, non-mutation.
- **Determinism:** the function is total and side-effect-free, so every assertion
  is `toEqual` on a fixed array (no flakiness, no clock, no fs).
- **Green-bar guard:** `bun test` (114 passing today) plus `tsc --noEmit` must
  both stay green after the addition (AC#3).

## Steps

### Step 1 — write `src/play/id-guard.ts`
Create the module exactly per Structure: header comment, single
`detectCollisions` export, `Set`-membership + dedup-guard loop, first-appearance
order, total (no throw).
*Verify:* `bun run check:typecheck` passes (the file compiles under `strict` +
`noUncheckedIndexedAccess` + `verbatimModuleSyntax`); the export signature
matches the AC string exactly.

### Step 2 — write `src/play/id-guard.test.ts`
Create the three `describe` blocks from Structure:
1. intersection — exact colliding ids; disjoint `[]`; empty-input `[]`×2.
2. order & dedup pinned — order follows `generated`, not `existing`; repeated
   colliding id appears once; repeated non-colliding id never appears.
3. purity — frozen inputs unchanged after the call.
*Verify:* `bun test src/play/id-guard.test.ts` green; assertions use `toEqual`
(exact), not `toContain`, so the "exactly the reused ids" AC is literally pinned.

### Step 3 — full green bar + commit
Run the whole suite and the typecheck together; confirm no regression in the
other 114 tests.
*Verify:* `bun run check:test` → 0 fail; `bun run check:typecheck` → no errors.
Then commit the two new files as one atomic change.

## AC verification matrix

| Acceptance Criterion | Verified by | Step |
|----------------------|-------------|------|
| `id-guard.ts` exports `detectCollisions(generated, existing) -> string[]`, PURE | typecheck + signature inspection; no fs/net/addon import in the file | 1 |
| `id-guard.test.ts`: colliding fixture returns **exactly** reused ids | `toEqual([exact])` collision test | 2 |
| disjoint fixture returns `[]` | disjoint `toEqual([])` test | 2 |
| order/dedup behavior pinned | order test (vs `generated`) + dedup test | 2 |
| `bun run check:test` green | full suite run | 3 |
| `bun run check:typecheck` green | `tsc --noEmit` | 1, 3 |
| no dependency on `materialize`/`project-context`; plain string arrays | import inspection (zero such imports); signature is `readonly string[]` | 1 |

## Commit plan

Single commit (the module + its test are one atomic unit; no intermediate
half-states worth isolating). Message: `T-004-01: pure cross-board id-collision
detector + tests`.

## Risks & mitigations

- **Risk:** over-coupling by importing a `WorkPlan` type "for convenience."
  *Mitigation:* the signature is plain `string[]`; no baml import at all — the
  test's absence of baml imports proves it.
- **Risk:** order/dedup left implicit and only incidentally correct.
  *Mitigation:* Step 2 pins both with dedicated tests whose fixtures are
  constructed so a sort-based or multiplicity-preserving implementation would
  fail the assertion.
- **Risk:** an accidental impurity (e.g., mutating the input).
  *Mitigation:* the purity `describe` freezes inputs and asserts they are
  unchanged.
