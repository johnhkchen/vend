# T-052-02 — Graph cast log (the settlement)

The honest read of the **LIVE** cast of `survey → [propose ×2] → capture-note` through the
wallet-threaded `castRealPlayGraph` (T-052-01). This closes the single property the
E-046/E-047/E-048 substrate carried **stub-proven only**: the 2-upstream JOIN running end-to-end on
REAL upstreams under ONE shared wallet. **It is now proven LIVE.**

This was a **metered, multi-run** proof. Four real casts were run (E052-01…04, each against a fresh
gitignored sandbox = a copy of the vend board under `.vend/live-proof/`). Runs 01–03 surfaced a real,
previously-undocumented distinction; **run 04 is the clean end-to-end proof**. Every number below is
quoted verbatim from `cast-result-0N.json` (the dumped `GraphResult`) and `.vend/runs.jsonl`.

## The headline (run 04, E052-04) — the JOIN ran end-to-end → **PROVEN LIVE**

All four nodes `success`; `skipped: []`; `halted: false`; the sink materialized.

| node | outcome | materialized | produced | wall |
|---|---|---|---|---|
| survey | success | ✓ | `…/E052-04/docs/active/pm/staged/survey-board.md` | 16:58:53.632 → 17:00:16.971 (83.3 s) |
| propose-1 | success | ✓ | **`…/epic/E-054.md`** | 17:00:16.974 → 17:01:20.805 (63.8 s) |
| propose-2 | success | ✓ | **`…/epic/E-053.md`** | 17:00:16.974 → 17:01:34.092 (77.1 s) |
| **capture-note** | **success** | **✓** | **`…/notes/e-053-…-e-054-…-two-embodiment-epics-on-one-engine.md`** | 17:01:34.093 → 17:02:53.776 (79.7 s) |

This is the exact inversion of T-047-02's Read 2 ("the join did NOT run live"). Here `capture-note` is
in `nodes` (not `skipped`), its outcome is `success`, `materialized: true`, and it is the graph's sink
(`produced` carries its note path). The metered cast did what only `castGraph` (not `castChain`) can.

---

## Read 1 — Concurrency held → **PROVEN** (re-confirmed under the shared wallet)

The two proposes (run 04) share an **identical `startedAt 17:00:16.974`** and one `runId`
(`run-2026-06-21T17-00-16-974Z`) — one wave, dispatched together by `runGraphConcurrent`'s
`Promise.all` the instant survey produced the board:

```
survey     16:58:53.632 ████████████████ 17:00:16.971
                                          ↓ 3 ms (the fan-out barrier — a real DAG edge)
propose-1  17:00:16.974 ███████████ 17:01:20.805            (success → E-054, 63.8 s)
propose-2  17:00:16.974 ██████████████ 17:01:34.092         (success → E-053, 77.1 s)
                        └──── both alive concurrently 63.8 s ────┘
                                          ↓ join barrier
capture-note 17:01:34.093 ██████████████ 17:02:53.776       (success → note, 79.7 s)
```

Both proposes are alive simultaneously for **63.8 s** (until propose-1 ends). Sequential would have
cost `63.8 + 77.1 = 140.9 s` of propose wall; the concurrent wave cost `77.1 s` (the MAX) — **~64 s
saved**, which *is* the concurrency. The survey→propose edge (3 ms gap) and the propose→note edge are
the real sequential DAG barriers. Two REAL `claude -p` casts overlapping in wall-clock — the thing the
linear chain structurally cannot show.

---

## Read 2 — The JOIN received BOTH upstreams → **PROVEN LIVE** (the new headline)

`capture-note`'s `adapt` received a **2-entry `NodeUpstreams` map** — `{propose-1: E-054 path,
propose-2: E-053 path}` — and consolidated both. Three independent pieces of live evidence:

1. **Both proposes produced epic paths** that reached the join (run 04): propose-1 → `E-054.md`,
   propose-2 → `E-053.md`, both `materialized: true`. `epicPathsFrom(upstreams)` therefore returned
   **two** non-empty paths (graph-real-play.ts:131–132).
2. **The note names both epics.** Its first line: *"# E-053 (TUI run surface) + E-054 (open-model
   runner): two embodiment epics on one engine"*, and the body compares their shared demand, overlap,
   and clearing order — exactly `buildConsolidationTopic`'s two-epic branch (core:108–111). A
   one-or-zero-upstream join would have produced the degraded single/none topic; it did not.
3. **`skipped` is empty and `halted` is false** — the join was not gated out; it was cast and ran.

This is the property that, before this ticket, existed only in `graph-real-play-core.test.ts`'s pure
`runGraph` stub. It is now a live fact. (Notably, the note **honestly flags itself**: "these IDs are
sandbox proposals, NOT minted into the real tree … the proposer reused E-053/E-054 for different epics
across the four proof runs" — the cast's own output corroborates the containment design.)

---

## Read 3 — ONE shared envelope bounded the spend → **PROVEN** (E-052's actual fix)

`castRealPlayGraph` allocated **one** `Wallet` and passed it as `castGraph`'s third arg;
`walletRemaining` is **present** on every run (the wallet path was taken, not the legacy no-wallet
path). Run 04:

- **funded** `4,200,000 tok / 6,600,000 ms` (≡ `realPlayMacro` over the run-04 provisioned per-cast
  budgets — see §"the budget story");
- **spent** `473,338 tok / 240,140 ms` = `funded − walletRemaining`, the **collective** draw off the
  ONE envelope (`survey + propose-1 + propose-2 + capture-note`), **not** a per-branch tally;
- **remaining** `3,726,662 tok`.

The wave dispatcher authorized each ready-set against the single live wallet and debited after settle
(tokens SUM, wall-clock MAX). The cross-branch leak E-052 closed **did not recur**: at no point did
two concurrent branches each pass `canAfford` against a stale pre-wave balance. This is the budget
invariant the product rests on, observed live.

---

## The budget story across the four runs (the honest journey — and a real finding)

The clean run 04 was reached only after runs 01–03 surfaced a distinction worth recording: **there are
two budget layers, and E-052 only governs one of them.**

| run | funded | spent | result | what it taught |
|---|---|---|---|---|
| **01** | 1.216M | 594,635 | propose-2 `budget-exhausted` (323,626 / **150,000** per-cast) → join **skipped** | The **shared wallet worked** (594k drawn off one envelope, 621k left, no leak) — yet the join still skipped, because propose-2 hit its **per-CAST** ceiling (`PlayNode.budget`), a layer the macro wallet does not widen. The E-047 failure mode, re-located. |
| **02** | 1.720M | 432,544 | all proposes ✓ (E-053+E-054); **capture-note CAST, received both** (`skipped: []`); note `budget-exhausted` (≈161k / **120k**) → note effect not materialized | The **JOIN ran and received both upstreams** — the headline property — but the note's own per-cast budget (default **8k**) is far too small to fund a real note cast. |
| **03** | 2.000M | 975,544 | propose-2 `budget-exhausted` (≈697k / 600k; `cache_read` ballooned to **634,925**) → join skipped | A propose's `cache_read` swings **wildly** run-to-run (42k → 323k → 635k). A per-cast ceiling sized to one run starves the next. |
| **04** | 4.200M | 473,338 | **all four ✓, note materialized** → join end-to-end | Generous per-cast headroom absorbs the variance; the join closes cleanly. |

**The finding (worth carrying forward):** E-052's shared wallet is the **wave-level** envelope
(authorize/debit across the fan-out). It is orthogonal to each node's **per-cast** `budget` (the
in-flight andon ceiling the individual `claude -p` stops itself at). Widening the macro does **not**
widen a per-cast ceiling. Proving the live join therefore required provisioning BOTH: one shared
envelope (E-052) **and** per-cast budgets large enough to absorb real (variable) burn — most acutely
the note, whose 8k default cannot fund a real cast. The per-node defaults are honest *predictions*;
the live proof needed them widened to the *observed* burn. (Not a defect in E-052 — a calibration note
on the play budgets; candidate downstream demand.)

---

## Read 4 — P7 + the verdict

**P7 (bounded + clean): HELD at both layers.** Every run's spend was bounded and the bounds *enforced*:
the per-cast andon fired exactly when a cast overran its ceiling (runs 01/02/03), and the shared wallet
bounded the wave (it never leaked across branches). The bounds *stopped* overruns rather than letting
them run away — the gate is the contract; it held, loudly, every time.

**This was a LIVE METERED cast, not a free deterministic proof.** ~14 real `claude -p` casts across
four runs (survey + 2 proposes + note per clean run; note skipped on degraded runs), **2,476,061
tokens total**. The headline run 04 alone is **4 real casts**. This is categorically distinct from the
free, addon-free `graph-real-play-core.test.ts` proof (which stubs the casts and asserts the wiring) —
real model spend, real minted artifacts, real concurrency, real andons.

> **Verdict (no over/under-claim).** The wallet-threaded `castRealPlayGraph` cast the diamond LIVE and
> proved, end-to-end, the last stub-only property of the substrate: the **2-upstream JOIN runs on REAL
> upstreams** — `capture-note` was cast (not skipped), received both proposes' produced epic paths
> (E-053 + E-054), and **materialized** a note consolidating both — while **concurrency held** (two
> real casts overlapping ~64 s) and **one shared wallet bounded the collective spend** with no
> per-branch leak. It took four metered runs: the shared wallet (E-052's fix) worked from run 01, but
> the live join also needed per-CAST budgets sized to real, variable burn — a calibration distinction
> the runs surfaced honestly. The substrate (E-046 typed DAG · E-047 live concurrency · E-048 shared
> wallet) is now proven LIVE in full. Modest in composition (`survey → propose → note` is still a thin
> playbook), but no longer stub-gated: the JOIN is real.

## AC checklist

- [x] **capture-note materialized (not skipped)** — run 04: `nodes` has `capture-note`, `outcome:
      success`, `materialized: true`, `skipped: []`, `halted: false`.
- [x] **2-entry NodeUpstreams from BOTH proposes' produced epic paths** — both proposes produced
      `E-053`/`E-054`; the note consolidates both by name (Read 2).
- [x] **two propose casts overlapped in time** — identical `startedAt 17:00:16.974`, shared `runId`,
      63.8 s concurrent (Read 1).
- [x] **total spend bounded by the single shared wallet (one envelope, not per-branch leak)** —
      `walletRemaining` present; spent `473,338 tok` = `funded − remaining` off ONE wallet (Read 3).
- [x] **verdict labels it a live metered cast (≈4 real `claude -p`), distinct from a free proof** —
      Read 4 (4 casts/clean run; 2.48M tokens across 4 runs).
- [x] Baseline gate green, no `src/` change (see `progress.md` / `review.md`); all mutation contained
      to gitignored `.vend/live-proof/` sandboxes.
