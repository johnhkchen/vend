# T-021-04 — Plan: vocabulary-translation-layer

_Ordered, independently-verifiable steps + the testing strategy. Each step small enough to commit
atomically (here: one logical unit, one commit, per the structure's "one atomic commit")._

## Testing strategy (up front)

- **All unit tests, all pure.** The module is pure (type-only graph/spec imports), so
  `translate.test.ts` is an ordinary `bun:test` file over plain-object fixtures — no fs, no BAML,
  no temp dirs. This is the `spec.test.ts` / `gates.test.ts` mould.
- **One inline `T-018-01` fixture** — a `TicketNode` literal whose `body` mirrors the real ticket
  (carries `R1`/`R3`/`PE-1`, `BAML`/`SAP`, `survey-core.ts`/`baml_src/`, an `## Acceptance
  Criteria` section). Built once, reused across the integration tests. No coupling to the live
  file (the loader is T-021-01's concern; this layer takes a node).
- **Verification criteria = the AC, made executable** in the integration test:
  1. `projectNode(t01, DESIGNER_PRESET, §1cOverlay)` face == the §1c plain face.
  2. `faceJargon(card) === []` and each denylist token absent from `faceText(card)`.
  3. those tokens reachable in `card.details` (charterCodes/bamlInternals/fileCites/rawACs).
- **Gate:** `bun run check` (baml:gen → typecheck → `bun test`) green, zero regressions, before
  commit. (Typecheck baseline confirmed green at research time.)

## Step 1 — the vocabulary policy core (classifier + scrubber + code table)

Write `src/present/translate.ts` through §5 of the structure: header, type-only imports,
`JARGON_CLASSES`, `jargonTokens`, `scrubFace`, `CODE_PLAIN`, `translateCode`.

- `jargonTokens` and `scrubFace` rebuild `RegExp`s per call from `source`/`flags` (avoid `g`-flag
  `lastIndex` state). `scrubFace` strips, collapses whitespace, trims, tidies dangling `(`/`,`.
- **Verify:** unit tests — a mixed string round-trips (`jargonTokens` finds the representatives;
  `scrubFace` removes them; clean prose survives); `translateCode("PE-1")` plain, unknown → `null`.

## Step 2 — body extractors (route dev content → details)

Add §6: `extractCharterCodes`, `extractFileCites`, `extractBamlInternals`, `rawAcceptanceCriteria`.
Reuse the classifier (filter `jargonTokens` by class, or run the class regex directly).

- **Verify:** unit tests over the fixture body — each extractor returns its class deduped;
  `rawAcceptanceCriteria` slices `## Acceptance Criteria` → next `## `; absent → `""`.

## Step 3 — face/state helpers

Add §7: `humanizeTitle` (kebab → sentence, then `scrubFace`), `stateChip`
(`spec.labels.status[status] ?? status`), `structuralBreakdown` (child/dep counts, zero clauses
omitted).

- **Verify:** unit tests — `humanizeTitle("steer-pure-core")` jargon-free; `stateChip` maps
  `done → "Done"` under `DESIGNER_PRESET`, unlabeled → bare word (never `phase:done`);
  `structuralBreakdown` counts an epic's stories / a story's tickets / a ticket's deps+blocks.

## Step 4 — Card types + `projectNode` + verdict seam

Add §8–§10: `PlainOverlay`/`FaceContent`/`DetailContent`/`Card` types; `projectNode` (spec-driven
routing into the two buckets, honest-empty omission, freeze the result); `faceText`, `faceJargon`.

- `projectNode`: iterate `spec.face` → set each present field via the Step-3 helpers / overlay,
  `scrubFace` every emitted string, omit `why`/`breakdown` when content is empty. Iterate
  `spec.details` → run each extractor, omit empty (`[]`/`""`). `Object.freeze` face, details, card.
- **Verify:** routing unit tests — `DESIGNER_PRESET` emits four face fields; `DEV_PRESET` omits
  `why`; `details:[]` spec → empty bucket; no overlay → no `why` (honest-empty). Card is frozen.

## Step 5 — the AC integration test (the contract)

Add the `describe("T-018-01 — the AC contract")` block:

- Project the fixture with `DESIGNER_PRESET` + the §1c overlay.
- Assert (1) face == §1c (`plainTitle`, `state:"Done"`, `why`, `breakdown` present and exact).
- Assert (2) `faceJargon(card)` is `[]`; and for each of `["P5","PE-1","BAML","SAP",".ts",
  "phase:done"]`, `faceText(card)` does **not** include it. (`P5` is asserted via a fixture body
  that mentions `P5` so the denylist representative is real, not vacuous.)
- Assert (3) reachability: `card.details.charterCodes` includes `PE-1` (and `R1`),
  `bamlInternals` includes `BAML` & `SAP`, `fileCites` includes a `survey-core.ts` path,
  `rawAcceptanceCriteria` is non-empty.

## Step 6 — green + commit

`bun run check`. On green, commit `translate.ts` + `translate.test.ts` as one unit:
`feat(present): vocabulary-translation layer — jargon-scrubbed face + dev details bucket (T-021-04)`.

## Risk / deviation watch

- **Scrubber over-strip** — `scrubFace`'s `filePath` class (`[\w./-]*\.ts`) could clip a legit word
  ending in `.ts`? None expected on a plain face; if a fixture surfaces one, narrow the boundary.
  Document any narrowing as a deviation in `progress.md`.
- **`P5` representative** — the AC lists `P5` though `T-018-01`'s real body uses `PE-1`/`R1`. The
  fixture body will include a `P5` mention so the test asserts the named representative directly
  (and `charterCode` regex covers both `P\d+` and `PE-\d+`). Noted so the fixture is faithful to
  the AC, not just the real ticket.
- **`mixed`/`technical` vocabulary** — out of scope for v1 (design D-rejected); face scrub is
  unconditional plain. Record as a known limitation in `review.md`, not a deviation.
