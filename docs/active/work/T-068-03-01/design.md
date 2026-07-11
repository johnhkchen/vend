# Design — T-068-03-01 orphan-epic-detector

## The decision, up front

Add ONE pure function to a new module `src/graph/orphan.ts`:

```ts
export function findOrphanEpics(graph: WorkGraph): string[]
```

It returns the ids of every epic in `graph` whose child-story list is empty (equivalently:
zero descendant tickets — see the invariant), in the graph's existing id-sorted order. Pure,
total, fs-free, zero throws. A sibling `src/graph/orphan.test.ts` covers both AC branches with
in-memory `buildGraph` fixtures.

## Approaches considered

### A. Structural check on the built graph — `epic.stories.length === 0` (CHOSEN)

Operate on the already-built, integrity-validated `WorkGraph`. An epic is orphan iff it has no
child stories. By the model invariant (Research §"the load-bearing find"), zero stories ⟹ zero
descendant tickets, so this is exactly "zero child stories AND zero tickets" on a valid graph.

- **Pro:** trivially pure (reads a frozen object tree), total (a `.filter`/`.map` over an
  array never throws), deterministic (`graph.epics` is pre-sorted by id). Matches the AC's
  "pure unit test, no fs, never throws" word-for-word.
- **Pro:** consumes the canonical `WorkGraph` — the SAME structure the doctor probe
  (T-068-03-02) already has to load via `loadWorkGraph`. No parallel data model.
- **Con:** relies on the build-time integrity guarantee. Mitigated: the detector's contract is
  explicitly "given a *built* `WorkGraph`"; a corrupt board never reaches here (`buildGraph`
  throws first). If we want defence-in-depth we can *also* count descendant tickets (Option A′).

### A′. Belt-and-suspenders — `stories.length === 0 && descendantTicketCount === 0`

Same as A but additionally flatten `epic.stories` to count tickets and require both zero.

- **Pro:** literally mirrors the AC phrasing "zero child stories AND zero tickets"; robust if
  the model ever allowed a ticket to attach to an epic without a story.
- **Con:** the second clause is provably dead on a valid graph (zero stories ⟹ empty flatMap ⟹
  zero tickets), so it adds a branch no test can ever exercise to `true`-then-`false`. Dead
  code is a smell the codebase avoids (cf. `runGraph`'s "unreachable" guards are kept minimal
  and commented). **Rejected** in favour of A + a one-line comment documenting the equivalence.

### B. Detect over the raw board (RawNode lists / frontmatter), before `buildGraph`

Re-derive containment from ids (group stories under epics by `epicIdForStory`, tickets under
stories by `storyId`) directly from parsed frontmatter, bypassing the object graph.

- **Con:** duplicates `buildGraph`'s linking logic — a second, drifting source of the
  epic→story→ticket edge. E-021's whole point is ONE place assembles that graph. **Rejected.**
- **Con:** would have to re-handle malformed frontmatter, re-implement the id convention, and
  re-sort — all already done, correctly, in `model.ts`.

### C. Put the detector in `src/doctor/` (e.g. `orphan-core.ts`)

The consumer is the doctor probe, so co-locate with `doctor-core.ts`.

- **Con:** the detector knows NOTHING about doctor concepts (`Check`, exit codes, hints) — it
  is pure graph analysis over `WorkGraph`. Placing it in `doctor/` would make `doctor/` import
  the graph model for a function that has no doctor vocabulary. The doctor SURFACE (Check +
  hint + exit code) is T-068-03-02's job and lives in `doctor/`; the graph FACT belongs with
  the graph. **Rejected** in favour of D.

### D. Put the detector in `src/graph/` next to `model.ts` (CHOSEN placement)

- **Pro:** the detector is a read-only analysis of `WorkGraph`; `graph/` is where the graph and
  its pure operations live (`model.ts` builds it, `orphan.ts` queries it). Symmetric with the
  existing pure/impure split: `model.ts`/`orphan.ts` are pure; `load.ts` is the impure shell.
- **Pro:** T-068-03-02's probe already imports from `graph/` (`loadWorkGraph`); importing
  `findOrphanEpics` from the same module family is natural layering — doctor consumes graph
  facts, exactly as `doctor-probe` consumes `executor/select` facts today.

## Chosen design in detail

**Module:** `src/graph/orphan.ts` (new). **Test:** `src/graph/orphan.test.ts` (new).

**Signature & contract:**

```ts
import type { EpicNode, WorkGraph } from "./model.ts";

/** Return the ids of every ORPHAN epic — one with no child stories (⟹ no descendant tickets),
 *  the half-minted residue of a terminally-failed decompose leg. PURE, TOTAL, fs-free, throws
 *  nothing (returned-data house rule). Order follows `graph.epics` (id-sorted by buildGraph). */
export function findOrphanEpics(graph: WorkGraph): string[] {
  return graph.epics.filter(isOrphanEpic).map((e) => e.id);
}

/** An epic is orphan iff it has zero child stories. On a built WorkGraph a story is the only
 *  path from a ticket up to an epic, so zero stories ⟹ zero descendant tickets — i.e. this is
 *  exactly "zero child stories AND zero tickets" (T-068-03-01 AC). Exported so a caller/test can
 *  ask about one epic node directly. PURE. */
export function isOrphanEpic(epic: EpicNode): boolean {
  return epic.stories.length === 0;
}
```

- **Return `string[]`, not the nodes:** the AC specifies "returns that epic id" / "returns
  []". Ids are the minimal, stable contract the doctor probe needs to name the offender;
  `graph.byId[id]` recovers the full node/title if T-068-03-02 wants a friendlier message.
- **Expose `isOrphanEpic` too:** a tiny predicate makes the "orphan" definition a single named
  thing (no magic `.length === 0` scattered), and lets the doctor probe or a future
  chain-rollback ask about one node without rebuilding the whole list. Cheap, pure, documents
  intent. It is the single source of the orphan rule.

**Why a comment, not a second clause, carries "AND zero tickets":** the invariant is a property
of `buildGraph`, not of this function's inputs at large. Documenting it (with a pointer to the
`storyId`/`epicIdForStory` linking that guarantees it) is more honest than a dead `&&` that no
test can flip, and it keeps the function a clean one-liner in the `model.ts` house style.

## Purity, totality, determinism (the AC, discharged)

- **Pure / fs-free:** the only import is a TYPE (`WorkGraph`, `EpicNode`), erased under
  `verbatimModuleSyntax`. No `node:fs`, no clock, no addon, no `process`. Mirrors `doctor-core.ts`.
- **Total / never throws:** body is `Array.prototype.filter` + `.map` over `graph.epics` and a
  `.length` read — none can throw for any `WorkGraph` value. Zero `throw` statements, matching
  the returned-data rule the AC restates.
- **Deterministic order:** `buildGraph` sorts `epics` by id; `filter`+`map` preserve order, so
  output is id-sorted with no extra sort needed. (A defensive `.sort()` is unnecessary and would
  only mask a change in the model contract — omitted.)

## What is explicitly NOT in this ticket (per story/epic boundary)

- No `Check`, no exit code, no fix-it hint, no board loading — that is T-068-03-02 (the impure
  doctor probe consuming this detector).
- No auto-repair (deleting the card, re-casting decompose) — deferred, metered/destructive.
- No chain-rollback — the named-but-deferred alternative surface.
- No status-based filtering, no "story exists but ticketless" partial-mint detection — out of
  this slice (only the fully-childless epic is the target).

## Risks

- **Model-contract drift:** if `EpicNode` ever gained a direct `tickets` field bypassing
  stories, `stories.length === 0` could under-report. Low risk (would be a large E-021-scope
  change) and caught by the fixture test's intent; the `isOrphanEpic` comment flags the
  assumption for any future editor.
