# T-067-01-02 — materialize-carries-code-text-at-cut — Structure

The blueprint: files touched, interfaces, internal shape, ordering. No new files; no
deletions. Four modified files, one clear dependency spine.

## Files

| File | Change |
| --- | --- |
| `src/play/materialize.ts` | render pair + verb gain the charter; new private prose helper |
| `src/play/materialize.test.ts` | charter fixture, updated goldens, new targeted tests, verb call sites |
| `src/play/decompose-epic.ts` | one line: `decomposeEffect` passes `ctx.inputs.charter` |
| `src/play/chain-propose-decompose.test.ts` | one line: direct `materialize` call passes `CHARTER` |
| `src/play/story-gate-cast.test.ts` | two lines: fixture effect takes `ctx`, passes `ctx.inputs.charter` |

`src/play/charter-snapshot.ts` is READ-ONLY upstream (imported, never edited). gates.ts,
decompose.baml, project-context.ts: untouched.

## src/play/materialize.ts — the whole change

### Imports (top of file)

```ts
import { snapshotCharterCodes, type CharterSnapshot } from "./charter-snapshot.ts";
```

Same-directory pure leaf; keeps the play→(pure sibling) direction. The baml imports stay
TYPE-ONLY; the module's purity header gains a T-067-01-02 paragraph naming the new rule:
codes carry their cut-time text; the snapshot arrives as a parameter; a miss degrades to the
bare code (the T-067-01-03 guard's input), never a fabricated gloss.

### New private helpers (placed with `alias`/`flowArray`, before the render pair)

```ts
/** Code shape, mirrored from charter-snapshot's DEFINITION ([A-Z]{1,3}\d+); the
 *  `(?! —)` lookahead skips codes already carrying a gloss (idempotency). */
const PROSE_CODE = /\b([A-Z]{1,3}\d+)\b(?! —)/g;

function resolveCodesInProse(text: string, snapshot: CharterSnapshot): string
// text.replace(PROSE_CODE, (match, code) => title ? `${code} — ${title}` : match)

function advancesLine(advances: readonly string[], snapshot: CharterSnapshot): string
// entries = advances.map(code => title ? `${code} — ${title}` : code); join("; ")
// returns `_Advances: ${...}_`  (the full line — single owner of that format)
```

Both PURE, total, no throw paths. `advancesLine` exists so renderTicketFile's body array
stays declarative; it is the only producer of the `_Advances:_` line.

### `renderTicketFile` — signature + body

```ts
export function renderTicketFile(t: TicketDraft, snapshot: CharterSnapshot): RenderedFile
```

- Frontmatter block: byte-identical, untouched.
- Body: `t.purpose` → `resolveCodesInProse(t.purpose, snapshot)`;
  `` `_Advances: ${t.advances.join(", ")}_` `` → `advancesLine(t.advances, snapshot)`;
  `t.doneSignal` → `resolveCodesInProse(t.doneSignal, snapshot)`. Nothing else moves.

### `renderStoryFile` — signature + body

```ts
export function renderStoryFile(
  s: StoryDraft,
  storyTickets: readonly TicketDraft[],
  cutDate: string,
  snapshot: CharterSnapshot,
): RenderedFile
```

`snapshot` goes LAST — after the existing parameters, mirroring `cutDate`'s append when
T-066-01-03 added it.

- Frontmatter: untouched.
- The five section values pass through `resolveCodesInProse` at their existing render sites:
  the `PRE_DAG_SECTIONS` loop (`value != null` branch), the `waveRationale` append, the
  `outOfSlice` chunk. `PRE_DAG_SECTIONS` itself, `dagBlock`, and the footer are untouched
  (no code-bearing content by construction).

### `materialize` — signature + one new line

```ts
export async function materialize(
  plan: WorkPlan,
  targets: MaterializeTargets,
  charter: string,
): Promise<MaterializeResult>
```

- After the collision guard / before the write loops (with the `cutDate` clock read — the
  "once per run" block): `const snapshot = snapshotCharterCodes(charter);`
- Both loops thread it: `renderStoryFile(s, storyTickets, cutDate, snapshot)`,
  `renderTicketFile(t, snapshot)`.
- Guard ordering unchanged: collisions still refuse before mkdir; the snapshot build sits
  after the guard (no point resolving a refused cut) — also exactly where T-067-01-03's
  resolvability check will slot in, between snapshot build and first write.

## src/play/decompose-epic.ts — one line

`decomposeEffect` (line ~188): `materialize(finalPlan, {…}, ctx.inputs.charter)`. The effect
already destructures `ctx`; `DecomposeInputs.charter` is the same string `gates` feeds
`clear`. Comment gains half a line naming the cut-time snapshot threading. No other site in
this file changes (render/parse/gates untouched).

## src/play/materialize.test.ts

### New fixture (top, with the draft factories)

```ts
const CHARTER = [
  "- **P1 — Author once, run forever.** Cost lives at authoring.",
  "- **P3 — Gates are the contract.** Quality lives inside the work.",
  "- **P4 — Autonomy by default, not supervision.** Work proceeds against gates.",
  "- **P6 — Executor-agnostic underneath.** Claude Code first.",
  "- **N1 — Not a chat copilot.** Removing yourself from the loop.",
].join("\n");
const SNAPSHOT = snapshotCharterCodes(CHARTER);   // value import — pure, zero-dep, addon-free
const EMPTY = snapshotCharterCodes("");
```

Fabricated (gates.test.ts precedent), bold-shaped so it actually resolves; NOT the live
charter (design D6 — renderer goldens must not move on charter amendments). Importing the
real resolver (not a hand-built Map) keeps the fixture honest to the upstream contract.

### Updated call sites and goldens

- Every existing `renderTicketFile(x)` → `renderTicketFile(x, SNAPSHOT)` (or `EMPTY` where
  the test's point is untouched-body behavior); same for `renderStoryFile(…, SNAPSHOT)`.
- Ticket full-file golden: `_Advances: P1_` → `_Advances: P1 — Author once, run forever_`
  (fixture advances stay `["P1"]`; golden comment updated to name T-067-01-02 as the surface
  move).
- Contract golden: `contractStory()`'s `scope` gains a trailing citation (`… (P3)`) and
  `honestBoundary` an inline one, so the golden PINS story-body resolution; expected bytes
  updated accordingly. Degraded golden: unchanged content (story() has no sections; body has
  no codes) — only the call-site signature changes; the golden bytes stay identical, which
  itself pins "empty sections ⇒ no expansion surface".
- `body carries the value triplet` test: `_Advances: P1, P3_` expectation becomes the
  semicolon-joined expanded pair.

### New targeted tests (one `describe("code-carrying bodies (T-067-01-02)")`)

1. multi-advance semicolon join (`P1; P3` both expanded).
2. miss degrades to bare code (`advances: ["P9"]` → `_Advances: P9_`).
3. purpose prose citation expands (`"…grounding (P4, P6)"`).
4. non-charter token passthrough (`"forward-E1 stays"` — `E1` untouched).
5. already-glossed passthrough (`"P4 — its own words"` not re-expanded; idempotency).
6. empty snapshot ⇒ ticket body shape is today's exactly (bare codes, comma join collapses
   to the degenerate single/bare forms — assert via full-line `toContain`).
7. story sections expand the same way through `renderStoryFile` (waveRationale + outOfSlice
   spot-check, non-golden).

### Real-fs collision tests

`materialize(plan, {…}, CHARTER)` — third argument threaded; assertions unchanged.

## Sibling test call sites

- `chain-propose-decompose.test.ts:137`: `materialize(CANNED_PLAN, {…}, CHARTER)` — the
  file's existing fixture; snapshots empty (non-bold), all assertions unaffected.
- `story-gate-cast.test.ts` `decomposeShapedPlay`: `effect: async (plan, ctx) => …
  materialize(plan, dirs, ctx.inputs.charter)` — mirrors the real effect's shape.

## Ordering of changes

1. materialize.ts helpers + render-pair signatures + verb (one coherent unit — the module
   never half-compiles), with decompose-epic.ts and the two sibling test call sites in the
   same change (required parameter breaks them atomically).
2. materialize.test.ts fixture + golden updates + new targeted tests.
Compile-wise these are one commit's worth; plan.md sequences the authoring inside it.
