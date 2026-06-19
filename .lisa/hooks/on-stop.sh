#!/bin/sh
# Lisa stop signal hook — called by Claude Code when it finishes responding.
#
# Two jobs, in order:
#   1. Write the lisa pane signal file (UNCHANGED, load-bearing for pane
#      orchestration) — this runs first and is never gated on anything below.
#   2. E-008 "done means committed" gate (the D-005 fix): run
#      `bun run check:committed` and, if uncommitted/untracked SOURCE is found,
#      BLOCK the stop (exit 2) so Claude Code feeds the andon back to the model
#      and it commits before the session can end.
#
# THE CENTRAL RULE (ci-strategy.md): this hook only INVOKES. The definition of
# "what counts as uncommitted source" lives in src/ci/committed-core.ts, never
# here. The gate runs on the HOST working tree (a Dagger container can't see it),
# which is why E-008 enforces in a lisa hook and not a /ci sub-class.
#
# FAIL OPEN: any inability to run the check (no bun, not a repo, env error) lets
# the stop proceed. A broken checker must never wedge the loop.

# ---- 1. lisa pane signal (unchanged; first; unconditional) ----
SIGNAL_DIR=".lisa/signals"
mkdir -p "$SIGNAL_DIR"

if [ -n "$LISA_PANE_ID" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SIGNAL_DIR/pane-$LISA_PANE_ID.stopped"
fi

# ---- 2. done-means-committed gate (E-008) ----

# Read the Stop-hook stdin payload, but only when stdin is a pipe — never block
# waiting on a tty (e.g. when this hook is run by hand for the dirty-tree demo).
STDIN=""
[ ! -t 0 ] && STDIN="$(cat)"

# stop_hook_active is set by Claude Code when this stop is itself a continuation
# triggered by a prior blocking stop hook — the guard against an infinite block
# loop. If we already blocked once, we warn but allow, so the loop can't wedge.
ALREADY_BLOCKED=0
printf '%s' "$STDIN" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && ALREADY_BLOCKED=1

# Fail open if the toolchain isn't usable — can't check is not the same as dirty.
command -v bun >/dev/null 2>&1 || exit 0
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$ROOT" ] || exit 0

# Run the gate from the repo root (cwd-robust); capture stderr (the offending
# paths), discard stdout (the "ok" line).
GATE_ERR="$(cd "$ROOT" && bun run check:committed 2>&1 1>/dev/null)"
GATE_CODE=$?

# Translate check:committed's exit code into Stop-hook behavior. Note the script
# uses exit 2 for "environment error" while the Stop hook uses exit 2 for
# "block" — so we translate, never blindly propagate.
case "$GATE_CODE" in
    0)
        exit 0 ;;                              # clean — all source committed
    1)                                          # andon — uncommitted source
        printf '%s\n' "on-stop: done-means-committed gate (E-008) — refusing to stop (D-005):" 1>&2
        printf '%s\n' "$GATE_ERR" 1>&2          # relay the offending paths verbatim
        if [ "$ALREADY_BLOCKED" -eq 1 ]; then
            exit 0                              # already blocked once — warn, don't wedge
        fi
        exit 2 ;;                               # block: feed the andon back to Claude
    *)
        printf '%s\n' "on-stop: check:committed could not run (exit $GATE_CODE) — allowing stop" 1>&2
        exit 0 ;;                               # environment error / unknown — fail open
esac
