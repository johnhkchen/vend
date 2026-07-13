# T-077-02-02 — Progress

## Status

- Research: complete.
- Design: complete.
- Structure: complete.
- Plan: complete.
- Implement: complete.
- Source commit: complete.
- Remaining phase: Review.

## Implemented outcome

Unresolved inline charter citations no longer discard a gates-cleared decompose cut. The pure
render path classifies each eligible prose occurrence against the cut-time charter snapshot,
replaces an unresolved cite with `[unresolved charter cite]`, and preserves an ordered structured
record containing the original code, artifact-field location, and `annotate` action.

The materializer writes the annotated board and returns those records. The concrete decompose
effect forwards nonempty records for the later run-record join. The generic cast ledger/summary is
unchanged, as required by the story DAG.

Structural invalidity remains a refusal. The acceptance fixture with an absent story contract stops
at the real story-completeness gate; the effect is not called and neither target directory exists.

## Production changes

### `src/play/materialize.ts`

- Imported `classifyCharterCite` from the committed T-077-02-01 predecessor.
- Imported `materializationDisposition` for aggregate taxonomy.
- Imported the shared classification and degradation types.
- Added the stable artifact marker `[unresolved charter cite]`.
- Changed prose matching to observe optional authored ` — ` gloss delimiters.
- Reused the existing `policedPrefixes` charter-family boundary.
- Left snapshot-missing foreign prefixes untouched.
- Classified snapshot-known and policed-prefix occurrences.
- Used action `annotate` for every inline editorial miss.
- Preserved resolvable authored-gloss text byte-for-byte.
- Expanded resolvable bare cites to their cut-time title as before.
- Replaced unresolved bare cites with the marker.
- Replaced unresolved authored cite plus delimiter with marker plus space.
- Added an invariant throw for impossible structural classifier output.
- Added private text-plus-classification rendering data.
- Added private detailed ticket and story renderers.
- Kept exported `RenderedFile` unchanged.
- Kept exported `renderTicketFile` and `renderStoryFile` signatures unchanged.
- Located ticket purpose as `<ticket>.md#purpose`.
- Located ticket done signal as `<ticket>.md#doneSignal`.
- Located each story contract field with its exact field name.
- Preserved classifications in rendered occurrence order.
- Extended `MaterializeResult` with required `degrades`.
- Folded classifications before the rendered-byte guard and before writes.
- Returned `[]` for clean materialization.
- Returned exact ordered records for degraded materialization.
- Retained `findBareCodes` as the post-transform safety net.
- Retained `BareCodeError` for surviving non-inline surfaces.
- Retained collision judgment before content judgment.
- Retained seat default behavior and byte shape.
- Updated module/function comments to describe the narrowed refusal boundary honestly.

### `src/play/decompose-effect.ts`

- Added `DecomposeEffectResult extends EffectResult`.
- Added optional `degrades` to that concrete result subtype.
- Kept the generic engine effect contract unchanged.
- Destructured degradation records from `materialize`.
- Forwarded only nonempty arrays.
- Preserved validation result semantics.
- Preserved routing-seat default and inference metadata.
- Preserved graph-invalid, id-collision, and remaining bare-code catch arms.
- Did not change run outcomes, run-log schema, or cast summary.

## Test changes

### `src/play/materialize.test.ts`

- Added a pure ticket-purpose case for an unresolved bare N4 cite.
- Asserted the marker replaces the code.
- Added a pure doneSignal case for unresolved authored-gloss N2.
- Asserted the readable gloss prose survives.
- Asserted raw N4/N2 tokens do not survive.
- Replaced the historical real-fs prose `BareCodeError` test.
- Asserted both story and ticket directories/files are materialized.
- Asserted exact two-record ordering.
- Asserted locations are `T-009-01.md#purpose`.
- Asserted action is `annotate`.
- Asserted the written body is clear under `findBareCodes`.
- Added an empty degradation-array assertion for a clean materialization.
- Kept the pure rendered-byte scanner matrix unchanged.
- Kept collision, seat, alias, story contract, and resolved-code goldens.
- Tightened the collision-order fixture to carry a genuinely bare unresolved advances code.

### `src/play/decompose-effect.test.ts`

- Added a complete N4 inline-prose plan.
- Ran it through the real concrete effect.
- Used a passing Lisa validator stub.
- Asserted `ok: true` and no refusal outcome.
- Asserted two written artifacts.
- Asserted the validator ran once.
- Asserted exact forwarded degradation data.
- Asserted the written marker and absent raw N4 token.

### `src/play/bare-code-cast.test.ts`

- Inverted the historical editorial-refusal fixture into a degraded success.
- Used unresolved authored-gloss N4 and N2 examples from the ticket context.
- Kept `advances` resolvable so all real gates clear.
- Captured materializer dispositions at the fixture effect seam.
- Asserted cast outcome `success`.
- Asserted `materialized: true`.
- Asserted exact ordered N4/N2 records.
- Asserted the story and ticket files exist.
- Asserted two honest markers in the written purpose.
- Asserted raw N4/N2 tokens are absent.
- Asserted all five real gate rows remain passed in the ledger.
- Added an absent-story-contract structural fixture.
- Asserted `gate-failed` and `materialized: false`.
- Asserted the effect was never observed.
- Asserted both target directories remain absent.
- Asserted the failed run record carries a story-completeness stop row.
- Retained the fully resolved grep-clean contrast.

## Focused verification

Command:

```bash
bun test \
  src/play/materialize.test.ts \
  src/play/decompose-effect.test.ts \
  src/play/bare-code-cast.test.ts
```

Final result:

```text
42 pass
0 fail
148 expect() calls
3 files
```

The focused suite was run after the final collision-fixture correction.

## Typecheck verification

Command:

```bash
bun run build
```

Result:

```text
tsc --noEmit
exit 0
```

This proved the concrete result subtype, classification narrowing, detailed renderer aggregation,
and required materialization result field compile under the repository's strict settings.

## Full repository verification

Command:

```bash
bun run check
```

Final result:

```text
BAML generation: pass
TypeScript typecheck: pass
Tests: 1780 pass, 1 skip, 0 fail
Expectations: 5609
Test files: 117
```

The single skip is the established local-dist acceptance integration skip:

```text
skipped — no dist/ artifacts (run `just release-local` to exercise)
```

No BAML source or generated-client diff remained.

## Diff verification

`git diff --check` passed for all five ticket-owned paths.

Source diff before commit:

```text
src/play/bare-code-cast.test.ts
src/play/decompose-effect.test.ts
src/play/decompose-effect.ts
src/play/materialize.test.ts
src/play/materialize.ts
```

The diff contained no whitespace errors.

## Commit

Committed through the required ticket transaction:

```bash
lisa commit-ticket \
  --ticket-id T-077-02-02 \
  --message "fix(play): degrade unresolved inline charter cites (T-077-02-02)" \
  --include src/play/materialize.ts \
  --include src/play/materialize.test.ts \
  --include src/play/decompose-effect.ts \
  --include src/play/decompose-effect.test.ts \
  --include src/play/bare-code-cast.test.ts
```

Commit:

```text
03be6e5c2e43a3ac9c3dbd022d80523f87ad9c45
```

Commit subject:

```text
fix(play): degrade unresolved inline charter cites (T-077-02-02)
```

No ordinary `git add` or `git commit` command was used.

## Post-commit hygiene

- All five ticket-owned source/test paths are clean.
- The ordinary git index contains no ticket-owned staged files.
- Lisa-managed `.lisa/provenance.jsonl` remains outside the source commit.
- Lisa-managed ticket phase/status changes remain outside the source commit.
- Lisa-published `docs/active/work/T-077-02-02/` remains outside the source commit.
- Concurrent ticket/work artifacts remain untouched.
- The source commit contains exactly the five planned paths.

## Plan deviations

One small correction was made during final audit:

- The collision-order test initially kept an unresolved prose code.
- After inline annotation, that input no longer exercised the retained bare-code content guard.
- The fixture was changed to an unresolved `advances: ["P9"]` code.
- This restores the test's original identity-before-content meaning without implementing the
  advances normalization owned by T-077-02-03.
- Focused and full gates were rerun after the correction.

No production-scope deviation occurred.

## Remaining work

- Write `review.md`.
- Write `review-disposition.json`.
- Do not start another ticket.
- Lisa owns publication, completion commit, and seat release.
