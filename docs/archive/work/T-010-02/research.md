# T-010-02 — Research: trigger-check-head-at-ticket-boundary

*Descriptive map of what exists and where it connects. The ticket asks for ONE
thing: wire the already-built `check:head` gate (T-010-01) to fire automatically
at a **coarse** boundary — **not** E-008's per-turn `on-stop`. Below: the hooks,
their actual frequencies (confirmed, per R11), the gate it triggers, and the
sibling wiring pattern it must mirror.*

## The gate to be triggered (already shipped — T-010-01, done)

- `package.json` → `"check:head": "bun run src/ci/check-head.ts"`.
- `src/ci/check-head.ts` — the thin IMPURE verb. `buildCommittedHead()`:
  `git rev-parse` preflight → `mkdtemp` → `git worktree add --detach <tmp> HEAD`
  → optional `bun install` → `bun run check` (baml:gen → typecheck → test) in the
  isolated tree → `finally` removes the worktree on **every** path. The
  `import.meta.main` block classifies and `process.exit`s.
- `src/ci/head-build-core.ts` — the PURE classifier. `classifyBuildOutcome()`
  maps a `BuildOutcome` to a `HeadVerdict` with this **exit vocabulary** (copied
  from `check-committed.ts`, the sibling gate):
  - **`0`** — committed HEAD builds (gate passes).
  - **`1`** — **ANDON**: HEAD does not build from a clean checkout (the E-007
    partial-commit class).
  - **`2`** — environment error (git missing / not a repo / `worktree add`
    failed) — **kept DISTINCT from a broken HEAD so the trigger can fail-open**.

This vocabulary is the contract T-010-02 consumes. The trigger never re-decides
"good"; it only translates `{0,1,2}` into hook behavior (the Central Rule).

**Cost shape (load-bearing for the trigger choice):** a real `check:head` does a
full `bun install` + `baml:gen` + `tsc` + `bun test` inside a fresh worktree.
T-010-01's review calls this "intentionally slow" (tens of seconds to ~a minute)
and is why it kept the heavy path out of `bun test` (only a synthetic fixture is
in-suite). This cost is *the* reason the trigger must be coarse.

## The hooks and their CONFIRMED frequencies (R11 — "confirm first")

`.claude/settings.json` is the authoritative wiring. It maps Claude-Code hook
events → the `.lisa/hooks/*.sh` scripts:

| hook script | CC event (matcher) | fires… | frequency |
|---|---|---|---|
| `on-heartbeat.sh` | `PostToolUse` | after every tool call | **highest** |
| `on-stop.sh` | `Stop` | every time Claude finishes a response | **per-turn** |
| `on-idle.sh` | `Notification` (`idle_prompt`) | session goes idle awaiting input | low |
| `on-clear.sh` | `SessionStart` (`clear`) | after `/clear` is processed | **per ticket/pane boundary — coarsest** |

Confirmed from each script's own header comment + the settings wiring:
- `on-stop.sh`: *"called by Claude Code when it finishes responding."* → **per
  turn.** Putting a ~minute build here = a minute of latency after EVERY model
  turn = the catastrophic-latency pitfall the ticket names.
- `on-clear.sh`: *"called by Claude Code after /clear is processed… so the plugin
  knows context has been cleared."* It writes `pane-$ID.cleared`. lisa uses
  `/clear` to recycle a pane between tickets, so **on-clear ≈ once per ticket** —
  the coarse boundary the ticket prescribes.

So the frequency ordering (highest→lowest): heartbeat ≫ stop ≫ idle ≳ clear. The
gate's cost belongs at the **bottom** of that ordering. `on-clear` is it.

## The sibling wiring pattern to mirror — `on-stop.sh` (E-008 / T-008-02)

`on-stop.sh` is the template for "hook invokes a `check:*` gate and translates its
exit code." Its shape, which T-010-02 mirrors structurally:

1. **Signal write FIRST, unconditional, load-bearing** — `pane-$ID.stopped` is
   written before any gate logic and is *never* gated on the check. (`on-clear`'s
   `pane-$ID.cleared` write is the analogous load-bearing line — must stay first.)
2. **Fail-open preflight** — `command -v bun || exit 0`; `git rev-parse … || exit
   0`. "Can't check" ≠ "found a problem." Never wedge.
3. **Run the gate from repo root** (`cd "$ROOT"`; cwd-robust).
4. **Translate exit code via `case`** — the hook owns the *behavior*, the script
   owns the *judgment*:
   - `0` → proceed.
   - `1` (andon) → E-008 **BLOCKS** (`exit 2` re-prompts Claude to commit), with
     an `ALREADY_BLOCKED` guard so it can't wedge into an infinite loop.
   - `*` → fail-open (`exit 0`), distinguishing env-error from a real andon.

The crucial difference T-010-02 must reason about (not copy blindly): E-008's
check is **fast** (`git status`) and runs on a **blockable** Stop hook, so BLOCK
is right. `check:head` is **slow** and `on-clear` is a **SessionStart** hook — a
different block-vs-warn situation (resolved in design.md).

## Constraints & assumptions surfaced (R11 honesty)

- **SessionStart hooks don't meaningfully block.** Unlike `Stop`/`PreToolUse`, a
  SessionStart hook's `exit 2` shows stderr but does not re-prompt or halt — it
  fires *after* the boundary. So the on-stop "block" andon doesn't transfer; the
  andon here must be a **flag/warn** (determined, not assumed — design.md).
- **Hook timeout.** Claude-Code hooks run under a timeout (default ~60s). A real
  `check:head` exceeds that. A synchronous on-clear build would be killed AND
  would delay session start — a wedge. This pushes toward **non-blocking**
  execution (design.md).
- **The hook edit affects FUTURE loops only.** Editing `on-clear.sh` changes what
  the *next* `/clear` does; this session can't observe its own future on-clear.
  Per the ticket, **live trigger verification is deferred** — this ticket proves
  the andon/translation by hand, not by a live loop.
- **`.lisa/.gitignore`** exists — confirm whether `on-clear.sh` and the signals
  dir are tracked before assuming the edit lands in git (checked at Implement).
- **No new judgment logic belongs in the hook** (Central Rule). All "what a HEAD
  outcome means" already lives in `head-build-core.ts`. T-010-02 adds *trigger
  wiring*, not a new gate.

## What this ticket touches (preview, not prescription)

The only behavioral change is inside `.lisa/hooks/on-clear.sh` (+ its work
artifacts). No `src/` change is required — `check:head` already exists and is
complete. The `bun run check:*` scripts and `check:committed`/`on-stop.sh` must
stay untouched and green.
