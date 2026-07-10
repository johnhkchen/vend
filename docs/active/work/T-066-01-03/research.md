# T-066-01-03 — materialize-contract-body — Research

Descriptive map of everything the story-writer change touches. No solutions here — just what
exists, where, and the constraints it imposes.

## The ticket in one line

`renderStoryFile` in `src/play/materialize.ts` writes a one-line body today
(`Materialized by Vend's \`decompose-epic\` play — N ticket(s).`); it must instead write the
contract body — five sections from the parsed story, a DAG block **derived** from the tickets'
`depends_on` edges, and the old provenance line demoted to a footer that also says *when*.
Ticket rendering must stay byte-identical.

## The module: `src/play/materialize.ts`

- **Charter (header comment)**: render functions (`renderTicketFile`, `renderStoryFile`) and the
  alias maps are PURE — no fs, no clock, no native addon — so `materialize.test.ts` is an
  ordinary pure-function test. The BAML import is TYPE-ONLY (erased under
  `verbatimModuleSyntax`), never loading the native addon into `bun test`.
- **`renderStoryFile(s: StoryDraft): RenderedFile`** (line 161): frontmatter is
  id / title / `type: story` (hardcoded) / status / priority / `tickets:` flow array; body is the
  single provenance line. It receives **only the StoryDraft** — it has no access to the plan's
  tickets today, which the DAG block will need.
- **`materialize(plan, targets)`** (line 188): the single IMPURE verb — collision guard first
  (`IdCollisionError` before any write), then `mkdir -p` + `writeFile` loops. It iterates
  `plan.stories` and calls `renderStoryFile(s)` per story; `plan.tickets` is in scope at that
  call site, so threading tickets into the story render is a local change.
- House rule stated in `alias()` (line 105): caller/wiring error THROWS (`RangeError` on
  enum/map drift) — never silently-wrong output.

## The settled input shape (T-066-01-01, commit f243432)

`baml_src/decompose.baml` `class StoryDraft` gained five **optional** fields, regenerated into
`baml_client/types.ts:163`:

```ts
scope?: string | null
storyAcceptance?: string | null
honestBoundary?: string | null
waveRationale?: string | null
outOfSlice?: string | null
```

Optional was the load-bearing choice: an absent section parses to a **typed absence**
(`null`/`undefined`), never a fabricated default and never a dropped story. The canonical field
list `STORY_CONTRACT_FIELDS` (+ `StoryContractField`, `STORY_CONTRACT_EXEMPLAR`) is exported from
`src/play/decompose-epic-core.ts:370` with a `satisfies readonly (keyof StoryDraft)[]` pin, so a
schema rename that misses a consumer fails `tsc`.

## The shape exemplar: `docs/active/stories/S-066-01.md`

The hand-authored look-and-feel bar for what the materializer must emit. Its body layout:

1. Intro paragraph (epic context) — *not* one of the five contract fields; the parse carries no
   equivalent, so the materialized body has no analogue of it.
2. `**Scope:** …` — bold-labeled paragraph.
3. `**Story acceptance:** …` — bold-labeled paragraph.
4. `**Honest boundary:** …` — bold-labeled paragraph.
5. `## DAG` — fenced code block with an ASCII tree of the tickets, then a
   `Wave rationale: …` paragraph under the block.
6. `**Out of this slice:** …` — bold-labeled paragraph.
7. `---` + italic one-line footer (`_Hand-authored 2026-07-10 as the …_`).

Note the field→label mapping is prose-cased, not the camelCase field names
(`storyAcceptance` → "Story acceptance", `outOfSlice` → "Out of this slice").

## The DAG's single source

- `TicketDraft.depends_on: string[]` is the only edge store; the ticket demands the story's DAG
  block be **derived** from it, never duplicated.
- `StoryDraft.tickets: string[]` is the story's ticket ids "in execution order"
  (decompose.baml:83); `WorkPlan.tickets` is every ticket across all stories in a valid
  dependency order.
- In the live decompose path (`src/play/decompose-epic.ts:142` `decomposeEffect`), the plan is
  renumbered (`renumberPlanToEpic`) and validated by `graphIntegrityViolations` **before**
  `materialize` is called, so story↔ticket cross-references are consistent by the time the
  writer runs. `blockEntryTicketsAfter` (`--after`) may add `depends_on` edges pointing at
  tickets **outside the plan** (existing board tickets) — an edge in `depends_on` is not
  guaranteed to name a ticket in this story or even this plan.
- The S-066-01 exemplar's DAG is a one-root tree with `├─`/`└─` glyphs and per-ticket
  descriptions; a general story's ticket graph is a DAG, not necessarily a tree, so the derived
  rendering cannot assume the exemplar's tree shape.

## Callers and what they assume

- `src/play/decompose-epic.ts:188` — the real effect. Calls `materialize(finalPlan, targets)`;
  nothing downstream inspects the story body (only `lisaValidate(root)` runs after, an external
  `lisa validate` over the whole board).
- `src/play/chain-propose-decompose.test.ts:137` — calls `materialize(CANNED_PLAN, …)` where
  `CANNED_PLAN.stories[0]` (line 56) carries **no contract fields** (legal: they're optional).
  Its assertions are `toContain` on frontmatter only (`id: S-900`, `tickets: [T-900-01]`).
  A story-render that **throws** on absent contract fields breaks this test; one that degrades
  does not.
- `src/play/materialize.test.ts` — the pure-render suite. Its `story()` fixture (line 49) also
  has no contract fields; assertions are `toContain` on frontmatter tokens. The collision-guard
  suite exercises `materialize` against a real temp fs with the same contract-less fixtures.
- **No test anywhere pins the current one-line story body** (`grep "Materialized by"` hits only
  `materialize.ts:172` and 30+ already-materialized story files under `docs/active/stories/` —
  history, explicitly out of the story's slice: "backfilling shell stories already on any board
  (history stays)").

## The sibling gate (T-066-01-02, same wave, disjoint file)

`decompose-epic`'s gate list gains a story-completeness gate: a parse with any of the five
sections empty/absent STOPs with a `story-incomplete` andon **before the effect** — so in the
decompose path, `materialize` only ever sees contract-shaped stories once that ticket lands.
The wave rationale in S-066-01 promises the two tickets touch disjoint files (gate core vs
`materialize.ts`), which constrains this ticket from reaching into `gates.ts`.

## Timestamps ("and when")

- The current provenance line has **no date**; the ticket adds "and when".
- House purity pattern for clocks: pure renderers take time as a *parameter* — e.g.
  `work-core.ts:190` renders from passed-in ms because "`new Date(ms)` is total, unlike argless
  `new Date()`"; the impure edge supplies the clock (`cast.ts:137` `new Date().toISOString()`,
  `gather.ts:296` `generatedAt: new Date().toISOString()`). The S-066-01 footer date form is a
  plain day: `2026-07-10`.

## Test conventions relevant to the golden-file AC

- No `*.golden` files or `fixtures/` dirs exist; the house pattern is inline fixtures in the
  `.test.ts` (gather.test.ts calls its exact-array/exact-hash assertions "golden hashes").
  A byte-exact golden here would follow the same pattern: an inline expected-body literal
  compared with `toBe`, or a template-literal golden constant.
- Every BAML type in tests is imported type-only and fixtures are plain objects cast to the
  erased types (`"Task" as DraftType`) — the addon must never load under `bun test`.
- Gate for done: `bun run check` (typecheck + lint + tests) per project memory.

## Constraints surfaced

1. **Purity**: `renderStoryFile` must stay pure — no clock inside it; the "when" must arrive as
   data from `materialize` (the impure verb) or its caller.
2. **Signature ripple**: the DAG block needs the story's TicketDrafts; today's signature
   `renderStoryFile(s)` can't see them. Both existing call sites (`materialize` loop, tests)
   are local and cheap to update.
3. **Ticket bytes frozen**: AC2 — `renderTicketFile` and the ticket loop must not change.
4. **Absent fields are representable**: `string | null | undefined` per field; two existing
   suites feed contract-less stories through `materialize` and must stay green (or be
   deliberately updated — but S-066-01 scopes this ticket to the story writer, and the gate
   ticket owns refusal semantics).
5. **External `depends_on` edges** (`--after`) can name ids outside the story/plan; the DAG
   derivation must not crash or lie about them.
6. **Frontmatter unchanged**: id, title, type, status, priority, tickets — only the body below
   the closing `---` changes.
