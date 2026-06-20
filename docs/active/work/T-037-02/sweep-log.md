# T-037-02 — Sweep Log (the watched, metered macro-wallet spend)

**LIVE + METERED. Real `claude -p` casts were made.** Operator-authorized at the counter
("Cast the live sweep now") on **2026-06-20**, `claude` CLI **2.1.185**, budget
**`--budget 3600000,1000000`** (1 h / 1 M tokens). This is the deferred-since-T-024-03 watched run.

## Headline outcome — HONEST 0-CLEAR (a clean P7 time-andon, reproduced twice)

The bounded sweep ran **live, twice**, and each time reached a **clean P7 stop** with **cleared 0**:
the first cast (`propose-epic` on the board's top signal) hit `andon: timed-out` at its **per-step
time envelope (~72.8 s)**, so `shouldContinue` ended the session on andon precedence. **The
wallet-bounded machinery worked exactly as designed** — bounded spend, truthful receipt, clean stop,
**zero partial state** (no half-minted epic). But the headline AC — *≥1 real pull cleared* — was
**NOT met**: the cast censored on **time**, before it could mint.

**This is NOT the E-024 price-mismatch no-op T-037-01 ruled out.** The stop detail shows the wallet
barely moved (`3527208 ms left` of 3,600,000 ⇒ ~72.8 s spent, **0 tokens debited**): the cast ran
under **exactly** its authorized per-step time budget (`propose-epic` envelope = **72,785 ms**) and
exceeded it → `timed-out`. **auth==exec held** (E-025). This is the honest "per-cast censoring at its
correct envelope" outcome T-037-01 explicitly flagged (R3 / caveat #2) — distinct from a price no-op.

---

## Step 1 — Stage a fresh board (`vend steer`, a live cast) ✅

```
$ bun run src/cli.ts steer
· system (init) … (thinking) …
· result (success)
· effect ✓ staged /Volumes/ext1/swe/repos/vend/docs/active/pm/staged/steer.md
· turns: 7
run run-2026-06-20T23-00-12-985Z: success (materialized: true)
```

- Board staged at **Jun 20 16:02:44** — **newer** than the newest `docs/active/{epics,stories,
  tickets}` md (Jun 20 15:51:24) ⇒ **clears the E-027 freshness gate** (`isBoardStale` false).
- Carries **9** ranked `vend chain "…"` signals (≥2 precondition satisfied). #1 (recommended):
  *"Run and settle the E-037 live macro sweep — authorize `lisa loop`, spend the bounded budget down
  across `vend work --no-intervened` casts to a clean P7 stop…"* — a self-referential meta-signal.
- Ledger: 25 → **26** (the steer cast itself, `play=steer outcome=success`).

## Step 2 — The metered sweep, run #1 (verbatim) ⚠ andon

```
$ bun run src/cli.ts work --no-intervened --budget 3600000,1000000

▶ casting: Run and settle the E-037 live macro sweep
    ◇ 0/1000k · 1000k left   ⏱ 0s/1h · 1h left
· system (init)
· system (thinking_tokens)        ← ~45 thinking emits elided for length (model thinking on the
   …  (×45)                          self-referential signal); full transcript in _sweep-raw.txt
· andon: timed-out
✓ done   : Run and settle the E-037 live macro sweep
    ◇ 0/1000k · 1000k left   ⏱ 1m/1h · 58m left
═ vend work — receipt ═

Cast 1, cleared 0:
  ⚠ Run and settle the E-037 live macro sweep   andon: timed-out   ◇ 0   ⏱ 1m

wallet: ◇ 0/1000k · 1000k left   ⏱ 1m/1h · 58m left

stopped: andon — refused (a successful stop, not a crash) — andon 'timed-out' — 1000000 tokens / 3527208 ms left
```

(The `⚠` andon line and the `stopped:` line render **amber** in the terminal — IA-9, a successful
refusal, never red. ANSI `[33m…[0m` codes present in `_sweep-raw.txt`.)

## Step 3 — The metered sweep, run #2 (retry — same fresh board) ⚠ andon (reproduced)

Retried once: the first run's near-zero token cost made a retry cheap, and a `rate_limit_event`
during staging raised the possibility the timeout was transient slowdown. It reproduced **identically**:

```
$ bun run src/cli.ts work --no-intervened --budget 3600000,1000000

▶ casting: Run and settle the E-037 live macro sweep
· … (thinking) … · andon: timed-out
✓ done   : Run and settle the E-037 live macro sweep

═ vend work — receipt ═
Cast 1, cleared 0:
  ⚠ Run and settle the E-037 live macro sweep   andon: timed-out   ◇ 0   ⏱ 1m
wallet: ◇ 0/1000k · 1000k left   ⏱ 1m/1h · 58m left
stopped: andon — refused (a successful stop, not a crash) — andon 'timed-out' — 1000000 tokens / 3527195 ms left
```

Two independent casts timing out at the **same** ~72.8 s wall ⇒ a **reproducible structural
result**, not a fluke. Stopped after run #2 — further retries would only reproduce it (the per-step
time budget is set by `recalibrate`, not a CLI knob; the 1 h *wallet* was never the binding limit).

---

## Receipt analysis (what the truthful receipt says)

| Field | Run #1 | Run #2 | Reading |
|-------|--------|--------|---------|
| Cast / cleared | 1 / **0** | 1 / **0** | one cast attempted, none cleared |
| Per-cast cost | ◇ 0 · ⏱ 1m | ◇ 0 · ⏱ 1m | **0 tokens debited**, ~72.8 s wall |
| Wallet remaining | ◇ 1000k · ⏱ 58m | ◇ 1000k · ⏱ 58m | the budget barely moved — bounded, honest |
| Stop | `andon 'timed-out'` | `andon 'timed-out'` | clean P7 refusal (andon precedence) |
| ms left | 3,527,208 | 3,527,195 | ⇒ ~72,792 / 72,805 ms spent = the propose per-step envelope |

The ~72.8 s spent ≈ `propose-epic` envelope **72,785 ms** (T-037-01's measured p90). The cast was
authorized at, ran under, and timed out at **exactly** its authorized time budget — **auth==exec**.

## Cleared pulls — NONE (honest)

`lisa validate` → **"All checks passed. 94 tickets, 1 ready, DAG valid."** The repo/board is green;
the staged board broke nothing. **No epic/story/ticket was minted** — `git status docs/active/{epics,
stories,tickets}` shows only Lisa's frontmatter advances on `T-037-01.md` / `T-037-02.md`, **no
partial mint** (the time-andon fired before `propose-epic` materialized anything). There are no
minted ids to validate — the correct, honest reflection of a 0-clear.

## Ledger delta — `.vend/runs.jsonl` 25 → 28 (+3)

```
26: play=steer        outcome=success    intervened=None   attested=False   (the staging cast)
27: play=propose-epic outcome=timed-out  intervened=False  attested=False   (run #1 — forward, censored)
28: play=propose-epic outcome=timed-out  intervened=False  attested=False   (run #2 — forward, censored)
```

Records 27 & 28 **carry `intervened:false` with no `intervenedAttestation` marker** ⇒ classified
**forward (live)** by `auditWalkAway` — so the AC's "forward-E1 record(s) appended carrying
`intervened:false`" is **satisfied (2 records)**. *But* both are **censored** (`timed-out`), not
cleared successes — they enlarge the forward *reported* sample without adding a cleared "untouched"
data point. No over-claim: this session **did not** clear a pull and **does not** meet the
≥10-genuine-forward bar (T-037-03 owns that cadence).

---

## Verdict against the Acceptance Criteria (honest)

| AC | Status | Evidence |
|----|--------|----------|
| Fresh board clears the E-027 gate | ✅ | `steer.md` @ 16:02:44 > live 15:51:24; 9 signals |
| `vend work --no-intervened --budget` to a clean P7 stop | ✅ | `andon 'timed-out'` — clean refusal, nothing partial (×2) |
| ≥1 real pull cleared, `lisa validate` green, auth==exec held | ❌ cleared 0 · ✅ auth==exec · ✅ validate green | cast censored on **time** before minting |
| forward-E1 record(s) appended `intervened:false` | ✅ (censored) | records 27, 28 forward/unattested |
| `sweep-log.md` captures steps + receipt + ids + ledger, honest | ✅ | this document |

**Bottom line:** the watched metered spend **proved the wallet/andon machinery** (bounded, truthful,
clean-stop, auth==exec, no partial state) but **did not land the headline live proof of a *cleared*
pull** — blocked **not** on price (E-025 holds) but on **per-step TIME censoring**: `propose-epic`
needs more than its 72,785 ms p90 envelope on this board's top signal, and times out before it can
mint. An honest 0-clear, recorded with its exact reason — see Review for the open concern + the
follow-up this surfaces (a real finding for T-037-03 / a recalibration fix).
