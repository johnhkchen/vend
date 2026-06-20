# Research — T-022-02: consistency-contract-and-fork

Descriptive map of what exists for synthesizing E-022's **consistency contract**. This
ticket builds no new mechanism; it runs the T-022-01 judge as a bounded sweep and
*decides* what consistency Vend promises. So the relevant material is: the diagnosis
instrument (T-022-01), the dispersion evidence already on the board (E-019/E-020), the
two documents the contract lands in (`information-architecture.md`, `demand.md`), and the
vision text the contract has to be faithful to.

## The instrument the sweep runs (T-022-01, commit `8edb71f`)

Three files under `src/probe/`, all additive (the consistency-probe path is byte-for-byte
unchanged — confirmed in T-022-01's review):

- **`equivalence.ts`** — the PURE core. `classifyEquivalence(verdicts, n)` folds per-pair
  `{ i, j, equivalent }` verdicts into an `EquivalenceReport`:
  - classes `EQUIVALENCE_CLASSES = ["equivalent-diversity", "genuine-disagreement", "mixed"]`.
  - score `e / P` where `P = n·(n−1)/2` is the **expected** pair count (NOT
    `verdicts.length`) — a short judge reply lowers the score; missing evidence is not
    agreement (the IA-8 honesty decision).
  - classification: full equivalent coverage ⇒ `equivalent-diversity`; zero equivalent ⇒
    `genuine-disagreement`; anything partial (incl. under-coverage) ⇒ `mixed`; `n<2` ⇒
    vacuous `equivalent-diversity`, caveated by the formatter.
  - `formatEquivalenceReport` emits one honest line with `⚠` caveats for vacuous reads
    and short judge replies. 12 pure unit tests cover every branch.
- **`run-equivalence-judge.ts`** — the IMPURE harness. `bun run
  src/probe/run-equivalence-judge.ts <play> [fragment.md] [N] [tokenBudget]`. It seeds a
  disposable temp root (`mkdtemp` → `lisa init`), copies the live charter + board in,
  casts the play N× collecting each `pm/staged` output (exactly the consistency probe's
  sweep), prints `formatConsistencyReport(...)` (the dispersion number), then casts a
  **judge** over the SIGNAL outputs via the `dispense` seam, parses per-pair verdicts
  (`parseVerdicts`, tolerant — drops malformed/out-of-range/duplicate-pair entries), and
  prints `formatEquivalenceReport(...)` **beside** the dispersion (AC#2 of T-022-01).
- **`equivalence.test.ts`** — the 12-case pure test. Not relevant to run, only to the
  "extend, don't break" invariant.

Supported plays: `survey`, `expand`, `steer` (decompose is out of scope — it's the
gated-vs-ungated probe's subject). Per-cast budgets default to each play's real
recalibrated budget (expand 250k / survey 300k / steer 400k); `tokenBudget` overrides.

**Two invariants inherited from `run-consistency-probe.ts`:** no ledger pollution (every
cast's `runLogPath` is inside the temp root) and no collision (output dirs cleared before
each cast). The judge cast only reads.

## The dispersion evidence the judge interprets (E-019 → E-020)

`docs/active/work/T-019-02/findings.md` (the E-019 sweep, N=3 × 3 plays, gates ON, fixed
grounded inputs) plus E-020's proof give the **line-set Jaccard dispersion** the
equivalence judge adds a meaning axis to:

| Play | Run-to-run dispersion | Source / note |
|---|---|---|
| **expand** | **0.50** | over 2 signals (E-019); fragment `fixtures/grounded-fragment.txt` |
| **survey** | **0.69** | became *measurable* only after E-020 stopped its over-abstention (`demand.md:77`) |
| **steer** | **0.72** | highest; outcome-stable (0% honest-empty) but content-unstable |

Key facts that constrain the contract:
- **The validity axis is the gates' job and is separately measured.** E-014 found gates
  cut decompose variance ~21% (0.62→0.49) and the honest-empty over-fire was *eliminated*
  in E-020 (expand 33%→0%, survey 67%→0%). So the **honest-empty / grounding** half is
  closed; what remains is purely the **lexical/content dispersion** of *valid* outputs.
- **Dispersion ≠ defect.** Jaccard tells us the outputs *differ*; it cannot say whether
  the difference *matters*. That gap is exactly what the equivalence judge fills and what
  the contract must rule on. (`equivalence.ts` header; E-022 intent.)
- E-019's own verdict left this open: steer's row literally says *"strengthen the steer
  consistency gate **(or accept divergence as by-design and say so)**"* — the fork this
  ticket resolves.

## Where the contract lands

- **`docs/knowledge/information-architecture.md`** — 16 settled principles (IA-1…IA-16) +
  an Index + an Open-threads section. Small/slow/capped by design; "fix one, never drift."
  Style: each principle is a bold `**IA-N — <claim>.**` lead, a paragraph of rationale,
  often tied to a charter principle (P3 = gates are the contract) and the TPS/MTG lenses.
  IA-8 ("the meter must not lie about its two denominations") and IA-10 ("two success
  states") are the closest existing neighbors — both are *honesty-about-what-we-promise*
  principles, which is exactly the contract's shape. **The new principle slots as IA-17**
  and must be added to the Index line and (if it opens nothing) not to Open-threads.
- **`docs/active/demand.md`** — the ranked board. Row 77 is the live **E-022** signal
  ("Articulation signal dispersion unbounded … active → E-022"). The "bridge" (per the
  ticket cite): a **converge** verdict for any play becomes a *downstream* demand signal
  (the convergence lever), and the E-022 row's Status updates to record the contract +
  the fork outcome. Staged-signal row shape lives in `docs/active/pm/staged/`.

## The vision text the contract must honor

`docs/knowledge/vision.md` §"The deeper promise: consistency" (lines 64–73):
> "Vend sells *repeatability over a process that is natively unrepeatable*. Agent work is
> probabilistic; the same prompt does not give you the same result twice. … the gates are
> the contract that converts a probabilistic process into a dependable product."

This is the load-bearing constraint: the contract cannot promise *lexical* identity (the
vision concedes "not the same result twice") — so "consistency" must be defined as
**gated validity**, with lexical divergence ruled either acceptable diversity or a defect
per play. The contract names *what the repeatability is over*.

## Constraints & assumptions surfaced

- **Cost discipline (E-022 + AC#4).** N≈3, bounded, logged; "directional, not proof" (the
  E-014 honest-sample discipline). No silent caps (IA-8).
- **The live judge sweep is the human step.** E-022's decomposition states this verbatim:
  *"T-022-02 (… the surfaced human fork; **the live judge sweep is the human step**)."* A
  full sweep is 9 play casts (250–400k tokens each) + 3 judge casts — a ~30-min,
  credit-spending, non-deterministic operation explicitly carved out as human, and exactly
  the hard-to-reverse outward action that warrants a human gesture. T-022-01's review
  independently flagged the harness as unproven end-to-end and not in CI. **Assumption
  carried into Design:** the agent prepares the protocol + the recommendation-first
  synthesis from existing evidence; the human runs the sweep to confirm/refute.
- **No code changes expected.** The deliverables are docs (a findings note + an IA
  principle + a demand.md bridge). `bun run check:*` is green at baseline (743 tests,
  T-022-01) and must stay green — a doc-only change cannot regress it, but Review verifies.
- **Recommendation-first (IA-1 / IA-5 / E-018 fork-genuineness).** The fork is the human's
  call; ours is the evidence + a recommendation. The contract must not auto-decide
  "converge" — it offers, with the lever named but unbuilt.
