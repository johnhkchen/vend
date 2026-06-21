# T-055-02 — Progress

_Execution log. What landed, deviations from the plan, and the gate results._

## Status: COMPLETE — both gates green, committed `2312f9a`.

## Steps executed (against plan.md)

- **Step 1 — types, palette, constants** ✅ `SvgBoxStyle`/`SvgOverlays`, a frozen 9-token
  `DEFAULT_PALETTE` (+ `NEUTRAL` fallback), and the `LABEL`/`FACE`/`CARD`/`EDGE`/`FACE_CHAR_BUDGET`
  constants. Hex reuses paper.ts's classDef family.
- **Step 2 — pure helpers** ✅ `styleFor` (`?? ` chain), `clip` (truncate + `…`), `svgTitle`
  (`xmlEscape`), `indexBoxes` (positional id→box join). All `noUncheckedIndexedAccess`-guarded.
- **Step 3 — `projectionToSvg`** ✅ root → optional `<title>` → edges → per-lane label +
  per-card rect[+face] → `</svg>`, joined with `\n`. Reads only.
- **Step 4 — `projection-svg.test.ts`** ✅ 16 tests, one describe per AC clause + overlays +
  a source-scan purity guard.
- **Step 5 — gates + commit** ✅ typecheck clean, full suite green, single atomic commit of the
  two source files (mirroring T-055-01's commit shape — work artifacts tracked separately).

## Gate results

- `bun run check:typecheck` (tsc `--noEmit`, `noUncheckedIndexedAccess: true`) → **clean**.
- `bun test src/present/projection-svg.test.ts` → **16 pass / 0 fail** (33 expect calls).
- `bun test` (full) → **1255 pass / 0 fail** across 80 files. No regressions; the new suite is
  purely additive (no existing module edited).
- Pre-commit hook (`check:precommit`) re-ran tests green on commit.

## AC ↔ test mapping (all satisfied)

| AC clause | Test | Result |
|---|---|---|
| one `<rect>` per card | `count(/<rect\b/) === 5` (real) / `=== 3` (fake) | ✅ |
| one group label per group | `count(/font-size="14"/) === groups.length` | ✅ |
| one `<line>` per `depends_on` | `count(/<line\b/) === links.length` (== 1) | ✅ |
| empty → minimal `<svg>` | `<svg`/`</svg>` present, `viewBox` set, 0 rects/lines, no `NaN` | ✅ |
| byte-identical twice | `toBe` self-equality (real + fake) | ✅ |
| reference-unchanged | `groups`/`links` refs identical + still frozen after render | ✅ |

## Deviations from plan

1. **`overlays?` reinterpreted, as designed (Decision 2).** paper.ts's `overlays` are per-node
   PROSE threaded into `projectGraph`; that prose is already baked into the projected cards by
   the time we receive the IR. So this consumer's `overlays` carry the two things the SVG layer
   genuinely owns — a `palette` override and an accessible `title` — keeping the `(IR, overlays?)`
   shape and the omit-friendly honest-empty semantics without a dead prose path. This was a
   planned design decision, not a mid-flight pivot; flagged here because it is the one place the
   signature diverges in *meaning* (not shape) from the mirrored contract.

2. **Manual eyeball render added (not in plan).** Beyond the automated suite, rendered a small
   real board to stdout to confirm well-formedness: valid root, `<title>`, one center→center
   edge, two colored rects + faces. Throwaway script, not committed. Confirmed the geometry and
   palette read as intended.

No other deviations. No plan steps skipped, no scope added beyond the AC + the two designed
options. `svg.ts` / `project.ts` / `paper.ts` untouched.

## Notes for Review

- The face text in synthetic fixtures (`"T T 001 01"`) is `humanizeTitle` of a fabricated kebab
  id — real boards carry meaningful titles. The renderer faithfully renders whatever the IR
  carries; it invents nothing.
- `DESIGNER_PRESET` happens to group by story and color by leverage, so the demo cards are
  orange (high priority). The renderer is preset-agnostic — it reads the projection's tokens.
