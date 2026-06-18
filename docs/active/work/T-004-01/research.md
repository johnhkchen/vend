# Research — T-004-01 pure-id-collision-detector

Descriptive map of the codebase as it bears on a pure, cross-board ID collision
detector. What exists, where, how it connects. No solutions proposed here.

## The ticket in one line

Add `src/play/id-guard.ts` exporting a PURE
`detectCollisions(generated, existing) -> string[]` that returns the ids a
`WorkPlan` would mint which already exist on the target board. T-004-02 (the next
ticket in S-004-01) composes it into the materialize write path behind an andon
gate. This ticket delivers only the detector + its test.

## Why this exists — the defect it guards

`src/play/materialize.ts` is the back half of the DecomposeEpic convergence: a
cleared `WorkPlan` is written to `docs/active/stories/*.md` +
`docs/active/tickets/*.md` via `materialize()` (lines 155–176). That function does
`mkdir -p` then `writeFile` per story/ticket — **with no existence check**. Two
`writeFile` calls to the same path silently overwrite (observation 20349:
"materialize.ts Has No Collision Guard — Blindly Overwrites Existing Files").

The E-001 live proof (`work/T-002-04/proof.md` kaizen #4, `runs.jsonl` A1) showed
the play minting `S-001` / `T-001-01…` — ids that were safe **only** because A1
materialized into a sandbox. Against the live board those ids already exist, so a
real run would clobber hand-authored files. The epic E-004 is "cross-board-id-guard";
this detector is its pure heart.

## The existing in-plan uniqueness check (the precedent to extend)

`src/gate/gates.ts` already enforces uniqueness, but only *within* the plan:

- `idSetOf(tickets)` (lines 105–112) builds a `Set<string>` of ticket ids and
  returns the first duplicate seen.
- `allocationGate` (lines 190–214) stops the line on a duplicate ticket id
  ("every reference to it is ambiguous"), unresolved `depends_on`, cycles, and
  dangling `story.tickets` refs.
- The four gates run `value → allocation → bounds → structural`, andon on first
  failure (`clear()`, lines 283–291).

This is the "structural poka-yoke" the ticket references as
`playbook-decompose-epic.md` gate 4. It guarantees no two *generated* ids collide.
It does **not** know what is already on the board — that is the cross-board gap.

## Where the existing ids already flow through the system

`src/play/project-context.ts` already collects the board's current ids
(observations 20343, 20350):

- `listIds(root, dir)` (lines 87–94) lists `*.md` basenames (without extension)
  under a docs dir — exactly the id namespace (`S-001`, `T-002-03`).
- `assembleInputs` (lines 101–118) calls `listIds` for both
  `docs/active/stories` and `docs/active/tickets`, and folds them into the
  `buildProjectSnapshot` string handed to the model.

So the *existing* ids are already gathered impurely as `string[]` and the
*generated* ids live on the parsed `WorkPlan` (`plan.stories[].id`,
`plan.tickets[].id`). Both sides reduce to plain `string[]` — which is precisely
what this ticket's signature takes. T-004-02 will compose those two arrays; this
ticket owns only the comparison.

## The materialize → gate insertion point (T-004-02's concern, context only)

`src/play/decompose-epic.ts` `runDecomposeEpic` (lines 106–188) is the impure
orchestrator: assemble → render → dispense → parse → `clear` → `classify` →
on success `materialize` + `lisaValidate` → `appendRunLog`. Observation 20351
pins the guard's insertion point: **between `classify` and `materialize`** in
`runDecomposeEpic` — after the gates clear but before any file is written. That
is T-004-02's wiring; this ticket must not reach into it.

## The house purity pattern (the hard constraint)

Every sibling pure module documents the same discipline, and the test files
enforce it:

- `gates.ts` (lines 12–15), `materialize.ts` (lines 9–16),
  `decompose-epic-core.ts` (lines 1–14), `project-context.ts` (lines 7–11) all
  state: PURE = no fs, clock, network, process, or BAML native addon.
- The BAML import is **type-only** (`import type … from "../../baml_client"`),
  erased under `verbatimModuleSyntax` (tsconfig.json), so it never loads the
  native addon into the `bun test` process. The addon's once-driven reactor makes
  a test process flaky / one-call-limited (memory 20213/20218/20232) — purity is
  what lets these be ordinary pure-function tests.
- House rule (from `budget.ts`, echoed in `gates.ts` 17–18): a *programmer* error
  (malformed call) THROWS; expected "bad data" is RETURNED, not thrown.

This detector takes plain `readonly string[]` — it needs no BAML import at all,
not even type-only. It is the purest module in the tree.

## Test-style precedent

`materialize.test.ts` is the closest sibling: `bun:test` (`describe`/`test`/
`expect`), small fabricated fixtures, branch coverage, explicit comment that
baml imports are type-only. `gates.test.ts` (87 tests) covers each gate's
pass/fail and the boundary throws. The detector's test should match: a colliding
fixture asserting the *exact* reused ids, a disjoint fixture asserting `[]`, and
order/dedup pinned.

## Constraints & assumptions surfaced

- **Pure, addon-free.** No fs/network/addon; plain arrays in, array out.
- **Exact set semantics.** AC requires "exactly the reused ids" for a colliding
  fixture and `[]` for disjoint — so output must be precisely the intersection.
- **Order/dedup must be pinned** by the test (AC leaves the policy open but
  demands it be fixed and tested). Both inputs are `readonly string[]` — the
  generated side can in principle carry duplicates; the policy must say what
  happens.
- **No coupling to `materialize`/`project-context`.** The signature is plain
  string arrays so T-004-02 composes it; this module imports neither.
- **Ids are opaque strings.** No parsing of `E-`/`S-`/`T-` structure is required;
  collision is string equality on the id namespace `listIds` already produces.
- **Greenfield green bar.** 114 tests pass today; `bun run check:test` and
  `check:typecheck` must stay green (AC#3).

## Open questions for Design

1. Dedup policy: should a generated id that collides and appears twice be
   reported once or twice? (Lean: once — it is a *set* of offending ids.)
2. Order policy: order of first appearance in `generated`, or sorted? (Lean:
   first-appearance — stable, mirrors `gates.ts` "first duplicate" framing.)
3. Should `existing` duplicates matter? (No — `existing` is only ever membership-
   tested.)
