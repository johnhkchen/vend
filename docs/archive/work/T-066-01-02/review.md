# T-066-01-02 — story-completeness-gate — Review

Handoff self-assessment. Code landed on `main` in two commits:
- `8fa03e7` `feat(gates): story-completeness gate — a shell story STOPs before the effect`
- `f2fc076` `test(play): cast-level proof a dispensed shell never reaches the effect`

`bun run check` green at both commit points; final state 1533 pass / 1 pre-existing skip /
0 fail (1534 tests, 104 files) — on a tree that already included sibling T-066-01-03's
materialize change (`3150c51`), so the two tickets are proven to compose.

## What changed

**Files modified (3) + created (1) + doc (1):**

- `src/gate/gates.ts` — the substance.
  - `GATE_NAMES` is now five, ordered `value → story-completeness → allocation → bounds →
    structural` (the new gate at position 2: a shell story is a VALUE-articulation failure,
    reported ahead of graph mechanics; the empty/malformed-plan case keeps its documented home
    at `value`).
  - `STORY_CONTRACT_FIELDS` + `StoryContractField` MOVED here from `decompose-epic-core.ts`
    (canonical home; `satisfies readonly (keyof StoryDraft)[]` pin intact). Why moved: core
    already value-imports `isStop` from gates, so the gate importing the list from core would
    have cycled the module graph — and P3-wise the enforcer owning the contract's vocabulary is
    the right shape anyway.
  - `storyCompletenessGate(plan)`: per story in order,
    `STORY_CONTRACT_FIELDS.filter((f) => !nonEmpty(s[f]))`; first offending story STOPs with
    `unit` = story id (`"<story>"` fallback) and
    `reason: "story-incomplete — missing: <schema-ordered names>"`. Never a warning, never a
    pad-to-pass — a returned STOP, logged like every honest refusal. Zero-story plans pass
    vacuously (unchanged behavior; documented in the gate's comment). Reuses the existing
    `nonEmpty` helper, so `null`/`undefined`/`""`/whitespace are all "missing" — closing the
    empty-string gap T-066-01-01 explicitly deferred here.
- `src/play/decompose-epic-core.ts` — local declarations replaced with re-exports from
  gates.ts (split value/type per verbatimModuleSyntax); every existing consumer import path
  unchanged (`decompose.test.ts` ×4 re-proven green). `STORY_CONTRACT_EXEMPLAR` stays.
  Small forced deviation: the now-unused `StoryDraft` type import removed.
- `src/gate/gates.test.ts` — `story()` fixture enriched to contract-shaped defaults; new
  7-test `describe("story-completeness gate")`.
- `src/play/story-gate-cast.test.ts` (NEW) — the AC2 cast-level proof (below).
- `docs/knowledge/playbook-decompose-epic.md` — the gate added as entry 2 of the
  clearing-gates verify spec (the doc `gates.ts`'s header cites; no sibling owns it; the later
  rule-set section references gates by name, so renumbering has no fallout).

**Deliberately untouched:** `materialize.ts` (T-066-01-03, landed in parallel),
`rdspi-workflow.md` (T-066-01-04 — in flight in another thread's working tree at review time),
`decompose-epic.ts` (its `gates: clear(...)` wiring already routes through the extended gate
table — zero play change needed), the engine (`GateVerdict.gate` is `string`; `classify`
already blocks the effect on any stop), and `RUN_OUTCOMES` (a gate stop stays outcome
`gate-failed`; the `story-incomplete` andon token lives in the STOP's reason → run-record
`gateResults[].detail` → the stdout andon line, all three verified).

## Acceptance criteria — both met

- **AC1 (gate unit tests):** shell-shaped parse STOPs with `gate: "story-completeness"`,
  `unit: "S-009"`, reason carrying `story-incomplete` + all five field names; a partial parse
  pins the byte-exact reason (`"story-incomplete — missing: honestBoundary, outOfSlice"` —
  schema order, present fields excluded); whitespace-only counts as missing; the
  contract-shaped fixture clears; `gateResults` verdict both ways — the pass side via the
  `cleared` echo (`[...GATE_NAMES]`, happy-path test), the fail side via the failed-row shape
  asserted at cast level. Plus ordering probes pinning position 2, and a first-offense test.
- **AC2 (cast-level, stub executor):** a dispensed shell (`JSON.stringify(SHELL_PLAN)` through
  a stub `Executor`) ends `gate-failed` / `materialized: false`, and the stories/tickets dirs
  were never even created (the real `materialize` never ran) — no story file exists after the
  refused cast. runs.jsonl carries exactly one record whose `gateResults` equals the single
  failed `story-completeness` row naming `S-900` + all five missing sections. A contrast cast
  of the same pipeline with a contract-shaped plan lands (`success`, files exist, five passed
  rows in order) — proving the refusal is the gate's judgment, not fixture breakage.

## Test coverage assessment

- **No over-refusal, proven:** all 19 pre-existing gate tests pass on their original verdicts
  with only the fixture enriched — the new gate refuses shells, not stories.
- **The refusal is isolated:** the cast-level shell plan carries one fully-valid ticket, so
  every other gate passes; only story-completeness can be (and is) the stop.
- **Production wiring is exercised by proxy:** the fixture play wires
  `clear(plan, {epic, charter})` byte-for-byte as `decomposeEpicPlay.gates` does, but the real
  `decomposeEpicPlay` object itself is never cast in tests (BAML addon, bun-test one-call
  limit — the standing repo constraint, not new debt).
- **Gap (accepted, epic-scoped):** no live metered cast — per the story's honest boundary,
  everything here is fixture-proven and FREE; the live cast + gold-master capture close the
  epic, human-authorized.

## Open concerns for a human reviewer

1. **`--no-gates` bypasses this gate too** (by design): the E2 probe mode skips the whole gate
   phase, so a shell CAN materialize under `vend run --no-gates`. That is the documented
   variance-probe control arm, not a leak — but worth remembering when reading probe boards.
2. **Zero-story plans still clear** (vacuous pass, pre-existing behavior). A plan with tickets
   but NO stories emits no story files and trips nothing. If that shape ever occurs in the
   field it arguably deserves its own gate; out of this slice, noted here deliberately.
3. **First-offense-wins means one shell at a time:** a plan with three shell stories reports
   only the first (house style, pinned by test). A human retrying a refused cast may see the
   andon "move" to the next story. Consistent with every other gate; flagging for awareness.
4. **Byte-exact reason strings in two tests** (`partial`, cast-level `gateResults`): a future
   rewording of the reason format will fail those tests — intentional (the andon token and
   section-naming are the ticket's contract), but the editor should update them together.
5. **Ordering probes freeze position 2.** If a future gate re-prioritization moves
   story-completeness, two tests + the header comment + the playbook doc must move together.

## Nothing critical outstanding

No TODOs in code, no skipped steps, no red anywhere. What the siblings consume:
`STORY_CONTRACT_FIELDS` / `StoryContractField` now canonical in `src/gate/gates.ts`,
re-exported unchanged from `src/play/decompose-epic-core.ts`; the gate is live in every
`decompose-epic` cast via the existing `clear` wiring, no caller changes anywhere.
