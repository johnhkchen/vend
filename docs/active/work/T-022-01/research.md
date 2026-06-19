# T-022-01 — Research: semantic-equivalence-judge

Map of the codebase as it bears on extending E-019's consistency probe with a
semantic-equivalence judge (R12 — over the same harness). Descriptive only.

## The ticket in one line

The line-set Jaccard dispersion (`./variance.ts`) tells us a play's N outputs on a
fixed input *differ*; it cannot tell us whether the difference *matters*. This ticket
adds a judge that classifies a play's divergent outputs as **equivalent-diversity**
(same intent / proposed work, worded differently) vs **genuine-disagreement** (they
propose *different* things) — beside the existing dispersion number. Split per the
house pattern: a **pure aggregation core** (unit-tested) + an **impure judge harness**
(not unit-tested, like `run-consistency-probe.ts`).

## The probe family (where this slots in)

`src/probe/` already holds three generations of the same pure-core ↔ impure-harness
split, each the precedent for the next:

| Pure core (unit-tested) | Impure harness (not tested) | What it measures |
|---|---|---|
| `variance.ts` (T-014-02) | `run-probe.ts` | gated-vs-ungated variance reduction (decompose) |
| `consistency.ts` (T-019-01) | `run-consistency-probe.ts` | run-to-run dispersion + outcome mix (any play) |
| `rubric.ts` (T-021-09) | `run-rubric-probe.ts` | "good enough" scorecard over a designer render |

This ticket adds a fourth pair: an **equivalence aggregation core** + an **equivalence
judge harness**. The judge sits *beside* `consistency.ts`'s dispersion — it consumes
the same N collected outputs and answers the question dispersion cannot.

## The pure core to mirror — `consistency.ts`

The closest structural sibling. Key shapes (all PURE, no fs/clock/addon):

- `PROBE_OUTCOMES` = `["signal","honest-empty","budget-exhausted"]` — a closed `as const`
  vocabulary → derived union. The dimension/outcome-name idiom (`rubric.ts`'s
  `RUBRIC_DIMENSIONS` repeats it). **Our classification union will follow this.**
- `ProbeResult { outcome, output: string | null }` — one cast's classified result.
- `consistencyReport(results)` → `{ variance: SetDispersion, mix: OutcomeMix }`. It
  filters to `signal` outputs with non-null text, then `dispersion(...)`.
- `dispersion(outputs)` (from `variance.ts`) → `{ n, dispersion, pairs: PairDiff[] }`.
  `PairDiff { i, j, distance }` is the **per-unordered-pair** model — directly the shape
  our per-pair equivalence verdict mirrors (`{ i, j, equivalent }` instead of a distance).
- Zero-safety discipline everywhere: `n < 2 ⇒ dispersion 0` (never NaN); rates defined
  as 0 on an empty set; `formatConsistencyReport` appends a `⚠` caveat when the signal arm
  is too small to disperse. **The judge core must keep this honesty (IA-8): a vacuous
  classification on < 2 outputs must read truthfully, not as a clean win.**

`consistency.ts` line 16-20 is explicit that **classification is NOT in the pure core**
because "signal vs abstention" is play-specific. Our judge is a *different* axis
(equivalence vs disagreement *among the signals*), and its raw verdicts come from a model
cast — so the same boundary holds: the impure harness produces verdicts, the pure core
only aggregates them into a classification + score.

## The harness to extend — `run-consistency-probe.ts`

The instrument that already collects the N outputs we need. Relevant machinery:

- `ProbeTarget` interface (line 68): `play`, `seed(root, srcInputPath?)`,
  `assemble(root)`, `subject(root)`, `outputDirs`, `isAbstention(output)`. One per play.
- Target builders: `decomposeTarget`, `surveyTarget`, `surveyThinTarget`, `expandTarget`,
  `steerTarget` + `resolveTarget(name, input)` switch and `SUPPORTED` list. The ticket
  scopes the judge to **expand / survey / steer** (the articulation plays).
- Temp-ledger + seeding helpers (the no-pollution / no-collision invariants):
  `seedTempRoot()` (mkdtemp + `lisa init`), `seedCharter`, `seedBoardSnapshot`,
  `collectOutput(root, outputDirs)` → concatenated `*.md` or `null`, `castN(...)` casts
  N× clearing output dirs each time and threads `runLogPath` into the temp root.
- House idiom (line 25-27, repeated from `run-probe.ts`): probe instruments **COPY**
  their seeding helpers rather than import, so each stays a self-contained instrument and
  the cited files stay byte-for-byte unchanged. `run-consistency-probe.ts` copied from
  `run-probe.ts`; this ticket can copy from `run-consistency-probe.ts` the same way.
- `castN` already returns `ProbeResult[]` (with `.output` text). The judge needs the
  **signal** outputs — exactly what `consistencyReport` already filters to.

## The dispense seam (the judge's casting mechanism)

`src/executor/claude.ts`:
- `dispense({ prompt, model?, effort?, system?, maxTurns?, onMessage?, timeoutMs? })` →
  `ResultMessage` with `.result?: string` (the model's reply text), `.usage`, `.model`,
  `.num_turns`. LIVE + metered; text path only (no schema-enforced output). This is "the
  dispense seam" the ticket says to reuse — the judge prompts the model and reads
  `.result`. No materialization, so the judge needs no Play/effect.
- `src/engine/cast.ts` `castPlay(...)` is the full play cast (render→dispense→gates→effect→
  log). The judge does NOT fit the Play contract (it has no parse/gates/effect/materialize),
  so casting it through `castPlay` would be a poor fit; the harness calls `dispense`
  directly under a wall-clock + token budget (`timeoutMsFor(budget)`), the same primitive
  `castPlay` composes. `Budget { timeMs, tokens }` from `src/budget/budget.ts`.

## Test + check conventions

- `bun test` (731 pass at baseline). Pure cores get an ordinary pure-function test over
  fabricated fixtures (`consistency.test.ts` builds `ProbeResult[]` by hand; no fs/addon).
- `bun run check` = `baml:gen → check:typecheck (tsc --noEmit) → check:test`. There are
  also `check:committed` / `check:head` CI gates. The ticket's `bun run check:*` green
  means typecheck + tests must pass; the new harness must typecheck even though it is not
  unit-tested.
- BAML caveat (`note-bridge.ts`): the native addon allows ONE native call per `bun test`
  process, so pure tests never touch BAML. Our judge uses `dispense` (free text), not a
  BAML function — so no addon constraint and no new `.baml` file is required.

## Constraints / assumptions surfaced

- **Extend, don't break (AC#3).** `run-consistency-probe.ts` and the cited cores must keep
  their existing path unaffected. The lowest-risk shape is *additive*: new files only.
- **Pure core takes verdicts, not raw text.** The model judgment (does pair (i,j) mean the
  same thing) is impure/non-deterministic; the unit-tested core must receive already-formed
  verdicts so its test is deterministic — exactly `consistency.ts`'s "harness classifies,
  core tallies" split.
- **Three fixtures named by AC#1**: all-equivalent → diversity; all-different →
  disagreement; a mix → mixed. These map cleanly onto a per-pair `equivalent: boolean`
  tally with a three-way classification.
- **Honesty caveat for < 2 outputs**: fewer than two signal outputs ⇒ zero pairs ⇒ the
  classification is vacuous and must carry a caveat (the `consistency.ts` n<2 precedent).
- **No real-log pollution**: the judge reuses the disposable-temp-root discipline; it is a
  read-only consumer of already-collected outputs, so it writes nothing of its own.
