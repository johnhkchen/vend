# Design — T-004-02 refuse-materialize-on-collision

Four decisions, each grounded in Research. Chosen option first, rejected options
with rationale.

## D1 — Where the guard lives: **inside `materialize`**

**Decision.** The collision check lives at the top of `materialize()`, before any
`mkdir`/`writeFile`: gather the existing ids from the two target dirs, run
`detectCollisions` against the plan's ids, and **throw before the first write** if
non-empty.

**Why.**
- AC1 is explicit: "*`materialize` collects the existing story + ticket ids under
  its target dirs and runs `detectCollisions`*." The function, not the runner.
- It is the stronger poka-yoke. The guard travels *with the write verb*: any
  caller of `materialize` (this runner, a future replay tool, a test) gets the
  refusal for free and cannot forget it. A guard in the runner protects only the
  one call site.
- `materialize` already owns `targets.storiesDir`/`ticketsDir` — it can gather the
  board ids from *exactly the dirs it is about to write*, fresher and more
  precise than reusing `assembleInputs`' run-start snapshot.
- "Zero files written" becomes **structural**: the throw precedes `mkdir`, so the
  write loop is unreachable on collision. Nothing to undo, no partial state (P7).

**Rejected — guard in the runner before the `materialize` call.** Clean (no
`materialize` change; "no write" is structural because the call never happens),
but it (a) contradicts AC1's wording, (b) leaves `materialize` itself a foot-gun
for any other caller, and (c) splits the gather from the writer that owns the
target dirs. The cross-board guard belongs with the write, like the gates belong
with the parse.

## D2 — How refusal reaches the runner: **a typed `IdCollisionError` thrown by `materialize`, caught by the runner**

**Decision.** `materialize` throws `IdCollisionError` (new, exported from
`materialize.ts`) carrying `collisions: readonly string[]`. The runner wraps the
`materialize` call in `try/catch`, catches `IdCollisionError` specifically, and
maps it to the `id-collision` outcome + a stdout andon. Any other error
re-throws (a genuine fs/launch failure is not a clean outcome — same rule the
runner already applies to non-timeout seam errors at line 142).

**Why.**
- `materialize` is an async fs verb mid-call; the only way it can refuse *after
  starting* is to throw. A **typed** error (not a bare `Error`) lets the runner
  distinguish "expected andon" from "disk broke" — exactly the house split
  between an expected refusal and a real failure.
- It is in-idiom: `materialize` already throws `RangeError` on enum/alias drift.
  Adding a second typed throw for a second refusal class is consistent.
- The error object carries the colliding ids so the runner's andon names them
  verbatim (AC2: "naming the colliding ids") without re-deriving anything.

**Rejected — `materialize` returns a discriminated result
(`{status:"refused", collisions}` | `MaterializeResult`).** Would keep
`materialize` throw-free, but it changes the success return type and forces every
caller to branch on a refusal that is, by construction, rare and terminal. A
throw is the lighter contract for an exceptional, line-stopping event, and keeps
the happy-path return type (`MaterializeResult`) unchanged. The pure *judgment*
(`detectCollisions`) stays total and throw-free; only the impure verb throws.

**Rejected — put the throw in `id-guard.ts`.** `id-guard` is deliberately the
purest, most-total module in the tree ("never throws; `[]` means clear"). Keeping
the throw in the impure verb preserves that. id-guard decides *what collided*;
materialize decides *what to do about it* (refuse).

## D3 — Who decides the `id-collision` label: **the runner, post-`materialize`; `classify` is untouched**

**Decision.** `classify` (pure core) stays exactly as-is. The runner holds a
mutable `let outcome = verdict.outcome` and reassigns it to `"id-collision"` in
the `catch (IdCollisionError)` branch. `appendRunLog` and the return value use
this final `outcome`.

**Why.**
- A collision is an **fs fact discovered after the plan cleared the gates** —
  unavailable to a pure function that runs pre-write with no board access.
  Threading the existing-ids gather into `classify` would force the runner to
  pre-`readdir` and would duplicate the gather D1 already places in
  `materialize`. The decision point *is* post-materialize-attempt.
- The relabel is a thin, mechanical `catch → assign` in the already-untested
  impure orchestrator — the same place the runner already does impure branching
  (timeout, lisaValidate → `materialized`). It introduces no new tested logic; the
  *judgment* it relies on (`detectCollisions`) is already unit-tested in T-004-01,
  and the *guard* (gather+detect+throw) gets its own fixture test via
  `materialize` (D4).
- `verdict.gateLog` is logged unchanged: the gates genuinely passed, so recording
  their passed rows is honest. The collision is a distinct, post-gate andon, not a
  gate failure — it deserves its own outcome label, not a faked `gate-failed`.

**Rejected — add `collisions` to `ClassifyInput` and let `classify` return
`id-collision`.** Purest-looking, but it inverts the data flow: the runner would
have to gather board ids *before* deciding to materialize, defeating D1's "gather
inside the verb that owns the dirs" and re-reading the disk twice. The outcome
priority (timeout > budget > gate > collision > success) is real, but collision
sits *below* success in that order and is only reachable when everything else
cleared — so it is naturally a post-`classify` refinement, not a peer input.

## D4 — Test strategy: **fixture test against `materialize` with a real temp dir**

**Decision.** `materialize.test.ts` gains a `describe("materialize — cross-board
collision guard")` block using a real `mkdtemp` temp dir (fs is addon-safe; only
the BAML *native addon* is forbidden in `bun test`). Two paths, both AC5:

- **Populated board → refuse.** Pre-write a colliding ticket file (e.g.
  `T-001-01.md`) into the temp tickets dir. Build a plain-object `WorkPlan`
  (stories+tickets cast to the erased BAML types, exactly as the existing draft
  fixtures do). `expect(materialize(plan, targets)).rejects.toThrow(IdCollisionError)`;
  assert the message/`.collisions` names the reused id(s); then **read the dir off
  disk** and assert *no new* files appeared (only the pre-seeded fixture remains)
  — "verified on disk, not just a flag".
- **Fresh/disjoint board → write.** Empty temp dirs, disjoint plan ids. `await
  materialize(...)` resolves; read disk and assert the expected `S-…`/`T-…` files
  now exist.

**Why.** The guard lives in `materialize` (D1), so the fixture test targets
`materialize` directly — it exercises the real gather + detect + throw, not a
stand-in. `materialize.ts` imports BAML **type-only**, so importing it into the
test loads no addon (the established `materialize.test.ts` precedent). The runner
relabel (D3) is the untested impure seam, "proven live" — consistent with the
house rule that `runDecomposeEpic` is not unit-tested.

**Rejected — test the runner end-to-end.** Would drag in `b` (the addon) and the
`claude`/`lisa` subprocess seams — flaky and addon-loading. The pure detector
(T-004-01 tests) + the materialize-guard fixture test together cover all the new
*logic*; the runner is thin wiring.

## Consequence: the `lisa validate` AC

AC4 ("a fresh/disjoint board still materializes normally and passes `lisa
validate`") is satisfied by D1's tolerant gather (`listIdsIn` returns `[]` for a
missing/empty dir ⇒ no collision ⇒ the existing write + `lisaValidate` path runs
unchanged). No change to the validate step.

## Summary of the chosen shape

```
materialize(plan, targets):
  existing  = listIdsIn(targets.storiesDir) ++ listIdsIn(targets.ticketsDir)   # impure gather
  generated = plan.stories.map(.id) ++ plan.tickets.map(.id)
  hits      = detectCollisions(generated, existing)                            # pure judge (T-004-01)
  if hits.length: throw new IdCollisionError(hits)                             # andon, before any write
  …existing mkdir + write loop unchanged…

runDecomposeEpic: … try { await materialize(...) ; lisaValidate }
                  catch IdCollisionError(e): outcome = "id-collision"; andon stdout naming e.collisions
RUN_OUTCOMES += "id-collision"
```
