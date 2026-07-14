# T-066-01-01 — story-contract-schema-and-render — Plan

Ordered, independently verifiable steps. The blueprint is structure.md; this sequences it and
defines the testing strategy per step. Commit strategy at the end.

## Step 1 — Schema: five optional fields on `StoryDraft`

**Edit** `baml_src/decompose.baml`: append `scope`/`storyAcceptance`/`honestBoundary`/
`waveRationale`/`outOfSlice` as `string?` with `@description`s (structure §1a), after `tickets`.

**Verify:** `bun run baml:gen` succeeds; `baml_client/types.ts` `StoryDraft` gains
`scope?: string | null` (and the other four); `bun run check:typecheck` green (additive-optional
⇒ nothing else moves).

## Step 2 — Core constants: the contract's canonical exports

**Edit** `src/play/decompose-epic-core.ts`: new trailing section exporting
`STORY_CONTRACT_FIELDS` (with `satisfies` pin against `keyof StoryDraft` — compile-time sync to
the schema), `StoryContractField`, and `STORY_CONTRACT_EXEMPLAR` (the ~15-line condensed
S-066-01 exemplar, written here FIRST — this is the authoring moment; step 3 pastes it).
`StoryDraft` import must be type-only (the module's addon-free charter).

**Verify:** `bun run check:typecheck` green. Negative check by inspection: the `satisfies` pin
would fail compile if a field name typo'd.

## Step 3 — Prompt: the contract demand + exemplar section

**Edit** `baml_src/decompose.baml` prompt: insert the "Every story is a CONTRACT" section
(structure §1b) between the admit-criteria block and "## The epic to clear" — five per-field
demand lines naming the JSON field names, the exemplar block byte-identical to step 2's constant
(same indent depth as surrounding prose so BAML's dedent is uniform), and the honesty clause
(absent over padded).

**Verify:** `bun run baml:gen` still green (template parses). Content verification is step 4's
render test — no manual prompt-dump needed.

## Step 4 — Tests: round-trip, typed absence, render demand

**Edit** `src/baml/decompose.test.ts` (structure §3):

1. Enrich `CANNED`'s story with all five fields populated (short contract-quality prose).
2. Add `PARTIAL_CANNED` (three of five) and `SHELL_CANNED` (none of five) fixtures.
3. Append ops `[5]` (parse PARTIAL) and `[6]` (parse SHELL) — never reorder `[0]`–`[4]`.
4. Assertions:
   - existing round-trip test extends: five fields survive parse verbatim (AC1a);
   - new contract describe: `[5]` story not dropped, present fields verbatim, absent fields
     `(x ?? null) === null` and not a string; `[6]` all five absent, iterated over
     `STORY_CONTRACT_FIELDS` (AC1b);
   - new render describe on `[2]`: prompt contains each field name, the demand phrase, and
     `STORY_CONTRACT_EXEMPLAR` (AC2).

**Verify:** `bun test src/baml/decompose.test.ts` — the step's own gate. Then the whole suite.

**Known risk + pre-decided fallback (design D2):** if full-string exemplar containment fails on
BAML dedent whitespace, switch the assertion to per-line trimmed containment
(`for (const line of EXEMPLAR.split("\n")) expect(prompt).toContain(line.trim())` modulo empty
lines) and record the deviation in progress.md. Content strength is equivalent; only indent
sensitivity differs.

**Second known risk:** SAP behavior for an absent *optional* field is unpinned in this repo
(first optional field ever — research §4). If `[5]`/`[6]` reveal SAP fabricates `""` or drops the
story, that is a DESIGN-invalidating discovery: stop, document in progress.md, and re-enter
design (the typed-absence contract is the ticket's core; it cannot be papered over in the test).

## Step 5 — Full gate + commit

**Verify:** `bun run check` (baml:gen → tsc → full `bun test`) — the real gate
(vend-gate-and-dev-setup). Also confirm `git status` shows only the three intended files (plus
untracked docs/work artifacts) — `baml_client/` must not appear (gitignored).

**Commit:** one atomic commit — the ticket is one coherent shape-settling change; steps 1–4 are
not independently valuable to the board (a schema without the demand, or a demand without the
test, is a half-contract). Message:

```
feat(decompose): story contract fields in schema + render (T-066-01-01)
```

If step 4's risks force a second authoring round, still land as one commit — the intermediate
states never need to exist on the branch. (RDSPI "commit incrementally" is satisfied at the
granularity of this ticket's single deliverable; progress.md records the internal step ticks.)

## Test strategy summary

| Concern | Where | Kind |
|---|---|---|
| Five fields round-trip populated | decompose.test.ts `[0]` (+`[4]` free ride) | fixture parse via bridge child |
| Absence → typed null, story not dropped | decompose.test.ts `[5]`, `[6]` | fixture parse via bridge child |
| No fabricated default | same — `typeof !== "string"` guard | fixture parse |
| Prompt demands all five + exemplar | decompose.test.ts render `[2]` | rendered-prompt containment |
| Field list ↔ schema sync | `satisfies keyof StoryDraft` | compile-time (tsc) |
| Exemplar prompt ↔ core sync | render containment assertion | test-time |
| Nothing else regresses | `bun run check` full suite | integration |

No live/metered test belongs to this ticket (the story's honest boundary: everything here is
fixture-proven and FREE; the live cast closes the epic, human-authorized).

## Acceptance criteria → step map

- AC1 (round-trip + typed absence fixtures) → steps 1, 4 (ops `[0]`/`[5]`/`[6]`).
- AC2 (render demands five sections + embeds exemplar) → steps 2, 3, 4 (render `[2]` describe).
