# T-003-03 — Plan: pure-selection-minilanguage

> Ordered, independently-verifiable steps. Testing strategy and verification criteria.
> The whole ticket is one pure module + its test — a small, single-commit unit, but
> sequenced so each step leaves the tree typecheck-green.

## Testing strategy

- **Unit tests only.** The module is pure with zero I/O — exactly the
  `id-guard.test.ts` species. No integration test belongs here; dispatch and resolution
  against a real menu are T-003-04's surface, not this ticket's.
- **`toEqual` on exact arrays** (membership + order), matching the sibling's discipline.
- **Errors asserted two ways:** `toThrow(SelectionError)` for the class, and a `reasonOf`
  helper to pin the closed-union `reason` tag — so a wrong-but-still-throwing path can't
  pass silently.
- **Branch coverage is the bar:** every reason (`empty`, `non-integer`, `out-of-range`,
  `reversed-range`, `malformed-range`), every D5–D9 edge (`01`, `3-3`, `6-4` both menu
  lengths, `menuLength 0`, dedup, sort, overlap, whitespace).
- **Verification gates:** `bun run check:typecheck` and `bun run check:test` both green
  (AC#4). Run the full suite, not just the new file, to confirm zero regressions.

## Steps

### Step 1 — `src/shelf/select.ts`: error type + public signature stub

Create `src/shelf/select.ts` with the header comment, `SelectionErrorReason` union,
`SelectionError` class, the two regex constants, and a `parseSelection` signature that
throws `not-implemented` (or returns `[]`). Goal: a compiling module with the final public
surface locked.

**Verify:** `bun run check:typecheck` green. The three exports resolve.

### Step 2 — `src/shelf/select.test.ts`: write the full spec (red)

Create the test file with all five `describe` blocks and the `reasonOf` helper, per
structure.md. Write them against the *intended* behavior, so they fail meaningfully against
the Step 1 stub.

**Verify:** `bun test src/shelf/select.test.ts` runs and **fails** (red bar) — proving the
tests exercise real behavior, not vacuously pass.

### Step 3 — implement `assertInRange` + single-index path

Fill in `assertInRange` (the `1 ≤ n ≤ menuLength` / `Number.isInteger` guard → `out-of-range`)
and the `SINGLE` branch of `expandField`, and wire `parseSelection`'s trim/split/empty/loop/
dedupe-sort skeleton.

**Verify:** the happy-path single-index, dedup, sort, `0`, `>menuLength`, empty-input, and
stray-comma tests pass. Range tests still red.

### Step 4 — implement the range path

Add the `RANGE` branch to `expandField`: parse endpoints (guarding `m[1]`/`m[2]` for
`noUncheckedIndexedAccess`), `assertInRange` each, reversed check after (D7), inclusive
expansion. Add the final `malformed-range` vs `non-integer` fallthrough.

**Verify:** the entire `select.test.ts` suite goes green — ranges, reversed, malformed,
`3-3`, `6-4` precedence, whitespace-around-dash, overlap.

### Step 5 — full green bar + typecheck, then commit

Run `bun run check:typecheck` and `bun run check:test` (the whole suite). Confirm zero
regressions against the existing ~136 tests. Then commit `select.ts` + `select.test.ts`
together as one atomic unit.

**Verify:** both gates green; `git status` shows only the two new source files (plus the
work artifacts) staged.

## Commit shape

One source commit:

```
T-003-03: pure selection mini-language parser (parseSelection + SelectionError)
```

The RDSPI work artifacts (`research/design/structure/plan/progress/review.md`) are
committed by the loop's own housekeeping per the established T-004/T-005 pattern (obs
20461) — this plan does not hand-commit them.

## Risk / deviation watch

- **`noUncheckedIndexedAccess` on regex groups** — `m[1]`/`m[2]` are `string | undefined`.
  Guard with a truthiness check after `RANGE.exec` (unreachable throw) rather than `as`,
  to stay honest under `--strict`. Flag in progress.md if it forces a shape change.
- **JS default sort** — must pass the numeric comparator `(a,b)=>a-b`; a lexicographic
  `10 < 2` bug would slip past small fixtures. The dedup/sort describe block uses values
  that would expose it (include a two-digit index).
- **Empty-field vs empty-input** — both map to reason `empty`; tests assert each so the
  shared reason is intentional, not an accident.
