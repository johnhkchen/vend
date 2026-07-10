# T-066-01-01 — story-contract-schema-and-render — Design

Decisions grounded in research.md. Each decision lists the options weighed and why the loser lost.

## D1 — The five fields are OPTIONAL (`string?`) in the BAML schema

**Options.**
(a) Required `string` fields.
(b) Optional `string?` fields → generated `field?: string | null`, SAP yields `null` when absent.
(c) Required fields + BAML `@assert`/`@check` constraints.

**Decision: (b).** The ticket's own words decide it: "a story missing a field surfaces as a
**typed absence** for the downstream gate to refuse — never a silently fabricated default."

- (a) is actively worse than it sounds: inside the all-array `WorkPlan`, a story object that fails
  required-field coercion is *dropped* by SAP — the story disappears from the plan instead of
  arriving incomplete. The downstream gate (T-066-01-02) then cannot name the story id in its
  `story-incomplete` andon because the story is gone. A silent disappearance is exactly the
  laundered evidence the house discipline forbids.
- (c) moves refusal into the parse layer, violating the module's own charter (decompose.baml
  header: "BAML owns SHAPE; gates own MEANING"). The gate list is where a shell must die, with a
  named andon and a logged verdict — T-066-01-02's whole job. Parse must *admit* the incomplete
  story and hand it over.
- (b) gives every consumer a compile-time prompt (`string | null | undefined`) that absence is a
  real state to handle — the typed absence the gate refuses on. Additive-optional also means every
  existing `StoryDraft` fixture and consumer (`renderStoryFile`, gates, the pure plan transforms)
  compiles unchanged, keeping this diff confined to schema + render + tests.

**Consequence to pin in a test, not assume:** this repo has no optional BAML field anywhere yet
(research §4/§8). The parse fixture asserting absence→`null` is therefore load-bearing, not
ceremonial.

## D2 — The exemplar is AUTHORED INTO the `.baml` prompt; the pure core exports the canonical

**Options.**
(a) Exemplar text lives only in the `decompose.baml` template; tests assert distinctive markers.
(b) Exemplar text lives in the template AND as an exported constant in `decompose-epic-core.ts`;
    the render test asserts the rendered prompt **contains the constant**, forcing the two copies
    to stay in sync.
(c) Thread the exemplar as a fourth template parameter (`DecomposeEpic(epic, charter, project,
    exemplar)`), sourced from a TS constant — single copy.
(d) Read `docs/active/stories/S-066-01.md` from disk at render time.

**Decision: (b).**

- (d) is disqualified outright: `decompose-epic` casts against *arbitrary target repos* —
  S-066-01.md exists only in vend's own repo. The exemplar is authored judgment, paid once at
  authoring (the ticket names P1 explicitly); it must be baked into the playbook, not fetched from
  the environment at cast time.
- (c) is a single-copy purist win but touches every render call site: the play's `render`, the
  bridge's `runOp`, the bridge op protocol (`BridgeOp`), and every existing render test op. It
  spreads a static string through a dynamic-parameter channel whose job is *per-cast* inputs
  (epic/charter/project vary per cast; the exemplar never does). Wrong channel.
- Between (a) and (b): (b) buys two things for the price of one duplicated string. First, the
  render test becomes a **sync poka-yoke** — edit the exemplar in either place without the other
  and `bun test` stops the line; the duplication is guarded, not hoped about. Second, the pure
  core gains the canonical contract artifacts the *sibling tickets* consume: T-066-01-02's gate
  needs the field list to check and its tests need a contract-shaped passing fixture; exporting
  `STORY_CONTRACT_FIELDS` and `STORY_CONTRACT_EXEMPLAR` from the addon-free core (the
  `DECOMPOSE_MAX_TURNS`/`DECOMPOSE_TOOLS` precedent — constants live where tests can load them
  without the addon) settles the shape once, here, as the keystone ticket should.
- This also honors the ticket's letter — "extend the play's render in
  `src/play/decompose-epic-core.ts`" — in the only way that module can honestly participate:
  research §3 showed the render *prompt* physically lives in `decompose.baml` (static template, no
  TS imports possible); the core's contribution is the exported contract constants the render
  test pins the prompt against.

**Whitespace risk, named:** byte-containment across BAML's `#"…"#` dedent is the one brittle
joint. Mitigation: author the exemplar lines at the same indent depth as the surrounding prompt
prose so the dedent is uniform; if full-string containment proves flaky during implement, degrade
the assertion to per-line trimmed containment (equally strong on content, immune to indent) and
record the deviation in progress.md.

## D3 — What the prompt demands, and where

Add one authored section to the `DecomposeEpic` prompt, after the five admit-criteria and before
"The epic to clear", titled **"Every story is a CONTRACT"**:

- Demands each story populate all five fields, naming the JSON field names exactly (`scope`,
  `storyAcceptance`, `honestBoundary`, `waveRationale`, `outOfSlice`) so the demand and
  `{{ ctx.output_format }}`'s schema display reinforce each other.
- States what each field must carry, in the charter's voice (one or two lines each — scope names
  the files/seams touched; storyAcceptance is an observable end-state, not a restated title;
  honestBoundary names what is deferred/free-vs-metered; waveRationale justifies the DAG's
  parallelism; outOfSlice fences what this story deliberately does not do).
- Embeds the exemplar (condensed from S-066-01.md, ~15 lines: the five sections' *content style*
  at contract quality) introduced as "the bar, drawn from a real cleared story".
- Ends with the honesty clause: a section you cannot fill truthfully is left ABSENT — never padded
  — because a downstream gate refuses shells and padding is laundering. This aligns the model's
  incentive with D1's typed absence instead of inviting filler.

Each new schema field also carries an `@description` (the output_format channel), mirroring the
demand in one line.

## D4 — Field names and types, verbatim from the ticket

`scope string?`, `storyAcceptance string?`, `honestBoundary string?`, `waveRationale string?`,
`outOfSlice string?` on `class StoryDraft`, in that order, after `tickets`. camelCase matches the
`doneSignal` precedent on `TicketDraft`. Multi-sentence prose fits a single string field; the DAG
block is *not* a field (research §7 — it is derived from ticket `depends_on` edges by
T-066-01-03's materializer; duplicating it as a story field would violate that ticket's
"derived, not duplicated" contract).

## D5 — Test design (both ACs, in `src/baml/decompose.test.ts`, one spawn)

Extend the existing single `runBridge` batch by appending ops (indices [0]–[4] stay stable):

1. **Round-trip populated (AC1a):** extend `CANNED`'s story with all five fields populated in
   S-066-01-flavored prose; assert each survives parse verbatim on the typed `StoryDraft`.
   (Existing tests [0]/[4] on CANNED's story only assert id/type/status/ticket-order, so
   enriching CANNED is additive, and the [4] open-model equality proof now covers the five fields
   for free by wrapping the same bytes.)
2. **Typed absence (AC1b):** append op [5] parsing `PARTIAL_CANNED` — same plan but the story
   carries only `scope` + `storyAcceptance` + `waveRationale`, omitting `honestBoundary` and
   `outOfSlice`. Assert: the story still parses (not dropped — pins D1's admit-don't-drop),
   present fields round-trip, and each absent field is `null`/`undefined` via
   `(x ?? null) === null` — and explicitly NOT a string (no fabricated default). A second
   shell-shaped fixture (none of the five) asserts all five absent — the exact shape T-066-01-02
   will refuse.
3. **Render demand + exemplar (AC2):** on the existing render result [2], assert the prompt
   contains each of the five field names (iterating `STORY_CONTRACT_FIELDS` from the core — the
   list and the prompt cannot drift apart) and contains `STORY_CONTRACT_EXEMPLAR` (D2's sync pin).
   The existing [2]≡[3] cross-client identity test extends coverage to the open-model render
   unchanged.

Importing the two constants from `decompose-epic-core.ts` into the test is safe: the core is
addon-free by charter (research §3), and it is already the module pure tests import.

## D6 — What does NOT change

`decompose-bridge.ts` (protocol and code — the type flows through the regenerated client),
`materialize.ts`, `gates.ts`, `decompose-epic.ts`'s `render` closure, all existing fixtures.
`baml_client/` regenerates via `bun run baml:gen` and stays gitignored.

## Rejected-summary

Required fields (silent story drop, gate can't name the id); parse-layer `@assert` refusal
(BAML owns shape, gates own meaning); exemplar as template param (static judgment in a per-cast
channel, triple call-site churn); exemplar read from disk (target repos don't carry vend's story
file); `toMatchSnapshot` (unused in this repo; containment assertions are the house "snapshot"
and survive unrelated prompt edits).
