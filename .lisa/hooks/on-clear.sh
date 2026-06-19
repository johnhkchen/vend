#!/bin/sh
# Lisa clear signal hook — called by Claude Code after /clear is processed
# (SessionStart, matcher "clear" in .claude/settings.json).
#
# Two jobs, in order:
#   1. Write the lisa pane "cleared" signal (UNCHANGED, load-bearing for pane
#      orchestration) — runs first, never gated on anything below.
#   2. E-010 "committed HEAD builds" gate (T-010-02): trigger `check:head` — the
#      isolated committed-HEAD build (T-010-01) — at THIS coarse boundary.
#
# WHY HERE AND NOT on-stop (the central design decision, R11 — confirmed, not
# assumed): hook frequencies from .claude/settings.json —
#     on-heartbeat (PostToolUse) … per tool call      ── highest
#     on-stop      (Stop)         … per response/turn  ── E-008's check:committed
#     on-idle      (Notification) … per idle prompt
#     on-clear     (SessionStart/clear) … per /clear ≈ once per ticket ── coarsest
# E-008's `check:committed` is a fast `git status`, so on-stop (per-turn) is fine.
# `check:head` is the OPPOSITE: a full `bun install` + `bun run check` in a fresh
# git worktree (tens of seconds to ~a minute). On a per-turn hook that is
# catastrophic latency. So the heavy gate fires only at the coarse on-clear
# (per-ticket) boundary. (E-010 decompose settled this; the propose step had
# wrongly assumed it "hangs off the same on-stop wiring point" as E-008.)
#
# THE CENTRAL RULE (ci-strategy.md): this hook only INVOKES + translates. The
# definition of "does HEAD build / what the exit code means" lives in
# src/ci/head-build-core.ts (the 0/1/2 vocabulary), never here.
#
# BLOCK vs WARN (determined like E-008, NOT assumed): E-008's on-stop BLOCKS
# (Stop-hook exit 2 re-prompts Claude to commit). That lever does not exist here:
# on-clear is a SessionStart hook — it fires AFTER the boundary and cannot re-
# prompt/halt; and the build is heavy + async. So a broken HEAD raises a durable
# WARN/andon FLAG (a signal file lisa already watches) + stderr — it never blocks.
#
# FAIL OPEN / NEVER WEDGE: any inability to run the check lets the clear proceed.
# The build runs DETACHED IN THE BACKGROUND so the session-start path stays
# instant and never trips the SessionStart hook timeout (a synchronous full build
# would exceed it and be killed). A broken or slow gate must never wedge the loop.
#
# NOTE: editing this hook affects FUTURE on-clear events (this session cannot
# observe its own next /clear). Live-loop trigger verification is DEFERRED per the
# ticket; the broken-HEAD andon is proven by hand (see work/T-010-02/).

# ---- 1. lisa pane "cleared" signal (UNCHANGED; first; unconditional) ----
SIGNAL_DIR=".lisa/signals"
mkdir -p "$SIGNAL_DIR"

if [ -n "$LISA_PANE_ID" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SIGNAL_DIR/pane-$LISA_PANE_ID.cleared"
fi

# ---- 2. committed-HEAD build andon gate (T-010-02 / E-010) ----

# Scope label: real loops carry LISA_PANE_ID; a by-hand demo has none, so fall
# back to "local" so the andon flag is still written and visible.
SCOPE="${LISA_PANE_ID:-local}"
# The build command. Default is the real gate; the broken-HEAD demo overrides it
# with `sh -c 'exit N'` to drive each branch deterministically (the offline/test
# seam, mirroring check-head.ts's install/check overrides).
CHECK_CMD="${LISA_HEAD_CHECK_CMD:-bun run check:head}"
BROKEN="$SIGNAL_DIR/pane-$SCOPE.head-broken"
OK="$SIGNAL_DIR/pane-$SCOPE.head-ok"
LOG="$SIGNAL_DIR/head-build.log"
LOCK="$SIGNAL_DIR/head-build.lock"

# Fail-open preflight: "can't check" is not "found a problem."
command -v bun >/dev/null 2>&1 || exit 0
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$ROOT" ] || exit 0

# The worker: run the gate, translate its exit code into an andon flag. Pure
# translation — it owns NO judgment (that is head-build-core.ts) and NO lock/trap
# bookkeeping (the caller owns that), so it runs identically foreground or bg.
run_head_gate() {
    NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    OUT="$(cd "$ROOT" && eval "$CHECK_CMD" 2>&1)"
    CODE=$?
    case "$CODE" in
        0)  # committed HEAD builds — clear any stale andon, record green.
            rm -f "$BROKEN"
            printf '%s ok\n' "$NOW" > "$OK"
            printf '%s head-gate: committed HEAD builds\n' "$NOW" >> "$LOG"
            ;;
        1)  # ANDON — HEAD does not build from a clean checkout (E-007 class).
            rm -f "$OK"
            { printf '%s\n' "$NOW"; printf '%s' "$OUT" | tail -c 500; } > "$BROKEN"
            printf '%s head-gate ANDON: HEAD does not build from a clean checkout\n' "$NOW" >> "$LOG"
            printf 'on-clear: check:head ANDON — committed HEAD does not build (E-007 class):\n%s\n' "$OUT" 1>&2
            ;;
        *)  # environment error (exit 2 / unknown) — fail-open, keep prior state.
            printf '%s head-gate: could not check (exit %s) — fail-open, prior state kept\n' "$NOW" "$CODE" >> "$LOG"
            ;;
    esac
}

# Atomic lock: skip if a build is already in flight, so two on-clears (e.g.
# overlapping panes) never launch two heavy builds. Released only by the worker.
mkdir "$LOCK" 2>/dev/null || exit 0

if [ -n "$LISA_HEAD_SYNC" ]; then
    # Demo/test: run foreground so the andon flag is observable deterministically
    # (no background race). Default production path is the detached branch below.
    run_head_gate
    rmdir "$LOCK" 2>/dev/null
else
    # Production: run the heavy build in a DETACHED subshell and return at once.
    # `trap '' HUP` lets it outlive this hook process (macOS has no setsid); the
    # EXIT trap releases the lock on every path; stdio is fully redirected.
    ( trap '' HUP; trap 'rmdir "$LOCK" 2>/dev/null' EXIT; run_head_gate ) </dev/null >>"$LOG" 2>&1 &
fi

exit 0
