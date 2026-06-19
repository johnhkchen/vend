# T-018-01 — Research: steer-pure-core

Descriptive map of what exists and how it connects. The pure core of `SteerProject-lite`
(E-018, S-018-01): the `Fork` type + the `Steer` output (board `Signal[]` reusing E-016 +
`Fork[]`) + the `SteerProject` BAML function + three pure gates. This ticket is the
foundation; T-018-02 registers/casts/stages on top.

## 1. The mirror target — the Survey pure core (E-017)

`src/play/survey-core.ts` is the closest sibling and the explicit thing to mirror. Its shape:

- **`SURVEY_GATE_NAMES`** `= ["honest-empty", "read-never-invent", "leverage-rank"]` — a
  `const` tuple that is the single source of gate ordering; `clear()` runs the gates in this
  sequence and a CLEAR echoes the names.
- **`TIER_RANK`** (exported) `{ Keystone:0, High:1, Standard:2, Leaf:3 }` — the single source
  of the leverage ordinal; `tierRank(member)` looks up and **throws `RangeError`** on an
  unknown key (enum/map drift = programmer error).
- **Three gates** each `(board) => Offense | null` where `Offense = { unit, reason }`:
  - `honestEmptyGate` — refuses a board padded with a blank/filler signal (`what` AND `why`
    both blank); an EMPTY board is the honest abstention and PASSES (polarity inverts from
    expand, where a blank single Signal STOPs).
  - `readNeverInventGate` — refuses the first signal whose `grounding` is blank (speculation).
  - `leverageRankGate` — refuses the first adjacent inversion where `tierRank(hi) >
    tierRank(lo)`; empty/single boards and equal-tier ties pass (non-strict ordering). It
    REFUSES rather than silently sorts (the visible andon is the point).
- **`clear(board): GateVerdict`** — runs the ordered `GATES` table, returns the FIRST stop
  (the andon — no accumulation, no later gates) or `{ status:"clear", cleared:[...names] }`.
  A STOP is **returned data, never a throw** (the gates.ts house rule). Takes no ctx (board
  gates need no charter — the clean divergence from expand's `valueLink`, which greps charter).
- **`renderBoard(board): string`** — one `demand.md` row per signal via
  `renderSignalRow` (imported from `expand-core.ts`), joined by newlines; empty board → `""`.

**Purity discipline (load-bearing):** all BAML imports are **type-only** (`import type {
Board, Signal, SignalTier }`), erased under `verbatimModuleSyntax`, so no native addon loads
into a `bun test` process. The ONE runtime import is `renderSignalRow` from `expand-core.ts`,
which is itself pure (type-only BAML) — a genuine SHARED CONTRACT (both plays write the
IDENTICAL demand.md row), reused per the codebase's DRY-of-contracts rule. The incidental
`nonEmpty` predicate is COPIED per the no-shared-util idiom.

## 2. The `Signal` shape to reuse (E-016)

`src/play/expand-core.ts` owns the `Signal` contract and its renderer:

- **`Signal`** (generated, `baml_client/types.ts`): `{ what, why, tier: SignalTier, budget,
  advances: string[], grounding, readiness }`. `SignalTier` enum = `Keystone | High |
  Standard | Leaf` (member names; `@alias` maps to lowercase demand.md tokens).
- **`renderSignalRow(signal): string`** — one `demand.md` table row; pure; throws `RangeError`
  on tier enum/alias drift via `aliasTier`. This is the shared row contract steer reuses for
  its board half.
- **`nonEmpty`, `matchIds`, `flowArray`, `tierLabel`, `TIER_ALIAS`** — local helpers; `nonEmpty`
  is the copied predicate idiom.

## 3. The BAML authoring layer

`baml_src/` holds the play definitions; `bun run baml:gen` regenerates `baml_client/`
(gitignored build product). Relevant precedents:

- **`baml_src/survey.baml`** — `class Board { signals Signal[] }` + `function Survey(project,
  charter) -> Board`. References `Signal`/`SignalTier` from `expand.baml` (BAML shares types
  across `baml_src/`, never redefines them). `client ClaudeStub` (render-only; BAML is never
  the transport — the live seam is `src/executor/claude.ts`).
- **`baml_src/decompose.baml`** — `class WorkPlan { stories StoryDraft[]; tickets
  TicketDraft[] }`: an **all-array class with TWO array fields**. Comment pins the SAP
  leniency: such a class **never REJECTS** — a malformed reply DEGRADES to an empty plan.
- **SAP-degrade finding (T-017-01, obs 21370–21372):** `Board` has ONE array field, so a bare
  unstructured string THROWS (`b.parse` cannot coerce a bare string INTO `signals`), while an
  object-shaped reply missing `signals` DEGRADES to `{signals:[]}`. **WorkPlan's two array
  fields both fall to `[]` even on a bare string** — the divergence survey.test.ts pins. This
  predicts `Steer` (two array fields: `signals` + `forks`) DEGRADES like WorkPlan, not throws
  like Board — to be VERIFIED empirically via the bridge (read-never-invent: probe, don't
  assume).

### The bridge pattern (offline BAML test)

The BAML native addon allows exactly ONE successful native call per `bun test` process, so
tests cannot call `b.request`/`b.parse` directly. `src/baml/survey-bridge.ts` is the pattern:
a standalone script (`import.meta.main`) reading `{ ops }` from stdin, running render/parse in
a child `bun` process, emitting `{ results }` JSON on stdout. `extractPromptText` (the pure
reach-in that pulls rendered prompt text from the request body) is IMPORTED from
`decompose-bridge.ts` (signature: `(req: { body: { json: () => { messages?: unknown[] } } })
=> string`), already play-agnostic. `src/baml/survey.test.ts` spawns the bridge, feeds canned
ops, asserts on parse/degrade/render.

## 4. The contract the gates compose into

`src/engine/play.ts` defines `GateVerdict` (play-agnostic): `{ status:"clear", cleared?:
string[] } | { status:"stop", gate, unit, reason }`. `Play<I,O>.gates: (out, ctx) =>
GateVerdict`. A pure `clear(steer)` drops straight into `Play.gates` as `(steer) =>
clear(steer)` with no adapter (T-018-02 wires it). `CastContext<I> = { inputs, projectRoot }`.

## 5. What a Fork IS (grounding the new gate)

From `docs/active/epic/E-018.md`, the ticket, and `playbooks/project-steering.md` (move 3,
"Surface the real forks") + `clearing-dynamics.md` (author + assent):

- A **`Fork`** = **question · 2–4 options · why-it-matters · recommendation**. It is a *real*
  trade-off only the human can make (e.g. *"build the wallet now or measure trust first?"*,
  *"deeper-per-epic or chain-more-epics?"*) — the andon pull at the steering layer.
- **Fork-genuineness (signature gate):** a `Fork` must be genuine; a fake/inconsequential
  choice is refused; an **empty `Fork[]` is VALID** (a clear path surfaces no forks — "never
  survey what you can just choose"). The fork-side sibling of honest-empty / read-never-invent.
- Project-steering move 3: "recommendation first; ask on real forks, decide-and-proceed on
  defaults" — grounds requiring a `recommendation` and refusing non-choices.

## 6. Constraints & assumptions

- **Scope is the PURE CORE ONLY.** No registration, no `castSteer`, no staging effect, no CLI
  gesture — all T-018-02. This ticket: `Fork` + `Steer` types (BAML), the `SteerProject`
  function, the `steer-bridge`, the three pure gates + a fork renderer, unit-tested.
- The core must be **pure** (no fs/spawn/addon) and compose into `Play.gates` shape.
- Gate names are fixed by the ticket: **read-never-invent, fork-genuineness, leverage-rank**
  (note: NO separate board honest-empty gate — fork-genuineness carries the honest-empty
  sibling role for forks; the board's read-never-invent reuses the survey pattern).
- `bun run check:*` (baml:gen → typecheck → test) must be green.
