# T-019-01 — Research: generalize the consistency probe

Descriptive map of the code the ticket touches. No solutions here (those are `design.md`).

## What the ticket asks

Generalize the decompose-only variance probe into an **any-play, run-to-run consistency
probe** (R12 shared-contract). Cast a named play **N× on a fixed input** and report:

1. **Output variance** — reuse `variance.ts`'s line-set-Jaccard dispersion.
2. **Outcome mix** — counts + rates of `signal` / `honest-empty` / `budget-exhausted`. The
   honest-empty rate on a *grounded* input is the over-eagerness/abstention behavioral signal.

The **pure** part (variance + outcome-mix computation over `{outcome, output}` results) is
unit-tested. The cast-loop harness is the impure sweep verb (not unit-tested, like
`run-probe.ts`). Cast into a **disposable temp ledger** — no real `.vend/runs.jsonl` or board
pollution.

## The existing probe (the thing to generalize)

### `src/probe/variance.ts` — the PURE core to reuse (unchanged)
- `lineSet(text) → Set<string>`: trimmed, non-blank, order-insensitive line set — the
  comparison unit.
- `lineJaccardDistance(a, b) → [0,1]`: `1 − |∩|/|∪|`; empty/empty ⇒ 0 (no divide-by-zero).
- `dispersion(outputs: readonly string[]) → SetDispersion { n, dispersion, pairs }`: mean
  pairwise Jaccard over all unordered pairs; `< 2` members ⇒ `0` dispersion. **This is the
  variance primitive the new core reuses.**
- `varianceReduction(gated, ungated)` + `formatVarianceReport`: the **gated-vs-ungated**
  headline. This is decompose-probe-specific (paired arms). The new probe is **single-arm**
  (one play, N casts, ±gates is not the axis), so it needs its own dispersion-over-one-set read,
  not `varianceReduction`. `dispersion()` is the shared primitive both build on.
- Already covered by `variance.test.ts` (pure-function tests, no fs/addon). The new pure core
  gets a sibling test file in the same discipline.

### `src/probe/run-probe.ts` — the IMPURE harness to generalize
- Hard-wired to `decomposeEpicPlay`: imports it directly (`decompose-epic.ts`), uses
  `epicIdOf`, casts `5× gated + 5× ungated` (`RUNS_PER_ARM`), diffs with `varianceReduction`.
- The reusable **discipline** (the parts to lift):
  - `seedTempProject(srcEpicPath)`: `mkdtemp` under `tmpdir()`, `lisa init` (so the effect's
    `lisa validate` passes), then seed the **fixed input** the play needs (decompose: the epic
    under `docs/active/epic/`, the real charter at `CHARTER_PATH`).
  - `initLisaProject(root)`: `Bun.spawn(["lisa","init"])` — the structure every play's effect
    requires (CLAUDE.md, `.lisa/hooks`, `docs/active/work`, rdspi-workflow.md).
  - `OUTPUT_DIRS` clearing between casts — dodges `materialize`'s id-collision guard so each run
    actually materializes instead of relabelling to `id-collision`.
  - `collectOutput(root) → string | null`: read+concat the `*.md` the effect materialized,
    sorted; `null` when nothing landed (gate-censored / collided / andon'd).
  - `castArm(...)`: the per-cast loop, threading `runLogPath` **into the temp root** so the real
    ledger is never touched, and a stable `runId` per cast.
- **Decompose-specific bits that must become play-parametric:** which play, the fixed-input
  seeding, the inputs assembly (`assembleInputs`), the subject, and which output dirs to
  clear/collect.
- House rule (stated in the file header): impure verbs (`castPlay`, fs, seeding) are **not**
  unit-tested — only the pure judgment is. The new harness inherits this.

## The casting spine the harness drives

### `src/engine/cast.ts` — `castPlay(play, inputs, budget, opts) → RunSummary`
- Generic over any `Play<I,O>`. Orchestration: render → dispense (`claude -p` under wall-clock)
  → meter (`budget.check`) → parse → gates (skippable via `opts.skipGates`) → classify →
  effect → `appendRunLog`.
- `CastOptions` the harness already uses: `subject` (required), `projectRoot`, `runLogPath`
  (→ temp ledger), `runId`, `skipGates`, `model`, `transcriptDir`.
- `RunSummary { runId, outcome: RunOutcome, materialized: boolean, produced?: string }` — the
  only structured return. **Does NOT return the parsed output `O`** — so signal/honest-empty
  discrimination cannot read the parsed value; it must read `outcome` + the collected output
  string (the central design tension, below).

### `src/engine/play.ts` — the registry to resolve a play by name
- `registry: PlayRegistry` singleton; `registry.get(name) → PlayLookup` (`{found:true, play}` |
  `{found:false, error: PlayNotFoundError}`) — never bare `undefined`. `registry.names()` lists
  registered keys. A play **self-registers** at module load (e.g. `survey.ts` calls
  `registry.register(surveyPlay)`), so the harness must value-import the play modules it can
  cast (importing pulls the BAML addon — fine in a plain `bun` process, which the probe is).
- `AnyPlay = Play<any,any>` — the type-erased element; `render/parse/gates/effect/budget/card`.

### `src/log/run-log.ts` — outcome vocabulary
- `RUN_OUTCOMES = ["success","gate-failed","timed-out","budget-exhausted","id-collision"]` →
  `RunOutcome`. **Note the mismatch:** the ticket's outcome-mix vocabulary
  (`signal`/`honest-empty`/`budget-exhausted`) is **not** `RunOutcome`. It is a *probe-level*
  classification derived from `RunOutcome` + output emptiness (see tension).
- `appendRunLog` writes one JSONL line per run; the harness redirects its path into the temp
  root, so the probe leaves the real ledger untouched.

## The plays the generalized probe can target

Registered plays (each self-registers on value-import; each has its own impure
`assemble*Inputs` + a fixed-input shape and budget):

| Play | name | inputs assembly | fixed input to seed | recalibrated budget |
|---|---|---|---|---|
| decompose-epic | `decompose-epic` | `assembleInputs` (epic+charter+snapshot) | an epic .md + charter | (existing) |
| propose-epic | `propose-epic` | (propose-core/effect) | a demand fragment + charter | 150k (recalibrated) |
| expand-fragment | `expand-fragment` | `assembleExpandFragmentInputs` | a fragment + charter | 250k (recalibrated) |
| survey | `survey` | `assembleSurveyInputs` (charter + board snapshot) | charter + stories/tickets dirs | 300k |
| steer | `steer` | (steer-effect/core) | board + forks | 400k |

The probe needs **per-play seeding + inputs assembly**. This is inherently play-specific glue
(run-probe hard-codes decompose's). The recalibrated budgets (E-018: expand 250k / survey 300k /
steer 400k) are the per-cast ceilings; the run-probe finding is that **token budget, not gates,
is the dominant censoring axis** (N=1-per-arm budget-exhaustion made the first sweep unreadable;
it raised the per-cast ceiling above the fat tail).

## The honest-empty / signal discrimination (the central tension)

The outcome mix needs three buckets, but `RunSummary` does not surface the parsed output:

- `budget-exhausted` (and `timed-out` / `gate-failed` / `id-collision`): non-`success` outcome.
  Trivially read off `RunSummary.outcome`. These are *censored* — nothing useful materialized.
- `signal` vs `honest-empty`: BOTH are `outcome: "success"`. The difference is whether the play
  **produced real content** or **honestly abstained** (IA-4). The polarity is **play-specific**:
  - `survey` (survey-core.ts): an **empty board CLEARS** (success) and `surveyBoardEffect`
    **still materializes** a non-empty abstention note ("Survey — no demand staged" /
    "honest empty board"). So *output-string-emptiness alone does NOT discriminate* signal from
    honest-empty for survey — the abstention note is non-blank text.
  - `expand-fragment` (expand-core): a blank signal **STOPs** (gate-failed) — its honest-empty
    is a *non-success* outcome, not a cleared-but-empty one.
  - `decompose-epic`: an empty workplan would gate-fail; honest-empty is not really in its
    vocabulary.
- Consequence: a *cross-play* signal/honest-empty classifier cannot be purely "is the output
  string blank". It needs either (a) a per-play abstention recognizer, or (b) the harness
  classifies and hands the pure core a **pre-labelled** `ProbeOutcome` — keeping the pure core a
  clean tallier. The AC's wording ("over a set of `(outcome, output)` results") points at (b):
  the pure core receives an already-classified outcome and an output string; classification
  lives in the impure harness (untested, documented), exactly where run-probe's per-play glue
  lives. **Design decides this.**

## Conventions & constraints observed

- **Pure-core / impure-verb split** (house pattern): pure modules import no fs/clock/addon and
  are unit-tested to the branch; the one impure verb is proven live, not unit-tested.
- **No-shared-util idiom**: small predicates (`nonEmpty`) are *copied* per module, not shared.
- **Returned data, not exceptions** for expected andons; `RangeError` only for programmer error.
- **Tooling:** `bun test` / `tsc --noEmit` / `bun run check` (= baml:gen + typecheck + test).
  AC#3 requires `check:*` green AND the existing `run-probe.ts` decompose path unaffected.
- `variance.test.ts` is the test template: `bun:test`, fabricated fixtures, no fs/addon.

## Open questions for Design

1. Where does signal/honest-empty classification live (pure core vs impure harness)? (leaning b)
2. Single-arm dispersion read vs reusing `varianceReduction` — confirm the single-arm shape.
3. How far to generalize seeding now — all five plays, or the core + decompose/survey first
   (the two with the cleanest fixed inputs) with a documented extension seam?
4. New module placement: `src/probe/consistency.ts` (pure) + `run-consistency-probe.ts` (impure),
   alongside the existing `variance.ts` / `run-probe.ts`.
