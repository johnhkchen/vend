# T-075-03-01 Review — cold-start confidence count

## Disposition

Pass.

The committed implementation satisfies the ticket acceptance criterion and the parent
story's confidence-label contract. A play with one or two successful runs now remains a
default-envelope play while showing its real progress toward the ledger-owned measurement
threshold. A play with no successful runs retains the prior no-history label, and a
runs-bearing measured-zero confidence remains rejected by TypeScript.

No blocking issue remains.

## Scope reviewed

Ticket-owned production file:

- `src/shelf/shelf-row.ts`

Ticket-owned test file:

- `src/shelf/shelf-row.test.ts`

Attempt artifacts were kept under:

- `.lisa/attempts/T-075-03-01/1/work/`

The ticket did not modify:

- `src/ledger/recalibrate.ts`;
- the cold-start threshold or ledger window;
- recalibration percentile or envelope math;
- `src/shelf/menu.ts`;
- `src/shelf/home.ts` or its shell;
- sibling-ticket source or tests;
- ticket phase/status frontmatter.

This preserves the story's declared file split and honest boundary.

## Production change assessment

`ShelfConfidence` now represents three honest states:

1. `{ kind: "default" }` for genuinely zero successful runs;
2. `{ kind: "default", runs: 1 | 2 }` for real but sub-threshold history;
3. `{ kind: "measured", runs: 3 | ... | 100 }` for measured history under the
   default ledger window.

The two runs-bearing ranges are derived from ledger exports rather than independent shelf
literals:

- `COLD_START_MIN_SUCCESSES` supplies the boundary;
- `DEFAULT_WINDOW` supplies the maximum measured sample count.

The runtime mapper consumes `RecalibrateResult.confidence.successes`; it does not count run
records a second time. That keeps recency-window and success-filter semantics owned by the
ledger. It maps only the three valid source/count combinations and raises a diagnostic
invariant error if the ledger and shelf contracts drift.

`shelfRows` retains the same pure composition:

- one fresh row per play;
- input order preserved;
- records passed to `recalibrate` unchanged;
- rarity-to-tier mapping unchanged;
- authored prior retained for default envelopes;
- measured envelope retained for measured histories;
- no filesystem, clock, process, network, or addon work.

The renderer now emits:

- zero runs: `(default — no runs yet)`;
- one run: `(default — 1 run, measured at 3)`;
- two runs: `(default — 2 runs, measured at 3)`;
- measured history: `(measured · N runs)`.

The displayed `3` is produced from `COLD_START_MIN_SUCCESSES`, so the shelf does not redefine
ledger policy. Default envelopes retain their `~` marker. Measured envelopes remain unprefixed.
Budget formatting, shelf layout, row alignment, worth/name fields, and empty-shelf behavior are
unchanged.

During review, a stale top-of-module comment that still described `recalibrate` as the only
value import was corrected to acknowledge the ledger-owned threshold/window imports. This was
a documentation-only ticket-owned cleanup and was committed through Lisa.

## Acceptance evidence

### One and two successful runs

Mapping tests build real successful `RunRecord` fixtures and assert:

- one success maps to `{ kind: "default", runs: 1 }`;
- two successes map to `{ kind: "default", runs: 2 }`;
- both cases retain the authored budget rather than claiming a measured envelope.

Renderer tests assert the exact singular and plural strings. Seam tests feed the same real
histories through `shelfRows` and then `renderShelf`, proving the complete pure path rather
than only a hand-built row fixture.

### Zero successful runs

The zero-record mapping test still expects the count-free `{ kind: "default" }` state.
Direct-render and mapping-to-render tests both assert `(default — no runs yet)`. The test also
asserts that this output does not contain `measured`.

### Measured zero remains unconstructable

The test module contains a consumed `@ts-expect-error` assertion for:

```ts
const measuredZero: ShelfConfidence = { kind: "measured", runs: 0 };
```

Because the full TypeScript no-emit check passes, the directive proves that the invalid value
is rejected. An additional assertion rejects `{ kind: "default", runs: 0 }`, ensuring zero
belongs only to the count-free default state. Positive controls construct both valid thin
counts and a measured count at the threshold.

## Verification

Focused suite after the implementation and again after the review cleanup:

```text
bun test src/shelf/shelf-row.test.ts
19 pass
0 fail
38 expect() calls
```

Type gate after the review cleanup:

```text
bun run check:typecheck
exit 0
```

Full repository gate during review:

```text
bun run check
BAML generation passed
TypeScript no-emit check passed
1749 pass
1 skip
0 fail
5512 expect() calls
116 test files
exit 0
```

The one skip is the repository's existing opt-in compiled-release acceptance test, which
requires local `dist/` artifacts. It is unrelated to this ticket and is not a failure.

Diff hygiene checks passed. The two ticket-owned source files have no remaining working-tree
diff and the ordinary Git index is empty.

## Commits

Primary source/test unit:

```text
59c23ad720cdd8e45a656c8b8d01484c76ffb94f
fix(shelf): show thin cold-start run counts (T-075-03-01)
```

Review comment cleanup:

```text
2b673b68a4fa0c9775ef9e9f96096cf093c641fe
docs(shelf): align confidence import boundary (T-075-03-01)
```

Both commits used `lisa commit-ticket` with exact repository-relative include paths. No
ordinary `git add` or `git commit` was used for ticket work.

## Coverage assessment

Coverage is proportionate and complete for this pure typed change:

- runtime mapping covers zero, one, two, and measured histories;
- exact label rendering covers zero, singular thin, plural thin, and measured cases;
- integration seams cover real records through mapping and rendering;
- typecheck covers both invalid zero constructions;
- existing layout, order, isolation, budget, and empty-shelf tests remain green;
- the full repository suite guards downstream consumers.

No network, filesystem, clock, process, BAML, or executor integration test is needed because
the changed boundary is pure and all inputs are plain values.

## Open concerns and limitations

No ticket-blocking concern or known defect remains.

The bounded literal range intentionally reflects the shelf's existing use of `recalibrate`
with default options. If a future shelf call supplies a custom window or cold-start threshold,
the shelf confidence contract and mapper will need to evolve with that API change. Today no
such call exists, and the invariant error makes that drift visible rather than allowing a
misleading label.

The sibling ticket owns the empty-board guidance wording. This ticket neither proves nor claims
that separate story acceptance item.

## Final assessment

The ticket is ready for Lisa completion publication. Its acceptance criterion is met, its
source and tests are committed, the full repository gate is green, and review found no reason
to block.
