# T-002-02 — Structure: file-level blueprint

The shape of the code, not the code. Two files created, zero modified, zero deleted.

## Files

| Action | File | Why |
|---|---|---|
| create | `src/gate/gates.ts` | the four clearing gates + `clear()` (AC1–AC2, AC4) |
| create | `src/gate/gates.test.ts` | passing + failing `WorkPlan` fixtures (AC3) |
| (exists)| `src/gate/.gitkeep` | leave; harmless once real files land |

No edits to `package.json` (no new dep — type-only import of the already-generated client),
`tsconfig.json`, or any sibling `src/` module. The DAG edge stays honest: the only import is
`import type` from `baml_client`.

## `src/gate/gates.ts` — public surface

```ts
import type { WorkPlan, TicketDraft, StoryDraft } from "../../baml_client/index.ts"; // TYPE-ONLY

export const GATE_NAMES = ["value", "allocation", "bounds", "structural"] as const;
export type GateName = (typeof GATE_NAMES)[number];

export interface ClearContext {            // the same strings fed to DecomposeEpic
  readonly epic: string;
  readonly charter: string;
}

export interface GateStop {                // the line stopped — andon
  readonly status: "stop";
  readonly gate: GateName;                 // which gate tripped
  readonly unit: string;                   // offending unit id, or "<plan>"
  readonly reason: string;                 // human-readable why
}
export interface GateClear {               // nothing tripped
  readonly status: "clear";
  readonly cleared: readonly GateName[];   // GATE_NAMES, in value-order
}
export type GateResult = GateClear | GateStop;

export function isStop(r: GateResult): r is GateStop;     // runner convenience
export function clear(plan: WorkPlan, ctx: ClearContext): GateResult;
```

`GateResult` is the **whole-plan** verdict (header comment disambiguates it from `run-log.ts`'s
per-gate `GateResult`).

## `src/gate/gates.ts` — internal organization

Top-to-bottom reading order (definitions before use, like `budget.ts`/`run-log.ts`):

1. **Header comment** — purpose; "gates own meaning, BAML owns shape"; pure-module note; the
   empty-plan-is-MALFORMED inheritance from T-002-01; the `GateResult` naming note.
2. **Public types** — `GATE_NAMES`, `GateName`, `ClearContext`, `GateStop`, `GateClear`,
   `GateResult`.
3. **Boundary guards** (programmer-error, throw — D6):
   - `assertPlan(plan)` — `plan`, `plan.stories`, `plan.tickets` are object/arrays.
   - `assertContext(ctx)` — `epic`, `charter` are strings.
4. **Small pure helpers:**
   - `nonEmpty(s): boolean` — string, length > 0 after trim.
   - `normalizeTitle(s): string` — lowercase + collapse whitespace (for doneSignal≠title).
   - `idSetOf(tickets): { ids: Set<string>; dup?: string }` — ticket-id set + first duplicate.
   - `matchIds(text, prefix): Set<string>` — grep `\b<prefix>\d+\b` (charter invariants/non-goals).
   - `findCycle(tickets): string | null` — DFS over `depends_on`; returns a node on a cycle.
5. **Four gate functions**, each `(plan, ctx) => Offense | null` where
   `Offense = { unit: string; reason: string }` (null = pass):
   - `valueGate(plan)` — empty-plan check, then per-ticket `advances`/`doneSignal`/`purpose`.
   - `allocationGate(plan)` — dup ids, `depends_on` resolution, cycle, `story.tickets` resolution.
   - `boundsGate(plan, ctx)` — `advances` P-refs resolve to charter invariants; N-refs rejected.
   - `structuralGate(plan)` — required lisa frontmatter fields present + non-empty.
6. **`clear()`** — `assertPlan` + `assertContext`, then iterate an ordered
   `[name, fn]` table; first non-null offense → `{ status: "stop", gate, ...offense }`;
   else `{ status: "clear", cleared: [...GATE_NAMES] }`.
7. **`isStop()`** — one-liner guard.

The ordered gate table is the single source of value-ordering — `GATE_NAMES` and the table use
the same names, so "in priority of value" is encoded once.

## `src/gate/gates.test.ts` — test organization

Type-only `WorkPlan`/`TicketDraft`/`StoryDraft` imports + value imports of `clear`, `isStop`,
`GATE_NAMES`. No subprocess bridge (gates touch no native addon). A `describe` per gate plus
ordering/guards:

- **fixture builders** — `ticket(overrides)`, `story(overrides)`, `plan(tickets, stories)`:
  start from a fully-valid baseline, override one field per failing case. Enum fields use the
  member-name string literals cast `as DraftType` etc. (the proven type-only pattern from
  `decompose.test.ts`), or imported enums — whichever keeps zero native load. A small inline
  `CHARTER` string carrying `P1…P7` / `N1…N4` for the bounds/grep path.
- `describe("clear — happy path")` — a valid multi-ticket plan with a real `depends_on` edge →
  `status: "clear"`, `cleared` equals `GATE_NAMES`.
- `describe("value gate")` — empty plan → stop@value `<plan>`; `advances: []` → stop@value;
  `doneSignal === title` → stop@value; empty `purpose` → stop@value.
- `describe("allocation gate")` — unresolved `depends_on` → stop@allocation; 2-cycle → stop@
  allocation; duplicate ticket id → stop@allocation; `story.tickets` dangling → stop@allocation.
- `describe("bounds gate")` — `advances: ["P9"]` (not in charter) → stop@bounds;
  `advances: ["N1"]` → stop@bounds; free-text `advances: ["faster-clearing"]` → passes bounds.
- `describe("structural gate")` — empty `phase` → stop@structural; empty `story` field → stop.
- `describe("value-ordering / short-circuit")` — a plan failing value AND structural reports
  **value** (higher priority); `isStop` narrows correctly; programmer-error inputs throw.

Every gate gets at least one passing and one failing fixture (AC3). The happy-path fixture is
the shared "valid plan" the failing cases mutate, so a single source defines "what good means."

## Ordering of work

`gates.ts` types → helpers → gate fns → `clear()`; then `gates.test.ts`; then `bun run check`.
No inter-file ordering constraints beyond "module before its test."
