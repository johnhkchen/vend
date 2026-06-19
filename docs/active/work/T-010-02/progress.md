# T-010-02 — Progress: trigger-check-head-at-ticket-boundary

*Executed plan.md. One hook edit + one demo harness; no `src/` change. All steps
done, zero deviations from the plan.*

## Steps

- **Step 1 — preflight + signal preservation** ✅ `on-clear.sh` keeps the
  load-bearing `pane-$ID.cleared` write (first, unconditional). Added section-2
  header documenting the SessionStart/`clear` frequency, *why not on-stop*
  (per-turn → catastrophic latency), Central Rule, WARN-not-block, fail-open, and
  the background+timeout rationale. `sh -n` parses clean.
- **Step 2 — worker + detached launch** ✅ `run_head_gate` translates exit
  `{0,1,2}` → andon flag. Atomic `mkdir` lock; production path runs the build in a
  `( trap '' HUP; trap …EXIT; run_head_gate ) … &` detached subshell and returns
  immediately; `LISA_HEAD_SYNC=1` runs foreground for the demo.
- **Step 3 — demo harness** ✅ `broken-head-demo.sh` drives all three branches.
- **Step 4 — regression** ✅ all `check:*` green (below).
- **Step 5 — artifacts** ✅ this file + review.md.

## Captured: broken-HEAD demo (AC#3)

```
Case 1 — broken HEAD (check:head exit 1):
  andon flag pane-demo-broken.head-broken written            PASS
  no head-ok flag                                            PASS
  stderr carries the andon                                   PASS
  hook still exits 0 (WARN, not block)                       PASS
  lock released                                              PASS
Case 2 — green HEAD (exit 0) clears a stale andon:
  stale pane-demo-green.head-broken cleared                  PASS
  head-ok flag written                                       PASS
Case 3 — env error (exit 2) fails open:
  prior pane-demo-failopen.head-broken left untouched        PASS
  no head-ok falsely written                                 PASS
  hook exits 0 (never wedges)                                PASS
  log records 'could not check'                              PASS

ALL CASES PASS — andon raised on broken HEAD, cleared on green, fail-open on env error.
```

## Captured: background (production) path — never wedges

```
hook returns in 0.017s (instant); flag absent while bg sleeps ("in flight");
detached worker writes pane-bg.head-broken ~1s later; lock released OK.
```

Proves the heavy build stays OFF the session-start critical path — the loop
cannot be wedged or slowed by this gate (R11).

## Captured: regression gates (AC#3 tail)

```
check:typecheck → tsc --noEmit, clean (OK)
check:test      → 319 pass / 0 fail (476ms)
check:committed → ok — all source committed (on-stop path untouched)
check:head      → ok — committed HEAD builds (exit 0, 2.8s, no worktree leak)
git worktree list → only the main tree (no leak)
```

## Deviations

None. The one structure.md caveat (the `nohup sh -c 'fn'` function-export
problem) was resolved exactly as planned — a `( … ) &` subshell closes over the
already-set function/vars, with `trap '' HUP` for detachment (macOS has no
`setsid`). No other deviations.

## Notes carried to review.md

- Andon is **asynchronous** (durable signal file, not the incoming agent's
  in-context message) — a deliberate consequence of the background decision.
- Live-loop trigger is **deferred** per the ticket (future-loop effect); proven by
  hand via the demo + the smoke runs above.
- Not committed here — per the session instruction, artifacts are written and the
  rest (phase transition / commit) is left to Lisa.
