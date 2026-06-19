# T-019-01 — Design: generalize the consistency probe

Decisions, with rejected alternatives, grounded in `research.md`.

## D1 — Two modules, mirroring `variance.ts` / `run-probe.ts`

Add a **pure** core and an **impure** harness, siblings of the existing pair:

- `src/probe/consistency.ts` — PURE. The variance + outcome-mix computation over a list of
  `{outcome, output}` results. No fs/clock/addon. Unit-tested (`consistency.test.ts`).
- `src/probe/run-consistency-probe.ts` — IMPURE. Resolves a play by name, seeds a disposable
  temp project, casts it N× on a fixed input into a temp ledger, classifies each run, calls the
  pure core, prints the report. Not unit-tested (the run-probe house rule for impure verbs).

**Rejected:** extending `variance.ts`/`run-probe.ts` in place. `variance.ts`'s
`varianceReduction` is a *paired gated-vs-ungated* read; the new probe is *single-arm* (one play,
N casts). Bolting a second shape onto a reviewed, committed module muddies it and risks AC#3
("existing decompose path unaffected"). New siblings keep both probes legible and leave
`run-probe.ts` byte-for-byte untouched. Reuse happens at the **`dispersion()` primitive**, which
both cores import.

## D2 — Classification lives in the impure harness; the pure core is a tallier

The pure core receives **pre-classified** results: `ProbeResult { outcome: ProbeOutcome,
output: string | null }`. It does not decide signal-vs-honest-empty.

Rationale (the central tension from research §"honest-empty / signal"): the discriminator is
**play-specific** (survey's honest-empty CLEARS and materializes an abstention note; expand's
honest-empty STOPs). A pure cross-play "is the output blank" test is *wrong* for survey. The AC
itself phrases the input as "a set of `(outcome, output)` results" — i.e. the outcome is already
a label, not a raw `RunOutcome`. So:

- **Impure harness** maps each cast → a `ProbeOutcome` (it has the `RunSummary` + collected
  output + knowledge of which play it cast). Untested, documented — exactly where run-probe's
  per-play glue already lives.
- **Pure core** counts the labels and computes variance over the produced outputs. Fully
  testable on fabricated `ProbeResult[]` — satisfying the AC's three fixtures.

**Rejected:** a pure `classify(runOutcome, output)` in the core. It would have to bake in
per-play abstention markers (brittle string-matching on "no demand staged"), coupling the pure
core to specific plays' effect prose. That is the util-coupling the house idiom forbids.

## D3 — `ProbeOutcome`: three named buckets, honest mapping

```ts
type ProbeOutcome = "signal" | "honest-empty" | "budget-exhausted";
```

The harness classifier (`classifyRun`) maps `(RunSummary, output: string | null)` → `ProbeOutcome`:

- `outcome !== "success"` → **`budget-exhausted`**. This is the *censored / produced-nothing-of-
  value* bucket. On a grounded, gated cast the run-probe finding is that the dominant non-success
  mode is genuine budget exhaustion (the fat tail). `timed-out` / `gate-failed` / `id-collision`
  fold here and are surfaced **separately in a raw `RunOutcome` tally** in the printed report so
  the fold is never silent (honesty — IA-8: the meter must not lie).
- `outcome === "success"` + the harness's per-play **`isAbstention(output)`** predicate true →
  **`honest-empty`**.
- `outcome === "success"` + not abstention → **`signal`**.

`isAbstention` is a **per-play** predicate carried on the probe's play-target config (D5), not a
global string test. Default: `output === null || output.trim() === ""`. Survey/steer override it
to recognize their abstention note (a stable marker substring the effect emits, e.g.
`"no demand staged"`). Decompose/expand use the default (their honest-empty is already a
non-success outcome, so the predicate rarely fires).

**Rejected:** a 5-way union mirroring `RunOutcome`. The ticket names exactly three buckets; the
raw `RunOutcome` histogram (printed alongside) preserves the full detail without bloating the
headline metric the findings note (T-019-02) reads.

## D4 — The pure core shape

```ts
interface OutcomeMix {
  readonly total: number;
  readonly counts: Record<ProbeOutcome, number>;
  readonly rates: Record<ProbeOutcome, number>;   // count / total; total 0 ⇒ all 0
}
interface ConsistencyReport {
  readonly variance: SetDispersion;   // dispersion() over the SIGNAL outputs only
  readonly mix: OutcomeMix;
}
function consistencyReport(results: readonly ProbeResult[]): ConsistencyReport;
function formatConsistencyReport(r: ConsistencyReport): string;  // one honest line
```

**Variance is computed over the `signal` outputs only** — the produced set whose run-to-run
agreement is the consistency question. `honest-empty` and `budget-exhausted` runs produce no
signal to disperse, so including them would conflate "abstained" with "disagreed". This mirrors
`varianceReduction`'s existing discipline of filtering `null` before dispersing. The `mix`
carries the counts so a low-variance number earned by mostly-abstaining (few signals) reads
truthfully — the formatter caveats `variance.n < 2` exactly as `formatVarianceReport` does.

`rates` is `count/total` over **all** runs (so the honest-empty *rate* is over every cast, the
over-eagerness denominator the ticket wants), while `variance.n` is just the signal count.

**Rejected:** dispersing over all non-null outputs (would mix survey's abstention note into the
signal set). Rejected: omitting rates (AC explicitly asks for "counts + rates").

## D5 — Play-target config drives per-play seeding & inputs

A small per-play record keyed by name, the parametric replacement for run-probe's hard-wired
decompose glue:

```ts
interface ProbeTarget {
  readonly play: AnyPlay;                       // resolved via registry.get(name)
  readonly seed: (root: string) => Promise<void>;        // create the fixed input under root
  readonly assemble: (root: string) => Promise<unknown>; // the play's assemble*Inputs
  readonly subject: (root: string) => string;            // run-log subject
  readonly outputDirs: readonly string[];                // dirs to clear+collect
  readonly isAbstention: (output: string | null) => boolean;
}
```

The harness builds a `Record<string, ProbeTarget>` (or a `name → builder` map). **First cut
covers `decompose-epic` and `survey`** — the two with the cleanest, already-exported inputs
assembly (`assembleInputs`, `assembleSurveyInputs`) and the two ends of the honest-empty polarity
(decompose: empty=stop; survey: empty=clear+note). expand/propose/steer are a **documented
extension seam** — adding one is "add a `ProbeTarget` entry", no core change. This keeps the
ticket tractable (≈ generalize, prove on two plays) while the *generalization is real* (the core
and harness are play-agnostic; only the target table enumerates).

**Rejected:** wiring all five plays now. propose/steer's input assembly is less uniform and
seeding their fixed inputs (a demand fragment; a board+forks) is more bespoke; doing two proves
the generalization without ballooning the impure (untested) surface. The seam makes the rest
cheap and is called out in `review.md` as the follow-up.

## D6 — Temp-ledger isolation reuses run-probe's discipline verbatim

`mkdtemp` → `lisa init` → per-play `seed(root)` → cast with `runLogPath` = `<root>/.vend/
runs.jsonl`, clearing `outputDirs` before each cast (dodge the id-collision guard). Identical to
run-probe; lifted into shared private helpers **inside the new harness** (not exported from
`run-probe.ts` — copying the ~15 lines honors the no-shared-util idiom and keeps run-probe
untouched per AC#3). The real `.vend/runs.jsonl` and the live board are never touched.

**Rejected:** importing helpers out of `run-probe.ts`. That would convert run-probe from a
self-contained instrument into a library and risk perturbing the decompose path. Copy, per house.

## D7 — N and gates

`N` casts default **5** (run-probe's `RUNS_PER_ARM`), overridable by CLI arg. Gates **ON** by
default (we measure the *delivered* consistency a user gets); a `--no-gates` flag is available
(threads `skipGates`) for symmetry but is not the primary axis. Per-cast budget defaults to the
**play's recalibrated budget** (`target.play.budget`), overridable — the run-probe lesson that
budget, not gates, censors.

## Decision summary

| # | Decision |
|---|---|
| D1 | New `consistency.ts` (pure) + `run-consistency-probe.ts` (impure); reuse `dispersion()` |
| D2 | Classification in the impure harness; pure core is a tallier over `{outcome,output}` |
| D3 | `ProbeOutcome` = signal / honest-empty / budget-exhausted; per-play `isAbstention` |
| D4 | `ConsistencyReport { variance (over signals), mix (counts+rates) }` + honest formatter |
| D5 | `ProbeTarget` table; first cut decompose + survey; documented extension seam |
| D6 | Temp-ledger isolation copied from run-probe (no import); real ledger/board untouched |
| D7 | N=5 default, gates ON, per-cast budget = play's recalibrated default |
