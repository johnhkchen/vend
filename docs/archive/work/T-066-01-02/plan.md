# T-066-01-02 — story-completeness-gate — Plan

Ordered, independently verifiable steps; two atomic commits. Verification gate throughout:
`bun run check` (typecheck + lint + tests — the repo's real gate). File set is fixed by
structure.md; if implementation reveals a needed deviation, it is documented in progress.md
before proceeding.

## Commit 1 — the gate itself + unit coverage (AC1)

### Step 1 — `src/gate/gates.ts`: constants + gate + table
1. Add the `── story contract ──` section: `STORY_CONTRACT_FIELDS` (five names,
   `as const satisfies readonly (keyof StoryDraft)[]`) + `StoryContractField`, doc comments
   adapted from core's (canonical home now here; the enforcer owns the vocabulary).
2. Extend `GATE_NAMES` to `["value", "story-completeness", "allocation", "bounds",
   "structural"]`.
3. Add `storyCompletenessGate(plan): Offense | null` between `valueGate` and `allocationGate`:
   per story in order, `missing = STORY_CONTRACT_FIELDS.filter((f) => !nonEmpty(s[f]))`;
   first story with any missing ⇒ `{ unit: nonEmpty(s.id) ? s.id : "<story>", reason:
   "story-incomplete — missing: <joined names>" }`; `[]` stories vacuous-pass. Doc comment:
   P3 floor, the andon token contract, BAML-owns-shape/gate-owns-meaning, D6 vacuous note.
4. Insert the `GATES` table row 2: `["story-completeness", (p) => storyCompletenessGate(p)]`.
5. Header comment: four → five, updated ordering line.

**Verify:** module compiles (`bunx tsc --noEmit` or the check script's typecheck); no test run
yet (gates.test.ts is expected red until Step 3 — the shared `story()` fixture is shell-shaped).

### Step 2 — `src/play/decompose-epic-core.ts`: move → re-export
Replace the local `STORY_CONTRACT_FIELDS`/`StoryContractField` declarations with
`export { STORY_CONTRACT_FIELDS } from "../gate/gates.ts";` +
`export type { StoryContractField } from "../gate/gates.ts";`; trim the section comment to
name the new canonical home. `STORY_CONTRACT_EXEMPLAR` untouched.

**Verify:** typecheck; `bun test src/baml/decompose.test.ts` (the ×4 consumer — proves the
re-export path is seamless).

### Step 3 — `src/gate/gates.test.ts`: fixtures + the new describe
1. Enrich `story()` defaults with all five contract fields (short S-066-01-flavored strings).
2. New `describe("story-completeness gate")` (between the value and allocation describes),
   tests per structure.md §3: shell-all-five (unit = story id; reason has `story-incomplete` +
   all five names), partial-two (names exactly the two), empty-string/whitespace ⇒ missing,
   explicit-null ⇒ missing, explicit pass for the contract-shaped default, ordering probes
   (value still first; story-completeness before allocation), first-offending-story unit.

**Verify:** `bun test src/gate/gates.test.ts` — all green, including every pre-existing test
on its original verdict (the no-over-refusal proof).

### Step 4 — Commit 1
`feat(gates): story-completeness gate — a shell story STOPs before the effect (T-066-01-02)`
Run `bun run check` first; commit only on green (honest-on-outcome).

## Commit 2 — the cast-level proof (AC2) + doc line

### Step 5 — `src/play/story-gate-cast.test.ts` (new)
Per structure.md §4: type-only WorkPlan/enum imports; local `SHELL_PLAN` (shell story + one
fully-valid ticket so only the new gate can stop it) and `CONTRACT_PLAN`; `stubExecutor(text)`
(cast.test.ts pattern); `decomposeShapedPlay` wiring the real `clear` and real `materialize`
into tmp dirs; two tests:
- refused shell cast — `gate-failed`, `materialized false`, **no story/ticket file exists**,
  runs.jsonl `gateResults` = one failed `story-completeness` row naming story id + missing
  sections + `story-incomplete`;
- contrast contract cast — `success`, story file exists.

**Verify:** `bun test src/play/story-gate-cast.test.ts`.

### Step 6 — `docs/knowledge/playbook-decompose-epic.md`
Insert the story-completeness gate as entry 2 of §"The clearing gates" (one entry, existing
voice); renumber the following entries. Read the section first; keep the diff minimal.

### Step 7 — Full gate + Commit 2
`bun run check` (whole suite — catches any test elsewhere that fabricates a story and calls
`clear`; research found none besides gates.test.ts, this is the proof). Commit:
`test(play): cast-level proof a dispensed shell never reaches the effect (T-066-01-02)`.

## Testing strategy summary

- **Unit (pure)**: gates.test.ts — the gate's judgment on fabricated parses (AC1). Fast, no
  fs/addon.
- **Integration (cast-level)**: story-gate-cast.test.ts — stub executor through the real
  `castPlay` + real `clear` + real `materialize`; observes the *absence* of files and the
  ledger record (AC2). Real fs under tmp dirs, still no addon and no tokens (FREE, per the
  story's honest boundary).
- **Regression**: the full existing suite via `bun run check` — the enriched `story()` fixture
  is the explicit no-over-refusal check; `decompose.test.ts` re-proves the moved constant's
  import path.

## Risks & watch-items

1. **Hidden `clear()` callers with shell stories** — research grepped: only gates.test.ts.
   The full-suite run in Step 7 is the backstop.
2. **Lint/format** (`bun run lint`) — long reason strings and the re-export split may need
   formatting passes; run the check script, not just tests.
3. **`story-gate-cast.test.ts` tmp hygiene** — follow cast.test.ts's `mkdtemp`/`afterEach rm`
   pattern exactly (parallel test files share the runner).
4. **Parallel siblings** — do not touch `materialize.ts` / `rdspi-workflow.md`; if a change
   there seems needed, stop and record it in progress.md instead (missing DAG edge, per the
   workflow doc).

## Acceptance-criteria trace

- AC1 (unit: shell STOPs with andon naming story id + missing sections; contract passes;
  gateResults either way) → Steps 1–3 (gate + describe; `cleared` echo covers the pass-side
  gateResults, the failed-row shape is asserted at cast level and via GateStop fields).
- AC2 (cast-level: dispensed shell never reaches effect; no story file after refused cast)
  → Step 5.
