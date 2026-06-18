# Structure — T-001-04 countable-run-log

The blueprint: exact files, the public interface, internal organization, and the
order of construction. Not code — the shape of it.

## Files

| Path | Action | Purpose |
|------|--------|---------|
| `src/log/run-log.ts` | **create** | The module: types + pure builder/serializer + one thin impure append. |
| `src/log/run-log.test.ts` | **create** | `bun:test` coverage of the two pure functions to the branch. |
| `src/log/.gitkeep` | **delete** | Placeholder; superseded once real files land in `src/log/`. |

No other files change. No imports added to `package.json` (uses only built-in
`node:fs/promises` + `node:path` + `bun:test`). No edits to `budget.ts` /
`claude.ts` — strict decoupling (AC #4).

## `src/log/run-log.ts` — public surface, top to bottom

A module header comment first (house style: the two prior modules open with a
purpose/contract block). Then, in dependency order:

### 1. Constants
```ts
export const DEFAULT_RUN_LOG_PATH = ".vend/runs.jsonl";
export const RUN_OUTCOMES = ["success", "gate-failed", "timed-out", "budget-exhausted"] as const;
export const RUN_LOG_SCHEMA_VERSION = 1;
```

### 2. Types (all exported; structural, importing nothing from sibling modules)
```ts
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

export interface UsageInput {            // duck-typed against seam result.usage / budget Usage
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}
export interface NormalizedUsage {       // post-build: numbers, no undefined
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_input_tokens: number;
  readonly cache_creation_input_tokens: number;
}
export interface GateResult {
  readonly gate: string;
  readonly passed: boolean;
  readonly detail?: string;
}
export interface RunRecordInput {        // what the runner hands us (pre-normalization)
  readonly runId: string;
  readonly play: string;
  readonly epic: string;
  readonly model: string;
  readonly outcome: RunOutcome;
  readonly usage?: UsageInput;
  readonly costUsd?: number;
  readonly gateResults?: readonly GateResult[];
  readonly startedAt: string;            // ISO-8601, runner-stamped
  readonly endedAt: string;              // ISO-8601, runner-stamped
}
export interface RunRecord {             // normalized, frozen, what gets serialized
  readonly v: typeof RUN_LOG_SCHEMA_VERSION;
  readonly runId: string;
  readonly play: string;
  readonly epic: string;
  readonly model: string;
  readonly outcome: RunOutcome;
  readonly usage: NormalizedUsage;
  readonly costUsd: number;
  readonly gateResults: readonly GateResult[];
  readonly startedAt: string;
  readonly endedAt: string;
}
export interface AppendRunLogOptions {
  readonly path?: string;                // default DEFAULT_RUN_LOG_PATH
}
```

### 3. Internal pure helpers (NOT exported)
```ts
function num(v: number | undefined): number;              // undefined / non-finite → 0  (budget idiom)
function assertNonEmpty(s: string, label: string): void;  // throws RangeError on "" / non-string
function assertOutcome(o: string): asserts o is RunOutcome;// throws RangeError if ∉ RUN_OUTCOMES
function normalizeUsage(u: UsageInput | undefined): NormalizedUsage; // each sub-count via num()
function normalizeGates(g: readonly GateResult[] | undefined): readonly GateResult[]; // default []
```

### 4. Pure public functions
```ts
export function buildRunRecord(input: RunRecordInput): RunRecord;
//  validate (assertNonEmpty ×4, assertOutcome, assertNonEmpty ×2 on timestamps),
//  normalize (usage, costUsd via num, gates), stamp v, then Object.freeze the record.

export function serializeRunRecord(record: RunRecord): string;
//  return JSON.stringify(record) + "\n"  — no space arg, single line guaranteed.
```

### 5. The one impure function
```ts
export async function appendRunLog(
  input: RunRecordInput,
  opts: AppendRunLogOptions = {},
): Promise<void>;
//  const path = opts.path ?? DEFAULT_RUN_LOG_PATH;
//  const line = serializeRunRecord(buildRunRecord(input));
//  await mkdir(dirname(path), { recursive: true });
//  await appendFile(path, line, "utf8");
```
Imports: `import { appendFile, mkdir } from "node:fs/promises";` and
`import { dirname } from "node:path";` — the only non-`bun:test`, non-type imports.

## Internal organization & boundaries

- **Purity boundary** runs between §4 and §5. Everything above `appendRunLog` is a
  pure function of its arguments — no fs, clock, network, or process. The single
  side effect (two fs calls) is isolated in `appendRunLog`, which holds *no* logic
  the pure pair doesn't already own. Mirrors `claude.ts`: pure helpers + one
  `dispense`.
- **Validation boundary** is `buildRunRecord`: caller errors (empty id, unknown
  outcome) throw `RangeError` *there*, loudly, before a malformed line can reach
  the ledger. Coercible noise (missing usage fields, absent cost) is absorbed
  silently to `0` / `[]` — the budget split between "programmer error → throw" and
  "absent data → coerce."
- **Decoupling boundary**: zero imports from `src/executor/` or `src/budget/`. The
  `UsageInput` interface is the duck-type contract that lets the runner forward
  `result.usage` without a shared symbol.

## `src/log/run-log.test.ts` — coverage map (pure only)

`describe` blocks, fabricated inputs only (no fs), mirroring `budget.test.ts`:

- **buildRunRecord — happy path:** full input → frozen record with `v`,
  normalized usage, gateResults preserved, all strings carried through.
- **buildRunRecord — normalization:** missing `usage` → all-zero
  `NormalizedUsage`; partial usage → missing sub-counts 0; non-finite → 0; absent
  `costUsd` → 0; absent `gateResults` → `[]`.
- **buildRunRecord — validation throws:** empty `runId/play/epic/model` →
  `RangeError`; empty `startedAt/endedAt` → `RangeError`; `outcome` not in
  `RUN_OUTCOMES` → `RangeError`.
- **buildRunRecord — immutability:** returned record is frozen
  (`Object.isFrozen`).
- **buildRunRecord — every outcome:** `test.each(RUN_OUTCOMES)` accepts each
  member.
- **serializeRunRecord — countability contract:** ends with exactly one `\n`; no
  interior `\n`; `JSON.parse(line)` deep-equals the record; an embedded newline in
  a `detail`/`play` string stays on one physical line (escaped).
- **round-trip:** `build → serialize → JSON.parse` reproduces the record's data.

`appendRunLog` is intentionally **not** unit-tested (it is the thin fs verb;
its logic is the tested pure pair) — documented in Review, matching `dispense`.

## Construction order

1. Delete `src/log/.gitkeep`.
2. Write `run-log.ts` §1→§5 in the order above (types before functions; bottom
   composes top).
3. Write `run-log.test.ts`.
4. `bun run check` (typecheck + test) must be green before the phase closes.
