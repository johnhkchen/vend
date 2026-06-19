# T-019-01 — Structure: generalize the consistency probe

The shape of the code (not the code). Files created/modified, interfaces, ordering.

## File-level change set

| File | Action | Purity | Tested |
|---|---|---|---|
| `src/probe/consistency.ts` | **create** | PURE | yes — `consistency.test.ts` |
| `src/probe/consistency.test.ts` | **create** | test | — |
| `src/probe/run-consistency-probe.ts` | **create** | IMPURE | no (house rule) |
| `src/probe/variance.ts` | unchanged (imported) | — | — |
| `src/probe/run-probe.ts` | **unchanged** (AC#3) | — | — |

No edits to `engine/`, `play/`, `log/` — the harness consumes their **existing** public surface
(`registry.get`, `castPlay`, `RunSummary`, each play's `assemble*Inputs`). Zero changes outside
`src/probe/`.

## `src/probe/consistency.ts` (PURE core)

Header comment in the house style: states the single promise (run-to-run consistency of ONE play
on a fixed input, as variance + outcome mix), the purity guarantee, and *why classification is
NOT here* (it is play-specific — D2). Imports **only** `dispersion` + `SetDispersion` from
`./variance.ts` (type + one pure value). No fs/clock/addon.

Public surface:

```ts
export type ProbeOutcome = "signal" | "honest-empty" | "budget-exhausted";
export const PROBE_OUTCOMES: readonly ProbeOutcome[];          // for iteration/zeroing

export interface ProbeResult {
  readonly outcome: ProbeOutcome;
  readonly output: string | null;   // materialized text; null when nothing landed
}

export interface OutcomeMix {
  readonly total: number;
  readonly counts: Readonly<Record<ProbeOutcome, number>>;
  readonly rates: Readonly<Record<ProbeOutcome, number>>;      // count/total; total 0 ⇒ 0s
}

export interface ConsistencyReport {
  readonly variance: SetDispersion;   // dispersion() over SIGNAL outputs only
  readonly mix: OutcomeMix;
}

export function outcomeMix(results: readonly ProbeResult[]): OutcomeMix;
export function consistencyReport(results: readonly ProbeResult[]): ConsistencyReport;
export function formatConsistencyReport(r: ConsistencyReport): string;
```

Internal logic:
- `outcomeMix`: seed `counts` to `{signal:0, honest-empty:0, budget-exhausted:0}` (via
  `PROBE_OUTCOMES`), tally, derive `rates` (`total === 0 ⇒ all 0`, never NaN — the
  `varianceReduction` divide-by-zero discipline).
- `consistencyReport`: `variance = dispersion(signalOutputs)` where `signalOutputs` =
  results filtered to `outcome === "signal"` with non-null `output` (a `signal` with null output
  is defensively dropped from the dispersion set, still counted in the mix). `mix = outcomeMix(...)`.
- `formatConsistencyReport`: one honest line — headline dispersion + signal n, then the mix
  (`signal X · honest-empty Y · budget-exhausted Z`) and the honest-empty rate, with a
  `⚠ signal arm too small to disperse` caveat when `variance.n < 2` (mirrors `formatVarianceReport`).

## `src/probe/consistency.test.ts` (PURE test)

`bun:test`, fabricated fixtures, no fs/addon — the `variance.test.ts` template. Cases (cover the
AC's three named fixtures + edges):
- `outcomeMix`: counts each bucket; rates sum to 1; empty input ⇒ all-zero, no NaN; honest-empty
  rate computed (AC).
- `consistencyReport`: **all-same signal outputs ⇒ variance 0** (AC); **mixed outcomes counted**
  (AC) and variance dispersed over signals only (an interleaved honest-empty/budget-exhausted does
  not perturb the signal dispersion); a `signal` with null output is dropped from dispersion but
  kept in the count.
- `formatConsistencyReport`: emits the headline + mix + caveat when signal n < 2.

## `src/probe/run-consistency-probe.ts` (IMPURE harness)

Header comment in the run-probe house style: the impure any-play sweep verb; run by a human AT
SWEEP; NOT unit-tested; the two invariants (no ledger pollution; no id-collision between casts).

Imports: node fs (`cp/mkdir/mkdtemp/readdir/readFile/rm`), `tmpdir`, `path`; `registry` +
`AnyPlay` from `../engine/play.ts`; `castPlay` + `RunSummary` from `../engine/cast.ts`; the pure
core from `./consistency.ts`; and the **play modules it can target** (value-import, to trigger
self-registration): `../play/decompose-epic.ts`, `../play/survey.ts` (+ their `assemble*Inputs`,
`CHARTER_PATH`, `epicIdOf`).

Internal structure:

```ts
const RUNS_DEFAULT = 5;

interface ProbeTarget {
  readonly play: AnyPlay;
  readonly seed: (root: string, srcInputPath?: string) => Promise<void>;
  readonly assemble: (root: string) => Promise<unknown>;
  readonly subject: (root: string) => string;
  readonly outputDirs: readonly string[];
  readonly isAbstention: (output: string | null) => boolean;
}

// per-play target builders (the parametric replacement for run-probe's hard-wired decompose glue)
function decomposeTarget(srcEpicPath: string): ProbeTarget;   // seeds epic + charter; assembleInputs
function surveyTarget(): ProbeTarget;                          // seeds charter + (light) board; assembleSurveyInputs

// copied (not imported) from run-probe's discipline — no-shared-util idiom, run-probe untouched:
async function initLisaProject(root: string): Promise<void>;  // Bun.spawn lisa init
async function seedTempRoot(): Promise<string>;               // mkdtemp + initLisaProject
async function collectOutput(root, outputDirs): Promise<string | null>;

function classifyRun(summary: RunSummary, output: string | null, t: ProbeTarget): ProbeOutcome;

async function castN(target: ProbeTarget, n: number, opts): Promise<ProbeResult[]>;  // the N-cast loop
async function main(playName: string, srcInputPath: string | undefined, n: number): Promise<void>;
```

`main`:
1. Resolve the target: switch on `playName` → `decomposeTarget` / `surveyTarget`; an unknown name
   prints `registry.names()` + the supported probe targets and exits non-zero (the
   `PlayNotFoundError`/usage discipline).
2. `seedTempRoot()` → `target.seed(root, srcInputPath)`.
3. `castN`: for each of N — clear `outputDirs`, `assemble(root)`, `castPlay(target.play, inputs,
   budget, { subject, projectRoot: root, runLogPath: <root>/.vend/runs.jsonl, runId })`, then
   `collectOutput` + `classifyRun` → push `ProbeResult`. `budget = target.play.budget`
   (recalibrated), token override via optional arg.
4. `consistencyReport(results)` → `formatConsistencyReport` to stdout, plus a raw `RunOutcome`
   tally line (the un-folded detail — D3 honesty).

`classifyRun`: `summary.outcome !== "success"` ⇒ `"budget-exhausted"`; else
`target.isAbstention(output) ? "honest-empty" : "signal"`.

CLI entry (`import.meta.main`):
```
bun run src/probe/run-consistency-probe.ts <play-name> [input.md] [N] [tokenBudget]
```
`decompose-epic` requires `input.md` (the epic); `survey` ignores it (reads the seeded board).
Arg validation mirrors run-probe (`process.exit(2)` on a bad/absent required arg).

## Module boundaries & invariants

- **Dependency direction preserved:** the harness depends UP onto `engine/` + the concrete
  plays; nothing in `engine/`/`play/` depends on the probe. Acyclic.
- **Purity wall:** `consistency.ts` imports only `variance.ts` (pure). The addon enters only via
  the value-imported play modules in the **impure** harness — never in a `bun test` process
  (no test value-imports the harness, exactly as none imports `run-probe.ts`).
- **AC#3:** `run-probe.ts` and every existing module are untouched; the new files are additive.

## Ordering of changes (feeds plan.md)

1. `consistency.ts` (pure core) — no deps but `variance.ts`.
2. `consistency.test.ts` — pin the core; green before the harness.
3. `run-consistency-probe.ts` (harness) — consumes the green core.
4. Smoke-run the harness once against a seeded play to prove live (not committed as a test).
