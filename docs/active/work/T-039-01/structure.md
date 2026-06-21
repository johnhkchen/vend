# T-039-01 — Structure (artifacts, mutations, and ordering)

This ticket writes **no source code**. Its "structure" is the set of artifacts it produces, the
runtime state it mutates (ledger, and on a clear, board cards), and the strict ordering the live
spend imposes. Below: what is created, what is touched at runtime, what is read-only, and the
invariants that must hold across the run.

## Files CREATED (work artifacts only)

```
docs/active/work/T-039-01/
  research.md      ✓ (Research)   — pre-run codebase map
  design.md        ✓ (Design)     — how to run the sweep; 6 decisions
  structure.md     ✓ (Structure)  — this file
  plan.md          ⏳ (Plan)       — ordered, verifiable steps
  progress.md      ⏳ (Implement)  — live execution log + deviations
  sweep-log.md     ⏳ (Implement)  — THE DELIVERABLE: verbatim receipt + honest verdict
  _sweep-raw.txt   ⏳ (Implement)  — raw combined stdout/stderr capture (ANSI preserved), if a cast runs
  review.md        ⏳ (Review)     — handoff: what happened, coverage, open concerns
```

`sweep-log.md` is the load-bearing artifact (the ticket's AC#5). `_sweep-raw.txt` is its verbatim
backing — referenced by `sweep-log.md`, not a substitute for it.

## Runtime state MUTATED by the live run (not source files)

- **`.vend/runs.jsonl`** — append-only ledger. The `steer` staging cast appends 1 record
  (`play=steer outcome=success`). Each `vend work` chain cast appends `propose-epic` (and, if propose
  clears, `decompose-epic`) records carrying `intervened:false`. **This is expected and desired** —
  the cleared forward-E1 record is a headline AC.
- **`docs/active/pm/staged/steer.md`** — overwritten by the fresh `vend steer` cast (the new board).
- **`docs/active/{epic,stories,tickets}/*`** — written **only on a clear**: a cleared
  propose→decompose chain mints a real epic + its decomposed tickets. On a 0-clear (time/budget
  andon before mint), **nothing is written here** — `git status` shows no partial mint (E-037's
  invariant; the time-andon fires before `propose-epic` materializes anything).

## Files READ-ONLY (the seams under test — never modified by this ticket)

```
src/budget/budget.ts        TIMEOUT_HEADROOM, timeoutMsFor   (E-038 fix — confirm live, don't touch)
src/play/work.ts            castWork, DEFAULT_BOARDS, freshness gate
src/play/work-core.ts       parseBoardSignals, isBoardStale, renderReceipt
src/engine/spend.ts         spendDown, sumActuals
src/ledger/recalibrate.ts   the price/percentile + CENSORED_OUTCOMES
src/ledger/walk-away.ts     auditWalkAway (T-039-02's coordinate — read for context only)
src/cli.ts                  the work / steer arms
```

If any of these would need editing to make the sweep clear, that is a **finding** for a follow-up
ticket (E-038 was the last code lever), not in-scope work here.

## Ordering (the live spend is strictly sequential)

```
1. Pre-check (free)        — timeoutMsFor==T×2; steer.md stale          [DONE — Decision 1]
        │  (hard gate: both must pass, else abort)
        ▼
2. Stage fresh board       — bun run src/cli.ts steer  → staged/steer.md (live cast, ~1-2 min)
        │
        ▼
3. Inspect #1              — concrete? proceed.  meta/self-referential? record finding + re-point.
        │
        ▼
4. Metered sweep           — bun run src/cli.ts work --no-intervened --budget 3600000,1000000
        │                     (walk away; capture combined output → _sweep-raw.txt)
        ▼
5. Clean P7 stop           — board-cleared | wallet-exhausted | andon
        │
        ▼
6. Capture + validate      — receipt → sweep-log.md; lisa validate (green); ledger tail read;
                             first cleared forward-E1 record OR named bottleneck
```

Steps 2→6 are a single uninterrupted walk-away (the `--no-intervened` contract). No step may be
reordered: pricing reads the ledger *after* staging, the gate reads board mtime *before* funding.

## Invariants that must hold across the run (assertions for the log)

- **P7 (no overspend):** the only cast authorized is a `fitNext` result affordable on its predicted
  price; the session ends on a clean stop with the wallet floored at ≥0, never a crash.
- **auth==exec (E-025):** every cast runs under exactly the per-step envelope it was authorized at
  (`proposeEnvelope` / `decomposeEnvelope` threaded into the cast, not a static default).
- **Meter must not lie (IA-8):** the receipt's two denominations and the ledger actuals match the
  real burn; a 0-clear reports `0 cleared`, not a softened number.
- **No partial state:** on andon before mint, `git status docs/active/{epic,stories,tickets}` shows
  no new cards (only Lisa's own frontmatter advances on the T-039-01 ticket are expected).
- **Comparability:** budget identical to E-037 (`3600000,1000000`), so the delta is the E-038 fix.

## Out of scope (explicit boundaries)

- No edits to `budget.ts` or any seam — E-038 already shipped the code lever.
- T-039-02 (the `auditWalkAway` settle pass + forward-rate read) is a separate, dependent ticket.
- No retry loop beyond what E-037 did (one reproduction at most) — the per-step envelope is set by
  `recalibrate`, not a CLI knob; repeated identical casts only reproduce the structural result.
