# T-077-02-01 — Review

## Disposition

Pass.

The ticket acceptance criterion is met. A pure, addon-free degrade-disposition type and classifier
now classify a caller-located charter cite against a `CharterSnapshot` as resolvable, degradable, or
structural. Unresolved valid cites produce the exact `{code, location, action}` record for either
`strip` or `annotate`. The aggregate taxonomy distinguishes a clean materialization,
`materialized-with-degrades`, and `structural-refusal`.

## Commit reviewed

```text
b4a472a891f4c425fa6b4aace660c68f6774c644
feat(play): classify charter cite dispositions (T-077-02-01)
```

The commit contains exactly:

- `src/play/degrade-disposition.ts`
- `src/play/degrade-disposition.test.ts`

No existing production or test file was modified.

## Production change

### `src/play/degrade-disposition.ts`

Added a new pure module with one type-only dependency on `CharterSnapshot`.

The module exports the closed action vocabulary:

```ts
["strip", "annotate"]
```

It exports `CharterCite`, which gives the classifier:

- the cited code;
- the caller-owned location;
- the action to apply if resolution misses.

It exports `DegradeDisposition` with exactly the story-required fields:

```ts
{
  code: string;
  location: string;
  action: "strip" | "annotate";
}
```

No extra free-form reason is mixed into that durable editorial record.

## Single-cite classification

`classifyCharterCite` returns a discriminated union.

### Resolvable

A code present in the supplied snapshot returns:

- `classification: "resolvable"`;
- canonical code;
- canonical location;
- snapshotted title.

It does not emit a false degrade record, even if the caller supplied a fallback action.

### Degradable

A valid, well-shaped code absent from the supplied snapshot returns:

- `classification: "degradable"`;
- one exact `DegradeDisposition`.

This behavior holds against an empty snapshot and for prefix-generic codes such as kitchen `K7`.
The classifier does not assume only `P` and `N` exist.

### Structural

An invalid direct classifier input returns:

- `classification: "structural"`;
- canonical code/location;
- `invalid-code` or `missing-location`.

Code validation runs first, giving deterministic first-offense behavior.

This structural branch does not replace or weaken the board's real structural gates. Graph defects,
id collisions, missing fields, and absent story contracts still refuse in their existing modules.
This ticket changes none of those paths.

## Materialization taxonomy

`materializationDisposition` folds single-cite classifications into:

- `materialized` when there are no structural findings and no degradation records;
- `materialized-with-degrades` when the board can land with one or more editorial changes;
- `structural-refusal` on the first structural finding.

The fold preserves per-occurrence order and does not deduplicate. That is appropriate because
location is provenance and later run-record presentation may need an honest count of degraded cites.

The fold allocates a fresh result array and does not mutate caller inputs.

## Pure-core assessment

The new module follows the project boundary:

- no filesystem access;
- no clock;
- no process/global environment;
- no network;
- no BAML import;
- no renderer import;
- no gate import;
- no ledger import;
- no thrown expected findings.

Its only dependency is a type-only `CharterSnapshot` import. At runtime it accepts plain values and
returns plain data.

The snapshot remains the sole resolution oracle. The classifier does not parse charter prose or
create a competing definition index.

## Test coverage

### Resolvable branch

- known `P3` resolves to the exact title;
- known `N4` resolves to the exact title;
- surrounding whitespace is canonicalized;
- no degradation record appears on a hit.

### Degradable branch

- unresolved `N2` produces exact `strip` disposition;
- unresolved `P9` produces exact `annotate` disposition;
- `K7` against an empty snapshot remains a valid degradable cite;
- record fields are asserted with exact equality.

### Structural branch

- empty code;
- whitespace-only code;
- lowercase code;
- word-shaped code;
- punctuation-suffixed code;
- blank location;
- invalid-code priority over a simultaneous missing location.

### Aggregate taxonomy

- empty input is clean `materialized`;
- all-resolvable input is clean `materialized`;
- mixed resolvable and degradable input is `materialized-with-degrades`;
- multiple records remain in caller order;
- a structural classification produces `structural-refusal`;
- structural refusal wins even after an earlier degradation.

### Purity

- frozen cite input survives unchanged;
- snapshot entries survive unchanged;
- frozen classification list survives unchanged;
- output degradation list is freshly allocated.

## Verification evidence

Focused suite:

```text
bun test src/play/degrade-disposition.test.ts
16 pass
0 fail
22 expect() calls
```

Strict typecheck:

```text
bun run build
$ tsc --noEmit
exit 0
```

Repository gate before commit:

```text
bun run check
BAML generation: pass
TypeScript: pass
1768 pass
1 skip
0 fail
5569 expect() calls
117 files
```

The single skipped test is the pre-existing optional compiled-dist acceptance integration. It is
unrelated and self-documents `just release-local` as the way to exercise it.

Commit whitespace check:

```text
git show --format= --check b4a472a891f4c425fa6b4aace660c68f6774c644
exit 0
```

## Acceptance trace

| Acceptance clause | Result | Evidence |
|---|---|---|
| pure degrade-disposition type | met | `DegradeDisposition` in addon-free module |
| classifier consumes cite + snapshot | met | `classifyCharterCite(CharterCite, CharterSnapshot)` |
| resolvable classification | met | known-code exact-title tests |
| degradable classification | met | missing-code tests |
| strip action | met | exact `N2` record |
| annotate action | met | exact `P9` record |
| structural classification | met | invalid-code/location tests |
| `{code, location, action}` record | met | exported interface + exact assertions |
| `materialized-with-degrades` taxonomy | met | aggregate degraded test |
| distinct structural refusal | met | structural-wins aggregate test |
| unit tests | met | 16 focused tests, full gate green |

## Compatibility

- Existing snapshot behavior is unchanged.
- Existing render bytes are unchanged.
- Existing gate results are unchanged.
- Existing effect behavior is unchanged.
- Existing RunOutcome and RunRecord schemas are unchanged.
- Existing structural refusal paths are unchanged.
- No BAML client regeneration diff was committed.
- No public consumer is forced to migrate because the module is new and not yet wired.

## Story-boundary audit

Intentionally deferred to `T-077-02-02`:

- invoke the classifier for inline prose;
- apply annotation or stripping;
- return degradation records from materialization/effect;
- stop turning editorial cites into `BareCodeError`.

Intentionally deferred to `T-077-02-03`:

- invoke the classifier for `advances`;
- extend normalization beyond the existing non-goal strip;
- preserve the value-gate refusal for a ticket left with no actual advance.

Intentionally deferred to `T-077-02-04`:

- add dispositions to `RunRecord`;
- normalize/revive optional ledger metadata;
- print `cleared; N cite(s) degraded` in the cast summary.

The ticket does not claim the full story acceptance on its own. It provides the shared contract the
story DAG requires before those changes can safely run in parallel.

## Open concerns

None blocking.

Location remains a nonblank string by design. The two applier tickets own the exact provenance
format because they know whether the cite came from an `advances` entry or a rendered prose field.
The final ledger ticket should preserve these values verbatim and validate the record atomically.

## Worktree and commit hygiene

- The meaningful source unit was committed through `lisa commit-ticket`.
- Exact include paths limited the commit to the two new files.
- No ordinary-index `git add` or direct `git commit` was used.
- Both ticket-owned source paths are clean after commit.
- Lisa-managed provenance/frontmatter and auto-published RDSPI artifacts remain outside the source
  commit and were not directly edited as ticket implementation.

## Final assessment

The change is right-sized, tested, committed, and inside the story slice. It gives both downstream
appliers one canonical classification and gives the ledger join one canonical degradation record.
P3 is preserved by distinguishing editorial degradation from structural refusal; P5 is preserved by
keeping the decision local, pure, and observable as plain data.
