# Plan — T-004-02 refuse-materialize-on-collision

Ordered, independently-verifiable steps. Each is small enough to commit atomic.
Sequencing follows Structure §"Ordering of changes" (leaves first, so each step
typechecks on its own).

## Step 1 — `run-log.ts`: add the `id-collision` outcome

- Append `"id-collision"` to the `RUN_OUTCOMES` tuple (line 39).
- Extend the tuple's doc comment (lines 33–38) to name the new state and its
  source: `id-collision` ← `materialize`'s cross-board guard (T-004-02).
- **Verify:** `bun run check:typecheck` clean. `bun test src/log/run-log.test.ts`
  green (existing tests unaffected; the new member is additive — `assertOutcome`
  now also accepts `"id-collision"`).

## Step 2 — `project-context.ts`: export `listIdsIn(dir)`

- Add exported `listIdsIn(dir: string): Promise<string[]>` holding the
  `readdir → *.md → strip .md`, `catch → []` logic.
- Refactor private `listIds(root, dir)` to `return listIdsIn(join(root, dir))`.
- **Verify:** `bun run check:typecheck` clean. `bun test
  src/play/project-context.test.ts` green — `buildProjectSnapshot` is untouched
  and `listIds`' behavior is byte-identical, so the snapshot tests still pass.

## Step 3 — `materialize.ts`: `IdCollisionError` + the guard

- Add `import { detectCollisions } from "./id-guard.ts"` and
  `import { listIdsIn } from "./project-context.ts"`.
- Export `class IdCollisionError extends Error` with `readonly collisions:
  readonly string[]` and a message naming the ids (Structure §3).
- Prepend the guard to `materialize()` (before the first `mkdir`): gather
  `existing` from both target dirs via `listIdsIn`, build `generated` from
  `plan.stories`+`plan.tickets` ids, `detectCollisions`, `throw new
  IdCollisionError(hits)` if non-empty.
- Update the module header to note `materialize` now reads the board before
  writing (still the single impure verb).
- **Verify:** `bun run check:typecheck` clean (no import cycle —
  `project-context` does not import `materialize`). Existing
  `materialize.test.ts` render-pair tests still green (the guard is not exercised
  by them; they call the pure render functions, not `materialize`).

## Step 4 — `materialize.test.ts`: the AC5 fixture test

- Add fs/temp imports and `materialize, IdCollisionError`.
- Add a `workPlan({stories, tickets})` plain-object helper (cast to the erased
  `WorkPlan` type) reusing the existing `ticket()`/`story()` draft fixtures, and a
  temp-dir helper with `afterEach` cleanup (`rm -rf`).
- **Test A (populated board → refuse):** seed `ticketsDir/T-001-01.md` with a
  sentinel body; plan mints `T-001-01` + a fresh `T-009-02`. Assert
  `rejects.toBeInstanceOf(IdCollisionError)`; `.collisions` deep-equals
  `["T-001-01"]`; read both dirs → only the sentinel present, `T-009-02.md`
  absent, sentinel body **unchanged** (no clobber).
- **Test B (fresh board → write):** empty dirs; disjoint plan (`S-009` +
  `T-009-01`). `await materialize(...)` resolves; read dirs → `S-009.md` and
  `T-009-01.md` exist.
- **Verify:** `bun test src/play/materialize.test.ts` green; both new tests pass.

## Step 5 — `decompose-epic.ts`: catch + relabel

- Import `IdCollisionError` alongside `materialize`.
- Introduce `let outcome: RunOutcome = verdict.outcome`.
- Wrap the `materialize` + `lisaValidate` block in `try`; add `catch (e)` that, on
  `IdCollisionError`, sets `outcome = "id-collision"` and writes the andon line
  naming `e.collisions`; else re-throws.
- Swap the `appendRunLog` `outcome:` field and the returned `outcome` from
  `verdict.outcome` to the mutable `outcome`.
- **Verify:** `bun run check:typecheck` clean. `bun test
  src/play/decompose-epic.test.ts` green — the pure-core tests
  (`classify`/`gateRowsFor`/…) are untouched by the runner-tail edit.

## Step 6 — full green bar + commit

- `bun run check:typecheck` → no errors.
- `bun run check:test` (full `bun test`) → all green, no regression (expect
  +2 from the new materialize fixture tests).
- Commit all five files as one atomic change (source + test together), message
  referencing T-004-02 and the AC it closes.

## Testing strategy summary

| Concern | Covered by | Kind |
|---------|-----------|------|
| pure intersection/dedup/order | `id-guard.test.ts` (T-004-01, existing) | unit, addon-free |
| guard refuses + names ids + zero writes | `materialize.test.ts` Test A | fixture, real fs |
| fresh board still writes | `materialize.test.ts` Test B | fixture, real fs |
| `id-collision` is a valid logged outcome | `run-log.test.ts` (existing `assertOutcome`) + typecheck | unit + types |
| runner relabel / andon stdout | runner (impure verb) — "proven live", not unit-tested | manual / live |
| `lisa validate` on fresh board | unchanged path (AC4) — no new test needed | inherited |

## AC verification matrix

| AC | Closed by |
|----|-----------|
| 1 — `materialize` gathers ids + runs `detectCollisions` before write | Step 3 |
| 2 — refuse on collision, typed error naming ids, zero files (on disk) | Step 3 (throw before write) + Step 4 Test A (disk assertion) |
| 3 — runner maps refusal → `id-collision` run-log outcome, one record, andon | Step 1 + Step 5 |
| 4 — fresh/disjoint board materializes + passes `lisa validate` | Step 3 tolerant gather + Step 4 Test B; validate path unchanged |
| 5 — fixture test both paths; `check:test`/`check:typecheck` green | Step 4 + Step 6 |

## Risks / watch-items

- **Import cycle** materialize↔project-context: none (project-context imports only
  node builtins). Confirm at Step 3 typecheck.
- **`afterEach` cleanup leak**: each temp dir is `mkdtemp`'d per test and removed
  in `afterEach`; a failed assertion still triggers cleanup.
- **`rejects.toBeInstanceOf`**: Bun supports it; fall back to `.rejects.toThrow(/already exist/)`
  plus a separate caught-error `.collisions` assertion if the matcher misbehaves.
