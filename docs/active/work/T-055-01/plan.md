# T-055-01 — Plan: ordered, verifiable steps

_Sequenced implementation. Each step independently checkable; one atomic commit at the end._

## Testing strategy

- **Unit, pure, no live model.** Every AC clause is a pure-function assertion (string-in/
  string-out, numbers-in/rects-out). No `buildGraph`, no fs, no `loadWorkGraph` — simpler than
  the paper/project suites.
- **Determinism via `toBe`.** Repeated identical input must produce identical output — asserted
  with `expect(f(x)).toBe(f(x))` for strings and a deep-equal for the layout object.
- **Non-overlap via pairwise intersection.** A helper in the test asserts no two card boxes
  (across all lanes) overlap, for an N×M fixture.
- **Purity enforced as a test.** Read `svg.ts`'s own source and assert the tokens `Date`,
  `Math.random`, and a `from "fs"`/`from "node:fs"` import are absent — turning the AC's
  "Date/Math.random absent" clause into an executable gate.
- **Gates:** `bun test` (suite green) and `tsc --noEmit` (typecheck) both pass before commit.

## AC → test mapping

| AC clause | Test |
|---|---|
| geometry: N groups of M cards → deterministic non-overlapping box rects | `layout` block: count, non-overlap, deterministic deep-equal |
| XML-escape neutralizes `<`,`>`,`&`,`"` | `xmlEscape` block: per-char + `&`-first + face-text-via-`svgText` |
| each primitive byte-identical for identical input | primitives block: exact string + `toBe` repeat |
| module imports no fs/clock/random (`Date`/`Math.random` absent) | purity-guard block: source-text scan |

## Steps

### Step 1 — Types + constants
Create `src/present/svg.ts` with the header doc-block, the public interfaces (`RectAttrs`,
`TextAttrs`, `LineAttrs`, `CardBox`, `LaneBox`, `SvgLayout`), and the frozen `LAYOUT` table
with concrete values:
`PAD=24, LANE_GAP=32, LANE_LABEL_H=28, LANE_PAD=12, CARD_W=220, CARD_H=64, CARD_GAP_Y=16`.
*Verify:* `tsc --noEmit` clean.

### Step 2 — `xmlEscape` + `num`
Implement `xmlEscape` (chained replace, `&` first → `<` → `>` → `"`) and the private `num`
coordinate normalizer (no locale/exponential, trim trailing `.0`).
*Verify:* hand-check `xmlEscape('<a href="x" & y>')` → `&lt;a href=&quot;x&quot; &amp; y&gt;`
— confirm `&` not double-escaped.

### Step 3 — Primitives
Implement `svgRect`, `svgText` (escapes `content` internally), `svgLine`, each with fixed
attribute order and `undefined`-optional omission, via a small private attribute joiner.
*Verify:* a quick REPL/inline check that a minimal `svgRect({x,y,width,height})` emits exactly
`<rect x="0" y="0" width="220" height="64"/>` and adding `fill` slots it in the fixed position.

### Step 4 — `layout`
Implement `layout(groupSizes)`: walk groups, compute lane x + label anchor + stacked card
boxes (with `cx`/`cy` centers) via the Decision-5 formulas, accumulate canvas width/height,
freeze the result. Empty input → `{ width: 2*PAD, height: 2*PAD, lanes: [] }`.
*Verify:* `layout([2,3])` → 2 lanes (2 and 3 cards), lane[1].x > lane[0].x + CARD_W, all
boxes within canvas.

### Step 5 — Test suite
Write `src/present/svg.test.ts` with the four `describe` blocks from Structure §test, including
the pairwise non-overlap helper and the source-scan purity guard.
*Verify:* `bun test src/present/svg.test.ts` green.

### Step 6 — Full gate + commit
Run the full `bun test` and `tsc --noEmit`. With everything green, commit `svg.ts` +
`svg.test.ts` as one atomic feat commit.
*Commit message:* `feat(present): SVG primitives + deterministic swimlane geometry (T-055-01)`.

## Risk register

- **R1 — Float coordinates breaking byte-identity.** All constants are integers and the math is
  integer add/multiply, so coordinates stay integral; `num` is a belt-and-suspenders guard.
  *Mitigation:* keep every constant integer; no division in the geometry.
- **R2 — Attribute order drift.** Output byte-identity depends on a fixed emit order independent
  of caller key order. *Mitigation:* each emitter writes a hand-fixed sequence, never iterates
  object keys.
- **R3 — Escaping order bug.** `<`-before-`&` double-escapes. *Mitigation:* `&` first, covered
  by an explicit test.
- **R4 — Scope creep into the consumer.** Tempting to emit a whole `<svg>` doc or import the IR.
  *Mitigation:* hold the boundary — element-level primitives + coordinates only; T-055-02 owns
  the document wrapper, palette, and IR mapping.
- **R5 — Purity guard false-confidence.** A source-text scan can miss obfuscated nondeterminism.
  *Mitigation:* acceptable here — the module is tiny and visibly pure; the scan plus the
  determinism `toBe` tests together are sufficient evidence for this leaf.
