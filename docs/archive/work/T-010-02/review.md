# T-010-02 — Review: trigger-check-head-at-ticket-boundary

*Handoff. What changed, AC status, coverage + gaps, open concerns — enough to
review without reading every line.*

## What changed

| file | action | what |
|------|--------|------|
| `.lisa/hooks/on-clear.sh` | **modify** | Kept the load-bearing `pane-$ID.cleared` write (first, unconditional). Appended the E-010 committed-HEAD build andon gate: fail-open preflight → atomic lock → **detached background** `check:head` → worker translates exit `{0,1,2}` into an andon FLAG. ~70 lines, mostly the rationale header. |
| `docs/active/work/T-010-02/broken-head-demo.sh` | **create** | Self-contained AC#3 demo: drives all three exit branches deterministically (inject exit + sync mode). |
| `docs/active/work/T-010-02/*.md` | **create** | RDSPI artifacts. |

**No `src/` change, no `package.json` change.** `check:head` (T-010-01) already
owns the whole build + judgment; per the Central Rule this ticket adds only
*trigger wiring*. `on-stop.sh`, `check-committed.ts`, `committed-core.ts`,
`head-build-core.ts`, `check-head.ts` are all untouched.

## How it works

On every `/clear` (SessionStart, matcher `clear` in `settings.json` — fires ≈ once
per ticket/pane boundary, the **coarsest** of the four lisa hooks): write the
`.cleared` signal, then, if `bun` + a git repo are present, take an atomic
`mkdir` lock and launch `check:head` in a **detached subshell** (`trap '' HUP` +
stdio redirect — survives the hook returning; macOS has no `setsid`). The hook
returns in ~17ms. When the background build finishes, the worker maps its exit:

| exit | meaning | andon action |
|---|---|---|
| `0` | committed HEAD builds | clear stale `*.head-broken`; write `*.head-ok`; log |
| `1` | **HEAD broken from clean checkout** (E-007 class) | **raise** `pane-<scope>.head-broken` (timestamp + output tail) + stderr andon. **No block.** |
| `2`/other | env error — couldn't check | **fail-open**: log only; prior flag state untouched |

The andon is a durable signal file under the gitignored `.lisa/signals/` — lisa
already watches that dir, so a broken HEAD surfaces to the orchestrator / human /
next on-clear.

## Why on-clear, not on-stop (the heart of the ticket — R11, confirmed)

Hook frequencies read off `settings.json` + each script's header: heartbeat (per
tool call) ≫ **on-stop (per turn)** ≫ idle ≫ **on-clear (per /clear ≈ per
ticket)**. E-008's `check:committed` is a fast `git status`, fine on per-turn
on-stop. `check:head` is a full `bun install` + `bun run check` in a fresh
worktree — putting that on a per-turn hook is the **catastrophic-latency pitfall**
the ticket names. It belongs at the coarse on-clear boundary. The rationale is
documented *in the hook header* (AC#1).

## Block vs. warn — DETERMINED, not assumed (like E-008)

E-008 BLOCKS (Stop-hook `exit 2` re-prompts Claude to commit). That lever does not
exist here: on-clear is a **SessionStart** hook — it fires *after* the boundary
and cannot re-prompt/halt, and the build is heavy + async. So a broken HEAD raises
a **WARN/andon FLAG**, never a block. The determination is grounded in the hook's
real semantics + the latency cost — exactly the "determine, don't assume" the
ticket asked for.

## Acceptance criteria — status

- **AC#1** (coarse trigger; choice grounded in confirmed frequencies + latency
  rationale, documented in the hook) — **met.** Wired into the already-existing
  `SessionStart/clear → on-clear.sh` path; frequency table + "why not on-stop" in
  the header.
- **AC#2** (broken HEAD → clear andon, block-vs-warn determined like E-008;
  fail-open if the gate can't run) — **met.** Exit `1` → durable `*.head-broken`
  flag + stderr, WARN not block; exit `2` → fail-open (state untouched); preflight
  failures → `exit 0`. Demo cases 1 & 3 prove both.
- **AC#3** (broken-HEAD demo shows the andon; per-turn pitfall documented as
  avoided; future-loop effect noted; `bun run check:*` stay green) — **met.**
  `broken-head-demo.sh` → ALL CASES PASS; per-turn pitfall avoided (on-clear, not
  on-stop) and documented; future-loop effect noted (below); regression:
  typecheck clean, **319 pass / 0 fail**, `check:committed` ok, `check:head` ok on
  live HEAD with no worktree leak.

## Test / demo coverage

- **Demo (`broken-head-demo.sh`)** — 11 assertions across the broken / green /
  env-error branches, plus the broken→green andon-clear transition and the
  fail-open "prior flag survives" case. Deterministic, offline, milliseconds (no
  real build — exits injected; T-010-01 already proved a real broken HEAD → exit
  1).
- **Background-path smoke** — confirmed the hook returns in ~17ms and the detached
  worker writes the flag afterward, with the lock released (no leak).
- **Regression** — full `check:*` suite green; `on-stop`/`check:committed`
  untouched.

**Gaps (intentional):**
1. **No live-loop trigger test.** The hook edit affects *future* on-clear events;
   a session can't observe its own next `/clear`. Deferred per the ticket; proven
   by hand instead.
2. **The real heavy path isn't asserted end-to-end in the demo** — the demo
   injects exit codes rather than building a real broken HEAD (which T-010-01's
   integration test already covers). The seam between "real `check:head` exit" and
   "hook translation" is covered on both sides, just not in one run.

## Open concerns / notes for next work

1. **Async andon (by design).** The flag lands a minute after the boundary, in the
   signals dir — not in the incoming agent's in-context message. A synchronous
   mode that rides `additionalContext` into the starting agent was rejected
   (blocks session start + trips the ~60s SessionStart hook timeout). If in-context
   surfacing is wanted later, that's the follow-up — it needs a fast HEAD build
   (e.g. the E-010 Dagger-CI-on-HEAD variant) to be viable synchronously.
2. **Stale lock.** If a worker is `kill -9`'d before its `EXIT` trap, the `mkdir`
   lock persists and the next on-clear skips its build until the lock is cleared
   by hand. Acceptable for now (fail-toward-skip, never wedge); an age-based
   stale-lock break is a cheap future hardening.
3. **`bun install` in the real worktree** still hits network/cache (T-010-01's
   concern #2 carries over) — a cold-cache offline machine could mis-classify an
   install failure as a build andon (exit 1). Out of scope; `--frozen-lockfile`/
   offline install is the future knob.
4. **Detachment portability.** `( trap '' HUP ) &` is the macOS-friendly stand-in
   for `setsid`; if a future runner aggressively reaps the hook's process group it
   could kill the worker. Verify if the gate ever appears to "not run" in a live
   loop. (Live verification deferred per the ticket.)
5. **No debounce / no Dagger-on-HEAD** — both are named E-010 follow-ups, not this
   ticket. **No auto-repair** — E-010 scope (detect, don't fix).

## Verdict

Self-assessed complete and green. The heavy `check:head` gate is wired to the
coarse on-clear boundary with the per-turn pitfall avoided and documented; a
broken HEAD raises a durable WARN andon (determined, not assumed) and the loop can
never be wedged (instant return, fail-open, lock-guarded). All ACs met; demo and
regression captured in `progress.md`. Ready for human review; live-loop trigger
verification intentionally deferred per the ticket.
