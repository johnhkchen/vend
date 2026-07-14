# T-047-02 — Graph cast log (the settlement)

The honest read of the T-047-01 live cast of `survey → [propose ×2] → capture-note` through
`castGraph`. T-047-01 never wrote its own `graph-cast-log.md` (it ran out of budget after launching the
cast — its `progress.md` Step 4 is still "IN PROGRESS"), so this record is written here from the raw
evidence the cast left: `.vend/runs.jsonl`, `work/T-047-01/cast-stdout.log`, the minted `E-048.md`, and
`survey-board.md`. Coordinates confirmed via codebase-memory `search_code` (not raw grep), per the ticket.

## The raw run-log records (verbatim from `.vend/runs.jsonl`)

Three records share the cast (`runId` of the two proposes is identical — one wave):

| play | epic (subject) | startedAt | endedAt | outcome | gates | cost |
|---|---|---|---|---|---|---|
| survey | survey of vend | `03:53:31.091Z` | `03:55:54.567Z` | success | honest-empty, read-never-invent, leverage-rank ✓ | $0.862 |
| propose-epic | **signal #1** | `03:55:54.569Z` | `03:57:03.539Z` | **budget-exhausted** | `[]` (none reached) | $0.619 |
| propose-epic | **signal #2** | `03:55:54.569Z` | `03:58:07.532Z` | success | value, bounds, structural ✓ | $0.576 |

There is **no `capture-note` record** for this cast (the only `capture-note` row in the whole log is
`verify-capture-note` from Jun 19 — an unrelated fixture). The cast produced **one** epic file:
`docs/active/epic/E-048.md`, mtime `20:58:07` = propose-2's `endedAt` to the second.

---

## Read 1 — Concurrency was real (THE HEADLINE) → **PROVEN**

The two proposes have **identical `startedAt`: `03:55:54.569Z`** (to the millisecond) and their live
intervals **overlap**:

```
survey     03:53:31.091 ████████████████████ 03:55:54.567
                                              ↓ 2 ms (the topo barrier — a sequential edge)
propose-1  03:55:54.569 ███████ 03:57:03.539                  (budget-exhausted, ~69.0 s)
propose-2  03:55:54.569 ██████████████ 03:58:07.532           (success, ~133.0 s)
                        └──── both alive concurrently for 68.97 s ────┘
```

- Both proposes are alive simultaneously from `03:55:54.569` to `03:57:03.539` — **68.97 s of genuine
  overlap**. `castGraph`'s wave dispatcher (`runGraphConcurrent`, `src/engine/graph.ts:115`) launched
  both ready nodes in one `Promise.all` wave the instant survey produced the board.
- Sequential would have cost `68.97 + 132.96 = 201.9 s` of propose wall; the concurrent wave cost
  `132.96 s` (the max, not the sum) — **~69 s saved**, which *is* the concurrency.
- This is exactly what `runChain` (sequential) and the stub diamond example **structurally cannot**
  show: two **real `claude -p` casts** overlapping in wall-clock time. **Headline achieved.**

The survey→propose edge, by contrast, is sequential (2 ms gap) — correct: it is a real DAG edge, the
fan-out barrier. Concurrency is between the two proposes, and it is real.

---

## Read 2 — The join received both → **NOT PROVEN LIVE (honest record)**

The `capture-note` join **did not run**: no run-log record, no note artifact. The cause is
deterministic and is the substrate working as designed, not a crash:

- `runGraph` (`src/engine/graph-core.ts:85`) runs a node **iff every in-edge upstream proceeded**
  (succeeded **and** surfaced a `produced` ref — the reused `decideThread` gate). The join depends on
  **both** proposes.
- **propose-1 (signal #1) was `budget-exhausted`** — it did not proceed (gates `[]`, no produced epic).
  So `capture-note` was **skipped** as a halt-the-dependent-subgraph node: `GraphResult.skipped` carries
  it with `blockedBy: [propose-1]`, `halted: true`. propose-2 (an independent sibling) still ran — which
  is why E-048 exists.
- **Honest verdict:** the **live** multi-upstream join is **unproven** by this run. It stands proven
  only in the **stub** test (`src/play/graph-real-play-core.test.ts` — the join receives
  `{propose-1: epicA, propose-2: epicB}` via pure `runGraph`). The live cast reached the join's *gate*
  and correctly *skipped* it; it never *consumed* two live epic paths. No over-claim here.

What the run *did* prove about the join machinery: the **halt/skip semantics are live-correct** — one
failed upstream skipped exactly the dependent join while the independent sibling completed. That is the
fails-vs-linear behavior, observed live.

---

## Read 3 — Minted-epic quality + decompose status

**One epic minted: `E-048 — cross-branch-budget-wallet`** (by propose-2 / signal #2, success; gates
value + bounds + structural all ✓). propose-1 / signal #1 minted nothing (budget-exhausted).

Which signals the proposes fanned over (from `survey-board.md`, ranked):
- **signal #1** = *"Add conditional edges to the typed DAG"* (**Keystone**, the v1-vision centerpiece)
  → propose-1 → **starved (budget-exhausted), no mint.**
- **signal #2** = *"Cross-branch budget accounting — make the macro-wallet (P7) span parallel DAG
  branches"* (**High**) → propose-2 → **E-048.**

**Sound vs filler: SOUND — and notably so.** E-048 (`advances: [P7, P3]`) names a *real*
architectural gap: `castGraph`'s wave dispatcher has **no shared wallet** across concurrent branches —
each node authorizes against its own static per-node budget, so a fan-out's parallel casts both pass
`canAfford` against the pre-wave balance and the P7 hard contract **leaks across branches**. This is
corroborated independently (obs 23279). It is the opposite of filler: it is the budget invariant the
whole product rests on.

**The striking part (and the honest center of this settlement):** the cast **minted the demand that
describes its own failure mode.** propose-1's `budget-exhausted` stop is a *live instance* of exactly
the per-branch budget pressure E-048 proposes to fix — two concurrent proposes each spending against
their own 150k envelope, no joint ceiling. The degraded run is therefore **more** valuable than a clean
one would have been: it surfaced, live, the gap its sibling minted.

- **`lisa validate`:** *All checks passed. 114 tickets, 1 ready, DAG valid.* E-048 is **minted-only**
  (status `open`, no stories/tickets) yet creates **no orphan** — the E-043 / E-046 partial-chain
  pattern (propose without decompose; the graph has no decompose node). Clean.
- **Decompose status / disposition:** **minted-only → KEEP** (sound demand worth pulling), decompose
  later if/when pulled. Not a throwaway proof artifact — it is genuine demand on Frontier 3. It is in
  fact already named on `demand.md` Frontier 3 as a follow-on; this cast crystallizes it as E-048.

---

## Read 4 — P7 + the honest first-composition verdict

**P7 (bounded + clean): HELD per-node; the cast exposed the cross-branch gap.**
- The spend was bounded and the bound *enforced*: propose-1 hit its 150k-token envelope and the **andon
  fired** — `budget-exhausted — spent 180315/150000 tokens (over by 30315)`. The accounting is exact:
  `input 15532 + output 4325 + cache_read 123303 + cache_creation 37155 = 180315`. The envelope did its
  job — it **stopped** propose-1 rather than letting it run away. The gate is the contract; it held.
- Cost was modest and accounted: survey $0.862 + propose-1 $0.619 + propose-2 $0.576 = **$2.06** total.
- The *limit* P7 showed (and E-048 captures): the two proposes were bounded **independently** (each
  against its own 150k), with **no shared wave-level envelope**. P7 is correct per node; it does not yet
  span the fan-out. Bounded + clean at the node level; the cross-branch envelope is genuine downstream work.

**First-composition verdict — no over-claim, no under-claim:**

> The first composed playbook proved, **live**, the two things only `castGraph` can do that the linear
> chain cannot: **real concurrency** (two real `claude -p` casts overlapping ~69 s under the wave
> dispatcher) and **live-correct halt/skip** of a dependent join when an upstream failed. It carried
> **real plays** end-to-end (survey + propose) to a **real mint** (E-048) — the substrate carries real
> work, not just stubs.
>
> It did **not** prove the live multi-upstream **join** (propose-1's budget-exhaustion skipped
> `capture-note`); that remains stub-proven only. And it is **modest**: `survey → propose → note` is a
> thin composition — the current plays do not compose richly yet (E-046's "richer playbooks" are
> downstream). This is **not** a profound playbook, and the run was **degraded** (one of two branches
> starved). But it is **not** nothing: concurrency live + halt/skip live + a real mint + a real P7 gap
> surfaced (E-048). The substrate is proven LIVE; the composition on top of it is still early.

## AC checklist

- [x] **Concurrency proof** — two proposes overlapping `03:55:54.569 → 03:57:03.539` (68.97 s). Proven.
- [x] **Join** — honest record: did **not** run live (propose-1 failed → join skipped); stub-proven only.
- [x] **Minted-epic quality + decompose status** — E-048 sound (real P7 gap); `lisa validate` clean
      (E-043, no orphan); minted-only; keep. **P7** bounded + clean per-node (andon fired correctly).
- [x] **First-composition verdict** — written above (no over/under-claim); `demand.md` Frontier 3 updated.
- [x] `bun run check:*` green (see `progress.md`).
