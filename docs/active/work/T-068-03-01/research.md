# Research — T-068-03-01 orphan-epic-detector

## The ticket in one line

A PURE detector that scans vend's built work-graph for an epic with zero child stories
and zero tickets — the half-minted state a terminally-failed `decompose-epic` leg leaves
behind — and returns the offending epic id(s). Over a fully-populated board it returns `[]`.
Pure unit test, no fs, never throws (the returned-data house rule).

## Parent story (S-068-03 orphan-epic-hygiene)

- **Scope:** a board-hygiene check catching an epic left with zero stories AND zero tickets
  after a terminally-failed decompose leg. Two layers: (1) a PURE detector over vend's built
  graph (this ticket), and (2) its surfacing as a `vend doctor` board-hygiene check
  (T-068-03-02, an impure probe that loads the board and emits a red `Check`).
- **Story acceptance:** over a board carrying a childless epic the detector returns that epic
  id; a fully-populated board returns `[]`. This ticket owns the pure half; T-068-03-02 owns
  the doctor surface + exit-code behaviour.
- **Honest boundary:** detection/flagging only — FREE and pure. It REPORTS the orphan; it does
  NOT auto-delete the epic card or auto-retry the decompose (destructive/metered repair is
  deferred). The chain-rollback alternative the epic names is NOT taken here.
- **DAG:** `T-068-03-01 (detector)` → `T-068-03-02 (doctor-orphan-check)`. Short serial chain;
  the doctor probe consumes this detector. Disjoint from S-068-01/02 (budget/run-log/classify),
  so this story runs in parallel with them.

## Parent epic (E-068 price-true-budget-units)

The epic's headline is budget-unit correctness; slice 3 (orphan-epic hygiene) is the
separable tail. "Done looks like": _a terminally-failed decompose leg leaves no orphan
behind — doctor flags (or the chain rolls back) an epic with zero stories/tickets instead of
staying green on the half-minted state._ E-068 also states RIGHT-SIZE (PE-7): slice 3 is
separable and may split into its own epic — here it is its own story, S-068-03.

## The built graph — where this detector reads (the load-bearing find)

`src/graph/model.ts` is the PURE core that turns the canonical board
(`docs/active/{epic,stories,tickets}/*.md`) into one typed, deeply-frozen `WorkGraph`. The
impure directory walk that feeds it is `src/graph/load.ts` (`loadWorkGraph`). Key types
(`src/graph/model.ts`):

```ts
interface WorkGraph {
  readonly epics:   readonly EpicNode[];
  readonly stories: readonly StoryNode[];
  readonly tickets: readonly TicketNode[];
  readonly byId:    Readonly<Record<string, AnyNode>>;
}
interface EpicNode  { kind: "epic";  id; title; status; …; stories: readonly StoryNode[]; }
interface StoryNode { kind: "story"; id; epicId: string | null; …; tickets: readonly TicketNode[]; }
interface TicketNode{ kind: "ticket"; id; storyId; …; }
```

**Containment is OBJECT references** (design of E-021): `epic.stories → StoryNode[]`,
`story.tickets → TicketNode[]`. The object graph is a TREE — no cycles. So an epic's child
stories are `epic.stories`, and its descendant tickets are `epic.stories.flatMap(s => s.tickets)`.

**Structural invariant that makes "AND zero tickets" collapse:** `buildGraph` links tickets
only through their parent story (`t.storyId`), and stories to epics only by the id convention
`epicIdForStory` (`S-NNN → E-NNN`). A ticket whose story is missing, or a story whose epic is
missing, is a `GraphIntegrityError` thrown at build time. Therefore, in any *validly built*
`WorkGraph`, a ticket can reach an epic ONLY via an existing story. Consequently:

> **An epic with zero child stories necessarily has zero descendant tickets.**

So "zero child stories AND zero tickets" reduces to `epic.stories.length === 0` on a built
graph. (An epic that HAS a story whose ticket-list is empty is a *different* partial-mint —
it has stories, so it is not "childless" — and is explicitly out of this slice.)

## The doctor pattern this feeds (T-068-03-02, read for placement)

- `src/doctor/doctor-core.ts` — PURE: `Check { name, ok, hint? }`, `passed(name)`,
  `failed(name, hint)`, `renderDoctorReport(checks): { ok, exitCode, report }`. Zero throws;
  offending outcomes are RETURNED data. `EXIT_OK = 0`, `EXIT_FAILED = 1`.
- `src/doctor/doctor-probe.ts` — IMPURE shell: gathers real-world facts (injected via
  `DoctorProbeDeps` for testability), emits one `Check` per dependency, wrapped in `safeCheck`
  so `probeDoctor` never rejects. This is the module T-068-03-02 will extend with a
  board-hygiene check that (a) loads the board (impure, injected) and (b) calls THIS detector.

So this ticket must expose a pure function the probe can call after an (impure) `loadWorkGraph`.

## House rules this detector must obey (observed across the codebase)

1. **Returned data, never thrown.** `doctor-core.ts`, `budget.ts`, `committed-core.ts`: an
   expected offending outcome is DATA, not an exception. This ticket's AC repeats it verbatim
   ("never throws"). The detector must be total over any `WorkGraph`.
2. **Pure core / impure shell split.** Judgment lives in a pure, fs-free module (unit-tested
   with in-memory fixtures); world-touching verbs live in a sibling shell. `model.ts` (pure) ↔
   `load.ts` (impure); `doctor-core.ts` (pure) ↔ `doctor-probe.ts` (impure). The detector is
   pure — it takes a `WorkGraph` value and returns ids; it does NOT load anything.
3. **Name the failure.** Downstream (T-068-03-02) will name the orphan epic + a fix-it hint;
   this ticket must surface enough to name it — the epic **id** is the AC-specified return.
4. **Deterministic ordering.** `buildGraph` returns `epics` already id-sorted
   (`epicNodes.sort((a,b) => a.id.localeCompare(b.id))`), so a detector that preserves
   `graph.epics` order yields id-sorted output for free.

## Test fixture pattern (from `src/graph/model.test.ts`)

The graph model is tested with in-memory `RawNode` builders fed to `buildGraph` — no fs:

```ts
const ticket = (id, story, deps=[]) => raw(`${id}.md`, { id, story, title, type, status, priority, phase, depends_on: deps });
const story  = (id, tickets)       => raw(`${id}.md`, { id, title, type:"story", status, priority, tickets });
const epic   = (id)                => raw(`${id}.md`, { id, title, status, advances:["P1"] });
buildGraph([epic("E-001")], [story("S-001-01", ["T-001-01"])], [ticket("T-001-01","S-001-01")]);
```

The detector's test will reuse this exact shape: `buildGraph` a fixture board with a childless
epic + a populated epic, assert the detector returns only the childless id; a fully-populated
board returns `[]`. This keeps the test a pure-function test with zero fs.

## Constraints & assumptions

- **Input is a *built* `WorkGraph`** (post-`buildGraph`), so referential integrity already
  holds — the detector need not re-validate edges. It only reads the frozen object tree.
- **The empty board** (zero epics) must return `[]` (vacuous — no orphans).
- **No status filtering** in scope: an epic is orphan by STRUCTURE (no children), independent
  of its `status` field. (A `done` epic with no children is still structurally half-minted; the
  epic/story say nothing about excluding by status, and decompose failure is the target case.)
- **Return type = `string[]` of epic ids** — exactly what the AC states ("returns that epic
  id" / "returns []"). The friendly title is reachable via `graph.byId[id]` if the doctor
  probe wants it; not this detector's concern.

## Open questions carried into Design

- **File placement:** `src/graph/` (graph analysis, next to `model.ts`) vs `src/doctor/`
  (consumed by the doctor probe). Both are defensible; Design decides.
- **Redundant `&& zeroTickets` guard:** given the invariant above, `stories.length === 0`
  suffices. Whether to also compute descendant-ticket count for literal-AC faithfulness /
  defence-in-depth is a Design call.
