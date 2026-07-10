# T-066-01-01 — story-contract-schema-and-render — Review

Handoff self-assessment. Code landed in commit `f243432`
(`feat(decompose): story contract fields in schema + render (T-066-01-01)`), on `main`,
`bun run check` green (1520 pass / 1 pre-existing skip / 0 fail, 103 files).

## What changed

**Files modified (3 source, +202/−13):**

- `baml_src/decompose.baml`
  - `class StoryDraft`: five new **optional** fields — `scope`, `storyAcceptance`,
    `honestBoundary`, `waveRationale`, `outOfSlice`, each `string?` with an `@description` that
    rides `{{ ctx.output_format }}` to the model. A header comment names the load-bearing choice:
    optional ⇒ absence parses to a typed `null` (the gate's refusal input); required would make
    SAP silently *drop* an incomplete story from the all-array plan.
  - Prompt: new authored section **"Every story is a CONTRACT (fill all five, honestly)"**
    between the admit-criteria and the per-cast inputs — one demand line per field naming the
    JSON field name, a ~14-line exemplar block ("the bar, drawn from a real cleared story",
    condensed from the hand-authored S-066-01.md), and the honesty clause: a section you cannot
    fill truthfully is left ABSENT, never padded.
- `src/play/decompose-epic-core.ts` — new `── story contract ──` section (addon-free, per the
  module's charter): `STORY_CONTRACT_FIELDS` (canonical five-name list,
  `satisfies readonly (keyof StoryDraft)[]` so a schema rename fails `tsc` before any test),
  `StoryContractField`, and `STORY_CONTRACT_EXEMPLAR` (canonical exemplar text; the render test
  asserts the rendered prompt contains it byte-identically, so the two copies cannot drift).
- `src/baml/decompose.test.ts` — `CANNED`'s story extracted to `CONTRACT_STORY` with all five
  fields populated; `PARTIAL_CANNED` (omits 2) / `SHELL_CANNED` (omits all 5) derived by
  key-omission from the same plan; bridge ops `[5]`/`[6]` appended (existing indices untouched);
  +4 tests across two new describes, +1 extension of the round-trip test.

**Files NOT changed** (deliberately — sibling-ticket territory): `materialize.ts` (T-066-01-03),
`gates.ts` (T-066-01-02), `rdspi-workflow.md` (T-066-01-04), `decompose-bridge.ts` and
`decompose-epic.ts` (the new type flows through the regenerated client with zero code change).
`baml_client/` regenerated but gitignored, as always.

## Acceptance criteria — both met

- **AC1** — round-trip + typed absence: op `[0]` round-trips all five populated fields verbatim
  (and op `[4]`'s open-model equality proof now covers them for free, same bytes); op `[5]` pins
  the partial case (present fields verbatim, `honestBoundary`/`outOfSlice` are `null` and
  explicitly not strings, story NOT dropped); op `[6]` pins the shell case (all five absent,
  iterated over `STORY_CONTRACT_FIELDS`) — exactly the shape T-066-01-02's gate will refuse.
- **AC2** — render demand + exemplar: the render test asserts the prompt contains the section
  heading, every field name backtick-quoted, the honesty clause, and `STORY_CONTRACT_EXEMPLAR`
  in full (byte-identical containment — BAML's uniform dedent made the designed pin work without
  the per-line fallback design D2 held in reserve).

## Test coverage assessment

Strong where it matters, with honest edges:

- **Pinned, not assumed**: these are the repo's first optional BAML fields; SAP's
  absent-optional behavior (null, admit-don't-drop, no default) is now pinned by fixtures, so a
  future BAML version bump that changes it stops the line here.
- **Three-way drift protection**: schema↔constant at compile time (`satisfies`), constant↔prompt
  at test time (containment), prompt↔model expectation via `output_format` descriptions.
- **Gap (accepted)**: no test exercises a *live* model emitting the fields — per the story's
  honest boundary, everything here is fixture-proven and FREE; the live metered cast closes the
  epic, human-authorized, not this ticket.
- **Gap (deferred to -02 by design)**: nothing yet *refuses* an empty-string field (`scope: ""`
  parses as a present string, not an absence). That is deliberate: BAML owns shape, the
  completeness gate owns meaning — T-066-01-02's "non-empty" wording covers it, and its ACs
  already demand the shell fixture STOP.

## Open concerns for a human reviewer

1. **Prompt-size cost is real but small**: the contract section adds ~35 lines to every
   decompose cast's prompt (paid per cast, metered). Judged worth it — the whole epic exists
   because the un-demanded schema produced shells — but it is the one recurring cost this ticket
   adds, and prompt trimming is available later if the exemplar proves more than needed.
2. **The exemplar is duplicated by design** (decompose.baml ↔ decompose-epic-core.ts). The
   render test makes drift impossible to miss, but an editor touching the prompt will hit a
   test failure that may surprise them — the constant's doc comment says exactly what to do.
3. **`SHELL_CANNED` still carries the enriched title/tickets**, not literally "today's ten-line
   shell file" — it models the shell at the *parse* layer (all five fields absent), which is the
   layer this ticket owns. T-066-01-02's cast-level test is where the file-shaped shell replay
   belongs.
4. **Model may emit explicit `null`s**: `output_format` shows `string or null`, so a model can
   emit `scope: null` — indistinguishable from omission after parse (both are the typed
   absence). This is correct behavior, just worth knowing when reading gate refusals later.

## Nothing critical outstanding

No TODOs left in code, no skipped steps, no red anywhere. The settled shape the three dependent
tickets consume: `StoryDraft`'s five `string | null | undefined` fields, plus
`STORY_CONTRACT_FIELDS` / `StoryContractField` / `STORY_CONTRACT_EXEMPLAR` exported from
`src/play/decompose-epic-core.ts`.
