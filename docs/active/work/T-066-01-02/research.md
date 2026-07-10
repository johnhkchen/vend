# T-066-01-02 — story-completeness-gate — Research

Descriptive map of what exists, where, and how it connects. No solutions proposed here.

## The ticket in one line

Add a story-completeness gate to `decompose-epic`'s gate list so a parsed story missing any of
the five contract fields STOPs the cast (named andon, story id + missing sections) before the
effect writes any file. Pure-core tested with fabricated parses; plus one cast-level test through
a stub executor proving a dispensed shell never reaches the effect.

## Where the gate list lives — `src/gate/gates.ts`

The play's gates are the exported `clear(plan, ctx)` in `src/gate/gates.ts` (303 lines):

- `GATE_NAMES = ["value", "allocation", "bounds", "structural"] as const` (line 32) — the single
  source of gate ordering. `clear()` walks the `GATES` table (line 273) in this sequence and a
  CLEAR echoes `cleared: [...GATE_NAMES]` (line 296).
- Verdict types: `GateStop { status:"stop", gate: GateName, unit, reason }` and
  `GateClear { status:"clear", cleared }`. **First failure wins** — `clear` returns the first
  gate's STOP, never accumulates (reporting the highest-value defect is the stated feature).
- Each gate is `(plan, ctx) => Offense | null` where `Offense = { unit, reason }`.
- House rule (header + budget.ts precedent): programmer error (malformed call) THROWS; an
  unworthy plan is a RETURNED STOP — an expected andon is data, not an exception.
- The module is PURE: no fs/clock/network/process; the `WorkPlan`/`StoryDraft`/`TicketDraft`
  imports are TYPE-ONLY (erased at runtime, never loads the BAML native addon), which is what
  lets `gates.test.ts` be an ordinary pure-function test.
- Helper already present: `nonEmpty(s: unknown): boolean` (line 92) — "present and non-blank
  after trimming". Exactly the "non-empty" semantics the ticket demands (covers `null`,
  `undefined`, `""`, and whitespace-only).
- Today's four gates check **tickets** almost exclusively. Stories are touched only by the
  allocation gate (`story.tickets` refs must resolve, line 206) and nowhere else — this is the
  hole the epic diagnosed: nothing checks a story body, so output degrades to the minimum the
  gates accept (E-066 intent).

## The five contract fields — settled by T-066-01-01 (commit f243432)

- Schema: `baml_src/decompose.baml` `class StoryDraft` gained five **optional** fields —
  `scope`, `storyAcceptance`, `honestBoundary`, `waveRationale`, `outOfSlice`, each `string?`.
  Optional is load-bearing: absence parses to a typed `null` (the gate's refusal input) rather
  than SAP silently dropping the story. A model may also emit explicit `null` — after parse it
  is indistinguishable from omission (both typed absence). Empty string `""` parses as a
  *present* string; T-066-01-01's review explicitly defers "non-empty" meaning to this gate.
- Canonical field list: `STORY_CONTRACT_FIELDS` + type `StoryContractField` in
  `src/play/decompose-epic-core.ts` (lines 370–379), pinned
  `satisfies readonly (keyof StoryDraft)[]` so a schema rename fails tsc. The comment block
  (line 356) says the list is "the single canonical field list … the render test and **the
  gate** both consume". `STORY_CONTRACT_EXEMPLAR` (prompt-drift pin) lives beside it — the gate
  does not need the exemplar.
- Current consumers of the list: `src/baml/decompose.test.ts` (4 sites — SHELL/PARTIAL fixture
  derivation and render assertions). Nothing else yet.

## The dependency-direction constraint (import cycle hazard)

`src/play/decompose-epic-core.ts` **value-imports** `isStop` (plus type `GateResult`) **from**
`src/gate/gates.ts` (line 18). Therefore `gates.ts` cannot value-import
`STORY_CONTRACT_FIELDS` back from `decompose-epic-core.ts` without creating a module cycle
(gates ⇄ core). The codebase is scrupulous about acyclic imports (the engine⊥play rule,
E-007 keystone; every module header narrates its dependency direction). Whatever design is
chosen must give the gate the field list without that cycle. Options exist (move the canonical
constant into gates.ts and re-export from core; or duplicate with a `satisfies` pin + equality
test) — Design decides.

## How a gate STOP flows through a cast — `src/engine/cast.ts` + `cast-core.ts`

`castPlay` (engine) runs: resolve tools → `play.render` → `executor.dispense` → budget `check`
→ `play.parse` → `play.gates` → pure `classify` → effect only on `verdict.materialize`:

- `decompose-epic.ts` wires `gates: (plan, ctx) => clear(plan, {epic, charter})` (line 249).
  `gates.ts`'s `GateResult` is structurally assignable to the engine's play-generic
  `GateVerdict` (`gate: string` — the engine is not bound to the four names, so adding a fifth
  name requires **zero engine change**).
- `classify` (`cast-core.ts` line 237): a gate stop ⇒ outcome `"gate-failed"`,
  `materialize: false` ⇒ **the effect never runs** ⇒ `materialize()` is never called ⇒ no story
  file is written. This is the mechanism the ticket's cast-level AC observes.
- `castGateRows` (line 225): a STOP → one failed row
  `{ gate, passed: false, detail: "<unit>: <reason>" }`; a CLEAR → one passed row per name in
  `cleared`. These land on the run record's `gateResults` (the "gateResults records the verdict
  either way" AC).
- stdout andon line (`cast.ts` line 264 + `stopReason` 337):
  `· andon: gate-failed — gate '<name>' stopped at <unit>: <reason>`.
- `RUN_OUTCOMES` (`run-log.ts` line 52) is a CLOSED list; a gate stop always logs outcome
  `"gate-failed"`. Named-andon vocabulary at the *outcome* level (`graph-invalid`,
  `id-collision`, `missing-capability`) exists only via effect/pre-dispense relabels. So the
  ticket's `story-incomplete` name must live in the gate verdict (gate name and/or reason), not
  in a new RunOutcome — unless the closed list were extended, which nothing here requires.

## The andon name in the source documents

- Ticket: "STOP with a named andon (`story-incomplete`, naming the story id and the missing
  sections)".
- Story S-066-01 acceptance: "replaying today's ten-line shell through the same cast is refused
  with a `story-incomplete` andon, no file written".
- Epic E-066 done-looks-like: "refused with a named andon (story-incomplete)".
- House naming precedent for gate names: other plays use kebab-case quality/rule phrases —
  `read-never-invent`, `honest-empty`, `fork-genuineness`, `leverage-rank`, `value-link`
  (steer/survey/expand cores). `GATE_NAMES` entries are echoed as *positives* in `cleared`.

## Test terrain

**Pure gate tests — `src/gate/gates.test.ts`** (204 lines): fabricated `WorkPlan` fixtures,
type-only BAML imports, enum member-name strings cast to erased enum types. Shared helpers:
`ticket(over)`, `story(over)`, `plan(tickets, stories?)`, `VALID`, charter fixture `CHARTER`
carrying P1..P7/N1..N4. **Crucial**: the `story()` helper builds stories WITHOUT the five
contract fields (they did not exist when it was written). Every describe's fixtures flow through
it; the happy-path test asserts `cleared` equals `[...GATE_NAMES]` (adapts automatically to a
fifth name). Once a story gate exists, every fixture with a default story becomes shell-shaped —
fixture enrichment is required or most existing tests change verdicts.

**Cast-level stub-executor precedent — `src/engine/cast.test.ts`**: a local `stubExecutor`
implementing `Executor.dispense` (streams canned messages, returns a `ResultMessage` whose
`result` is the text `parse` receives), a local fixture `Play` (echo), real `castPlay` with
`projectRoot`/`transcriptDir`/`runLogPath` under a tmp dir, then asserts the runs.jsonl record.
**Offline decompose-shaped precedent — `src/play/chain-propose-decompose.test.ts`**: builds a
full `WorkPlan` literal with enum member strings (`"Task" as DraftType` …) and calls the REAL
`materialize` into tmp `storiesDir`/`ticketsDir`. Together these show AC2's test can compose:
stub executor + a decompose-shaped fixture play whose `gates` is the real `clear` and whose
`effect` calls the real `materialize` — no BAML addon anywhere (`decompose-epic.ts` itself is
never value-imported by bun tests; addon one-call limit, module header line 24).

**materialize** (`src/play/materialize.ts`): pure render + one impure verb; collision guard
throws `IdCollisionError` before any write. Its story writer is T-066-01-03's territory
(parallel ticket — must not be touched here); this ticket only needs the *absence* of its output
after a refused cast.

## Sibling-ticket boundaries (wave rationale: disjoint files)

- T-066-01-01 (done): `decompose.baml`, `decompose-epic-core.ts` (contract section),
  `decompose.test.ts`.
- **T-066-01-02 (this)**: the gate — `src/gate/gates.ts` + `gates.test.ts` + a cast-level test;
  the story names "the play's gate list (`decompose-epic.ts`)" as scope, but the play already
  routes through `clear`, so the wiring may already be complete.
- T-066-01-03 (parallel): `materialize.ts` — hands off.
- T-066-01-04 (parallel): `rdspi-workflow.md` — hands off.
- `docs/knowledge/playbook-decompose-epic.md` §"The clearing gates" enumerates gates 1–4 —
  owned by no sibling; it is the doc `gates.ts`'s header cites.

## Constraints and assumptions surfaced

1. `gates.ts` must stay pure and addon-free (type-only BAML imports) — its test discipline
   depends on it. A value import of a *pure constant* keeps purity but risks the cycle above.
2. First-failure ordering is semantic: where the new gate sits in `GATE_NAMES` decides which
   defect is reported when a plan is both shell-storied and otherwise broken.
3. Zero-story plans: no current gate demands stories exist; `plan.stories` may legitimately be
   iterated vacuously.
4. `StoryDraft` optional fields arrive as `string | null | undefined`; `""`/whitespace must
   refuse (this gate owns "meaning"; BAML owns shape — T-066-01-01 review, gap #2).
5. The engine (`cast.ts`, `cast-core.ts`, `play.ts`) needs no change: `GateVerdict.gate` is
   already `string`, `classify` already blocks the effect on any stop.
6. Verification gate for the repo: `bun run check` (typecheck + lint + tests) — the real gate
   per CLAUDE.md / project memory.
