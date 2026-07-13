# T-077-02-02 — Review

## Disposition

Pass.

The ticket acceptance criterion is met. A decompose cast whose complete ticket prose cites the
charter-unresolvable N4/N2 examples now materializes an annotated board and returns exact ordered
degradation dispositions. A contrasting plan with an absent story contract still stops at the real
story-completeness gate and writes zero files.

## Source commit

```text
03be6e5c2e43a3ac9c3dbd022d80523f87ad9c45
fix(play): degrade unresolved inline charter cites (T-077-02-02)
```

Committed source paths:

- `src/play/materialize.ts`;
- `src/play/materialize.test.ts`;
- `src/play/decompose-effect.ts`;
- `src/play/decompose-effect.test.ts`;
- `src/play/bare-code-cast.test.ts`.

The commit contains no phase artifact, ticket frontmatter, Lisa provenance, concurrent work, BAML
schema, or generated-client file.

## Acceptance evaluation

### Editorial fixture materializes

Met.

`src/play/bare-code-cast.test.ts` dispenses a complete story/ticket plan through:

- the stub executor;
- real JSON parse;
- real `clear` gates;
- real `materialize`;
- real `castPlay` settlement.

The ticket purpose contains:

```text
Vend is N4 — Not an executor; the shelf is N2 — Not a babysitting dashboard.
```

The charter fixture deliberately defines neither N4 nor N2 while keeping the ticket's `advances`
code resolvable. All five real gates pass.

Observed cast result:

```text
outcome: success
materialized: true
```

The story and ticket files both exist on disk.

### Honest annotation

Met.

The written ticket purpose becomes:

```text
Vend is [unresolved charter cite] Not an executor; the shelf is [unresolved charter cite] Not a babysitting dashboard.
```

The raw N4 and N2 tokens are absent from the materialized artifact. The authored explanatory prose
remains readable. The marker contains no code-shaped token, so it cannot be confused with a valid
cut-time gloss or retrigger the retained bare-code scanner.

### Degrade disposition returned

Met.

The fixture observes:

```json
[
  {"code":"N4","location":"T-900-01.md#purpose","action":"annotate"},
  {"code":"N2","location":"T-900-01.md#purpose","action":"annotate"}
]
```

The records come from the shared T-077-02-01 classifier, not from reparsing the output marker.

`MaterializeResult.degrades` is always present. A clean cut returns `[]`; a degraded cut returns
occurrence-level records in rendered order.

`decomposeEffect` returns nonempty records through its concrete `DecomposeEffectResult`, proven by
an addon-free real-fs effect test. This establishes the handoff to T-077-02-04 without changing the
generic cast/run-log schema in this ticket.

### BareCodeError removed for editorial inline cite

Met.

Inline application runs before `findBareCodes`. Eligible unresolved prose is annotated, so the
write guard sees clean rendered bytes and does not throw.

`BareCodeError` itself remains intentionally present. It is still the rendered-byte safety net for
surviving non-inline surfaces, notably unresolved `advances` output before T-077-02-03 applies its
own normalization. Retaining the type does not violate the criterion; the editorial producing path
has been removed.

### Structural defect refuses with zero files

Met.

The cast fixture includes a story with all five required contract fields absent. The real gate
reports:

```text
story-incomplete — missing: scope, storyAcceptance, honestBoundary, waveRationale, outOfSlice
```

Observed cast result:

```text
outcome: gate-failed
materialized: false
```

The fixture callback proves the effect never ran. Both story and ticket target directories remain
absent, not merely empty. The run record includes a failed `story-completeness` row.

## Design review

### Classification authority

Sound.

The implementation reuses `classifyCharterCite` and the existing cut-time `CharterSnapshot`. It
does not add a competing code parser or charter lookup service.

### Scope of eligible codes

Sound.

- Snapshot-known codes resolve normally.
- P/N snapshot misses degrade because those families are always charter-policed.
- Snapshot-defined prefix families receive the same treatment.
- Snapshot-missing foreign families remain verbatim ordinary prose.

This preserves the existing `forward-E1`/`A3` passthrough contract.

### Authored gloss handling

Sound.

The matcher now observes ` — ` rather than skipping the whole occurrence.

- A resolvable authored gloss remains byte-identical.
- An unresolved authored cite loses its code and delimiter, then retains the explanatory text after
  the marker.

The existing idempotence case remains green.

### Location quality

Sound.

`<artifact>.md#<field>` locations are stable, deterministic, nonblank, and generated at the pure
field call site before rendering erases draft boundaries. Ticket purpose/doneSignal and every story
contract field have distinct locations.

### Pure core / impure shell

Preserved.

- Matching, classification, annotation, location attachment, rendering, and aggregation are pure.
- The existing `materialize` shell remains the sole filesystem writer.
- The charter snapshot is still created exactly once per cut.
- Files are still rendered and judged completely before the first write.

### Structural guard order

Preserved.

Cross-board collision detection still runs before charter snapshot/render/content judgment. The
test now uses an unresolved bare advances code so it continues to prove identity wins over a real
remaining content defect.

## File-by-file review

### `src/play/materialize.ts`

The public renderer signatures and `RenderedFile` bytes container remain stable. Private detailed
renderers avoid leaking classification metadata into byte-oriented callers. `MaterializeResult`
adds one required degradation array, which gives downstream concrete callers unambiguous clean
versus degraded data.

No filesystem operation moved ahead of collision, classification, or the retained content guard.

### `src/play/decompose-effect.ts`

The concrete subtype is a narrow bridge to the later join. It avoids an engine-to-play dependency
and remains assignable to `EffectResult`. Nonempty-only forwarding keeps clean effect result shapes
unchanged.

All existing named refusal paths remain present.

### `src/play/materialize.test.ts`

Coverage includes:

- unresolved bare prose;
- unresolved authored-gloss prose;
- exact annotation bytes;
- exact occurrence records;
- clean empty record array;
- real filesystem materialization;
- scanner-clean written bytes;
- collision precedence with a genuine remaining bare-code defect.

The pre-existing pure scanner matrix remains intact, preventing accidental guard deletion.

### `src/play/decompose-effect.test.ts`

Coverage proves concrete propagation, real written bytes, validator execution, artifact count, and
the absence of the raw unresolved code.

### `src/play/bare-code-cast.test.ts`

Coverage uses the full real-gate cast harness for both editorial success and structural refusal.
The existing fully resolved plan remains as a grep-clean contrast, so the new behavior is not
proven only by degraded inputs.

## Verification review

Focused suite:

```text
42 pass
0 fail
148 expect() calls
```

Build:

```text
tsc --noEmit — pass
```

Full repository gate:

```text
BAML generation — pass
TypeScript typecheck — pass
1780 tests passed
1 test skipped
0 tests failed
5609 expectations
117 test files
```

The single skip is the existing dist-artifact integration condition, not a ticket regression.

`git diff --check` passed before commit. No generated BAML diff remained.

## Regression audit

- Resolvable code expansion remains green.
- Resolvable authored gloss remains byte-identical.
- Foreign prefix passthrough remains green.
- Advances rendering remains unchanged.
- Bare-code pure scanning remains green.
- Cross-board collision refusal remains green.
- Known/unknown seat materialization remains green.
- Story contract/DAG/footer goldens remain green.
- Alias drift errors remain green.
- Decompose routing and inference behavior remains green.
- Full repository suite is green.

## Honest boundary

This ticket proves the inline prose branch only.

It does not claim:

- dangling `advances` codes materialize yet;
- degradation records are durable in `runs.jsonl` yet;
- the CLI/cast summary prints a degraded count yet;
- the reporter's live E-045 cast was rerun;
- any repair or regeneration loop exists.

Those are intentionally separated:

- `T-077-02-03` owns advances normalization and its value-gate boundary;
- `T-077-02-04` owns the RunRecord and cast-summary join;
- live metered recast remains outside the parent story's fixture-proven boundary.

## Open concerns

No blocking concern.

One presentation limitation is explicit: `[unresolved charter cite]` does not include the original
code in artifact prose. That is intentional so the retained bare-code guard cannot mistake the
marker for unresolved grounding. The exact code remains in structured disposition data and will
become durable/operator-visible in T-077-02-04.

The generic `castPlay` return currently drops concrete effect degradation metadata. This is not a
hidden gap in this ticket; it is the named dependency join owned by T-077-02-04 after both appliers
land.

## Worktree and workflow hygiene

- Source work is committed through `lisa commit-ticket`.
- The commit includes exactly five ticket-owned paths.
- Ticket-owned source paths are clean after commit.
- No ordinary index command was used.
- Lisa-managed provenance/frontmatter/publication changes remain outside the source commit.
- Concurrent ticket work remains untouched.
- All six attempt artifacts are in the private attempt directory.
- Review disposition is `pass`.

## Final assessment

Ready to complete.

The implementation converts only the editorial inline-prose failure into an honest degraded clear,
returns the precise data needed by the later ledger join, and retains structural refusal with the
strongest observable zero-write proof. Acceptance is met with focused and repository-wide green
verification.
