# T-077-02-01 — Progress

## Current state

- Research: complete.
- Design: complete.
- Structure: complete.
- Plan: complete.
- Implement: complete.
- Review: next.

## Implementation summary

Created the shared pure charter-cite disposition seam planned for the story's two downstream
appliers and ledger join.

Production source:

- `src/play/degrade-disposition.ts`

Test source:

- `src/play/degrade-disposition.test.ts`

No existing source module was modified.

## Step 1 — Pure contract module — complete

Added the closed action vocabulary:

```ts
export const DEGRADE_ACTIONS = ["strip", "annotate"] as const;
```

Added the caller input contract:

```ts
interface CharterCite {
  code: string;
  location: string;
  action: DegradeAction;
}
```

Added the exact requested degradation record:

```ts
interface DegradeDisposition {
  code: string;
  location: string;
  action: DegradeAction;
}
```

Added the exhaustive single-cite classification:

- `resolvable` carries canonical code/location and snapshot title;
- `degradable` carries one `DegradeDisposition`;
- `structural` carries canonical code/location and stable reason.

Added stable structural input reasons:

- `invalid-code`;
- `missing-location`.

Added `classifyCharterCite(cite, snapshot)`.

Observed implementation behavior:

- code and location are trimmed once;
- code validation precedes location validation;
- code shape matches snapshot parsing: `[A-Z]{1,3}\d+`;
- `snapshot.get(code)` is the only resolution decision;
- a valid snapshot miss is degradable;
- invalid input returns data and never throws;
- the caller's strip/annotate action is preserved exactly.

Added the materialization taxonomy:

- `materialized`;
- `materialized-with-degrades`;
- `structural-refusal`.

Added `materializationDisposition(classifications)`.

Observed fold behavior:

- first structural finding wins;
- degradations preserve input order;
- resolvable cites create no false records;
- no deduplication occurs;
- the returned degradation list is freshly allocated;
- empty/all-resolvable input is a clean materialization.

## Step 2 — Focused unit suite — complete

Added 16 Bun tests with 22 assertions.

Resolvable coverage:

- known `P3` resolves to `Gates are the contract`;
- known `N4` resolves to `Not an executor`;
- surrounding code/location whitespace is canonicalized;
- resolvable output contains no degradation record.

Degradable coverage:

- unresolved `N2` returns exact `strip` record;
- unresolved `P9` returns exact `annotate` record;
- prefix-generic `K7` degrades against an empty snapshot;
- record code/location/action are exact.

Structural coverage:

- blank code;
- whitespace-only code;
- lowercase code;
- word-shaped code;
- punctuation-suffixed code;
- blank location;
- invalid code wins over simultaneous blank location.

Materialization coverage:

- empty list is `materialized`;
- all-resolvable list is `materialized`;
- mixed resolvable/degradable is `materialized-with-degrades`;
- multiple records preserve caller order;
- a structural finding is `structural-refusal`;
- structural wins after an earlier degradation.

Purity coverage:

- frozen cite input survives unchanged;
- snapshot entries survive unchanged;
- frozen classification input survives unchanged;
- aggregate degradation output is a fresh array.

## Focused verification

Command:

```text
bun test src/play/degrade-disposition.test.ts
```

Result:

```text
16 pass
0 fail
22 expect() calls
Ran 16 tests across 1 file.
```

## Type verification

Command:

```text
bun run build
```

Result:

```text
$ tsc --noEmit
exit 0
```

This proves the discriminated unions and type-only snapshot import satisfy strict TypeScript,
`noUncheckedIndexedAccess`, and `verbatimModuleSyntax`.

## Diff verification

Command:

```text
git diff --check -- src/play/degrade-disposition.ts src/play/degrade-disposition.test.ts
```

Result: exit 0, no whitespace errors.

Pre-commit source status contained exactly the two new ticket-owned source paths in addition to
Lisa-managed board/artifact state.

## Full repository gate

Command:

```text
bun run check
```

Result:

```text
BAML code generation: pass
TypeScript: pass
1768 pass
1 skip
0 fail
5569 expect() calls
Ran 1769 tests across 117 files.
```

The single skip is the existing optional compiled-dist acceptance integration, which names
`just release-local` as its activation path. It is unrelated to this ticket.

## Commit

Committed through the required isolated Lisa transaction:

```text
b4a472a891f4c425fa6b4aace660c68f6774c644
feat(play): classify charter cite dispositions (T-077-02-01)
```

Exact included paths:

- `src/play/degrade-disposition.ts`
- `src/play/degrade-disposition.test.ts`

Commit stat:

```text
src/play/degrade-disposition.test.ts | 178 lines
src/play/degrade-disposition.ts      | 133 lines
2 files changed, 311 insertions(+)
```

No `git add`, ordinary-index staging, or direct `git commit` was used.

## Post-commit audit

- Both ticket-owned source paths are tracked and clean.
- No ticket-owned source path is staged, modified, or untracked.
- The commit contains exactly the intended two files.
- Existing source modules remain unchanged.
- Ticket phase/status frontmatter was not edited by the worker.
- Remaining worktree state is Lisa-managed provenance/frontmatter and automatically published
  attempt artifacts.

## Deviations from plan

None material.

The implementation and tests match the planned public surface and behavior. The only operational
observation was that Lisa automatically published completed private phase artifacts to
`docs/active/work/T-077-02-01/`; those files were not written directly and were not included in the
source commit, as required by the assignment.

## Remaining work

- Review the committed diff against the ticket and story boundaries.
- Write `review.md`.
- Write `review-disposition.json`.
- Stop on this ticket and await Lisa completion handling.
