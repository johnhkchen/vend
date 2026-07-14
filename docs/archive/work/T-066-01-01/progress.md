# T-066-01-01 — story-contract-schema-and-render — Progress

## Completed

- [x] **Step 1 — schema**: `baml_src/decompose.baml` `StoryDraft` gained the five contract fields
      as `string?` with `@description`s + a header comment naming the typed-absence rationale.
      `bun run baml:gen` regenerated; verified `baml_client/types.ts` shows
      `scope?: string | null` (and the other four). Typecheck green.
- [x] **Step 2 — core constants**: `src/play/decompose-epic-core.ts` gained a
      `── story contract ──` section exporting `STORY_CONTRACT_FIELDS` (with
      `satisfies readonly (keyof StoryDraft)[]` compile-time pin — `StoryDraft` imported
      type-only, module stays addon-free), `StoryContractField`, and `STORY_CONTRACT_EXEMPLAR`.
- [x] **Step 3 — prompt**: `decompose.baml` gained the "Every story is a CONTRACT" section
      (five per-field demand lines naming JSON field names, the exemplar block, the
      absence-over-padding honesty clause) between the admit-criteria and the per-cast inputs.
- [x] **Step 4 — tests**: `src/baml/decompose.test.ts` — `CANNED`'s story extracted to
      `CONTRACT_STORY` with all five fields populated; `PARTIAL_CANNED`/`SHELL_CANNED` derived by
      key-omission from the same plan (single-variable fixtures); ops `[5]`/`[6]` appended
      (indices `[0]`–`[4]` untouched); round-trip test extended over `STORY_CONTRACT_FIELDS`; new
      typed-absence describe (2 tests) and render-contract describe (2 tests).
- [x] **Step 5 — full gate**: `bun run check` green — 1520 pass / 1 skip (pre-existing) / 0 fail
      across 103 files. `git status` confirms only the three intended source files modified;
      `baml_client/` absent (gitignored).

## Deviations from plan

1. **Mid-step-4 red, self-inflicted and instructive**: the first test run failed the two render
   assertions because `baml:gen` had only been run after step 1 (schema) — the generated client
   embeds the prompt template, so step 3's prompt edit wasn't in the rendered output until a
   re-gen. Fixed by re-running `bun run baml:gen`. No code change; noted because it confirms
   `bun run check`'s gen-first ordering is what protects CI from ever seeing this state.
2. **Neither pre-named risk fired**: (a) full-string exemplar containment passed — BAML's dedent
   is uniform, so the flush-left TS constant matches the rendered block byte-identically; the
   per-line fallback was not needed. (b) SAP's absent-optional behavior is exactly the designed
   typed absence (null, story admitted, no default) — pinned green on first run.

## Commits

- `feat(decompose): story contract fields in schema + render (T-066-01-01)` — the three source
  files, one atomic commit (per plan step 5).
- RDSPI work artifacts committed separately as docs.

## Remaining

Review phase (review.md) — nothing else outstanding.
