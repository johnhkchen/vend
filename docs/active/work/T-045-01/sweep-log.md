# T-045-01 — Sweep log (verbatim)

A LIVE, METERED sweep. Real `claude -p` casts, real tokens, real minted epic. Human-authorized
(explicit in-session GO for the full bounded sweep). Outcome recorded honestly: **a clean P7
0-clear** with the cause, **E-044 confirmed live**, **E-043 confirmed live (no orphan)**.

Run date: 2026-06-20 (PDT) / 2026-06-21Z.

---

## 1. Fresh board #1 signal (E-044 verdict) — **CONCRETE DEMAND, E-044 TOOK**

`vend steer` re-stage: `run-2026-06-21T02-34-13-621Z` success, 5 turns. Fresh
`docs/active/pm/staged/steer.md` written 19:36 (was 17:07 → freshness gate now passes).

**Stale (17:07) board #1 — the self-referential meta-task E-044 targets:**
> `Re-run the bounded metered sweep again after E-039 settles to accrue CLEARED forward-E1 records
> toward the ≥10 bar.`

**Fresh (19:36) board #1 — verbatim:**
> `vend chain "Build the typed multi-node DAG — plays composing into a real graph (fan-out, join,
> conditional) beyond the linear propose→decompose chain. — The literal architectural centerpiece of
> the v1 vision ('typed, graph-structured agent orchestration') is still unbuilt; the engine casts
> only single plays + one linear chain. Closes the largest remaining vision-distance and is the
> substrate the open-model runner wants underneath it."   # recommended next pull (highest leverage)`

**Verdict: E-044 took.** The fresh #1 is concrete product demand (a buildable feature). The
self-referential "re-run the sweep" signal is **absent from the entire fresh board** — all 8 signals
are concrete demand (DAG; hackathon `examples/` template; open-model runner; Linear renderer;
annotation→demand round-trip; single-binary delivery; structured stop-reason; per-play model
selection). The ranker demoted the meta-task off the board entirely. No silent re-point was needed.

---

## 2. The sweep receipt — verbatim

Command: `bun run src/cli.ts work --no-intervened --budget 3600000,1000000`

```
· result (success)
· andon: budget-exhausted — spent 366414/227464 tokens (over by 138950)
· turns: 11 / 15 cap
✓ done   : Build the typed multi-node DAG
    ◇ 536.3k/1000k · 463.7k left   ⏱ 2m/1h · 57m left
═ vend work — receipt ═

Cast 1, cleared 0:
  ⚠ Build the typed multi-node DAG   andon: budget-exhausted   ◇ 536.3k   ⏱ 2m

wallet: ◇ 536.3k/1000k · 463.7k left   ⏱ 2m/1h · 57m left

stopped: andon — refused (a successful stop, not a crash) — andon 'budget-exhausted' — 463713 tokens / 3423336 ms left
```

**Stop classification: clean P7 andon (a successful refusal, NOT a crash).** auth==exec held — the
cast ran under the funded 1M/1h wallet; the wallet still had 463.7k tokens / 57m when it stopped. The
stop was triggered by the **per-step envelope guard**, not wallet exhaustion: the decompose-epic step
was authorized at 227464 tokens and the model consumed 366414 (over by 138950), tripping the andon.
The chain aborted → **cleared 0**.

---

## 3. Cleared chain(s)

**None — 0-clear.** The single cast did not clear a chain. `lisa validate` (verbatim):

```
All checks passed. 109 tickets, 1 ready, DAG valid. Run `lisa loop` to start.
Config: max_threads=2, session_timeout=3600s
```

The board remains valid and green.

---

## 4. E-043 idempotent mint — **CONFIRMED LIVE (no orphan)**

The propose-epic step succeeded and minted one epic:

```
docs/active/epic/E-046.md
  id: E-046
  title: typed-dag-fan-out-join-substrate
  advances: [P1, P6]
```

**Duplicate-title check across all epics:** none (`sort | uniq -d` empty). **No orphan** — there is
no childless *duplicate* of any minted title (the E-041 failure mode). E-046 is a single card.

E-046 is currently **un-decomposed** (no story/ticket references it) because the decompose step
aborted — but this is a legitimate resume point, **not** an E-043 orphan. On a retry,
`proposeEpicEffect` → `findExistingByTitle("typed-dag-fan-out-join-substrate", …)` will **adopt**
E-046 and mint nothing, so the chain resumes on the one card. The live sweep thus also set up the
exact condition E-043 was built to handle idempotently.

---

## 5. Forward-E1 ledger delta

`.vend/runs.jsonl`: 34 → **36** records (+2, both carry `intervened:false`):

| record | play | outcome | intervened | forward-E1? |
|---|---|---|---|---|
| `…02-36…` | propose-epic | success | false | **yes — forward success** (minted E-046) |
| `…02-37…` | decompose-epic | budget-exhausted | false | forward record, but andon (not success) |

Counts:
- `intervened:false`: 20 → **22** (+2)
- `intervened:false` + `success`: 13 → **14** (+1, the propose half)

**Honest note on the cadence goal:** the AC asked for forward records moving toward ≥10 — the propose
success *is* a new forward-E1 success record (+1). But the deeper keystone goal (a **cleared chain**,
forward 8 → ≥10 *clears*) did **not** advance: no chain cleared this sweep. The cadence gained a
forward success datum, not a clear.

---

## 6. Finding — the 0-clear cause (actionable)

The decompose-epic cast for a heavyweight epic (the typed multi-node DAG) used **366k output-shaping
tokens against a 227464 per-step envelope** recalibrated at the standard tier. The envelope is
**under-provisioned for large epics** — the same class as E-025 (authorize-vs-execute) and the
cold-start token-budget recalibration already staged earlier
(`recalibrate-vend-expand-s-cold-start-token-budget-up`). The DAG is one of the largest epics on the
board; its decomposition legitimately needs a bigger envelope than the standard-tier prior grants.

This is a genuine, concrete next signal: **raise the decompose-epic cold-start token envelope** (or
tier the DAG signal higher) so the chain can clear. It is NOT a regression of E-043/E-044 — both
hardening seams confirmed live; it is the *next* recalibration the cadence surfaces, exactly as E-038
fixed the propose-side censor.

---

## 7. AC scorecard

- [x] Fresh board staged (freshness gate passed); #1 recorded — **concrete demand → E-044 live**.
- [x] `vend work --no-intervened --budget ~1h,~1M` run live to a **clean P7 stop**; auth==exec held.
- [~] **0 chains cleared** — honest record of the 0-clear with cause (decompose envelope overrun);
      **NO orphan** (E-043 live-confirmed: no duplicate-title epic).
- [~] New forward-E1 records appended (+2 `intervened:false`; +1 success) — a forward *success* datum,
      but **no cleared chain**, so the ≥10-*clears* cadence did not advance this sweep.
- [x] `sweep-log.md` captures the verbatim #1, receipt, (no) cleared id, ledger delta, E-043/E-044
      confirmations, and the cause.
