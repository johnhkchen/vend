# Plan — T-068-03-01 orphan-epic-detector

## Overview

One small, atomic change: a pure detector module + its pure test. The plan is short by design
(the ticket is a pure one-function detector). Steps are ordered so each is independently
verifiable, and the whole lands as a single commit-worthy unit.

## Steps

### Step 1 — write `src/graph/orphan.ts`

- House-style header comment: ticket/story/epic provenance; pure/total/fs-free/never-throws
  contract; the invariant that makes "zero stories" == "zero stories AND zero tickets" on a
  built graph; explicit NOT-here list (doctor surface, auto-repair, chain-rollback).
- `import type { EpicNode, WorkGraph } from "./model.ts";`
- `export function isOrphanEpic(epic: EpicNode): boolean` → `epic.stories.length === 0`, with
  the invariant comment.
- `export function findOrphanEpics(graph: WorkGraph): string[]` →
  `graph.epics.filter(isOrphanEpic).map((e) => e.id)`.
- Match `model.ts` formatting exactly (semicolons, 2-space, JSDoc on each export).

**Verify:** `bun run build` typechecks the module (types-only import resolves, no `verbatim`
violation).

### Step 2 — write `src/graph/orphan.test.ts`

Cover, using in-memory `buildGraph` fixtures (no fs), the cases enumerated in structure.md:

1. childless epic → `["E-002"]` (the primary AC).
2. fully-populated board → `[]` (the second AC).
3. multiple orphans → id-sorted (`["E-001","E-003"]`).
4. empty board (`buildGraph([],[],[])`) → `[]`.
5. story-exists-but-ticketless epic → NOT flagged (AND-collapse boundary / out-of-slice).
6. determinism + `not.toThrow` (the returned-data / never-throws AC).
7. `isOrphanEpic` predicate true/false directly.

**Verify:** `bun test src/graph/orphan.test.ts` — all green.

### Step 3 — full gate

Run the repo gate to prove nothing regressed and style is clean:
- `bun test` (whole suite still green — the new module is additive, imports nothing existing
  mutably).
- `bun run build` (typecheck + bundle green).
- `bun run lint` (format + lint clean; fix any formatting the linter flags to match `model.ts`).

## Testing strategy

- **Unit only.** This ticket is a pure function over an in-memory `WorkGraph`; there is no IO
  surface to integration-test. The AC explicitly scopes it to "pure unit test, no fs".
- **Real `buildGraph`, not a mock graph.** Fixtures are built through the genuine
  `buildGraph` so the test binds to the true frozen `WorkGraph` shape and catches any drift in
  `EpicNode.stories`. This mirrors `model.test.ts`.
- **Both AC branches are first-class tests** (childless → id; populated → `[]`), plus the
  boundary case (story-but-no-ticket) that proves the AND-collapse is intentional, plus the
  never-throws/deterministic assertions the house rule demands.
- The impure doctor-probe integration (loading a real board, emitting a `Check`, exit code) is
  T-068-03-02's test surface, NOT this ticket's — deliberately excluded.

## Verification criteria (definition of done for this ticket)

- [ ] `findOrphanEpics` returns the childless epic's id over a fixture board with one.
- [ ] `findOrphanEpics` returns `[]` over a fully-populated fixture board.
- [ ] The detector is a pure unit test — no fs, no addon, no clock imported.
- [ ] The detector never throws for any `WorkGraph` (zero `throw` statements; `not.toThrow`
      asserted).
- [ ] `bun test`, `bun run build`, `bun run lint` all green.

## Commit strategy

`orphan.ts` + `orphan.test.ts` are one logical unit and land together. Per the repo's
concurrency model (Lisa serializes commits across threads via file locking), the actual `git
commit` is left to Lisa's orchestration rather than performed ad hoc from this session on the
default branch; `progress.md` records the completed, gate-verified working-tree state so the
commit is a mechanical wrap-up. If committed manually, the message would be:
`feat(doctor): orphan-epic detector — flag epics with zero stories/tickets (T-068-03-01)`.

## Risks & mitigations

- **Formatting drift from the linter** → run `bun run lint` and align to `model.ts`; trivial.
- **Model-contract assumption** (zero stories ⟹ zero tickets) → documented in-code via the
  `isOrphanEpic` comment; the ticketless-story fixture test pins the intended boundary.
