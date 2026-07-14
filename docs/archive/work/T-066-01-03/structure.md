# T-066-01-03 — materialize-contract-body — Structure

The blueprint: which files change, what each gains, and the module's internal organization after
the change. Two files touched, none created, none deleted.

## Files

| File | Change |
|---|---|
| `src/play/materialize.ts` | Modified — story renderer gains the contract body; ticket renderer, alias maps, guard, fs loops untouched except the one `renderStoryFile` call site |
| `src/play/materialize.test.ts` | Modified — new golden describe for the story body; new ticket byte-golden; existing describes updated only where the story-render signature is called |

Explicitly **not** touched: `src/play/decompose-epic.ts` (its effect calls `materialize`, whose
signature is unchanged), `src/play/decompose-epic-core.ts`, `src/play/gates.ts` (sibling ticket),
`baml_src/*`, `src/play/chain-propose-decompose.test.ts` (calls `materialize`, not
`renderStoryFile`; stays green via D2's degrade behavior).

## `src/play/materialize.ts` — internal organization after the change

Existing order preserved; new pieces slot in between `renderTicketFile` and `materialize`:

```
imports                       (unchanged: fs verbs, join, TYPE-ONLY baml types, guard, listIdsIn)
header comment                (amended: one paragraph on the contract body + cutDate purity)
TYPE_ALIAS / STATUS_ALIAS /
PRIORITY_ALIAS / PHASE_ALIAS  (unchanged)
MaterializeTargets            (unchanged)
MaterializeResult             (unchanged)
IdCollisionError              (unchanged)
RenderedFile                  (unchanged)
alias(), flowArray()          (unchanged)
renderTicketFile()            (unchanged — AC2's frozen surface)

── story contract body (T-066-01-03) ──
STORY_SECTION_LABELS          (new, module-private const)
dagBlock()                    (new, module-private pure helper)
renderStoryFile()             (signature widened; body rewritten)

materialize()                 (one hunk: compute cutDate once, filter storyTickets per story,
                               pass both to renderStoryFile; everything else identical)
```

### `STORY_SECTION_LABELS` (private)

The ordered field→prose-label table for the bold-labeled sections (D4):

```ts
const STORY_SECTION_LABELS = [
  ["scope", "Scope"],
  ["storyAcceptance", "Story acceptance"],
  ["honestBoundary", "Honest boundary"],
  // waveRationale is NOT here — it renders inside the DAG section (D3)
  ["outOfSlice", "Out of this slice"],
] as const satisfies readonly (readonly [keyof StoryDraft, string])[];
```

The `satisfies` pin mirrors `STORY_CONTRACT_FIELDS`'s: a schema rename fails `tsc` here before
any test runs. Private because the golden test pins the rendered output, not the table — no other
module needs it (the gate consumes `STORY_CONTRACT_FIELDS` from `decompose-epic-core.ts`, per D5's
no-coupling note). `waveRationale` and the two positional splits (scope/acceptance/boundary render
*above* the DAG, out-of-slice *below*) are placement facts the render function owns, so the table
carries only the bold-labeled four; the function composes them around the DAG section. If a
simpler shape falls out during implementation (two small tables, or labels inlined at the four use
sites), that is an allowed local simplification — the golden is the contract, not the table shape.

### `dagBlock(s, storyTickets)` (private, pure)

- Input: the `StoryDraft` + its `readonly TicketDraft[]` (already filtered by `materialize`).
- Builds `Map<id, TicketDraft>` from `storyTickets`; iterates `s.tickets` (execution order).
- Per line: `${id}  ${title}` when the draft is found, bare `${id}` when not (degrade, D3);
  appends `  ← ${depends_on.join(", ")}` when the found draft's `depends_on` is non-empty.
- Output: the full fenced block as a string —
  ` ```\n{lines}\n``` ` under the caller's `## DAG` heading (heading stays in `renderStoryFile`
  so the section reads as one unit there).

### `renderStoryFile(s, storyTickets, cutDate)` (exported, pure — widened)

```ts
export function renderStoryFile(
  s: StoryDraft,
  storyTickets: readonly TicketDraft[],
  cutDate: string,
): RenderedFile
```

- Frontmatter block: byte-identical to today (id, title, `type: story`, status, priority,
  tickets flow array).
- Body assembly: an array of *chunks*, joined with blank lines, then framed by the same leading
  `\n` / trailing `\n` the current body uses:
  1. For each of the three pre-DAG labels with a present (`!= null`) field:
     `**{Label}:** {value}`.
  2. Always: `## DAG` + `\n\n` + `dagBlock(...)`, then, when `waveRationale` is present,
     `\n\n` + `Wave rationale: {value}` (one chunk, so the rationale stays inside the section).
  3. When `outOfSlice` present: `**Out of this slice:** {value}`.
  4. Always: `---` then the footer line as the final chunk:
     `_Materialized by Vend's \`decompose-epic\` play — {n} ticket(s), {cutDate}._`
     where `n` is `s.tickets.length` (unchanged semantics).
- No throw paths added: absent fields skip (D2); unknown enum members still throw via the
  untouched `alias()` calls in the frontmatter.

### `materialize()` (one localized hunk)

```ts
const cutDate = new Date().toISOString().slice(0, 10);   // once per run, before the story loop
...
for (const s of plan.stories) {
  const storyTickets = plan.tickets.filter((t) => s.tickets.includes(t.id));
  const { name, body } = renderStoryFile(s, storyTickets, cutDate);
  ...
}
```

Guard, mkdir order, ticket loop, return shape: all unchanged. `MaterializeTargets`,
`MaterializeResult`, and the public `materialize` signature are unchanged, which is why no caller
file is touched.

## `src/play/materialize.test.ts` — organization after the change

- Fixture helpers `ticket()`/`story()` unchanged (their contract-less defaults are now
  load-bearing for the degraded-shape golden).
- `describe("renderStoryFile — story frontmatter")`: existing tests updated only at the call
  sites — `renderStoryFile(story(...), [], "2026-07-10")` — assertions unchanged (frontmatter
  bytes are unchanged, so they pass as-is).
- **New** `describe("renderStoryFile — contract body (T-066-01-03)")`:
  1. *contract golden*: full-fixture story (all five fields) + three tickets whose edges include
     a two-parent join; `expect(body).toBe(GOLDEN)` against an inline template literal.
  2. *degraded golden*: `story()` default (no contract fields) + one ticket →
     frontmatter + DAG + footer only, also `toBe`-pinned.
  3. *edge fidelity*: a `depends_on` naming an id outside the story renders verbatim; an
     `s.tickets` id missing from `storyTickets` renders as the bare id.
- **New** ticket byte-golden inside the existing `renderTicketFile` describe: one full-file
  `toBe` for `ticket()` — the executable form of "byte-identical to today", authored from the
  *current* renderer's output before any source edit.
- Collision-guard describe: untouched (calls `materialize`, whose signature didn't move).

## Ordering of changes (matters for AC2's honesty)

1. First capture the ticket golden from the **unmodified** renderer and land it in the test file
   (green against today's code) — the byte-identity bar is then real, not retro-fitted.
2. Then modify `materialize.ts` (renderer + verb hunk) and add the story-body goldens.
3. `bun run check` gates the whole.
