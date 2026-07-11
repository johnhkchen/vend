# Review — T-068-03-01 orphan-epic-detector

## What changed

Two new files, nothing modified or deleted:

| File | Lines | What |
|------|-------|------|
| `src/graph/orphan.ts` | ~49 | Pure detector: `isOrphanEpic(epic)` + `findOrphanEpics(graph)`. |
| `src/graph/orphan.test.ts` | ~95 | 7 pure unit tests over real `buildGraph` fixtures. |

`findOrphanEpics(graph: WorkGraph): string[]` returns the ids of every epic with zero child
stories — the half-minted residue of a terminally-failed `decompose-epic` leg. `isOrphanEpic`
is the exported single-node predicate that is the one source of the orphan rule.

## How it meets the acceptance criteria

> over a fixture board with a childless epic the detector returns that epic id; over a
> fully-populated board it returns []; pure unit test, no fs, never throws.

- **Childless epic → its id:** test 1 (`E-002` childless amongst a populated `E-001`) →
  `["E-002"]`. ✅
- **Fully-populated board → `[]`:** test 2. ✅
- **Pure, no fs:** the module imports a TYPE only (erased under `verbatimModuleSyntax`); the
  test builds every fixture in memory through `buildGraph` — no `node:fs`, addon, clock, or
  process anywhere. ✅
- **Never throws:** the body is `filter`/`map`/`.length` — total over any `WorkGraph`; zero
  `throw` statements; test 6 asserts `not.toThrow`. ✅ (the returned-data house rule.)

## Design rationale (the one judgment call)

"Zero child stories AND zero tickets" is implemented as `epic.stories.length === 0`. This is
NOT a shortcut: on a *built* `WorkGraph`, `buildGraph` links a ticket to an epic ONLY through
its parent story (`ticket.storyId` → story → epic via `epicIdForStory`), and a missing story or
epic on either edge is a `GraphIntegrityError` thrown at build time. So a ticket can reach an
epic only via an existing story ⟹ an epic with zero stories has zero descendant tickets. The
equivalence is documented in-code (module header + `isOrphanEpic` JSDoc). A redundant
`&& ticketCount === 0` clause was rejected as provably-dead code (no test could ever flip it) —
see design.md Option A′.

The boundary case is pinned by test 5: an epic whose only story is ticketless is NOT flagged (it
has a child story — a different partial-mint that S-068-03 explicitly leaves out of slice).

## Test coverage

7 tests, all green (`bun test src/graph/orphan.test.ts` → 7 pass / 0 fail):
- both AC branches (childless→id, populated→[]);
- multiple orphans returned id-sorted from an out-of-declaration-order board (proves ordering
  rides on `buildGraph`'s sort, no hidden dependence on input order);
- empty board → `[]` (vacuous);
- the ticketless-story boundary (the AND-collapse is intentional, not accidental);
- determinism + never-throws;
- the `isOrphanEpic` predicate true/false directly.

**Coverage assessment:** every branch of both functions is exercised (`filter` keep/drop,
`map`, `.length` zero/non-zero, empty input). Fixtures use the genuine frozen `WorkGraph`, so
the test binds to the real model shape, not a mock.

**Gaps (intentional, out of this ticket):** the impure board load + doctor `Check`/hint/exit-code
surface is T-068-03-02's test surface, not covered here. No property/fuzz test — unwarranted for
a two-line pure predicate.

## Full-gate result

- `bun run build` (`tsc --noEmit`) — clean.
- `bun run check` (baml:gen + typecheck + full suite) — **1578 pass, 1 skip, 0 fail** across
  107 files. The pre-existing skip is unrelated; the change is purely additive.

## Open concerns / handoff notes

1. **Commit is deferred to Lisa.** The working tree holds two new files, gate-verified, not yet
   committed (default-branch + cross-thread commit-serialization reasons — see progress.md).
   Suggested message:
   `feat(doctor): orphan-epic detector — flag epics with zero stories/tickets (T-068-03-01)`.
2. **Downstream contract for T-068-03-02:** the doctor probe should call `loadWorkGraph`
   (impure, injected for testability) then `findOrphanEpics`, and map a non-empty result to a
   red `Check` naming the ids + a fix-it hint + non-zero exit. `graph.byId[id].title` gives a
   friendlier name if wanted. Neither export carries doctor vocabulary — the seam stays clean.
3. **Model-contract assumption** (zero stories ⟹ zero tickets) is documented in-code and pinned
   by test 5; if `EpicNode` ever gained a direct `tickets` edge, revisit `isOrphanEpic`. Low
   risk (would be an E-021-scope change).
4. **No `lint` script** in this repo — the gate is `bun run check`. Style was matched to
   `model.ts` by hand; typecheck is the mechanical check and is clean.

## Verdict

Ready for review and Lisa's commit. Scope is exactly the pure half of S-068-03; the doctor
surface is correctly left to T-068-03-02.
