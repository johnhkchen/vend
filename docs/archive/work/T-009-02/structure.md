# T-009-02 — Structure: file-level blueprint

The shape of the code, not the code. Two files created; nothing modified or deleted.

## Files

| File | Action | Why |
|---|---|---|
| `src/play/propose-core.ts` | **create** | The pure core: PE gates + `renderCard` + `nextEpicId`. |
| `src/play/propose-core.test.ts` | **create** | Pure-function test, all BAML imports type-only. |

No existing file is touched. `id-guard.ts` is reused by import (unchanged). `propose.baml`
/ `propose-bridge.ts` (T-009-01) are untouched. T-009-03 will later import this module to
register the play — that wiring is out of scope here.

## `src/play/propose-core.ts` — internal organization

Ordered top-to-bottom (the gates.ts/materialize.ts reading order: header → imports →
types → pure helpers → gates → public `clear` → renderer).

### 1. Module header comment
The purity contract, verbatim-style with siblings: only runtime import is the pure
`detectCollisions`; `EpicCard`/enums and `GateVerdict` are TYPE-ONLY (erased under
`verbatimModuleSyntax`), so the test loads no BAML addon. States the three-gate value
order and the andon-on-first-failure contract.

### 2. Imports
```ts
import type { EpicCard } from "../../baml_client/index.ts";          // type-only
import type { GateVerdict } from "../engine/play.ts";                // type-only
import { detectCollisions } from "./id-guard.ts";                    // runtime (pure)
```
Note: enum *types* (`CardColor`…) arrive via `EpicCard`'s field types; the alias maps key on
the string member values, so no enum value-import is needed.

### 3. Public constants & context type
```ts
export const PE_GATE_NAMES = ["value", "bounds", "structural"] as const;
export type PEGateName = (typeof PE_GATE_NAMES)[number];

export interface ProposeClearContext {
  readonly charter: string;
  readonly existingEpicIds: readonly string[];
}
```

### 4. member→alias maps + `alias()` (renderer support, materialize.ts pattern)
```ts
export const COLOR_ALIAS:     Readonly<Record<string,string>>  // White→white, …
export const CARD_TYPE_ALIAS: Readonly<Record<string,string>>  // Sorcery→sorcery, Permanent→permanent
export const RARITY_ALIAS:    Readonly<Record<string,string>>  // Common→common, …
function alias(table, member, field): string                    // throws RangeError on drift
```

### 5. pure helpers
```ts
function nonEmpty(s: unknown): boolean                 // gates.ts/note-core idiom
function matchIds(text: string, prefix: "P"|"N"): Set<string>   // copy of gates.ts matchIds
function flowArray(items: readonly string[]): string  // copy of materialize.ts flowArray
const EPIC_ID_RE = /^E-\d{3}$/
```

### 6. the three gates: `(card, ctx) => Offense | null`
Mirror gates.ts's `Offense {unit, reason}` private shape; each gate returns `null` on pass.
```ts
interface Offense { readonly unit: string; readonly reason: string }
function valueGate(card: EpicCard): Offense | null
function boundsGate(card: EpicCard, ctx: ProposeClearContext): Offense | null
function structuralGate(card: EpicCard, ctx: ProposeClearContext): Offense | null
```
- `valueGate`: `serves`, `value`, `intent` non-empty; `advances` non-empty array, all
  non-blank.
- `boundsGate`: grep `ctx.charter` for `P#/N#`; an `advances` entry that is `N\d+`/live
  non-goal → STOP; a `P\d+` not in charter → dangling-ref STOP; free-text passes.
- `structuralGate`: required-fields presence loop (`REQUIRED_CARD_FIELDS`); `color`
  non-empty array; `EPIC_ID_RE` shape; `kind === type`; `detectCollisions([card.id],
  ctx.existingEpicIds)`.

### 7. the ordered gate table + public `clear`
```ts
const GATES: ReadonlyArray<readonly [PEGateName, (c: EpicCard, ctx: ProposeClearContext) => Offense | null]>
export function clear(card: EpicCard, ctx: ProposeClearContext): GateVerdict
```
Iterates `GATES`; first `Offense` → `{status:"stop", gate, unit, reason}`; none →
`{status:"clear", cleared:[...PE_GATE_NAMES]}`. (No `assert*` throw-guards needed — inputs
are a typed `EpicCard` + a literal context; a malformed call is a type error, not a runtime
branch. If defensive guards are warranted, they follow the gates.ts `assertContext` shape.)

### 8. `nextEpicId`
```ts
export function nextEpicId(existing: readonly string[]): string
```
Scan `existing` for `E-(\d+)`, numeric-max, `+1`, zero-pad to 3 → `E-0XX`; empty → `E-001`.

### 9. `renderCard`
```ts
export function renderCard(card: EpicCard): string
```
Compose: frontmatter block (`---` … `id/title/status: open/kind(alias)/advances(flowArray)/
serves: >` … `---`), a stat-block region (manaCost, color aliases, type alias, rarity alias,
play trailer), then the four body sections. `[...].join("\n")` like the materialize/note
renderers.

## Public interface (what T-009-03 will import)

- `clear(card, ctx): GateVerdict` — the registrable gate (drops into `Play.gates`).
- `renderCard(card): string` — the effect's body source.
- `nextEpicId(existing): string` — the effect's id-mint.
- `ProposeClearContext` — the context T-009-03 builds impurely.
- `PE_GATE_NAMES`, the alias maps — exported for the effect/tests and run-log parity.

## `src/play/propose-core.test.ts` — organization

Mirror `note-core.test.ts`:
- imports: `describe/expect/test` from `bun:test`; `type { EpicCard } from baml_client`
  (type-only); the public surface from `./propose-core.ts`.
- a `FULL_CARD: EpicCard` literal fixture + a `ctxWith(charter, ids)` helper.
- `describe` blocks: `clear — value/pass`, `clear — bounds STOP`, `clear — structural STOP`
  (collision + bad id + kind≠type), `clear — value STOP` (blank fields), `nextEpicId`,
  `renderCard — round-trips every field`.

## Ordering of work (hands off to Plan)

1. Types + constants + alias maps + helpers (no behavior yet to test, but compiles).
2. The three gates + `clear` → test gates.
3. `nextEpicId` → test.
4. `renderCard` → test round-trip.
5. `bun run check:*` green; commit.

## Boundaries honored

- **No fs / no addon**: only `detectCollisions` (pure) at runtime; all BAML/engine imports
  type-only — `propose-core.test.ts` is an ordinary pure test (AC#3).
- **No engine coupling**: `GateVerdict` is the only engine touch, type-only; registration is
  T-009-03's job, not this module's.
- **Reuse, don't reinvent**: `detectCollisions` imported, not re-implemented (AC's "reuse");
  `matchIds`/`flowArray`/`alias` are small private copies of the gates/materialize idioms
  (cross-module export of those privates is not warranted for ~3 one-liners).
</content>
