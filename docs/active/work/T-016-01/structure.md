# T-016-01 — Structure

The blueprint: files created/modified, interfaces, ordering. Not code — the shape of the code.

## Files

| File | Action | Loads addon? | Purpose |
|---|---|---|---|
| `baml_src/expand.baml` | **create** | (BAML src) | `enum SignalTier`, `class Signal`, `function ExpandFragment` |
| `baml_client/**` | regenerate | — | `bun run baml:gen` emits the `Signal`/`SignalTier` types |
| `src/play/expand-core.ts` | **create** | No (type-only) | `Signal` gates + renderer + `ExpandClearContext` |
| `src/play/expand-core.test.ts` | **create** | No (pure) | gate + renderer unit tests |
| `src/baml/expand-bridge.ts` | **create** | Yes (subprocess) | render/parse ops over `b.*.ExpandFragment` |
| `src/baml/expand.test.ts` | **create** | Yes (child spawn) | offline parse/reject/render pins |

No files modified. No deletions. T-016-02 will add `expand-effect.ts` + `expand.ts` (shell/gesture).

## `baml_src/expand.baml`

```
// header: authoring-only, mirrors propose.baml; SAP-rejects garbage (required scalars);
// the honest-empty contract (model abstains with blank what/why) documented here.

enum SignalTier { Keystone @alias("keystone") High @alias("high")
                  Standard @alias("standard") Leaf @alias("leaf") }

class Signal {
  what string @description("ONE line: the move to make. Leave BLANK (with `why`) ONLY when the fragment grounds no real demand — honest-empty abstention, never manufactured.")
  why string @description("why it might matter — the leverage in one line. Blank with `what` blank ⇒ honest-empty.")
  tier SignalTier @description("leverage tier: keystone|high|standard|leaf (demand.md value ranking, never an effort estimate)")
  budget string @description("the pre-filled budget envelope in demand.md notation, e.g. '~1 block (≈2h)' or 'small (~1h)' — a rough default, refined by measured data downstream")
  advances string[] @description("charter invariant id(s) (e.g. [P2]) or the core-feature advance this serves; never empty for a real signal")
  grounding string @description("WHAT in the fragment / real project state this was READ from — a fragment phrase, a file/doc, a run-log fact. Blank ⇒ invented/speculative ⇒ refused.")
  readiness string @description("board readiness: 'ready', or 'blocked: <what it waits on>'")
}

function ExpandFragment(fragment: string, charter: string, project: string) -> Signal {
  client ClaudeStub
  prompt #" ...demand-extractor framing: read latent demand off the fragment+project,
            cite the source (grounding), abstain blank rather than invent, name the value
            (advances)... {{ fragment }} {{ charter }} {{ project }} {{ ctx.output_format }} "#
}
```

## `src/play/expand-core.ts` — public surface

```ts
import type { Signal } from "../../baml_client/index.ts";       // TYPE-ONLY
import type { GateVerdict } from "../engine/play.ts";           // TYPE-ONLY

export const EXPAND_GATE_NAMES = ["honest-empty", "read-never-invent", "value-link"] as const;
export type ExpandGateName = (typeof EXPAND_GATE_NAMES)[number];

export interface ExpandClearContext { readonly charter: string; }

export const TIER_ALIAS: Readonly<Record<string,string>>;       // member → demand token

export function clear(signal: Signal, ctx: ExpandClearContext): GateVerdict;
export function renderSignalRow(signal: Signal): string;        // pure demand-row renderer
```

Internal (not exported): `nonEmpty(s)`, `matchIds(text,"P"|"N")` (copied from propose-core —
self-contained, the gates.ts discipline), `aliasTier(member)` (throws `RangeError` on drift), the
three gate fns `(signal, ctx) => Offense | null`, the `GATES` ordered table, `Offense` interface.

### Gate logic (the three `(signal, ctx) => Offense | null`)

- `honestEmptyGate(signal)`: `!nonEmpty(what) && !nonEmpty(why)` → Offense (unit `<fragment>`,
  reason "honest-empty: the fragment grounds no demand — nothing to stage (IA-4)").
- `readNeverInventGate(signal)`: `!nonEmpty(grounding)` → Offense (reason "read-never-invent:
  cites no real state — a speculative signal is refused (PE-1)"). Runs after honest-empty, so by
  here `what`/`why` are non-blank ⇒ content exists but is ungrounded ⇒ invented.
- `valueLinkGate(signal, ctx)`: empty/all-blank `advances` → Offense ("names no value it advances");
  else for each entry: a `N\d+` or charter non-goal → Offense ("cannot advance a non-goal"); a
  `P\d+` absent from `matchIds(ctx.charter,"P")` → Offense ("dangling invariant ref"). Free-text
  entries (core-feature prose, no grep-able id) pass — the propose `boundsGate` rule.

### `clear()`

```ts
const GATES: [ExpandGateName, (s: Signal, c: ExpandClearContext) => Offense | null][] = [
  ["honest-empty",      (s) => honestEmptyGate(s)],
  ["read-never-invent", (s) => readNeverInventGate(s)],
  ["value-link",        (s, c) => valueLinkGate(s, c)],
];
export function clear(signal, ctx): GateVerdict {
  for (const [gate, run] of GATES) { const o = run(signal, ctx);
    if (o) return { status:"stop", gate, unit:o.unit, reason:o.reason }; }
  return { status:"clear", cleared:[...EXPAND_GATE_NAMES] };
}
```

### `renderSignalRow()`

Pure. Emits one demand.md table row:
`| **${what}** — ${why} | **${tierLabel}** | ${budget} | ${readiness} |`
where `tierLabel` = title-cased `aliasTier(signal.tier)`. `advances`/`grounding` appended as a
trailing ` · advances ${flowArray(advances)}` note so the row round-trips every field for the test.
Throws `RangeError` on tier enum/map drift (the `propose-core.alias` rule).

## `src/baml/expand-bridge.ts` — public surface

```ts
export type ExpandBridgeOp =
  | { mode:"render"; fragment:string; charter:string; project:string }
  | { mode:"parse"; text:string };
export type ExpandBridgeResult =
  | { ok:true; mode:"render"; prompt:string }
  | { ok:true; mode:"parse"; signal:Signal }
  | { ok:false; error:string };
export function runOp(op: ExpandBridgeOp): ExpandBridgeResult;
```

Imports `b` from `baml_client/sync_client.ts`, `Signal` type-only, `extractPromptText` from
`./decompose-bridge.ts` (reused, never re-implemented). `import.meta.main` block: read `{ops}` from
stdin → map `runOp` → write `{results}` to stdout; `process.env.ANTHROPIC_API_KEY ??=
"baml-render-only"`.

## `src/play/expand-core.test.ts` — cases

A `FULL_SIGNAL` fixture (grounded, tier "Keystone" member, advances `["P2"]`, grounding non-blank)
+ `CHARTER` snippet (`P2 … N4 …`). Then: clears all three gates (echoes names); blank what+why →
honest-empty STOP; filled-but-blank grounding → read-never-invent STOP; empty advances → value-link
STOP; advances `["N4"]` → value-link STOP (non-goal); advances `["P9"]` → value-link STOP
(dangling); free-text advances → clear; renderer contains what/why/tier-token/budget/readiness/P2;
tier drift (`"Legendary"` cast) → `RangeError`.

## `src/baml/expand.test.ts` — cases

`runBridge([...])` (one child spawn) over: `{mode:"parse", text: CANNED}` → typed `Signal` (tier
member "Keystone", advances, grounding); `{mode:"parse", text:"not a signal"}` → `ok:false`
"required field"; `{mode:"render", fragment, charter, project}` → prompt contains all three
sentinels + the extractor framing.

## Ordering of changes

1. `baml_src/expand.baml` → `bun run baml:gen` (so `Signal` exists for `tsc`).
2. `src/play/expand-core.ts` (the pure core).
3. `src/play/expand-core.test.ts` → green (pure, fast).
4. `src/baml/expand-bridge.ts`.
5. `src/baml/expand.test.ts` → green (spawns child).
6. `bun run check` (baml:gen + typecheck + full suite) green; commit.
