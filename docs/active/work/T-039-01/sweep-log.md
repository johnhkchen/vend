# T-039-01 — Sweep Log (the live, metered re-sweep — E-038 confirmed, 2 pulls CLEARED)

**LIVE + METERED. Real `claude -p` casts were made.** Authorized by the human running `lisa loop` on
the T-039-01 ticket (whose entire purpose is the metered live spend, P7-bounded). `claude` CLI
**2.1.185**, `bun` **1.3.9**, budget **`--budget 3600000,1000000`** (1 h / 1 M tokens, byte-identical
to E-037 for comparability). Run on **2026-06-20** (~17:08 PDT).

## Headline outcome — CLEARED 2 (E-038 worked live; the censoring ratchet is broken in flight)

Where E-037 watched the macro-wallet clear **0** (propose-epic guillotined at its 72,785 ms envelope,
twice), this re-sweep — same budget, same machinery, **only E-038's 2× timeout headroom added** —
**cleared 2 real pulls** to a clean P7 stop:

- `✓ Author vend init`   → minted **E-040** (`vend-init-scaffold`) + 2 stories + 4 tickets
- `✓ Author vend doctor` → minted **E-042** (`vend-doctor-preflight`) + 2 stories + 4 tickets

**The propose-epic casts FINISHED** — they ran **93 s and 83 s**, both *past* the 72,785 ms wall that
killed E-037, surviving only because E-038 gave the kill-switch a 145,570 ms wall (`price × 2`). This
is the fix proven **live**, not just deterministically. The stop was a clean P7 **wallet-exhausted**
(367 k tokens left, but less than the next pull's price). `lisa validate` is **green**.

One honest wart: the `vend doctor` clear minted a **duplicate** orphan epic **E-041** (see Findings).

---

## Step 1 — Deterministic pre-check (free) ✅ GO

```
$ bun -e 'import {timeoutMsFor, TIMEOUT_HEADROOM} from "./src/budget/budget.ts"; …'
TIMEOUT_HEADROOM = 2
timeoutMsFor({timeMs:72785,tokens:227390}) = 145570      # E-038 LIVE: the 72,785 ms envelope now
                                                          # has a 145,570 ms kill-wall (price × 2)
$ stat steer.md → 2026-06-20 16:02:44    (staged board)
$ stat newest docs/active/{epic,stories,tickets}/*.md → 2026-06-20 17:01:23   (live state)
⇒ 16:02:44 < 17:01:23 ⇒ isBoardStale = TRUE ⇒ a fresh board is genuinely needed.
```

Both gates pass: E-038 is live, and the staged board is stale. **A one-line go.** (Affordability still
gates on the bare price — E-038 is isolated to the kill-switch.)

## Step 2 — Stage a FRESH board (`vend steer`, a live cast) ✅

```
$ bun run src/cli.ts steer
· result (success)
· effect ✓ staged /Volumes/ext1/swe/repos/vend/docs/active/pm/staged/steer.md
· turns: 7
run run-2026-06-21T00-05-46-640Z: success (materialized: true)
```

Fresh board staged at **17:07:38** (> live state ⇒ clears the E-027 freshness gate). Ledger 28 → 29
(the steer cast itself, `play=steer outcome=success`). Carries **6** ranked `vend chain "…"` signals.

## Step 3 — Inspect #1 → SELF-REFERENTIAL again (a finding) → re-point at concrete demand ✅

**The fresh board's #1 was again the E-037 degenerate case** — a self-referential meta-target:

> `vend chain "Re-run the bounded metered sweep again after E-039 settles to accrue CLEARED
> forward-E1 records toward the ≥10 bar. — …"`   *(# recommended next pull)*

This is "run the sweep" pointed at itself — not decomposable real product work, so **not a valid
clear-test** (T-039-01 Decision 2 / Step 3 explicitly anticipated this). **Recorded as a finding**
and the sweep was pointed at the top **concrete** signal instead: a board
(`docs/active/pm/staged/concrete-board.md`, signals verbatim from the steer board, the
self-referential #1 dropped) whose #1 is real product demand:

```
#1  Author `vend init`   — Frontier 7 foundation (scaffold a vend+lisa project)
#2  Author `vend doctor` — envinfo-backed preflight gate
#3  Build the multi-node typed DAG
#4  Ship the hackathon examples/ template
#5  Thread the structured stop-reason onto the run record
```

## Step 4 — The metered sweep (verbatim receipt) ✅ CLEARED 2

```
$ bun run src/cli.ts work --no-intervened --board docs/active/pm/staged/concrete-board.md \
        --budget 3600000,1000000

▶ casting: Author `vend init`
    ◇ 0/1000k · 1000k left   ⏱ 0s/1h · 1h left
  …  · effect ✓ minted E-040 → …/docs/active/epic/E-040.md
     · effect ✓ lisa validate ✓
✓ done   : Author `vend init`
    ◇ 338.1k/1000k · 661.9k left   ⏱ 3m/1h · 56m left
▶ casting: Author `vend doctor`
    ◇ 338.1k/1000k · 661.9k left   ⏱ 3m/1h · 56m left
  …  · effect ✓ minted E-042 → …/docs/active/epic/E-042.md
     · effect ✓ lisa validate ✓
✓ done   : Author `vend doctor`
    ◇ 633.0k/1000k · 367.0k left   ⏱ 6m/1h · 53m left
═ vend work — receipt ═

Cast 2, cleared 2:
  ✓ Author `vend init`   ◇ 338.1k   ⏱ 3m
  ✓ Author `vend doctor`   ◇ 294.9k   ⏱ 2m

wallet: ◇ 633.0k/1000k · 367.0k left   ⏱ 6m/1h · 53m left

stopped: wallet exhausted — wallet can't afford the next pull (3 left on the board) — 366996 tokens / 3209678 ms left
```

**No `andon: timed-out`.** Both propose casts finished and the chains cleared. Clean P7
**wallet-exhausted** stop: 367 k tokens remained but less than the next pull's predicted price
(`canAfford` false), so the loop stopped rather than authorize an unaffordable cast — exactly P7.

## Receipt analysis (the truthful receipt vs E-037)

| Field | E-037 (T-037-02) | **T-039-01 (this run)** | Reading |
|-------|------------------|--------------------------|---------|
| Cast / cleared | 1 / **0** | 2 / **2** | both pulls cleared |
| Propose outcome | `timed-out` @ 72.8 s (×2) | **success** @ 93 s & 83 s | **E-038 live** — past the old wall |
| Tokens debited | 0 | **633.0 k** | real burn, real mints |
| Stop | `andon 'timed-out'` | `wallet exhausted` | both clean P7 stops |
| Wallet left | ◇ 1000k / ⏱ 58m | ◇ 367k / ⏱ 53m | the wallet actually moved |
| Minted | none | **E-040, E-042** (+ stories/tickets) | the headline live proof |

**auth==exec held (E-025):** each propose ran under its authorized 72,785 ms *price* envelope with the
145,570 ms *kill-wall* (E-038); each decompose under its 160,745 ms envelope. The casts ran under
exactly what was authorized — no 227k→150k mismatch.

## Cleared pulls — the minted board cards (`lisa validate` GREEN)

```
$ lisa validate → All checks passed. 105 tickets, 3 ready, DAG valid.   (was 97 at E-039 pull)

E-040  vend-init-scaffold      (advances P5,P2)   → S-040-01, S-040-02 ; T-040-01..04
E-042  vend-doctor-preflight   (advances P3,P4,P6) → S-042-01, S-042-02 ; T-042-01..04
```

Both epics carry valid frontmatter and a full decomposition (story + ticket DAG). `lisa validate`
green confirms the minted cards broke nothing and the DAG is consistent.

## The CLEARED forward-E1 records — ledger `.vend/runs.jsonl` 29 → 33 (+4)

```
30: play=propose-epic   outcome=success  intervened=false  epic="Author `vend init`"   env=72785ms   elapsed=93s   tok=145451
31: play=decompose-epic outcome=success  intervened=false  epic=E-040                   env=160745ms  elapsed=133s  tok=192613
32: play=propose-epic   outcome=success  intervened=false  epic="Author `vend doctor`"  env=72785ms   elapsed=83s   tok=192478
33: play=decompose-epic outcome=success  intervened=false  epic=E-042                   env=160745ms  elapsed=82s   tok=102462
```

All four carry `intervened:false` with no attestation ⇒ classified **forward (live)** by
`auditWalkAway`, **and** all four are `outcome:success` — these are the **first CLEARED forward-E1
records** in the project (the baseline entering E-039 was 4/10, *all censored*). Records 30 & 32 are
the proof the ratchet broke: a propose-epic running **93 s / 83 s past the 72,785 ms** wall that
censored E-037, landing a SUCCESS that now *enters* the recalibration sample (the data E-038's
headroom was designed to let in). T-039-02 owns the precise forward-rate audit read.

## Findings

1. **Self-referential #1 (recorded, handled).** The fresh steer board's recommended pull was again
   the E-037 degenerate "run the sweep" meta-target. Re-pointed at concrete demand (Step 3). The
   board's *ranker* still over-weights the self-referential keystone signal — a steer-quality lever
   worth a follow-up (it will keep surfacing until the ranker demotes meta-targets).
2. **Duplicate orphan epic E-041 (overproduction wart).** The `vend doctor` clear minted the epic
   **twice**: **E-041** (`vend-doctor-preflight`, childless — no stories/tickets, not in the ledger,
   not in the sweep's effect log) and **E-042** (same title, fully decomposed, the one the cast
   logged + the decompose record targeted). `lisa validate` stays green (a childless epic is not a
   DAG violation), but it is overproduction — two epic cards for one signal. Likely an id-allocation
   double-mint inside the propose step. **Flag for T-039-02 / a follow-up:** decide whether to delete
   the E-041 orphan and whether the propose play needs an idempotent-mint guard.

## Verdict against the Acceptance Criteria

| AC | Status | Evidence |
|----|--------|----------|
| Pre-check: `timeoutMsFor`==T×2 + staged board stale → go | ✅ | 145570; 16:02 < 17:01 |
| Fresh concrete board staged; #1 recorded (re-pointed if meta) | ✅ | steer @ 17:07; #1 self-ref → concrete-board.md (vend init) |
| `vend work --no-intervened --budget ~1h,~1M` to clean P7 stop, **propose FINISHING** | ✅ | propose 93 s/83 s, no timeout; `wallet exhausted` |
| **≥1 real pull CLEARED** + first CLEARED forward-E1 record | ✅ **2 cleared** | E-040, E-042; ledger 30–33 all `intervened:false`+`success`; validate green; auth==exec |
| `sweep-log.md` captures verbatim steps + receipt + ids + ledger delta | ✅ | this document |

**Bottom line:** the watched metered spend landed the headline E-039 proof — the macro-wallet
**cleared real product work** (2 pulls, 2 epics + 8 tickets) on a walk-away, bounded run, with the
propose-epic casts finishing **past** the wall that censored E-037. E-038's 2× headroom is confirmed
**live**, and the first cleared forward-E1 records are now in the ledger (cadence begins: ~4/10 → real
cleared evidence). Honest caveats: the board ranker still surfaces a self-referential #1, and the
vend-doctor clear left a duplicate orphan epic (E-041) — both recorded for the T-039-02 settle pass.
P7 held throughout: real actuals debited, clean wallet-exhausted stop, no partial state beyond the
flagged duplicate.
