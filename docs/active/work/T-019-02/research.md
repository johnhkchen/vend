# T-019-02 — Research: run the sweep and produce findings

Descriptive map of what exists for running the consistency probe on **expand / survey / steer**
and synthesizing a findings note + verdict. No solutions here — those are `design.md`.

## What this ticket inherits (T-019-01, committed `f8146f5`)

The any-play consistency probe shipped as two siblings of the decompose-only pair:

- **`src/probe/consistency.ts`** — PURE core. `ProbeOutcome = signal | honest-empty |
  budget-exhausted`; `ProbeResult { outcome, output }`; `outcomeMix` (counts + rates over ALL
  casts); `consistencyReport` (disperses the **signal arm only**, reusing `variance.ts`'s
  `dispersion`); `formatConsistencyReport` (one honest line, caveats `signal.n < 2`). Unit-tested
  (10/10 in `consistency.test.ts`).
- **`src/probe/run-consistency-probe.ts`** — IMPURE sweep harness. Resolves a play by name, seeds
  a disposable temp project (`mkdtemp` → `lisa init` → per-play `seed`), casts N× on a fixed input
  into a temp ledger, classifies each cast, prints the report + a **raw `RunOutcome` tally**. NOT
  unit-tested (house rule for impure verbs). CLI: `<play-name> [input.md] [N] [tokenBudget]`.

The harness's `ProbeTarget` table is the extension seam (design D5): **first cut covers
`decompose-epic` + survey only** — `SUPPORTED = ["decompose-epic", "survey"]`. Adding a play is
"add one `ProbeTarget` entry + a `resolveTarget` case + a value-import so it self-registers." The
two invariants are inherited from `run-probe.ts`: **no ledger pollution** (`runLogPath` → temp
root) and **no collision** (clear `outputDirs` before each cast so a fresh board materializes).

## The three target plays (go-and-see, `src/play/`)

| field | expand | survey | steer |
|---|---|---|---|
| const / `.name` | `expandFragmentPlay` / `"expand-fragment"` | `surveyPlay` / `"survey"` | `steerProjectPlay` / `"steer"` |
| budget (recalibrated 2026-06-19) | `{1_200_000ms, 250_000tok}` | `{1_800_000ms, 300_000tok}` | `{2_400_000ms, 400_000tok}` |
| assemble verb | `assembleExpandFragmentInputs(opts)` | `assembleSurveyInputs(opts)` | `assembleSteerInputs(opts)` |
| opts requires | `fragment` + `budget` | `budget` | `budget` |
| budget used by assembler? | no (threaded to `castPlay`) | no | no |
| writes to | `docs/active/pm/staged/<slug(what)>.md` | `…/staged/survey-board.md` | `…/staged/steer.md` |
| outputDirs | `["docs/active/pm/staged"]` | same | same |
| empty behavior | **STOP** (gate-failed, nothing written) | **CLEAR + marker** | **CLEAR + marker** |
| abstention marker | _(none — STOP)_ | `# Survey — no demand staged` / `honest empty board` | `# Steer — nothing to stage` / `honest empty steer` |
| fixed input | charter + stories/tickets ids; **fragment is a string arg** | charter + stories/tickets snapshot | charter + stories/tickets snapshot |

All three: `card.color = ["blue","green"]`, write to the same `STAGING_DIR =
docs/active/pm/staged`, charter read from `CHARTER_PATH = docs/knowledge/charter.md`. Registry:
`src/engine/play.ts` — `AnyPlay = Play<any,any>`; each play self-registers at module load, so the
harness must **value-import** `expandFragmentPlay` / `steerProjectPlay` (it already imports
`surveyPlay`, `decomposeEpicPlay`) for them to resolve and for their assemble verbs to be callable.

## The central tension — honest-empty polarity is split (the D3 divergence)

The probe's `classifyRun` is: `outcome !== "success" → budget-exhausted`; else
`isAbstention(output) ? honest-empty : signal`. This means:

- **survey / steer** abstain by CLEARING and materializing a marker note — a `success` outcome
  whose output contains the marker substring. Their `isAbstention` keys on that marker, so their
  **honest-empty rate is read directly off the probe mix.** ✓
- **expand / decompose** abstain by STOPPING (the honest-empty gate fails → `gate-failed`, nothing
  materialized). That is **not** a `success`, so `classifyRun` folds it into **`budget-exhausted`**.
  Expand's honest-empty bucket is therefore structurally **always 0** in the mix; its honest
  abstentions hide inside `budget-exhausted`, separable only via the **raw `RunOutcome` tally**
  (`gate-failed N`) the harness prints beside the mix, plus the per-cast andon line `castPlay`
  emits naming the stopping gate. This is the IA-8 "no silent caps" discipline working as designed
  (the fold is surfaced, never silent) — but it means **expand's honest-empty / over-eagerness must
  be read from the raw tally, not the headline mix.** This is the single most important
  interpretation rule for the findings note.

## The prior this sweep tests (E-016 finding (2), `demand.md:71`)

> **(2) high run-to-run variance** — 3 casts on the same grounded fragment gave signal /
> budget-blow / honest-empty (the honest-empty looked over-eager; a consistency note, cf. E-014).

I.e. **3 casts of `expand` on ONE fixed grounded fragment → 3 different outcomes.** Restated in
`epic/E-019.md:37-39` and this ticket (`T-019-02.md:25`). The sweep's job: **confirm or refute**
this, extended to expand/survey/steer. E-019.md:42-43 fixes the reading: *"on a known-grounded
input, an honest-empty is a false negative"* — so on a grounded input the **honest-empty rate
directly measures how over-eagerly the abstention gate fires** (over-eager = abstains on real
demand). The verdict's tune target (E-019.md:62): *"do the gates (honest-empty / fork-genuineness)
or budgets need tuning?"*

## The findings-note shape to match (E-014, `work/T-014-03/findings.md`)

The cited model artifact, in order: **Title + framing blockquote → `## TL;DR — the decision`
(bolded verdict, "unmeasured is not weak") → `## The numbers` (one paragraph per arm, fenced
verbatim tool output) → `## The decision` (verdict + 3-branch rule table: signal-state → verdict
→ concrete next pull) → `## Honest about the sample` (small-N caveat) → `## How to produce the
numbers` (fenced sweep commands) → `## Citations`.** The honest-sample discipline: *"a directional
signal, not a proof… ≤5 casts… one fixed input… a directional steer from one honest user beats a
confident guess from none — but it is a steer."* And the verdict distinguishes **"not-yet-measured"
from "weak"** (does not trigger a reroute on absence of data alone).

## The bridge back to demand.md (the "tune the gates" branch)

`demand.md` signals are table rows: `| Signal | Value | Budget | Status |`. A "tune the gates"
verdict mints a **new row** (bolded what — em-dash why · value tier · ~budget · `ready (advances
[P3,…] · grounded in demand.md E-016 finding (2))`) plus a literal `vend chain "<what> — <why>"`
pull string — the staged-signal shape in `pm/staged/steer.md:11`. The E-019 row (`demand.md:74`)
is the row this verdict updates with a `Status (T-019-02): …` line.

## Cost reality (the bounded-sweep constraint)

A cast spawns a real `claude -p` agent (subscription auth, `src/executor/claude.ts`) — multi-turn,
heavy. At N=3 the ceiling is expand 3×250k + survey 3×300k + steer 3×400k ≈ **2.85M tokens** and
up to ~20/30/40 min wall-clock per cast. `lisa`, `claude`, `bun` are all on PATH; no
`ANTHROPIC_API_KEY` (subscription auth, as the seam documents). This is why the ticket fixes **N
small (3)** and AC#4 designates the full live sweep as **"the human verification at sweep"** —
the gate-green deliverable (harness + note) must stand independent of a completed 2.85M-token run.

## Constraints / assumptions

- `run-probe.ts` and `consistency.ts` stay untouched (extend only the harness's target table).
- N=3 (cost-aware; the ticket's explicit small N — directional, not proof; E-014 discipline).
- Expand needs a **fixed grounded fragment** authored as a fixture (the other two read the live
  board snapshot the harness already copies).
- The note must be honest about which arms were measured live vs. left for the at-sweep run, and
  must read expand's honest-empty from the raw tally, not the mix.
