# T-066-01-02 — story-completeness-gate — Structure

The blueprint: files touched, module boundaries, public surface, and change ordering.
No file outside this list changes. `materialize.ts` and `rdspi-workflow.md` are explicitly
hands-off (parallel siblings T-066-01-03 / -04).

## Files

### 1. `src/gate/gates.ts` — MODIFY (the substance)

**Header comment**: "four value-ordered gates" → five; ordering line becomes
`value → story-completeness → allocation → bounds → structural`; one added paragraph noting the
story-contract division of labor (BAML owns shape/typed absence — T-066-01-01; this gate owns
meaning/non-emptiness) and the `story-incomplete` andon token.

**`GATE_NAMES`** (line ~32):
```ts
export const GATE_NAMES = ["value", "story-completeness", "allocation", "bounds", "structural"] as const;
```
`GateName` derives automatically. No other type changes — `GateStop`/`GateClear`/`Offense`
untouched; the engine's `GateVerdict` takes `gate: string`, so nothing upstream recompiles
differently.

**New exported constants** (a `── story contract ──` section, placed with the pure helpers,
moved verbatim-in-spirit from `decompose-epic-core.ts` with doc comments adapted to the new
home — canonical home per design D4):
```ts
export const STORY_CONTRACT_FIELDS = [
  "scope", "storyAcceptance", "honestBoundary", "waveRationale", "outOfSlice",
] as const satisfies readonly (keyof StoryDraft)[];
export type StoryContractField = (typeof STORY_CONTRACT_FIELDS)[number];
```
(`StoryDraft` is already a type-only import here — the pin moves intact; module stays pure and
addon-free.)

**New gate function** (between `valueGate` and `allocationGate`, matching their shape):
```ts
function storyCompletenessGate(plan: WorkPlan): Offense | null
```
- Iterate `plan.stories` in order; for each story compute
  `missing = STORY_CONTRACT_FIELDS.filter((f) => !nonEmpty(s[f]))` (schema-order preserved by
  filtering the canonical list, not the story's keys).
- First story with `missing.length > 0` returns
  `{ unit: nonEmpty(s.id) ? s.id : "<story>",
     reason: `story-incomplete — missing: ${missing.join(", ")}` }`.
- `[]` stories ⇒ vacuous `null` (design D6, said in the doc comment).
- Doc comment states: the floor of P3 (an ungated output degrades to the minimum accepted),
  the andon token contract (`story-incomplete` + story id + missing sections — what the
  ticket/story/epic all name), and why non-emptiness only (quality is the render's job).

**`GATES` table**: insert `["story-completeness", (p) => storyCompletenessGate(p)]` as row 2.
`clear()` body and `isStop` unchanged (the table drives everything).

### 2. `src/play/decompose-epic-core.ts` — MODIFY (move + re-export, no semantic change)

In the `── story contract ──` section (lines ~356–380): delete the local
`STORY_CONTRACT_FIELDS` / `StoryContractField` declarations; in their place:
```ts
export { STORY_CONTRACT_FIELDS } from "../gate/gates.ts";
export type { StoryContractField } from "../gate/gates.ts";
```
(verbatimModuleSyntax: value and type re-exports split.) Section comment updated: canonical
home is now `gates.ts` (the enforcer owns the vocabulary); this re-export preserves every
existing import path (`decompose.test.ts` ×4) and the path T-066-01-03 will use.
`STORY_CONTRACT_EXEMPLAR` and its comment stay here untouched. The module already imports
gates.ts (`isStop`) — no new edge, direction unchanged (core → gates), graph stays acyclic.

### 3. `src/gate/gates.test.ts` — MODIFY

- `story()` helper: add contract-shaped defaults for all five fields (short, honest strings —
  S-066-01-flavored). Existing describes keep their verdicts untouched.
- Happy-path test: no edit needed (`cleared` asserts `[...GATE_NAMES]`).
- New `describe("story-completeness gate")` between the `value` and `allocation` describes
  (mirrors gate order), covering:
  1. shell story (all five fields absent via `null`/omission — today's ten-line shell at the
     parse layer) ⇒ STOP `{gate: "story-completeness", unit: <story id>}`, reason contains
     `story-incomplete` and all five field names;
  2. partial story (2 missing) ⇒ reason names exactly those 2, not the present 3;
  3. `scope: ""` / whitespace ⇒ missing (the empty-string meaning T-066-01-01 deferred here);
  4. contract-shaped story (the enriched default) ⇒ the plan clears — covered by happy path,
     plus an explicit pass assertion in this describe;
  5. ordering probes: shell story + purposeless ticket ⇒ stops at `value`; shell story +
     dangling `depends_on` ⇒ stops at `story-completeness` (position 2 pinned);
  6. multiple shell stories ⇒ the FIRST one's id is the unit (first-offense-wins).

### 4. `src/play/story-gate-cast.test.ts` — CREATE (the AC2 cast-level proof)

New bun test, ~150 lines, composing existing precedents; **no BAML addon** (WorkPlan/enum
imports type-only; enum members as string-literal casts).

Internal fixtures (all local to the file):
- `SHELL_PLAN: WorkPlan` — 1 shell story (five fields absent) + 1 fully-valid ticket (so every
  OTHER gate passes — isolates the refusal to the new gate);
- `CONTRACT_PLAN: WorkPlan` — same plan with the five fields populated;
- `stubExecutor(resultText)` — `Executor` whose `dispense` streams a minimal message sequence
  and returns a `ResultMessage` with `result: resultText` (cast.test.ts pattern);
- `decomposeShapedPlay(dirs)` — `Play<{epic, charter}, WorkPlan>`:
  `render` constant; `parse: (t) => JSON.parse(t)`; `gates: (plan, ctx) => clear(plan,
  {epic: ctx.inputs.epic, charter: ctx.inputs.charter})` (the real clearing function, wired
  exactly as `decomposeEpicPlay.gates` is); `effect` calls the real `materialize` into tmp
  `storiesDir`/`ticketsDir` and returns `{ok: true, artifacts}`.

Tests:
- **refused shell cast**: `castPlay` with `stubExecutor(JSON.stringify(SHELL_PLAN))` ⇒
  `outcome "gate-failed"`, `materialized false`; `storiesDir`/`ticketsDir` contain no files
  (dirs never created — the effect never ran); runs.jsonl has exactly one record with
  `outcome: "gate-failed"` and `gateResults` = one failed `story-completeness` row whose
  detail carries the story id, `story-incomplete`, and the missing section names.
- **contrast contract cast**: same play, `CONTRACT_PLAN` ⇒ `outcome "success"`,
  `materialized true`, the story file EXISTS — proves the pipeline lands when the contract is
  met, so the no-file result above is the gate's refusal, not fixture breakage.

### 5. `docs/knowledge/playbook-decompose-epic.md` — MODIFY (minimal)

§"The clearing gates": insert the story-completeness gate into the numbered list at position 2
(one entry, same voice as the existing four: what it checks, what the andon names); renumber
3–5. Nothing else in the doc changes.

## Public-surface delta

- `gates.ts` exports gain: `STORY_CONTRACT_FIELDS`, `StoryContractField` (moved), and the
  widened `GATE_NAMES`/`GateName` (now five members).
- `decompose-epic-core.ts` exports: unchanged *paths* (re-export), unchanged `STORY_CONTRACT_EXEMPLAR`.
- No engine, play-wiring, run-log, or CLI surface changes.

## Ordering of changes (compile-green at each step)

1. `gates.ts`: constants moved in + gate + table + names (self-contained, compiles alone).
2. `decompose-epic-core.ts`: swap local declarations for re-exports (consumers unaffected).
3. `gates.test.ts`: fixture enrichment + new describe.
4. `story-gate-cast.test.ts`: new file.
5. Playbook doc line.
6. `bun run check` (typecheck + lint + full suite) — the repo's real gate.

Steps 1–2 must land together in one commit (the move is atomic); 3–5 can ride the same commit
or follow — plan.md sequences the commits.
