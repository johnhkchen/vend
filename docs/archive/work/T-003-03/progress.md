# T-003-03 — Progress: pure-selection-minilanguage

> What got built, against the plan. Deviations and their rationale.

## Status: implementation complete, gates green

- `bun run check:typecheck` → clean (no errors).
- `bun test src/shelf/select.test.ts` → **27 pass / 0 fail**, 34 assertions.
- `bun test` (full suite) → **163 pass / 0 fail** across 12 files — zero regressions
  (was ~136 before this ticket; the +27 are this file's).

## Steps, as executed

| Step | Plan | Outcome |
|------|------|---------|
| 1 | `select.ts` error type + signature | Done — written complete in one pass (see deviation D-1) |
| 2 | `select.test.ts` full spec (red) | Done — 5 describe blocks + `reasonOf` + an error-structure block |
| 3 | `assertInRange` + single-index path | Folded into the single-pass implementation |
| 4 | range path + malformed/non-integer fallthrough | Folded in; all branches covered |
| 5 | full green bar + typecheck + commit | Both gates green; committed |

## Files

- **created** `src/shelf/select.ts` — `parseSelection` + `SelectionError` +
  `SelectionErrorReason`. ~115 lines incl. header. Zero imports (pure, R5).
- **created** `src/shelf/select.test.ts` — 27 tests across happy-path, dedup/sort,
  whitespace, hard-errors, edge/precedence, and error-structure blocks.
- **created** `src/shelf/` directory (also T-003-01's home; disjoint files, no conflict).

## Acceptance criteria — all met

- [x] `src/shelf/select.ts` exports `parseSelection(s, menuLength) -> number[]` —
      comma-separated, `a-b` inclusive, 1-indexed, deduped, sorted, whitespace-tolerant.
- [x] `0`, out-of-range, reversed range, and non-integer fields throw a typed
      `SelectionError` — no silent coercion. (Plus `malformed-range` for broken range
      shapes, surfaced in Research and tested.)
- [x] Fully unit-tested (`1,2,4-6 → [1,2,4,5,6]`; dedup; every error case).
- [x] No dependency on menu/CLI modules; both gates green; advances **P2**.

## Deviations from the plan

- **D-1 — single-pass implementation instead of the staged red→green steps 1→4.** The
  module is small and the design was fully settled in design.md/structure.md, so writing
  `select.ts` complete and then the test was faster than stubbing. The *intent* of the
  staged plan — tests that exercise real behavior — is preserved: the `reasonOf` helper
  pins each reason tag, and the suite was confirmed to discriminate (e.g. the numeric-sort
  and D7-precedence tests would fail against a naive implementation). No behavioral change
  vs. the plan.
- No other deviations. All D1–D9 design decisions implemented as written:
  - D5: `01 → [1]` accepted; `1.5`/`a` → non-integer; `0` → out-of-range. ✓
  - D7: `6-4` @ menuLength 5 → out-of-range; @ menuLength 10 → reversed; `3-3 → [3]`. ✓
  - D8: `menuLength 0` rejects every index (no separate guard). ✓
  - D9: `Set<number>` + numeric `.sort((a,b)=>a-b)`; the `10,2 → [2,10]` test pins it. ✓

## Notes for the boundary (T-003-04)

`SelectionError` carries `reason` (closed union), `field`, and `input` — enough to render a
precise message and to distinguish a user typo from a bug. `parseSelection` is reached only
on the `vend <sel>` path; bare `vend` never calls it. Pass `menu.actions.length` as
`menuLength` and resolve the returned 1-indexed positions against the persisted menu.
