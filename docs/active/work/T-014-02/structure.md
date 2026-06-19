# T-014-02 — Structure

*The file-level blueprint: what is created, modified, the public interfaces, and the order
of changes. Not code — the shape of the code.*

## Files

| File | Action | Why |
|---|---|---|
| `src/engine/cast.ts` | **modify** | Add `skipGates?` to `CastOptions`; guard the one gate call. |
| `src/play/decompose-epic.ts` | **modify** | Add `skipGates?` to `RunOptions`; thread it through `assembleAndCast` → `castPlay`. |
| `src/cli.ts` | **modify** | `parseRunArgs` detects `--no-gates`; `run` command carries `skipGates?`; dispatch passes it. Update `USAGE`. |
| `src/cli.test.ts` | **modify** | Add parse tests for `--no-gates` (present ⇒ `skipGates:true`; absent ⇒ key omitted). |
| `src/probe/variance.ts` | **create** | The PURE diff/variance core (the unit-tested deliverable). |
| `src/probe/variance.test.ts` | **create** | Unit tests over fixture outputs. |
| `src/probe/run-probe.ts` | **create** | The IMPURE sweep harness (5×2 live cast; not unit-tested). |

No deletions. No schema changes. `src/log/`, `src/gate/`, `src/budget/`, `src/ledger/`,
`src/shelf/` are untouched.

## `src/engine/cast.ts` (modify)

`CastOptions` gains:

```ts
/** Skip the play's gate phase (the E2 / T-014-02 `--no-gates` run mode). When set, the
 *  output is parsed and materialized WITHOUT clearing — `gateVerdict` stays null, so
 *  `classify` returns `success` and the effect lands ungated. Absent/false ⇒ the gated
 *  path is unchanged. The run logs `gateResults: []` (no gates ran — honest). */
readonly skipGates?: boolean;
```

In `castPlay`, the only body change (the gate block, cast.ts:126–129):

```ts
if (budgetOutcome.status === "ok") {
  output = play.parse(result.result ?? "");
  gateVerdict = opts.skipGates ? null : play.gates(output, ctx);
}
```

Plus one honest stdout line when skipping (mirrors the existing `· andon:` / `· effect`
lines): `if (opts.skipGates) process.stdout.write("· gates skipped (--no-gates)\n");` placed
near the gate block. No other change; `classify`, `castGateRows`, the run-log write, and
`RunSummary` are unchanged.

## `src/play/decompose-epic.ts` (modify)

`RunOptions` gains `readonly skipGates?: boolean;` (doc: "thread the engine's `--no-gates`
run mode"). `assembleAndCast` adds `skipGates: opts.skipGates` to the `castPlay` `CastOptions`
object (alongside `subject`/`projectRoot`/`model`/`runId`/`transcriptDir`). `runDecomposeEpic`
is unchanged (delegates to `assembleAndCast`).

## `src/cli.ts` (modify)

- `ParsedCommand` `run` variant: add `readonly skipGates?: boolean`.
- `parseRunArgs`: scan for `--no-gates` (a presence flag, like `--all`); return
  `{ cmd:"run", play, epicPath, budget, ...(noGates ? { skipGates: true } : {}) }`. The
  `--budget` index search must skip the `--no-gates` token (it already searches by value, so
  order-independent — `--no-gates` may appear before or after `--budget`).
- `USAGE`: `run <play> <epic.md> --budget <ms>,<tokens> [--no-gates]`.
- Dispatch (`import.meta.main`, run arm): pass `skipGates: parsed.skipGates` into the
  `runPlay` options object.

## `src/probe/variance.ts` (create — PURE)

The deliverable that gets unit-tested. No fs/clock/process/addon imports.

```ts
/** One pair's divergence within a set: the two run indices and their distance ∈ [0,1]. */
export interface PairDiff { readonly i: number; readonly j: number; readonly distance: number; }

/** A set's dispersion: member count + mean pairwise distance + the raw per-pair diffs. */
export interface SetDispersion {
  readonly n: number;                       // materialized members (nulls excluded)
  readonly dispersion: number;              // mean pairwise distance; 0 when n < 2
  readonly pairs: readonly PairDiff[];
}

/** The whole probe read: both sets, the headline reduction, and the censored counts. */
export interface VarianceReport {
  readonly gated: SetDispersion;
  readonly ungated: SetDispersion;
  readonly reduction: number;               // (ungated − gated)/ungated; 0 if ungated==0
  readonly censoredGated: number;           // runs that materialized nothing (null)
  readonly censoredUngated: number;
}

/** Trimmed, non-blank lines as a Set — the comparison unit. PURE. */
export function lineSet(text: string): Set<string>;

/** Jaccard distance over two line sets: 1 − |∩|/|∪|. Both-empty ⇒ 0. PURE. Range [0,1]. */
export function lineJaccardDistance(a: string, b: string): number;

/** Mean pairwise distance over the materialized outputs. n < 2 ⇒ dispersion 0, pairs []. PURE. */
export function dispersion(outputs: readonly string[]): SetDispersion;

/** The headline read. Inputs are per-run materialized output, or null when a run
 *  materialized nothing (gated censoring / collision). PURE. Totals over every edge case. */
export function varianceReduction(
  gated: readonly (string | null)[],
  ungated: readonly (string | null)[],
): VarianceReport;

/** One honest line for the findings note — the single number + raw dispersions + censored
 *  counts, so a reduction inflated by censoring reads truthfully. PURE. */
export function formatVarianceReport(r: VarianceReport): string;
```

Internal helper: `meanPairwise(outputs)` builds the `PairDiff[]` and the mean (shared by
`dispersion`). `varianceReduction` partitions nulls (counting censored), calls `dispersion`
on the survivors of each arm, computes `reduction` with the divide-by-zero guard.

## `src/probe/run-probe.ts` (create — IMPURE, `import.meta.main`)

The sweep harness (D4). Imports: `mkdtemp`/`mkdir`/`rm`/`readdir`/`readFile`/`writeFile`/`cp`
(node:fs/promises), `tmpdir` (node:os), `join` (node:path); `assembleInputs` +
`CHARTER_PATH` (project-context), `decomposeEpicPlay` (decompose-epic), `castPlay`
(engine/cast), `varianceReduction`/`formatVarianceReport` (./variance). Structure:

- `RUNS_PER_ARM = 5` (constant; ≤ PRD's ≤5-cast budget per arm = 10 total).
- `seedTempRoot(epicPath)` — mkdtemp; copy the fixed epic in; copy the **real** charter to
  `tmp/docs/knowledge/charter.md` (bounds gate needs it); return `{ tmp, epicPathInTmp }`.
- `collectOutput(tmp)` — read+concat all `*.md` under `tmp/docs/active/{stories,tickets}`,
  sorted by name for determinism; `""`/none ⇒ `null`.
- `castArm(tmp, epicPathInTmp, skipGates, n)` — the per-run loop: `rm -rf` the two output
  dirs, `assembleInputs`, `castPlay(... { runLogPath: join(tmp,'.vend','runs.jsonl'),
  skipGates, runId })`, then `collectOutput`.
- `main(epicPath)` — seed; run both arms; `varianceReduction`; print
  `formatVarianceReport`; print per-run outcomes for the transcript.
- Budget: a generous fixed envelope (the play's default `decomposeEpicPlay.budget`) so the
  arms aren't budget-censored — we want to isolate the *gate* channel.

## Interface & dependency notes

- New `src/probe/` module depends UP onto `engine/cast`, `play/decompose-epic`,
  `play/project-context` — same direction concrete consumers already use; no cycle.
- `variance.ts` imports **nothing** (pure, addon-free) — so `variance.test.ts` is an ordinary
  pure-function test, never loading BAML.
- The `skipGates` threading touches only the run path; `chain`/`select`/`browse`/`envelope`
  commands are untouched.

## Order of changes (matches plan.md)

1. `cast.ts` `skipGates` option + guard (the mechanism).
2. Thread through `decompose-epic.ts` + `cli.ts`; update `cli.test.ts`.
3. `variance.ts` pure core.
4. `variance.test.ts` unit tests.
5. `run-probe.ts` harness.
6. `bun run check` green; commit.
