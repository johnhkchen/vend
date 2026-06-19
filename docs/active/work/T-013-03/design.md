# T-013-03 — Design

*Options, tradeoffs, decisions with rationale — grounded in the research. What was
rejected and why.*

Five decisions: **(A)** the project-identifier field + reader grouping, **(B)** the
`calibrate` signature & return shape, **(C)** the bias-factor estimator, **(D)** the
partial-pooling (empirical-Bayes shrinkage) law, **(E)** the surface.

---

## Decision A — `project?: string` on the record, default derived on read

### The question
AC1: the record must carry a **stable project identifier** (backward-compatible — absent →
a derived default), and the reader must **group a play's runs by project**.

### Options
1. **Required `project` field, asserted on write.** Rejected — breaks every pre-T-013-03
   record (and the write boundary would throw on legacy data the read face must tolerate).
2. **Optional `project?`, omitted-when-absent on write; default derived on read.**
   *Chosen.* Mirrors the `envelope?` idiom exactly (research §run-log): `buildRunRecord`
   spreads it only when present, `reviveRecord` keeps it only when it is a non-empty
   string, so legacy records stay **byte-identical**. The reader supplies the default via a
   pure `projectOf(r) = r.project ?? DEFAULT_PROJECT`.
3. **Derive the project from `epic` or `runId`.** Rejected — those encode no project; the
   default must be a single stable bucket for legacy runs, not a guess.

### The write-side value
`cast.ts` stamps `project: basename(projectRoot)` (a new optional `CastOptions.project`,
defaulting to the repo-dir basename). This is the **stable, local-first** project id
(charter P5; a cross-project corpus via a user-global store is the documented follow-up).
New records always carry it; `DEFAULT_PROJECT` (`"(default)"`) only ever applies to legacy
records that predate the field.

### The reader grouping
Extend `forPlay`'s opts bag with `project?` (the minimal move — it already has `outcome?`):
`forPlay(records, play, { project })` filters by `projectOf(r) === project`. Plus exported
`projectOf` + `DEFAULT_PROJECT` so a caller can group (`forPlay` per distinct project) and
the calibrate core can match a key. No new reader function, no new coupling.

---

## Decision B — `calibrate(estimate, key, projectRecords, genericPrior, opts)`

### Signature
```ts
calibrate(
  estimate: Budget,                                   // the raw envelope to correct
  key: { readonly play: string; readonly project: string },
  projectRecords: readonly RunRecord[],               // this project's records (the play+project pairs)
  genericPrior: BiasPrior,                             // the generic play prior (pooled across projects)
  opts?: { readonly shrinkage?: number },
): CalibrateResult
```

### Return shape
```ts
interface BiasFactor { readonly tokens: number; readonly timeMs: number } // actual/allocated ratio, per dim
interface BiasPrior  { readonly factor: BiasFactor; readonly n: number }   // a learned factor + its pair count
interface CalibrateResult {
  readonly corrected: Budget;                          // estimate × pooled factor, per dim, positive-int
  readonly factor: BiasFactor;                         // the POOLED factor actually applied (the learned bias)
  readonly confidence: { readonly projectN: number; readonly genericN: number };
}
```

**Why `estimate`/`corrected` are `Budget`, and `factor` is per-dimension.** AC2 names the
return `{ corrected, factor, confidence: { projectN, genericN } }` but fixes only the
`confidence` sub-shape; the *types* of `corrected`/`factor` are open. The codebase's own
`recalibrate` bounds **tokens and wall-clock independently** (research §recalibrate), and
AC4 feeds T-013-02's measured **Budget** through correction. A single scalar factor would
conflate token-bias and time-bias — runs can overestimate tokens while underestimating
time. So `factor` is a per-dim `BiasFactor` and `corrected` is a `Budget`, honoring the
"independent dimensions" precedent. `BiasFactor` is **not** a `Budget` (a 0.2 ratio is not
a positive-int budget dimension) — it is its own type.

**Why `genericPrior` is a passed-in `BiasPrior`, not imported / recomputed.** Mirrors
T-013-02 Decision B (prior passed in, never imported): the core computes ratios from data;
it does **not** own where the generic corpus comes from. The caller computes
`genericPrior = learnBiasFactor(forPlay(records, play))` (all projects) and hands it in with
its `n`, so the core can report `genericN` and shrink correctly. This keeps the core's
imports type-only-plus-pure-helpers and trivially fixturable.

**The three-level hierarchy** (project → generic → authored default) falls out of the
shrinkage, not a branch ladder: `learnBiasFactor` of an empty sample returns the **identity
factor `{1,1}` with `n=0`** (the authored default = "no correction"). So projectN=0 ∧
genericN=0 ⇒ pooled = identity ⇒ `corrected = estimate` verbatim. No special-casing.

---

## Decision C — the bias factor is the **median** actual/allocated ratio, per dim

### The question
"Learn the empirical bias factor — the actual/allocated **ratio distribution** — from
(allocated, actual) pairs of **successful** runs (censored excluded, IA-13)."

### How a record yields a pair
- **allocated** = `record.envelope` (the T-013-01 logged ceiling). A record **without an
  envelope contributes no pair** (the allocated half is unknown — skip, don't fake).
- **actual.tokens** = `totalTokens(record)`; **actual.timeMs** = `wallClockMs(record)`
  (`null` ⇒ that record drops from the **time** ratio sample only, exactly as `recalibrate`
  drops null-stamp records from its time percentile).
- ratio.tokens = actual.tokens / envelope.tokens; ratio.timeMs = actual.timeMs /
  envelope.timeMs. A non-positive allocated dimension is skipped (no divide-by-zero).

### Aggregation: median, not mean
- **Median** (`percentile(sortedAsc, 0.5)`, reusing T-013-02's primitive) — *chosen*.
  Robust to the fat tail (IA-13's whole premise: never mean+stddev). One outlier run that
  spent its full envelope cannot drag the learned bias. Consistent with the module's
  existing robust-statistic stance.
- **Mean ratio** — rejected: a single near-envelope run skews it; the fat tail is exactly
  what we must not average over.
- **Ratio-of-medians vs median-of-ratios** — *median-of-ratios* chosen: the *per-run* ratio
  is the unit of bias ("this run cost 0.3× what we budgeted"); the distribution of those
  ratios is what AC2 names. Ratio-of-medians would lose the pairing.

**Direction is data-driven** (AC2): median ratio < 1 ⇒ systematic **over**-estimate ⇒
`corrected < estimate`; > 1 ⇒ **under**-estimate ⇒ `corrected > estimate`. Falls out of the
multiply; no over/under branch. (The ticket's *"overestimate by ~80%"* ≈ a ratio of ~0.2.)

`learnBiasFactor(records, opts)` is its own exported pure helper (returns `{ factor, n }`),
so it is unit-tested in isolation **and** reused by the caller to build the generic prior —
the same function pooled at two levels (project vs cross-project), which *is* the
hierarchy.

---

## Decision D — partial pooling by empirical-Bayes shrinkage

### The law
Per dimension, with `projectN` project pairs and the generic factor `g`:
```
w        = projectN / (projectN + K)          // K = shrinkage strength (prior's equivalent sample size)
pooled   = w · projectFactor + (1 − w) · g    // projectFactor = identity when projectN = 0
corrected = max(1, ceil(estimate · pooled))   // positive-int budget contract
```
`K = DEFAULT_SHRINKAGE = 5` (overridable via `opts.shrinkage`) — the project must accrue ~K
pairs before it outweighs the prior. This is the **two-level form of T-013-02's cold-start**
(a soft, continuous version of recalibrate's hard `minSuccesses` cliff).

### Why this satisfies AC3's three regimes (monotonic prior→project)
- **N = 0** ⇒ w = 0 ⇒ pooled = generic prior (pure outside view). ✓
- **small N** ⇒ 0 < w < ½ ⇒ shrunk toward generic. ✓
- **large N** ⇒ w → 1 ⇒ project-dominant. ✓
- `w(N) = N/(N+K)` is **strictly increasing** in N, so with `projectFactor` fixed the
  corrected estimate moves **monotonically** from the prior to the project-specific value
  as project-N grows — exactly the AC3 assertion, directly unit-testable.

### Rejected
- **Hard cliff** (recalibrate's `successes < minSuccesses` → prior verbatim) — rejected
  here: AC3 demands a *monotonic* move, which a cliff cannot give. Shrinkage is the right
  tool for a two-level prior; the cliff was right for a single-level percentile.
- **Full James-Stein / variance-weighted shrinkage** — rejected: needs per-group variance
  estimates that are noise at these sample sizes. `N/(N+K)` is the honest minimal form
  (the same shape as a Beta-Binomial posterior mean), and it is exact and total.

---

## Decision E — surface: extend `vend envelope` with `--estimate` / `--project`

### The question
AC4/AC5: a raw estimate, fed *through* bias correction, shown corrected and tagged with how
much data backs it. The Confirm screen does not exist yet (TUI epic), so the CLI is the
surface — exactly as T-013-02 chose.

### Decision
Extend the existing **read-only** `vend envelope <play>` arm (no new command):
- New optional `--estimate <ms>,<tokens>` (parsed by the existing `parseBudgetArg`) — the
  raw estimate to correct. **Absent ⇒ the estimate is T-013-02's measured default** (the
  recalibrate envelope), so "the measured default feeds through" (AC4) with no flag.
- New optional `--project <id>` (defaults to `basename(cwd)`, the same default the writer
  stamps) — which project's history to correct against.
- The arm then: `loadRunLog` → `recalibrate` (measured default, unchanged first line) →
  build `genericPrior = learnBiasFactor(forPlay(records, play))` and
  `projectRecords = forPlay(records, play, { project })` → `calibrate(estimate, {play,
  project}, projectRecords, genericPrior)` → print a **second** line: the corrected budget,
  the applied factor, and `N project / M generic`. Still **exits 0** (read-only — display,
  not actuation; IA-14 deferred), additive to the existing output.

A pure `formatCorrectionLabel(result)` does the label (tested), mirroring
`formatEnvelopeLabel`. The dispatch wiring stays the thin untested shell.

### Rejected
- **Actuating the corrected budget into a real dispatch** — rejected (IA-14: deadband /
  hysteresis is a later rung; this slice displays only, like T-013-02).
- **A separate `vend calibrate` command** — rejected: bias correction *is* the envelope
  readout's second half; one surface, not two.

---

## What this design defers
- **Actuation** into the live dispatch default — IA-14.
- **A cross-project (user-global) generic corpus** — charter P5 follow-up; the generic
  prior here pools only the local log's other projects.
- **Per-group variance-weighted shrinkage** — `N/(N+K)` is the honest minimal form.
- **Probe casts** to de-bias the censored tail — IA-13 mechanism, later.
