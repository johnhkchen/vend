# T-013-02 — Structure

*The blueprint: which files are created/modified, module boundaries, public interfaces,
ordering. Not code — the shape of the code.*

---

## File inventory

| File | Action | Why |
|------|--------|-----|
| `src/ledger/recalibrate.ts` | **create** | The pure recalibration core + label formatter + types. The whole math face. |
| `src/ledger/recalibrate.test.ts` | **create** | Fixtured unit tests (the gate for AC #3). |
| `src/cli.ts` | **modify** | New `envelope` command: a `ParsedCommand` arm, a pure parse helper, a thin dispatch arm. |
| `src/cli.test.ts` | **modify** | Cover the new pure parse helper (arg shapes). |

No modifications to `run-log.ts`, `budget.ts`, `gather.ts`, `menu.ts`, `press*.ts` —
the read face and the prior accessor already exist; we only *consume* them. This keeps
the change additive and the existing modules untouched.

---

## `src/ledger/recalibrate.ts` — the pure core

### Imports (types only — all erased at compile)
```ts
import type { RunRecord } from "../log/run-log.ts";
import { forPlay, totalTokens, wallClockMs } from "../log/run-log.ts"; // value: pure helpers
import type { Budget } from "../budget/budget.ts";
import type { ValueTier } from "../shelf/menu.ts";
```
`forPlay` / `totalTokens` / `wallClockMs` are **pure** value imports from `run-log.ts`
(no fs — they operate on records/strings), so the core stays pure and unit-testable.
`Budget` and `ValueTier` are `import type` (erased — no runtime coupling to budget/menu).

> Note: importing the pure helpers from `run-log.ts` does not pull `node:fs` into the
> test process at module-eval time in any harmful way (the fs verbs are only *called*
> inside `appendRunLog`/`loadRunLog`, never at import). `run-log.test.ts` already imports
> from the same module with no addon/fs trouble — precedent confirms it's safe.

### Public surface
```ts
export const TIER_PERCENTILE: Record<ValueTier, number>;   // keystone .95 / high .92 / standard .90 / leaf .75
export const COLD_START_MIN_SUCCESSES = 3;                  // default "a handful"
export const DEFAULT_WINDOW = 100;                          // default recency window

export interface Confidence {
  readonly successes: number;
  readonly censored: number;
  readonly percentile: number;
}
export interface RecalibrateResult {
  readonly envelope: Budget;
  readonly confidence: Confidence;
  readonly source: "measured" | "prior";
}
export interface RecalibrateOptions {
  readonly minSuccesses?: number;
  readonly window?: number;
}

export function percentile(sortedAsc: readonly number[], p: number): number;
export function recalibrate(
  play: string,
  records: readonly RunRecord[],
  tier: ValueTier,
  prior: Budget,
  opts?: RecalibrateOptions,
): RecalibrateResult;
export function formatEnvelopeLabel(result: RecalibrateResult): string;
```

### Private helpers
```ts
const CENSORED_OUTCOMES: readonly RunOutcome[] = ["budget-exhausted", "timed-out"];
function positiveInt(n: number): number;   // Math.max(1, Math.ceil(n))
```

### Internal organization (top → bottom)
1. **Constants** — `TIER_PERCENTILE`, `COLD_START_MIN_SUCCESSES`, `DEFAULT_WINDOW`,
   `CENSORED_OUTCOMES`.
2. **Types** — `Confidence`, `RecalibrateResult`, `RecalibrateOptions`.
3. **`percentile(sortedAsc, p)`** — nearest-rank ceil. PRECONDITION: input is sorted
   ascending and non-empty (caller guarantees both). `index = clamp(ceil(p·n) − 1, 0,
   n−1)`.
4. **`recalibrate(...)`** — the orchestration (see §Algorithm).
5. **`formatEnvelopeLabel(result)`** — pure presentation.

### Algorithm of `recalibrate`
```
p          = TIER_PERCENTILE[tier]
window     = opts.window ?? DEFAULT_WINDOW
minN       = opts.minSuccesses ?? COLD_START_MIN_SUCCESSES

played     = forPlay(records, play)                 // this play, all outcomes
windowed   = played.slice(-window)                  // last `window` (most recent)
successes  = windowed.filter(r => r.outcome === "success")
censored   = windowed.filter(r => CENSORED_OUTCOMES.includes(r.outcome)).length
confidence = { successes: successes.length, censored, percentile: p }

if successes.length < minN:
    return { envelope: prior, confidence, source: "prior" }     // cold start

tokensAsc  = successes.map(totalTokens).sort(asc)
timesAsc   = successes.map(wallClockMs).filter(non-null).sort(asc)

tokens     = positiveInt(percentile(tokensAsc, p))
timeMs     = timesAsc.length ? positiveInt(percentile(timesAsc, p)) : prior.timeMs
return { envelope: { timeMs, tokens }, confidence, source: "measured" }
```
Sorting is on a **copy** (`[...].sort`) — never mutate the records' derived arrays in a
way that surprises a caller (the records are frozen; the mapped arrays are fresh, but we
keep the no-surprise discipline).

### `formatEnvelopeLabel`
- `source === "measured"` → `measured · {successes} casts · p{round(p·100)}`
  + (censored > 0 ? ` · {censored} andon'd` : "")
- `source === "prior"` and `successes === 0` → `estimate (no data)`
- `source === "prior"` and `successes > 0` → `estimate ({successes} casts — need {minN})`
  *(minN is not on the result; for the "below threshold" form we show the count only:
  `estimate ({successes} casts)`. Keeps the formatter dependency-free of the threshold.)*

---

## `src/cli.ts` — the surface (modify)

### `ParsedCommand` — add an arm
```ts
| { readonly cmd: "envelope"; readonly play: string; readonly tier: ValueTier }
```

### `parseArgs` — route `envelope`
Add, beside the `run` / `chain` routes:
```ts
if (argv[0] === "envelope") return parseEnvelopeArgs(argv);
```

### `parseEnvelopeArgs(argv)` — new PURE helper
- `argv[1]` is `<play>`; missing / `--`-leading ⇒ `{ cmd: "usage", error: "missing <play>" }`.
- optional `--tier <t>`: validated against the four `ValueTier` words; an unknown tier ⇒
  usage error; absent ⇒ default `"standard"`.
- returns `{ cmd: "envelope", play, tier }`.

A tiny `VALUE_TIERS` tuple (`["keystone","high","standard","leaf"]`) lives in cli for the
membership check (cli already owns `SELECTION_SHAPE`-style local constants). `ValueTier`
imported `import type` from `menu.ts` (cli already `import type { Budget }`).

### `USAGE` banner — append the new line
```
       vend envelope <play> [--tier <tier>]
```

### Dispatch arm (inside `import.meta.main`)
```ts
if (parsed.cmd === "envelope") {
  const { loadRunLog } = await import("./log/run-log.ts");
  const { recalibrate, formatEnvelopeLabel } = await import("./ledger/recalibrate.ts");
  const { budgetForTier } = await import("./shelf/gather.ts");
  const { records } = await loadRunLog();
  const result = recalibrate(parsed.play, records, parsed.tier, budgetForTier(parsed.tier));
  const { timeMs, tokens } = result.envelope;
  process.stdout.write(`${parsed.play} [${parsed.tier}]: ${tokens} tokens / ${timeMs} ms — ${formatEnvelopeLabel(result)}\n`);
  process.exit(0);
}
```
Lazy imports keep the heavy deps (gather → shelf) off the pure-parse path, exactly as
the `browse`/`select`/`chain` arms do. Read-only: never writes, always exit 0.

---

## `src/cli.test.ts` — cover the parse helper (modify)
Add `describe("parseArgs — envelope")`: valid `envelope <play>` → default tier; explicit
`--tier keystone`; missing play → usage; unknown tier → usage. (Pure parser only — the
dispatch shell is untested, per house pattern.)

---

## Ordering of changes (for the Plan)
1. `recalibrate.ts` — `percentile` first (leaf), then `recalibrate`, then
   `formatEnvelopeLabel`.
2. `recalibrate.test.ts` — lock the math.
3. `cli.ts` — parse arm + dispatch arm + USAGE.
4. `cli.test.ts` — parse coverage.
5. `bun run check:typecheck` + `check:test` green; smoke `vend envelope decompose-epic`.

## Module-boundary summary
`src/ledger/recalibrate.ts` is a **pure leaf-consumer**: depends up onto
`run-log.ts` (pure helpers + record type), `budget.ts` (type), `menu.ts` (type). Nothing
imports *it* except the cli dispatch shell. No cycle, no new impure verb (reuses
`loadRunLog`). The Ledger directory is the home T-013-03 (bias-correction) extends.
