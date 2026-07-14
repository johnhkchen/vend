# Review — T-004-02 refuse-materialize-on-collision

Handoff document. What changed, test coverage, open concerns. Enough to
understand the work without reading every diff. Committed as `639efd0`.

## What changed

| File | Action | Summary |
|------|--------|---------|
| `src/log/run-log.ts` | modified | Added `"id-collision"` to `RUN_OUTCOMES` (+ doc). `RunOutcome`/`assertOutcome` pick it up. |
| `src/play/project-context.ts` | modified | Extracted + **exported** `listIdsIn(dir)`; private `listIds(root, dir)` delegates to it. |
| `src/play/materialize.ts` | modified | New exported `IdCollisionError`; gather→`detectCollisions`→throw guard prefixed onto `materialize`. |
| `src/play/decompose-epic.ts` | modified | Runner catches `IdCollisionError`, relabels outcome → `id-collision`, andon stdout. |
| `src/play/materialize.test.ts` | modified | Real-fs fixture: 2 tests (refuse / fresh write). |

`src/play/id-guard.ts` (T-004-01) is **consumed, not modified** — the pure
detector is imported and called, exactly as its S-004-01 decomposition intended.
The two ticket files (`T-004-01.md`, `T-004-02.md`) carry Lisa's phase-field
edits and were deliberately left out of this commit.

## How it works (the guard's shape)

The cross-board guard lives **inside `materialize`**, before the first `mkdir`:

```
existing  = listIdsIn(storiesDir) ++ listIdsIn(ticketsDir)   # impure gather, tolerant of missing dirs
generated = plan.stories.map(.id) ++ plan.tickets.map(.id)
hits      = detectCollisions(generated, existing)            # pure judgment (T-004-01)
if hits.length: throw new IdCollisionError(hits)             # andon — BEFORE any write
…unchanged mkdir + write loop…
```

The throw precedes every write, so "no partial materialization" (P7) is
**structural**, not a cleanup path. The runner wraps the call:

```
try { await materialize(...); lisaValidate(...) }
catch (e) { if (e instanceof IdCollisionError) { outcome = "id-collision"; andon naming e.collisions }
            else throw e }
```

`verdict.outcome` (a `success`) is relabeled to `id-collision` for the single
`appendRunLog` record; `verdict.gateLog` is logged unchanged (the gates genuinely
passed — the collision is a distinct post-gate andon).

## Acceptance criteria — all met

- ✅ **AC1 — `materialize` gathers ids + runs `detectCollisions` before write.**
  The guard is the first thing `materialize` does; it reuses `project-context`'s
  listing via the new `listIdsIn`, pointed at its own target dirs.
- ✅ **AC2 — refuse on collision (typed error naming ids), zero files, on disk.**
  `IdCollisionError` carries the deduped, plan-ordered colliding ids. Test A
  asserts the throw *and* reads the dirs off disk: no new files, the seeded
  sentinel unchanged, the stories dir never even created.
- ✅ **AC3 — runner maps refusal → `id-collision` outcome, one record, andon.**
  Single `appendRunLog` call with `outcome = "id-collision"`; one stdout andon
  line naming the ids; no partial materialization.
- ✅ **AC4 — fresh/disjoint board materializes + passes `lisa validate`.**
  `listIdsIn` returns `[]` for empty/missing dirs ⇒ no collision ⇒ the existing
  write + `lisaValidate` path runs unchanged. Test B proves the write half.
- ✅ **AC5 — fixture test both paths; `check:test`/`check:typecheck` green.**
  Two real-fs tests; `tsc --noEmit` clean; `bun test` 125 pass / 0 fail.

## Test coverage

| Behavior | Test |
|----------|------|
| pure intersection / dedup / first-appearance order | `id-guard.test.ts` (T-004-01, 8 tests) |
| guard refuses, names exact reused id, zero new files, sentinel intact | `materialize.test.ts` Test A |
| fresh/disjoint board writes both files | `materialize.test.ts` Test B |
| `id-collision` is an accepted logged outcome | `run-log.ts` `assertOutcome` + typecheck |

The two new tests use a per-test `mkdtemp` dir with `afterEach` cleanup, plain-
object `WorkPlan`s, and type-only BAML imports — **no native addon loaded**, so
they sit cleanly in the addon-free test discipline (`materialize.test.ts`
precedent). Both paths of the guard branch (`collisions.length > 0` and `=== 0`)
are exercised.

## Coverage gaps / not unit-tested (by design)

- **The runner relabel (`catch → outcome = "id-collision"`, andon stdout)** is the
  untested impure seam — `runDecomposeEpic` is never unit-tested (it value-imports
  `b`, the BAML addon), exactly as before. Its logic is a thin `instanceof` catch
  over the tested guard + tested detector; it will be exercised live, as T-002-04
  exercised the rest of the runner. A reviewer wanting belt-and-suspenders could
  add an integration check, but it would re-introduce the addon/subprocess seams
  the house pattern keeps off the test path.
- **`lisa validate` on a fresh board (AC4's validate half)** rides the unchanged
  path; no new test asserts the validate spawn (it was never unit-tested — it
  spawns a real `lisa` binary).

## Open concerns / limitations

- **Stories vs. tickets share one flat id pool** in the guard (both dirs' ids and
  both plan arrays are concatenated). Safe because `S-…` and `T-…` namespaces
  can't coincide by construction; if a future id scheme broke that, the pooling
  would conservatively over-detect (refuse), never under-detect — fail-safe.
- **The guard reads the board fresh at write time**, not the run-start snapshot —
  intentional (catches a board that changed mid-run), at the cost of two extra
  `readdir`s on the happy path. Negligible, and correct for a poka-yoke.
- **`IdCollisionError` is thrown by `materialize` generally**, so any future caller
  (replay tools, etc.) inherits the guard — the intended strengthening, but
  callers must be ready to catch it (the runner is; documented on the class).

## Critical issues needing human attention

None. The change is additive, green, atomic, and closes the obs-20349 clobber
hazard in the live path that T-004-01 left open by design. E-004 (cross-board
id-guard) is now functionally complete: T-004-01 (pure detector) +
T-004-02 (andon gate) together stop a re-minted id before it overwrites a
hand-authored board file.
