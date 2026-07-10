# T-066-01-02 — story-completeness-gate — Design

Decisions grounded in research.md. Each names the options weighed and why the winner won.

## D1 — Where the gate lives: a fifth entry in `gates.ts`'s gate table

**Options**
a) A fifth gate inside `src/gate/gates.ts`: add to `GATE_NAMES`, add a `storyGate` function,
   add a row to the `GATES` table.
b) Chain a separate check in the play's `gates` closure (`decompose-epic.ts`):
   `storyCheck(plan) ?? clear(plan, ctx)`.
c) A standalone module `src/gate/story-gate.ts` composed by the play.

**Decision: (a).** The ticket says "add … to `decompose-epic`'s gate list", and the gate list
*is* the `GATES` table — `clear` is the single clearing function the play wires
(`decompose-epic.ts:249`), so (a) ships with **zero play/engine change**: the STOP flows through
the existing `GateResult → GateVerdict → classify → gate-failed → no effect` path, and a CLEAR's
`cleared` echo automatically logs the fifth passed row (the AC's "gateResults records the
verdict either way"). (b)/(c) would bolt a second verdict source onto the play, bypass the
`cleared` echo (a passing run would not log the new gate), and put untestable logic in
`decompose-epic.ts` (never value-imported by bun tests — addon). Rejected.

## D2 — Naming: gate `story-completeness`, andon token `story-incomplete` in the reason

**Options for the `GateName`**: `story-completeness` / `story-contract` / `story-incomplete`.

**Decision:** the gate is **`story-completeness`** — the ticket's own noun ("a
story-completeness gate"), and it matches house style: gate names name the quality checked
(`value`, `bounds`, `read-never-invent`, `honest-empty`) and are echoed as *positives* in
`cleared` — a cleared gate named `story-incomplete` would read as a defect present. Rejected
`story-contract` (vaguer; the check is completeness of the contract, not the contract itself).

**Where `story-incomplete` (the named andon from ticket/story/epic) lives:** the STOP's
`reason` is prefixed with the literal token:
`story-incomplete — missing: scope, honestBoundary, …`, with `unit` = the story id. This makes
the andon name appear verbatim in all three surfaces without touching the closed `RUN_OUTCOMES`
list (research: outcomes stay `gate-failed` for any gate stop; only effects relabel outcomes):

- stdout: `· andon: gate-failed — gate 'story-completeness' stopped at S-001: story-incomplete — missing: …`
- run record `gateResults[0].detail`: `S-001: story-incomplete — missing: …`
- the returned `GateStop` a unit test asserts on.

Rejected: a new `RunOutcome "story-incomplete"` — would need the engine's play-agnostic
`classify` to special-case one play's gate (breaks the engine⊥play boundary) and extend a
closed, versioned ledger vocabulary for no functional gain.

## D3 — Ordering: second, between `value` and `allocation`

`GATE_NAMES = ["value", "story-completeness", "allocation", "bounds", "structural"]`.

First-failure-wins makes position semantic. The module's charter orders gates by **priority of
VALUE, not of format**. A shell story is a value-articulation failure — the story cannot say
what it owns, proves, or defers — which outranks graph mechanics (allocation) and format
(structural). Placing it after `value` keeps the two established behaviors intact: a
zero-ticket/malformed plan still reports at `value` (`<plan>`), and a ticket that advances
nothing still reports at `value` before its story's shape is judged. Rejected: appending last
(would report a shell story only after structural nits — inverts the value ordering); first
(the empty-plan MALFORMED case must keep reporting at `value`, its documented home).

## D4 — Sourcing the field list: canonical constant moves to `gates.ts`, core re-exports

The gate must iterate the five names; research pinned the hazard: core already value-imports
`isStop` from gates, so gates cannot import `STORY_CONTRACT_FIELDS` from core (cycle).

**Options**
a) Move the canonical `STORY_CONTRACT_FIELDS` + `StoryContractField` into `gates.ts`
   (which already type-imports `StoryDraft`, so the `satisfies readonly (keyof StoryDraft)[]`
   pin moves intact); `decompose-epic-core.ts` **re-exports** them from gates, so every
   existing consumer (`decompose.test.ts`, 4 sites) and T-066-01-03's planned import path keep
   working unchanged. `STORY_CONTRACT_EXEMPLAR` stays in core (the gate never needs it).
b) Duplicate the list in gates.ts with its own `satisfies` pin + a cross-module equality test.
c) A third shared module (`src/gate/story-contract.ts` or similar).
d) Let gates import core anyway (ESM tolerates function-time cycles).

**Decision: (a).** One canonical copy (T-066-01-01's stated intent: "the single canonical field
list … the render test and the gate both consume"), zero consumer churn via re-export, and the
dependency arrow points the way it already does (core → gates). Conceptually right too: P3 says
gates are the contract — the contract's vocabulary lives with its enforcer. (b) adds a second
copy plus a drift test for no benefit; (c) is a new module for one constant; (d) violates the
repo's explicitly-narrated acyclic-import discipline even if the runtime tolerates it. Note
T-066-01-01 is **done** (f243432), so editing core's contract section is not a parallel-file
conflict; the edit is a move-and-re-export, not a semantic change.

## D5 — Offense shape: first offending story, ALL its missing sections named

Per story, collect every field failing `nonEmpty` (the existing helper — covers `null`,
`undefined`, `""`, whitespace; exactly the "non-empty" the ticket demands and the empty-string
meaning T-066-01-01 deferred here). The first story with any missing field STOPs with all of
*its* missing fields listed in schema order (`STORY_CONTRACT_FIELDS` order). Matches the
ticket ("naming the story id and the missing sectionS") while preserving the module's
first-offense-wins style across units. Unit falls back to `"<story>"` when the id itself is
blank (mirror of structuralGate's `"<ticket>"`). Field names are reported as the schema/prompt
names (`scope, storyAcceptance, honestBoundary, waveRationale, outOfSlice`) — the same tokens
the render demands, so a human fixes the right thing.

## D6 — Zero-story plans pass vacuously

No existing gate demands stories exist; the gate judges "every parsed story", which is vacuous
over `[]`. Demanding story presence would change behavior for plans that legitimately cleared
before this ticket and is not in the AC. Documented in the gate's comment; flagged in review.

## D7 — Test strategy, unit level (`gates.test.ts`)

- Enrich the shared `story()` helper with contract-shaped defaults for all five fields (drawn
  in spirit from S-066-01, the passing exemplar the ticket names). Every existing fixture then
  stays on its current verdict — the suite proves the gate does not over-refuse.
- New `describe("story-completeness gate")`: shell story (all five absent — today's ten-line
  shell at the parse layer, exactly T-066-01-01's `SHELL_CANNED` shape) STOPs with
  `gate: "story-completeness"`, `unit` = story id, reason containing `story-incomplete` and
  every field name; a partial story lists exactly its missing fields (and not the present
  ones); `""`/whitespace-only counts as missing; explicit `null` counts as missing; a
  contract-shaped story passes; the happy-path `cleared` echo now carries five names (existing
  test adapts via `[...GATE_NAMES]`); ordering probes (shell story + no-purpose ticket ⇒
  `value`; shell story + dangling depends_on ⇒ `story-completeness` — position pinned).

## D8 — Test strategy, cast level (new `src/play/story-gate-cast.test.ts`)

Composes two proven precedents (cast.test.ts's stub executor; chain-propose-decompose.test.ts's
type-only WorkPlan literals + real `materialize`) into the AC's end-to-end proof, with **no BAML
addon**: a fixture `Play<{epic,charter}, WorkPlan>` whose `parse` is `JSON.parse`, whose `gates`
is the **real** `clear` (same wiring shape as `decomposeEpicPlay.gates`), and whose `effect`
calls the **real** `materialize` into tmp dirs. The stub executor's `ResultMessage.result`
carries `JSON.stringify(plan)` — the "dispensed" text.

- Refused cast: shell plan dispensed ⇒ `outcome === "gate-failed"`, `materialized === false`,
  **stories dir does not exist / holds no file** (the effect never ran), and the runs.jsonl
  record's `gateResults` is the single failed `story-completeness` row naming the story id +
  missing sections.
- Contrast cast: the same pipeline with a contract-shaped plan ⇒ `success`, story file exists —
  proves the refusal above is the gate's doing, not a broken fixture pipeline.

Rejected: casting the real `decomposeEpicPlay` (value-imports the BAML addon — bun-test
one-call limit; research), and asserting only the unit level (the AC explicitly demands the
cast-level no-file proof).

## D9 — Documentation touch: playbook + module headers

`gates.ts`'s header and `playbook-decompose-epic.md` §"The clearing gates" both enumerate four
gates; the playbook is the "verify spec" the header cites and no sibling ticket owns it. Update
both minimally (fifth gate line; ordering string). `rdspi-workflow.md` stays untouched —
T-066-01-04's file.

## Out of scope (fences)

`materialize.ts` (T-066-01-03), `rdspi-workflow.md` (T-066-01-04), live metered casts and the
gold-master capture (epic close, human-authorized), any `RUN_OUTCOMES` extension, demanding
stories exist, and validating contract *quality* beyond non-emptiness (a gate can check
presence honestly; prose quality is the render's + human's job).
