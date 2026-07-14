# T-056-03 — Review: weight-blocked-edges-in-svg

_Phase: Review. Handoff for a human reviewer — what changed, coverage, open concerns._

## What changed

Blocked dependency edges now render with **visual weight** in `projectionToSvg`. A `depends_on` link
whose `from` ticket is not done (`link.blocked === true`, computed in T-056-02) draws as a heavier,
distinct red stroke; a satisfied edge keeps the existing light slate stroke. This makes "what should I
unblock first?" pop off the work-graph board. Scope held to stroke **weight + color only** — no
arrowheads, no edge labels, no palette redesign, no geometry change.

### Files modified (2 — no files created or deleted)

**`src/present/projection-svg.ts`** (production, the only behavior change)
- Added module-private frozen const `EDGE_BLOCKED = { stroke: "#E53935", strokeWidth: 4 }` next to the
  existing `EDGE = { stroke: "#B0BEC5", strokeWidth: 2 }`; reworded `EDGE`'s doc to mark it the
  *satisfied* style so the pair reads as a set.
- In the edge-draw loop, added `const edge = link.blocked ? EDGE_BLOCKED : EDGE;` after the endpoint
  guard and fed `edge.stroke` / `edge.strokeWidth` to the existing `svgLine` call. Loop ordering
  ("edges first"), the defensive `if (!from || !to) continue`, and everything else are unchanged.

**`src/present/projection-svg.test.ts`** (tests)
- `fakeProjection`'s single link gained `blocked: false` — a controlled satisfied-edge case.
- New describe `projectionToSvg — blocked edges carry visual weight (E-056)` with 3 tests.

### Design choices (see `design.md`)

- **Second const + ternary** (Option A) over a configurable edge palette (B), a leaf-layer change (C),
  or inlining the palette's `critical` stroke (D). A is the minimal diff that mirrors the file's
  existing style-table idiom and keeps the IR-agnostic leaf (`svg.ts`) untouched.
- **`#E53935` / width 4**: red echoes the palette's existing `critical` stroke (zero new color
  language); 4 is 2× the satisfied weight and integer (byte-stable via `num`).

## Test coverage

`bun run check`: **1281 pass, 0 fail**, 3603 expect() calls, 81 files; `tsc --noEmit` clean.
(Suite was 1278 before — +3 new tests.)

| AC clause | Covered by |
|---|---|
| blocked:true → heavy/distinct stroke (thicker + distinct color) | `…blocked:true link renders the heavy, distinct stroke` — `miniProjection`'s real `blocked:true` link → `stroke="#E53935"`, `stroke-width="4"` |
| blocked:false → existing light EDGE style | `…blocked:false link renders the existing light EDGE style` — `stroke="#B0BEC5"`, `stroke-width="2"`, and asserts absence of the heavy values |
| same projection → byte-identical SVG | `…byte-identical SVG (P5)` + the pre-existing determinism describe |
| `.vend/work-graph.svg` shows heavy strokes only on unsatisfied deps | manual render (below) |
| House gates green | `bun run check` green |

Invariants re-confirmed: purity grep guard (no `Date`/`Math.random`/fs added) green; one-way
authority test green (input still frozen/reference-unchanged); honest-empty green (empty projection
still emits zero `<line>`).

## Live render verification

`bun run src/cli.ts svg` → `.vend/work-graph.svg`: 2 groups, 136 cards, 90 links.
- `stroke="#E53935" stroke-width="4"` (heavy/blocked): **1**
- `stroke="#B0BEC5" stroke-width="2"` (light/satisfied): **89**
- 1 + 89 = 90 = total links. The single heavy stroke is the one edge from a not-done ticket
  (T-056-03 → T-056-02). Heavy strokes appear **only** on unsatisfied dependencies, as specified.

## Open concerns / limitations

- **Color-blindness:** weight (width 4 vs 2) carries the signal independently of the red/slate hue, so
  the distinction survives a grayscale or color-blind view — the heaviness, not just the color, does
  the work. No dashed/marker channel added (out of scope).
- **Low blocked count is expected, not a bug:** this near-complete repo has almost all tickets `done`,
  so almost all `from`-tickets are done → only 1 currently-unsatisfied dependency. The flag is
  state-derived; the count tracks real project state.
- **`fakeProjection` still cast `as unknown as Projection`** (pre-existing pattern) — the literal omits
  card-detail shape for terseness; unchanged by this ticket beyond adding `blocked: false`.
- **No new public surface:** `EDGE_BLOCKED` is module-private like `EDGE`. If a future ticket wants
  caller-overridable edge styling, that is a deliberate new `overlays.edgePalette` (design Option B),
  explicitly deferred here.

## Reviewer attention

Nothing critical. The change is ~6 production lines, additive, fully reversible by `git revert`
(no schema/data change — the `blocked` flag persists, simply unread by the renderer if reverted).
