# Research — T-075-01-01 extend-face-jargon-classifier

## Assignment and phase

- Ticket: `T-075-01-01`.
- Parent story: `S-075-01`.
- Current ticket phase at session start: `research`.
- The assignment requires one continuous RDSPI pass through Review.
- Attempt artifacts belong only in `.lisa/attempts/T-075-01-01/1/work/`.
- Lisa, not this worker, publishes admitted artifacts and advances ticket frontmatter.
- Ticket-owned source must be committed with `lisa commit-ticket` and exact include paths.
- Existing ticket frontmatter modifications are Lisa-owned and must remain untouched.

## Story contract

- The story is deliberately limited to the shared read-surface jargon classifier.
- In-scope production code is `src/present/translate.ts`.
- In-scope proof is `src/present/translate.test.ts` plus `src/present/svg-file.test.ts`.
- `projectNode` and `projectGraph` field routing are explicitly out of the change surface.
- The live board, projected through `DESIGNER_PRESET`, must have empty `faceJargon`.
- The named residual families are `Baml…`, `Ci…`, and `Claude p…`.
- Plain title, why, and breakdown content must otherwise remain unchanged.
- This is fixture- and live-board-proven, pure/free work; no model call is involved.
- The later designer render-and-watch probe is explicitly deferred.

## Product grounding

- The UX survey identifies card-face jargon as a live weakness of the SVG surface.
- It names the same visible examples: `Baml…`, `Ci module`, and `Claude p…`.
- The persona work treats face vocabulary as the first-order visual-surface risk.
- A jargon-heavy card face turns the SVG back into a technical text wall.
- The ticket advances P5 because the local visual surface must be usable by a non-developer.
- It also preserves the vision's author-once/run-repeatedly behavior: policy is encoded once.
- The classifier is a gate-like contract: the face is scrubbed without live supervision.

## Existing classifier

- `src/present/translate.ts` is a pure module.
- `JARGON_CLASSES` is the single source of truth for face jargon.
- Each class is a named global `RegExp`.
- `JargonClass` is derived from the keys of `JARGON_CLASSES`.
- `CLASS_ORDER` is derived from the same object.
- `matchClass` constructs a fresh regex per call, avoiding shared `lastIndex` state.
- `jargonTokens` runs every class and deduplicates tokens.
- `scrubFace` runs every class and removes matching tokens.
- `faceText` joins only visible face strings.
- `faceJargon` applies `jargonTokens` to `faceText`.
- Therefore the write-side scrub and read-side verdict cannot drift if classes stay shared.

## Existing jargon families

- `charterCode` recognizes `PE-N`, `IA-N`, `PN`, and `RN` codes.
- `bamlSap` currently recognizes exact uppercase `BAML` and `SAP` only.
- `filePath` recognizes TypeScript paths and `baml_src/...` paths.
- `phaseRaw` recognizes raw `phase:<value>` strings.
- None of the current patterns carries the case-insensitive `i` flag.
- There is no current class for standalone `CI`.
- There is no current class for the two-token `Claude p...` family.

## Why the leaks occur

- Canonical ticket titles are kebab/snake forms in the graph.
- `humanizeTitle` replaces separators with spaces.
- It sentence-cases only the first character.
- Thus `baml-decompose-epic-function` becomes `Baml decompose epic function`.
- A later `baml` token remains lowercase, as in `Open model baml client`.
- `ci-module-bootstrap` becomes `Ci module bootstrap`.
- A later `ci` remains lowercase, as in `Release ci tarball sha`.
- `claude-p-dispense-seam` becomes `Claude p dispense seam`.
- Exact uppercase `BAML` does not recognize `Baml` or `baml`.
- The other two token families have no classifier entry at all.

## Live-board observation at Research

The live graph was loaded and projected with `DESIGNER_PRESET`. A read-only scan for the
three named families found six visible faces:

| Card | Visible plain title | Residual match |
|---|---|---|
| `T-001-02` | `Claude p dispense seam` | `Claude p` |
| `T-002-01` | `Baml decompose epic function` | `Baml` |
| `T-002-01-01` | `Ci module bootstrap` | `Ci` |
| `T-009-01` | `Baml propose epic function` | `Baml` |
| `T-036-01` | `Open model baml client` | `baml` |
| `T-062-03` | `Release ci tarball sha` | `ci` |

- This is a non-vacuous live defect, not only a synthetic fixture gap.
- All six leaks occur in `plainTitle`.
- Their state and breakdown fields are already plain.
- The live board currently contains no authored `why` overlays in this projection path.

## Projection path

- `loadWorkGraph` reads canonical Markdown frontmatter/body into a frozen `WorkGraph`.
- `projectGraph` projects ticket nodes only.
- `projectGraph` calls `projectNode` for each ticket.
- `projectNode` obtains `plainTitle` from overlay text or `humanizeTitle`.
- Every routed face string passes through `scrubFace`.
- `DESIGNER_PRESET.face` includes plain title, why, state, and breakdown.
- `projectGraph` groups designer cards by status; grouping is irrelevant to classification.
- `writeBoardSvg` uses the designer preset by default and renders the resulting projection.
- No file-writing behavior is needed to verify the classifier result.

## Unit-test seam

- `src/present/translate.test.ts` is already organized around pure record fixtures.
- Its first describe block directly tests `jargonTokens` and `scrubFace` together.
- Existing tests cover uppercase BAML/SAP, charter codes, paths, and raw phases.
- The tests prove both classification and cleaned prose.
- The existing T-018 contract also pins authored `plainTitle`, `why`, and `breakdown` exactly.
- New family-level cases can stay in the classifier describe block.
- Exact cleaned-string assertions can prove unrelated words and spacing remain unchanged.
- Case variants matter for BAML and CI because the live board contains both positions/cases.

## Live integration-test seam

- `src/present/svg-file.test.ts` already imports `loadWorkGraph`, `DESIGNER_PRESET`, and
  `projectGraph`.
- Its final describe block already performs live-board assertions.
- It hashes `docs/active` around the write seam to prove one-way authority.
- Another test projects the same live board to compare status and story grouping.
- The requested empty-`faceJargon` assertion can reuse the same live loader and projection.
- It needs only the pure `faceJargon` import from `translate.ts`.
- Flattening projection groups exposes every card without inspecting SVG text.
- An aggregate list of `{id, jargon}` failures gives a useful assertion diagnostic.

## Constraints and boundaries

- Preserve the single classifier used by both scrub and verdict.
- Do not add a second regex in the live test as an alternate policy authority.
- Do not change graph loading, project routing, grouping, SVG rendering, or overlays.
- Do not rewrite canonical titles in `docs/active`.
- Do not broaden `CI` matching into arbitrary words beginning with `ci` such as `cites`.
- Regexes must remain global because `matchAll` requires `g`.
- Scrubbing must leave surrounding prose readable and deterministic.
- Existing details extraction behavior should remain intact.
- In particular, `extractBamlInternals` depends on the `bamlSap` class.
- The full `bun run check` is the required repository gate.

## Worktree state

- The branch began with modified ticket frontmatter for `T-075-01-01` and `T-075-02-01`.
- Those changes are phase transitions made by Lisa.
- No ticket-owned source file was modified at Research start.
- No ordinary git staging or commit operation is authorized for this ticket.

## Research conclusion

- The defect is localized to incomplete classifier coverage.
- The shared architecture already has the correct write/read policy seam.
- Three family-level classifier changes plus pure and live-board assertions cover the contract.
- No architecture, routing, renderer, filesystem, or model change is indicated by the evidence.
