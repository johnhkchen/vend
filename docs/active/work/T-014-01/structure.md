# T-014-01 — Structure

File-level blueprint. Five files touched, one created. No deletions. The shape of the code,
not the code.

## Files

| File | Action | What |
|------|--------|------|
| `src/log/run-log.ts` | modify | add `intervened?: boolean` to `RunRecordInput` + `RunRecord`; spread-when-present in `buildRunRecord`; keep-when-boolean in `reviveRecord` |
| `src/log/run-log.test.ts` | modify | cases: build with `true`/`false`/absent; revive preserves bool, drops non-bool, tolerates absent; absent record unchanged byte-for-byte |
| `src/engine/cast.ts` | modify | `CastOptions.intervened?: boolean`; spread into the single `appendRunLog` call |
| `src/play/decompose-epic.ts` | modify | `RunOptions.intervened?: boolean`; forward in `assembleAndCast` → `castPlay` opts |
| `src/play/dispatch.ts` | none | `RunOptions` flows through unchanged (it already passes `opts` straight to `assembleAndCast`) |
| `src/ledger/walk-away.ts` | **create** | the pure audit: types, `auditWalkAway`, `formatWalkAwayFindings`, `TIER_ANDON_BUDGET` |
| `src/ledger/walk-away.test.ts` | **create** | pure tests against fixture logs (records with/without `intervened`) |
| `src/cli.ts` | modify | `--intervened`/`--no-intervened` on `run`; new `audit` command (pure parse + impure arm) |
| `src/cli.test.ts` | modify | parse cases for `run --intervened` and `audit …` |

`dispatch.ts` listed for completeness: it needs **no edit** — `runPlay(name, opts)` forwards
`opts` verbatim, so once `RunOptions` carries `intervened` it threads through for free.

---

## 1. `src/log/run-log.ts` — the field

**`RunRecordInput`** — add after `project?`:
```
/** One self-reported bit (T-014-01): did the author step in mid-run (true) or let it
 *  clear (false)? Absent ⇒ unknown (back-compat; every pre-T-014-01 record). The E1
 *  walk-away instrument (PRD KR1). */
readonly intervened?: boolean;
```

**`RunRecord`** — same field + doc ("Present ONLY when the cast supplied one — absence is
meaningful (unknown), so it is omitted rather than written, exactly like `envelope`/`project`").

**`buildRunRecord`** — add a normalizer call + conditional spread (mirrors envelope/project):
```
const intervened = normalizeIntervened(input.intervened);   // boolean | undefined
...(intervened !== undefined ? { intervened } : {}),
```
New helper `normalizeIntervened(v): boolean | undefined` — returns `v` iff `typeof v ===
"boolean"`, else `undefined` (a non-boolean is coerced to absent, not asserted — like
`normalizeProject`, an absent/odd value is legal back-compat, not a caller bug).

**`reviveRecord`** — same `const intervened = typeof r.intervened === "boolean" ? r.intervened
: undefined;` + conditional spread in the returned frozen object.

Invariant preserved: no new import; field omitted when absent ⇒ old records byte-identical.

## 2. `src/engine/cast.ts` — the write

- `CastOptions`: add `readonly intervened?: boolean;` (doc: the E1 bit, threaded to the
  single end-of-cast append; absent ⇒ field omitted).
- In the `appendRunLog({...})` call, add a conditional spread next to `envelope`/`project`:
  `...(opts.intervened !== undefined ? { intervened: opts.intervened } : {})`.

No logic change — the bit is pass-through data, exactly as `project` is.

## 3. `src/play/decompose-epic.ts` — the thread

- `RunOptions`: add `readonly intervened?: boolean;`.
- `assembleAndCast`: add `intervened: opts.intervened,` to the `castPlay(..., {...})` opts
  object (alongside `model`, `runId`, `transcriptDir`). `undefined` flows harmlessly (the
  conditional spread in cast.ts omits it).

## 4. `src/ledger/walk-away.ts` — the audit (the heart)

Module header in the house style (purity note, IA cites). Imports TYPE-ONLY + run-log's
pure helpers (`forPlay`, `totalTokens`, `wallClockMs`, `RUN_OUTCOMES`, `RunOutcome`,
`RunRecord`) and `ValueTier`. Mirrors `recalibrate.ts`'s coupling discipline.

**Constants**
- `TIER_ANDON_BUDGET: Record<ValueTier, number>` = `{ keystone: 0.05, high: 0.08,
  standard: 0.10, leaf: 0.25 }` — the % side of IA-12 (keystone/standard/leaf from the doc;
  `high` interpolated, mirroring how `TIER_PERCENTILE` placed `high` at p92).
- `CENSORED_OUTCOMES` — re-declare locally (or import from recalibrate) the
  `[budget-exhausted, timed-out]` set used for the censored subtotal.
- `DEFAULT_WINDOW` — reuse 100 (import from recalibrate or redeclare; prefer import to keep
  one source of truth for the window size).

**Types**
```
interface OutcomeMix { readonly [k in RunOutcome]: number }   // count per outcome
              (+ derived) total, success, censored
interface CostVsEnvelope {
  readonly tokens: number | null;   // median actual/allocated, null when no pair
  readonly timeMs: number | null;
  readonly n: number;               // pairs backing it
}
interface InterventionStat {
  readonly reported: number;        // records carrying the bit
  readonly intervened: number;      // of those, how many true
  readonly rate: number | null;     // intervened/reported, null when reported===0
  readonly trend: { readonly earlier: number | null; readonly recent: number | null };
}
interface WalkAwayReport {
  readonly total: number;
  readonly play: string | null;     // null = all plays
  readonly andonRate: number;
  readonly andonBudget: number;
  readonly withinBudget: boolean;
  readonly outcomeMix: OutcomeMix & { total; success; censored };
  readonly cost: CostVsEnvelope;
  readonly intervention: InterventionStat;
}
interface AuditOptions { play?: string; tier?: ValueTier; window?: number; }
```

**Functions (all PURE)**
- `auditWalkAway(records, opts={}) → WalkAwayReport` — window+optional play filter via
  `forPlay`/`slice(-window)`; compute the four blocks; tier default `standard`.
- `formatWalkAwayFindings(report) → string` — the E1 fragment (AC #3): walk-away rate +
  trend, andon-rate vs budget (✓ in / ⚠ over), outcome mix line, cost-vs-envelope line.
  Honest fallbacks ("no self-reports yet (N runs)" when `reported===0`; "no envelope data"
  when `cost.n===0`).
- Private helpers: `median(sortedAsc)` (or import `medianOrNull` pattern), `ratePair` for
  the trend split.

**Public exports**: `TIER_ANDON_BUDGET`, `auditWalkAway`, `formatWalkAwayFindings`, the
types. Nothing imports walk-away back (leaf consumer, like recalibrate).

## 5. `src/ledger/walk-away.test.ts` — pure tests

A `rec(over)` fixture factory (like `baseInput`) producing `RunRecord`s. Suites:
- outcome mix + andon rate (all-success ⇒ 0; mixed ⇒ correct fraction; vs tier budget).
- cost-vs-envelope: ratios from envelope-carrying successes; `null`/`n:0` when none.
- intervention: rate over reported only; absent-bit records excluded from `reported`;
  trend earlier/recent split; `reported===0` ⇒ `rate:null`.
- `formatWalkAwayFindings`: contains the key numbers; honest fallback strings.

## 6. `src/cli.ts` — flag + verb

**`run --intervened`**: in `parseRunArgs`, scan for `--intervened` / `--no-intervened`
(presence flags, like `--all`); set `intervened` on the returned `run` command. Update the
`run` variant of `ParsedCommand` with `intervened?: boolean`. Dispatch arm passes it into
`runPlay`'s opts.

**`audit` verb**: 
- `USAGE` gains an `audit` line.
- `parseArgs`: `if (argv[0] === "audit") return parseAuditArgs(argv);`.
- `parseAuditArgs` (PURE): optional play (first non-flag token), `--tier` (validated against
  `VALUE_TIERS`, default standard), `--window` (optional positive int). Returns
  `{ cmd: "audit", play?, tier, window? }` or a `usage` error.
- `ParsedCommand` gains the `audit` variant.
- Impure arm (lazy imports `loadRunLog` + walk-away), prints `formatWalkAwayFindings`,
  `exit(0)`.

## 7. `src/cli.test.ts` — parse tests

- `run … --intervened` ⇒ `intervened: true`; `--no-intervened` ⇒ `false`; neither ⇒ field
  absent. (`--budget` still required.)
- `audit` ⇒ default tier standard, no play; `audit decompose-epic --tier keystone --window
  50`; bad `--tier` ⇒ usage.

## Ordering

1 → 2 (field + its tests, independently green) → 3 (cast write) → 4 (decompose thread) →
5 (audit module) → 6 (audit tests) → 7 (cli flag+verb) → 8 (cli tests). Each step keeps
`bun run check` green; field and audit module are independently committable.
