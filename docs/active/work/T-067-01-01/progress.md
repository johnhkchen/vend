# T-067-01-01 — charter-code-snapshot-resolver — Progress

## Completed

- **Step 1 — `src/play/charter-snapshot.ts`** ✓
  Written per structure.md: header narrative (snapshot-at-cut story, id-guard purity
  standard, definition-anchored parse, first-wins, matchIds split), `DEFINITION` regex,
  private `oneLine`, exported `CharterSnapshot` + `snapshotCharterCodes`. Zero imports.
  Sanity REPL run: live charter → exactly 11 entries (P1..P7, N1..N4, title-only values);
  kitchen charter → K1..K3.

- **Step 2 — `src/play/charter-snapshot.test.ts`** ✓
  Five describes as planned: live-charter gold pin (full map equality, key-set equality);
  typed absence (unknown codes incl. `PE1`/`K1`-against-live, retired-P3 fixture, honest
  empty); never-empty-string (malformed definitions mint nothing; value sweep over BOTH real
  charters); definition-anchored + first-wins pins; shape robustness (wrapped span, trailing
  period, no-period, kitchen K1..K3).
  `bun test src/play/charter-snapshot.test.ts`: **13 pass, 0 fail, 63 expects**.

- **Step 3 — full gate + commit** ✓
  `bun run check` (baml:gen + tsc --noEmit + full suite): **1546 pass, 1 skip (pre-existing),
  0 fail** across 105 files.
  Committed as `23469d9` — `feat(play): charter-code snapshot resolver — pure code→one-liner
  map (T-067-01-01)` (module + test, one atomic unit per plan).

## Remaining

Nothing — all plan steps executed. Review phase next.

## Deviations from plan

Two, both found while writing/running the tests (plan step 2 list adjusted in place):

1. **Dropped `**P8 — ...**` from the malformed-definition cases.** `oneLine` strips exactly
   ONE trailing period, so an all-period title normalizes to `..` — non-blank, therefore a
   *present* (if ugly) entry, not a blank one. The case as written contradicted the
   documented strip-one contract; the AC only forbids empty strings, which the remaining
   cases (`.`-only, whitespace-only, tab) still pin. Punctuation-quality policing would be
   speculative scope.
2. **Removed the `expect(value, message)` custom-message form** from the value sweep —
   nonstandard across the repo's test suites; plain `expect` keeps house style.

No other deviations: files, exports, regex shape, and test structure match structure.md
exactly.
