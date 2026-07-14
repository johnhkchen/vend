#!/bin/sh
# T-010-02 — broken-HEAD andon demo (AC#3).
#
# Proves the on-clear trigger's exit-code -> andon translation across all three
# branches WITHOUT a real (minute-long) worktree build: LISA_HEAD_CHECK_CMD
# injects each exit code, LISA_HEAD_SYNC=1 runs the worker in the foreground so
# the flag is observable deterministically. T-010-01 already proved a real broken
# HEAD yields exit 1; this demo proves what the hook DOES with {0,1,2}.
#
# Run from the repo root:  sh docs/active/work/T-010-02/broken-head-demo.sh
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || exit 2
HOOK=".lisa/hooks/on-clear.sh"
SIG=".lisa/signals"
FAILED=0

check() { # check <label> <condition-result-as-string "PASS"/"FAIL">
    printf '  %-58s %s\n' "$1" "$2"
    [ "$2" = "PASS" ] || FAILED=1
}
exists() { [ -e "$1" ] && echo PASS || echo FAIL; }
absent() { [ -e "$1" ] && echo FAIL || echo PASS; }

# ---- Case 1: broken HEAD (exit 1) -> andon raised, no block --------------------
echo "Case 1 — broken HEAD (check:head exit 1):"
P=demo-broken
rm -f "$SIG/pane-$P".*
ERR="$(LISA_HEAD_SYNC=1 LISA_PANE_ID=$P LISA_HEAD_CHECK_CMD='sh -c "echo missing ./play.ts; exit 1"' \
    sh "$HOOK" 3>&1 1>/dev/null 2>&3)"
RC=$?
check "andon flag pane-$P.head-broken written" "$(exists "$SIG/pane-$P.head-broken")"
check "no head-ok flag" "$(absent "$SIG/pane-$P.head-ok")"
check "stderr carries the andon" "$(printf '%s' "$ERR" | grep -q 'ANDON' && echo PASS || echo FAIL)"
check "hook still exits 0 (WARN, not block)" "$([ "$RC" -eq 0 ] && echo PASS || echo FAIL)"
check "lock released" "$(absent "$SIG/head-build.lock")"

# ---- Case 2: green HEAD (exit 0) clears a stale andon --------------------------
echo "Case 2 — green HEAD (exit 0) clears a stale andon:"
P=demo-green
rm -f "$SIG/pane-$P".*
echo "stale" > "$SIG/pane-$P.head-broken"   # pre-seed a prior broken flag
LISA_HEAD_SYNC=1 LISA_PANE_ID=$P LISA_HEAD_CHECK_CMD='sh -c "exit 0"' sh "$HOOK" >/dev/null 2>&1
check "stale pane-$P.head-broken cleared" "$(absent "$SIG/pane-$P.head-broken")"
check "head-ok flag written" "$(exists "$SIG/pane-$P.head-ok")"

# ---- Case 3: env error (exit 2) -> fail-open, prior state untouched ------------
echo "Case 3 — env error (exit 2) fails open:"
P=demo-failopen
rm -f "$SIG/pane-$P".*
echo "prior-broken" > "$SIG/pane-$P.head-broken"   # a prior andon must survive
LISA_HEAD_SYNC=1 LISA_PANE_ID=$P LISA_HEAD_CHECK_CMD='sh -c "exit 2"' sh "$HOOK" >/dev/null 2>&1
RC=$?
check "prior pane-$P.head-broken left untouched" "$(exists "$SIG/pane-$P.head-broken")"
check "no head-ok falsely written" "$(absent "$SIG/pane-$P.head-ok")"
check "hook exits 0 (never wedges)" "$([ "$RC" -eq 0 ] && echo PASS || echo FAIL)"
check "log records 'could not check'" "$(grep -q 'could not check (exit 2)' "$SIG/head-build.log" && echo PASS || echo FAIL)"

# ---- cleanup -------------------------------------------------------------------
rm -f "$SIG"/pane-demo-*.*

echo
if [ "$FAILED" -eq 0 ]; then
    echo "ALL CASES PASS — andon raised on broken HEAD, cleared on green, fail-open on env error."
    exit 0
else
    echo "DEMO FAILED — see above."
    exit 1
fi
