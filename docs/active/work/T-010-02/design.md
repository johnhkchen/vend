# T-010-02 — Design: trigger-check-head-at-ticket-boundary

*One decision per the ticket's two open questions: **which trigger** and
**block-vs-warn**. Plus a third the research forced: **sync-vs-background**. Each
is decided against the codebase reality from research.md, not assumed.*

## Decision 1 — Trigger: the `on-clear` hook (SETTLED by the ticket; confirmed here)

The ticket settles the trigger as `on-clear` (or loop-end). Research confirms the
choice on frequency grounds, so we adopt `on-clear` and reject the alternatives:

| option | frequency | verdict |
|---|---|---|
| **`on-stop`** (E-008's hook) | per turn | **REJECTED.** A ~minute build after every model response = catastrophic latency. The ticket's central prohibition. |
| `on-heartbeat` | per tool call | REJECTED. Even worse than on-stop. |
| `on-idle` | per idle | REJECTED. Fires mid-ticket whenever the agent pauses for input — neither a clean boundary nor reliably once-per-ticket. |
| **`on-clear`** (SessionStart/clear) | **per ticket/pane boundary** | **CHOSEN.** Coarsest hook; lisa `/clear`s to recycle a pane between tickets, so it fires ≈ once per ticket — exactly the cadence a heavy build can afford. |
| "loop-end" (lisa-loop completion) | per loop | Viable but **not a Claude-Code hook we own here** — it'd need a lisa-side change outside this repo's `.lisa/hooks/`. `on-clear` is already wired in `settings.json`, so it's the in-scope, lower-friction realization of the same "coarse boundary" intent. |

**Grounding (R11 — confirmed, not assumed):** frequencies are read off
`.claude/settings.json` (event→script map) + each script's header comment.
`on-clear` = `SessionStart` matcher `clear` = once per `/clear`. This rationale
is documented *in the hook* (AC#1).

## Decision 2 — Block vs. warn: **WARN / FLAG**, not block (determined like E-008)

E-008 chose **BLOCK** (`exit 2` on the Stop hook re-prompts Claude to commit).
That was correct *for E-008's situation*. T-010-02's situation differs on two axes
that both point away from block:

1. **Hook capability.** `on-clear` is a **`SessionStart`** hook. SessionStart
   hooks fire *after* the boundary and do **not** support the re-prompt/halt that
   `Stop`/`PreToolUse` `exit 2` gives. "Block the clear" is not a thing the
   platform offers — by the time it runs, context is already cleared and the next
   session is starting. So block is *unavailable*, not merely unwise.
2. **Check cost + timing.** Even if it could block, blocking the *incoming*
   session for a ~minute build (and risking the hook timeout) would wedge the
   loop — the exact failure R11 forbids ("a broken or slow gate must never wedge
   the loop").

**Therefore: WARN / FLAG.** On a broken HEAD (`check:head` exit `1`) the hook
raises a durable **andon signal file** (`.lisa/signals/pane-<scope>.head-broken`)
plus stderr/log — visible to lisa (which already watches `.lisa/signals/`), to a
human, and to the next on-clear. It does **not** halt anything. This mirrors
E-008's *intent* (surface the andon to the process) while respecting that this
hook's lever is a flag, not a block. This is the determination the ticket
demands — grounded in the hook's real semantics, not assumed.

Exit-code → behavior (the only logic the hook adds; judgment stays in the gate):

| `check:head` exit | meaning | on-clear behavior |
|---|---|---|
| `0` | committed HEAD builds | clear any stale `*.head-broken` flag; write `*.head-ok`; log. Silent success. |
| `1` | **ANDON** — HEAD broken from clean checkout | **raise** `*.head-broken` (timestamp + output tail); log to stderr. **No block.** |
| `2` / other | env error — couldn't check | **fail-open**: log only; leave prior flag state untouched (can't-check ≠ fixed, ≠ newly-broken). |

## Decision 3 — Execution: **BACKGROUND (detached)**, not synchronous

Forced by research: a real `check:head` (full install + check in a worktree)
costs tens of seconds to a minute and **exceeds the ~60s SessionStart hook
timeout**. A synchronous on-clear would (a) delay every incoming session start by
that much and (b) be killed by the timeout before writing its andon — a wedge
*and* a miss. Options:

- **(A) Synchronous foreground.** Simplest, lets the andon ride `additionalContext`
  into the incoming agent's context. **REJECTED** — blocks session start + hits
  the hook timeout. Violates "never wedge / never slow."
- **(B) Background, detached.** on-clear launches the build with `nohup … &`
  (macOS has no `setsid`; `nohup` + backgrounding + stdio redirection detaches it
  so it survives the hook returning), then returns **immediately**. The worker
  translates the exit code into the andon flag when it finishes. **CHOSEN.** The
  session-start critical path stays instant — the loop can never be wedged or
  slowed by this gate, satisfying R11's "slow gate must never wedge" directly.

Tradeoff accepted: the andon is **asynchronous** — it lands in the signals dir a
minute later, consumed by lisa / the human / the next on-clear, **not** in the
starting agent's immediate context. Surfacing it in-context (synchronous mode +
`additionalContext`) is a deferred enhancement, noted in review.md. For a
detect-not-repair gate (E-010 scope) whose consumer is the orchestrator, a
durable flag is the right andon.

**Concurrency guard.** Two on-clears (overlapping panes) must not launch two heavy
builds. An atomic `mkdir` lock (`.lisa/signals/head-build.lock`) gates the launch:
if held, skip (the in-flight build will produce a fresh verdict). The worker
removes the lock in a `trap` on every exit path (mirrors check-head's `finally`).

## Decision 4 — No new TypeScript; the hook is a thin translator (Central Rule)

All "what a HEAD outcome means" already lives in `head-build-core.ts`
(`classifyBuildOutcome`, the 0/1/2 vocabulary). Per the Central Rule, the trigger
**only invokes and translates** — exactly as `on-stop.sh` does for
`check:committed`. So the change is confined to `.lisa/hooks/on-clear.sh`; no
`src/` edit. The exit-code `case` is hook *behavior*, not check *logic* (the same
boundary on-stop already draws).

## Decision 5 — Test/demo seams (justified, default to production)

Two env knobs, defaulting to real behavior, mirroring `check-head.ts`'s
`install`/`check` overrides:

- **`LISA_HEAD_CHECK_CMD`** — the build command (default `bun run check:head`).
  Lets the broken-HEAD demo inject each exit code (`sh -c 'exit 1'`, `exit 0`,
  `exit 2`) deterministically in milliseconds, instead of a real minute-long
  worktree build. T-010-01 already proved a real broken HEAD yields exit `1`;
  this ticket proves the *translation*, so injecting the exit is the right seam.
- **`LISA_HEAD_SYNC`** — when set, run the worker in the foreground (no detach),
  so the demo observes the andon flag deterministically without polling a
  background job. Default unset = background (production).

Both are clearly test/demo-only and documented in the hook. They keep the
broken-HEAD demo (AC#3) fast, offline, and free of any real HEAD mutation.

## What is explicitly OUT of scope

- No debounce; no Dagger-CI-on-HEAD variant (E-010 follow-ups, not this ticket).
- No auto-repair (E-010 scope: detect, don't fix).
- No live lisa-loop trigger verification (deferred per the ticket — future-loop
  effect; we prove the andon by hand).
- `check:committed` / `on-stop.sh` untouched (AC: stay green).
