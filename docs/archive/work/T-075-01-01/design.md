# Design — T-075-01-01 extend-face-jargon-classifier

## Decision summary

Extend `JARGON_CLASSES` in place, retaining it as the single policy authority:

1. make the existing BAML/SAP class case-insensitive;
2. add a standalone, case-insensitive `CI` class;
3. add a case-insensitive `Claude` + `p...` phrase class;
4. pin each family through the existing `jargonTokens`/`scrubFace` unit seam; and
5. fold `faceJargon` over the live `DESIGNER_PRESET` projection in `svg-file.test.ts`.

No routing, graph, overlay, SVG, or canonical-board content changes are required.

## Design forces

- The story requires classifier-only production changes.
- The write-side scrub and read-side verdict must share one policy.
- The live leaks arise after title humanization changes casing and separators.
- The classifier must recognize the visible form, not only the canonical slug form.
- `CI` must not become a broad `ci...` prefix that catches ordinary words such as `cites`.
- `Claude p...` is explicitly named as a family, rather than only one literal title.
- Existing details extraction calls `matchClass(body, "bamlSap")` and must keep working.
- Every regex used by `matchAll` must retain the global flag.
- The live assertion must consume `faceJargon`, not invent a parallel denylist.

## Option A — patch titles or overlays

Rewrite the six current canonical ticket titles, or provide plain overlays for those IDs.

### Advantages

- The current SVG would look clean.
- No regex policy would need to expand.

### Rejection

- It changes canonical work data instead of the read-surface policy.
- It fixes six instances, not the recurring token families.
- Future BAML/CI/Claude titles would leak again.
- It violates the story's classifier-only scope and one-way presentation authority.
- It makes authoring pay the same vocabulary cleanup repeatedly.

## Option B — scrub in the SVG renderer

Add SVG-only replacement logic in `projection-svg.ts` or `svg-file.ts`.

### Advantages

- It targets the surface where the defect was observed.
- It could be implemented as a small renderer patch.

### Rejection

- Paper/probe/other card consumers would retain the leak.
- The renderer would acquire a second definition of jargon.
- `faceJargon` could report clean while rendered text used a different policy, or vice versa.
- It breaks the existing “one classifier, two uses” design.

## Option C — add a second post-projection denylist

Keep `JARGON_CLASSES` unchanged but add a special live-board validator for these terms.

### Advantages

- It would make the requested live test fail before a scrub change.
- It would provide a narrowly named regression signal.

### Rejection

- Validation alone does not remove the visible leak.
- A second denylist can drift from `scrubFace`.
- The ticket explicitly asks to extend the shared classifier.
- The existing `faceJargon` seam is the required contract.

## Option D — extend `JARGON_CLASSES` (chosen)

Keep all policy in `translate.ts` and let existing composition apply it everywhere.

### Advantages

- Both `scrubFace` and `faceJargon` change together automatically.
- Every card consumer benefits, not only SVG output.
- `projectNode` routing remains byte-for-byte untouched.
- The change stays pure and deterministic.
- Existing tests already expose the right seams.
- New future titles using these families are covered without per-ID work.

### Cost

- Regex boundaries must be chosen carefully to avoid deleting ordinary prose.
- Case-insensitivity on the existing combined BAML/SAP class also recognizes lowercase `sap`.
- The `Claude p...` phrase deliberately removes two words rather than one token.

## D1 — BAML family

Change the existing pattern from:

```ts
/\b(?:BAML|SAP)\b/g
```

to the same closed terms with `gi` flags.

Rationale:

- The live forms are `Baml` and `baml`.
- Humanization is responsible for the case variants.
- Exact word boundaries prevent substring removal from larger words.
- Keeping the existing class preserves `extractBamlInternals` composition.
- Treating case as presentation noise is simpler and safer than enumerating title positions.

The design does not broaden BAML to arbitrary `Baml...` identifier suffixes. The observed and
accepted family is the token in casing variants; file/identifier families remain covered by the
existing file-path/detail routing policy.

## D2 — CI family

Add a named class equivalent to:

```ts
/\bCI\b/gi
```

Rationale:

- It recognizes `CI`, `Ci`, and `ci` as the same acronym.
- Exact word boundaries recognize only the standalone token.
- It does not match `cites`, `circular`, or other ordinary `ci...` words.
- It catches both beginning-of-title and middle-of-title live forms.

## D3 — Claude p... family

Add a named phrase class equivalent to:

```ts
/\bClaude\s+p\w*\b/gi
```

Rationale:

- It catches the live two-token `Claude p` residue.
- It also covers the explicitly named `Claude p...` family such as `Claude prompt`.
- `\s+` reflects the humanized title form after separators become spaces.
- The leading and trailing boundaries prevent matching inside larger tokens.
- The pattern is intentionally narrower than all `Claude ...` phrases; only the named `p...`
  family is within ticket scope.

This phrase is removed as one jargon match. Cleanup then handles surrounding whitespace using the
existing `scrubFace` pipeline.

## D4 — preserve prose around removals

No cleanup rules will be changed. Existing cleanup already:

- removes empty parentheses;
- closes spacing after an opening parenthesis;
- removes spaces stranded before punctuation;
- collapses doubled spaces; and
- trims ends.

Family tests will assert exact cleaned strings, not only absence. That pins the important honest
boundary: adjacent plain words remain in order and punctuation remains readable.

## D5 — pure unit proof

Add one table-driven or grouped test covering every new family:

- BAML casing: beginning-title `Baml` and embedded lowercase `baml`;
- CI casing: beginning-title `Ci` and embedded lowercase `ci`;
- Claude phrase: literal `Claude p` and a longer `Claude prompt` representative.

For each representative:

- `jargonTokens(input)` reports the intended match;
- `scrubFace(input)` equals the exact expected plain remainder; and
- `jargonTokens(scrubFace(input))` is empty.

Also pin a non-match containing an ordinary `ci...` word to guard against prefix overreach.

## D6 — live-board integration proof

In `src/present/svg-file.test.ts`:

1. load the real board with `loadWorkGraph()`;
2. cast it through `projectGraph(live, DESIGNER_PRESET)`;
3. traverse every projected card;
4. call the shared `faceJargon(card)` predicate;
5. collect only non-empty results with card IDs; and
6. assert the collection is empty.

The assertion message should expose failing IDs/tokens naturally through structural equality.
It should not scan SVG bytes or repeat regexes. This proves the exact story-level composition.

## D7 — unchanged field routing/content

- Do not edit `projectNode`.
- Do not edit `projectGraph`.
- Do not edit `DESIGNER_PRESET`.
- Do not edit `structuralBreakdown`, `stateChip`, or overlays.
- Exact unit expected strings establish that only matched jargon disappears.
- Existing T-018 contract tests continue pinning authored `plainTitle`, `why`, and `breakdown`.
- The full suite detects unintended byte/content changes in established projection fixtures.

## Verification

- Run focused `translate.test.ts` and `svg-file.test.ts` first.
- Confirm new tests fail against the old classifier if practical before production edit.
- Run `bun run check` after implementation.
- Commit only the three ticket-owned source/test paths using `lisa commit-ticket`.
- Re-run or rely on the commit hook's full gate, then ensure no ticket-owned file is left dirty.

## Chosen outcome

The classifier remains a small, pure, shared policy. Mixed-case BAML, standalone CI, and the
named Claude-p phrase family are removed at the same boundary as all prior jargon. The live-board
test proves the actual SVG input projection is clean without creating a second vocabulary oracle.
