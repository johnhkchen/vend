# T-013-02 — Design

*Options, tradeoffs, decisions with rationale — grounded in the research, not
assumptions. What was rejected and why.*

Five decisions: **(A)** where the module lives, **(B)** the `recalibrate` signature and
return shape, **(C)** the percentile method, **(D)** censoring & windowing semantics,
**(E)** the surface.

---

## Decision A — a new `src/ledger/` module, not a method on an existing one

### The question
`recalibrate` needs `RunRecord` (from `src/log/`) **and** `Budget` (from `src/budget/`).
Those two are deliberately decoupled (research §"the Budget this returns"). Where does
the consumer live without regressing that?

### Options
1. **Add it to `run-log.ts`.** Rejected — would force `run-log.ts` to import `Budget`
   (it returns one), breaking its stated zero-coupling-to-`src/budget/` invariant
   (lines 19–24). The reader was carefully built to stop *exactly* at filtering.
2. **Add it to `budget.ts`.** Rejected — `budget.ts` imports nothing and is the purest
   leaf; importing `RunRecord` would weld it to the log. Budget is *composed*, never a
   collaborator (its own header says so).
3. **New module `src/ledger/recalibrate.ts`.** *Chosen.* A new node that depends **up**
   onto both leaves (`import type` only — erased), creating no cycle (neither leaf
   imports the ledger). Matches the IA's first-class noun ("The Ledger", IA-12..16) and
   gives the recalibration loop a home to grow into (T-013-03 bias-correction lands
   beside it).

**Chosen: a new `src/ledger/` directory.** Pure core + its test; the fs touch is the
existing `loadRunLog`, reused — no new impure verb in this module at all.

---

## Decision B — `recalibrate(play, records, tier, prior)` → `RecalibrateResult`

### Signature
```ts
recalibrate(
  play: string,
  records: readonly RunRecord[],
  tier: ValueTier,
  prior: Budget,
  opts?: { readonly minSuccesses?: number; readonly window?: number },
): RecalibrateResult
```

**Why `prior` is an explicit parameter, not imported.** The ticket sketches
`recalibrate(play, records, tier)`, but the cold-start fallback needs the hand prior,
which lives in `gather.ts`'s `TIER_BUDGET`. Two ways to get it:

- *Import `budgetForTier`* — rejected. `gather.ts` transitively pulls the whole shelf
  (menu, select, stateHash); importing it into the pure ledger core drags that weight in
  and couples calibration to the browse subsystem. It would also duplicate budget policy
  ownership.
- *Pass it in* — **chosen.** The Ledger computes percentiles from data; it does **not**
  redefine budget policy. The caller (the surface) owns the prior source and hands
  `budgetForTier(tier)`. The pure core then imports **only types** (`RunRecord`,
  `Budget`, `ValueTier`), all erased — the cleanest possible dependency footprint, and
  it stays trivially fixturable (a literal prior in tests).

### Return shape
```ts
interface Confidence {
  readonly successes: number;   // N successful runs in the window → the percentile sample
  readonly censored: number;    // andon'd-at-envelope runs (budget-exhausted | timed-out)
  readonly percentile: number;  // the tier percentile used, e.g. 0.95
}
interface RecalibrateResult {
  readonly envelope: Budget;                 // measured, or the prior on cold start
  readonly confidence: Confidence;
  readonly source: "measured" | "prior";     // "prior" ⇒ cold-start fallback fired
}
```
The AC requires `{ envelope, confidence: { successes, censored } }`; we **extend**
`confidence` with `percentile` and add a top-level `source` discriminant so the surface
can render an honest label ("measured · N casts · p95" vs "estimate (no data)") without
re-deriving anything. Extending a contract with additive fields is the house idiom (cf.
the optional `envelope` field T-013-01 added).

---

## Decision C — exact percentile by **nearest-rank (ceil)**, conservative

### The question
"Exact percentile over the windowed records — NOT t-digest." Exact = computed from the
real sample, not a sketch. Two exact methods:

1. **Linear interpolation (type-7, NumPy/R default).** Smooth; interpolates between the
   two ranks bracketing `p·(n−1)`.
2. **Nearest-rank, ceil:** `index = ceil(p · n) − 1`, clamped to `[0, n−1]`, over the
   ascending sort. *Chosen.*

### Why nearest-rank
- **Conservative on small N** — the regime we live in (cold-ish logs). For p95 of n=10,
  ceil(9.5)−1 = 9 → the **max** observed. Interpolation would return something *below*
  the max, under-bounding a fat tail we have barely sampled. The whole point (IA-13) is
  to **bound the tail**, and the andon budget already *caps how much tail we can ever
  see* — so erring high is correct.
- **Standard for SLO percentiles** (the SRE framing in IA-12). p95 latency = "the value
  the 95th-percentile request is at or below," nearest-rank.
- **Trivially exact and total** — one sort, one index, no interpolation arithmetic to
  get subtly wrong on ties or n=1.

`percentile(sortedAsc, p)` is its own tiny exported pure function so it is unit-tested
in isolation (n=1, exact boundaries, p=0/1).

---

## Decision D — censoring & windowing semantics

### Censored set (IA-13)
- **Percentile sample** = `success` runs only (what *finishing* costs).
- **Censored count** = `budget-exhausted` + `timed-out` (right-censored at the
  envelope: their true cost is `≥ envelope`, never observed). These are **excluded** from
  the sample but **counted** in `confidence.censored` — the andon-rate signal (IA-15).
- `gate-failed` / `id-collision` are **neither**: not a finishing-cost observation, not
  an envelope censoring. They fall out of both — a refusal isn't a cost data point.

### Windowing (IA-13 "weight recent runs more")
The minimal honest form is a **recency window**: take the **last `window` records** of
the play's filtered list (the ledger is append-ordered, so the tail is most recent),
*then* split into successes/censored within that window. Default `window = 100`.

- Rejected: exponential time-decay weighting. That is drift *actuation* (IA-14) — a
  later rung. A hard window is the smaller real thing and keeps the percentile exact.
- Windowing the whole play list (not just successes) keeps the censored *rate*
  reflective of the same recent window — successes and andons measured over one horizon.

### Independent dimensions (AC)
Two separate samples from the same success set:
- `tokens` = `totalTokens(r)` for every success → sorted → percentile.
- `time` = `wallClockMs(r)` for every success **whose stamps parse** (`null` dropped) →
  sorted → percentile. So the time sample may be smaller than the token sample; that is
  correct, not a bug. If the time sample is empty (all `null`), the time dimension falls
  back to `prior.timeMs` while tokens may still be measured.

### Cold start
`successes < minSuccesses` (default **3** — "a handful") ⇒ return the **prior** verbatim
as the envelope, `source: "prior"`. Confidence still reports the real `successes` /
`censored` so the label can say "estimate (N casts)". The threshold is an `opts` field so
a stricter caller can demand more.

### Valid-budget guarantee
Each emitted dimension is `Math.max(1, Math.ceil(value))` — positive integer, satisfying
`assertPositiveInt` downstream. Ceil (not round) keeps the bound conservative. A measured
envelope *below* the prior is allowed (legitimate tightening) — this slice only
*computes*; it does not actuate (no deadband/hysteresis — IA-14).

---

## Decision E — the surface: a read-only `vend envelope <play>` command

### The question
"A surface (CLI flag/output and/or the Confirm default) shows the measured envelope
labelled with confidence." The Confirm screen does not exist yet (TUI epic).

### Options
1. **Wire measured envelopes into the press dispatch default** (press loads the log,
   `planRuns` uses measured instead of `action.budget`). Rejected for this slice —
   silently changing the budget a real cast dispatches under is **actuation**, exactly
   the move IA-14 guards with deadband + asymmetric hysteresis (a later rung). The ticket
   says this slice "does not yet auto-tune or act on it." Acting on it here would be
   premature and risky.
2. **A read-only `vend envelope <play> [--tier <t>]` command** that loads the ledger,
   recalibrates, and **prints** the proposed envelope + honest label. *Chosen.* It
   *displays* the measured default without actuating it — the honest, non-flapping
   surface this rung calls for, and the literal "live check" the ticket describes ("cast
   a play, see its envelope proposed from history").

`--tier` defaults to `standard` (p90 — the neutral middle); the prior is
`budgetForTier(tier)`. A pure `formatEnvelopeLabel(result)` does the label string
(tested); the dispatch arm is the thin untested shell (loadRunLog → recalibrate →
print), mirroring every other arm in `cli.ts`.

---

## What this design deliberately defers

- **Actuation** into the live dispatch default — IA-14 (deadband, auto-widen,
  slow-tighten). Display only here.
- **Bias-correction** (estimated-vs-actual ratio, hierarchical pooling) — T-013-03 /
  IA-16, lands beside this in `src/ledger/`.
- **Uncensored probe casts** to de-bias the tail — IA-13 mechanism, later.
- **t-digest** streaming quantiles — a scale optimization; exact is correct until the
  log is large.
