# T-003-03 — Review: pure-selection-minilanguage

> Handoff document. What changed, test coverage, open concerns — enough to review the
> work without reading every diff.

## Summary

The pure parse half of the `vend <sel>` press. A single module turns the selection
mini-language (`1,2,4-6`) into the picked 1-indexed positions — deduped, sorted, validated
against `menuLength` — or throws a typed `SelectionError`. Zero imports, zero I/O; the
purest module species in the tree (the `id-guard.ts` mould). Committed at `37b9e05`.

## Files changed

| File | Action | Lines | Notes |
|------|--------|-------|-------|
| `src/shelf/select.ts` | created | ~115 | `parseSelection`, `SelectionError`, `SelectionErrorReason`; 2 private helpers |
| `src/shelf/select.test.ts` | created | ~165 | 27 tests, 6 describe blocks, a `reasonOf` helper |

`src/shelf/` is new; it is shared (disjoint files) with the parallel T-003-01 menu work —
no edit conflict, exactly as R5 predicted. No existing file was modified or deleted.

## Public surface

Exactly the three exports the acceptance criteria name — nothing more:

- `parseSelection(s: string, menuLength: number): number[]` — pure, partial (throws on
  invalid input), returns a fresh deduped+sorted array.
- `class SelectionError extends Error` — `readonly reason`/`field`/`input`.
- `type SelectionErrorReason` — closed union of 5 failure modes.

Internal helpers (`expandField`, `assertInRange`) are unexported — behavior is contract,
shape is not.

## Acceptance criteria → evidence

| AC | Status | Evidence |
|----|--------|----------|
| `parseSelection` exports correct signature & semantics | ✅ | happy-path + dedup/sort + whitespace blocks |
| `0`/out-of-range/reversed/non-integer throw typed `SelectionError` | ✅ | hard-errors block, each `reason` pinned |
| Fully unit-tested (`1,2,4-6`; dedup; error cases) | ✅ | 27 tests, the spec example asserted verbatim |
| No menu/CLI dependency; gates green; advances P2 | ✅ | zero imports; typecheck clean; 163/163 |

## Test coverage

- **27 tests / 34 assertions** in `select.test.ts`; **full suite 163 pass / 0 fail** (was
  ~136 — no regressions). `tsc --noEmit` clean.
- Every `SelectionErrorReason` branch is exercised, and asserted by *tag* (`reasonOf`), not
  just by "something threw" — a wrong-but-throwing path cannot pass.
- Discriminating fixtures, not just confirmatory ones:
  - `10,2 → [2,10]` would fail a lexicographic sort (catches the JS default-sort trap).
  - `6-4 @ menuLength 5 → out-of-range` vs `@ 10 → reversed-range` pins the D7 precedence.
  - `3-3 → [3]` proves equal endpoints aren't treated as reversed.
  - `01 → [1]`, `1.5`/`a` → non-integer, `1-2-3`/`3-`/`-3` → malformed-range, `4 6` →
    non-integer (no silent coercion), `1,,2`/`1,`/`""` → empty.
  - An error-structure test asserts `reason`/`field`/`input`/`name` are all populated.

## Coverage gaps / things deliberately not tested

- **Astronomically large indices** (e.g. `99999999999999999999`) are not fixture-tested.
  `^\d+$` + `Number()` would produce an imprecise float, but it would still be `> menuLength`
  for any real menu → `out-of-range`. Harmless; noted for completeness.
- **No property/fuzz test.** The branch coverage is exhaustive against the closed grammar,
  so a generative test would add little here.

## Open concerns / handoff notes

- **None blocking.** The module is self-contained and final for its scope.
- **For T-003-04 (the convergence):** pass `menu.actions.length` as `menuLength`; resolve the
  returned 1-indexed positions against the persisted `.vend/menu.json`. Use
  `SelectionError.reason` (closed union → exhaustive `switch`) to render a precise message —
  distinguish a user typo (`out-of-range`, `non-integer`, …) from a genuine bug. Note the
  parser does **not** know about a stale menu; staleness detection (epic "Done looks like")
  is T-003-02/04's `MenuCache` freshness marker, upstream of resolution.
- **Scope boundary honored:** no resolution, no dispatch, no `--budget` parsing — all
  T-003-04. This ticket is parse-only, as decomposed.

## Risk assessment

Low. Pure function, no I/O, no shared mutable state, no concurrency surface; the lock/DAG
concerns in the workflow's Concurrency section don't apply (disjoint files from the parallel
thread). The only subtlety — sort comparator and reversed/out-of-range precedence — is
pinned by tests that would fail if either regressed.
