# T-010-02 — Structure: trigger-check-head-at-ticket-boundary

*The shape of the change — files, the on-clear.sh blueprint, signal/lock layout,
and the contract boundaries. Not code; the skeleton the Plan fills in.*

## Files

| file | action | what |
|---|---|---|
| `.lisa/hooks/on-clear.sh` | **modify** | Keep the load-bearing `.cleared` signal write (first, unconditional). Append the HEAD-build andon gate: fail-open preflight → lock → launch `check:head` (background, detached) → worker translates exit `{0,1,2}` into andon-flag actions. |
| `docs/active/work/T-010-02/*.md` | **create** | RDSPI artifacts (this set). |
| `docs/active/work/T-010-02/broken-head-demo.sh` | **create** | Self-contained demo harness driving all three exit-code branches via `LISA_HEAD_CHECK_CMD` + `LISA_HEAD_SYNC`; output captured into progress.md (AC#3). |

**Not touched:** `src/**` (check:head already complete), `package.json`,
`.lisa/hooks/on-stop.sh`, `check-committed.ts`/`committed-core.ts`. No new
TypeScript (Central Rule — judgment stays in `head-build-core.ts`).

## `on-clear.sh` blueprint (shell, POSIX `/bin/sh`)

Ordered sections, mirroring `on-stop.sh`'s discipline:

```
#!/bin/sh
# header: purpose, the on-clear/SessionStart frequency + WHY not on-stop
#         (per-turn → catastrophic latency), the Central Rule, fail-open,
#         WARN-not-block rationale, background rationale (hook timeout).

# ── 1. lisa pane signal (UNCHANGED, first, unconditional) ──────────────
SIGNAL_DIR=".lisa/signals"
mkdir -p "$SIGNAL_DIR"
[ -n "$LISA_PANE_ID" ] && echo "<utc>" > "$SIGNAL_DIR/pane-$LISA_PANE_ID.cleared"

# ── 2. committed-HEAD build andon gate (T-010-02 / E-010) ──────────────
# scope label so the by-hand demo (no pane id) still flags visibly
SCOPE="${LISA_PANE_ID:-local}"
CHECK_CMD="${LISA_HEAD_CHECK_CMD:-bun run check:head}"
BROKEN="$SIGNAL_DIR/pane-$SCOPE.head-broken"
OK="$SIGNAL_DIR/pane-$SCOPE.head-ok"
LOG="$SIGNAL_DIR/head-build.log"
LOCK="$SIGNAL_DIR/head-build.lock"

# fail-open preflight: can't-check ≠ broken
command -v bun >/dev/null 2>&1 || exit 0
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$ROOT" ] || exit 0

# atomic lock: skip if a build is already in flight (no double heavy build)
mkdir "$LOCK" 2>/dev/null || exit 0

# worker: run the gate, translate exit → andon flag. Defined as a function so
# it can run foreground (demo/test, LISA_HEAD_SYNC) or background (prod).
run_head_gate() {
    trap 'rmdir "$LOCK" 2>/dev/null' EXIT          # release lock, ALL paths
    OUT="$(cd "$ROOT" && eval "$CHECK_CMD" 2>&1)"; CODE=$?
    case "$CODE" in
        0)  rm -f "$BROKEN"; echo "<utc> ok" > "$OK"
            printf '%s head-gate: HEAD builds\n' "<utc>" >> "$LOG" ;;
        1)  rm -f "$OK"
            { echo "<utc>"; printf '%s' "$OUT" | tail -c 500; } > "$BROKEN"
            printf '%s head-gate ANDON: HEAD does not build\n' "<utc>" >> "$LOG"
            printf 'on-clear: check:head ANDON — committed HEAD does not build:\n%s\n' \
                "$OUT" 1>&2 ;;                       # WARN, never block
        *)  printf '%s head-gate: could not check (exit %s) — fail-open\n' \
                "<utc>" "$CODE" >> "$LOG" ;;          # env error: leave state
    esac
}

if [ -n "$LISA_HEAD_SYNC" ]; then
    run_head_gate                                   # demo/test: foreground
else
    nohup sh -c 'run_head_gate' </dev/null >>"$LOG" 2>&1 &  # prod: detached bg
fi
exit 0
```

> Note: the `nohup sh -c 'run_head_gate'` line is illustrative — a child `sh`
> won't see the parent's function. The Plan resolves this by exporting the needed
> vars and re-deriving the worker inline in the backgrounded subshell (a `(
> ... ) &` block that closes over the already-set shell variables), so detachment
> works without a function export. See plan.md step 2.

## Signal / lock layout (under `.lisa/signals/`, gitignored)

| path | written by | meaning | lifecycle |
|---|---|---|---|
| `pane-<scope>.cleared` | section 1 (unchanged) | context cleared | per on-clear |
| `pane-<scope>.head-broken` | worker, exit 1 | **ANDON**: HEAD broken | created on 1; removed on next 0 |
| `pane-<scope>.head-ok` | worker, exit 0 | last build green | created on 0; removed on next 1 |
| `head-build.log` | worker, all paths | rolling verdict log | append-only |
| `head-build.lock/` | launch | a build is in flight | mkdir on launch; rmdir in worker `trap` |

`<scope>` = `LISA_PANE_ID` in a real loop, `local` by hand — so the demo flags
visibly without a pane id. All of this is under the gitignored `signals/` dir, so
no runtime state is ever committed (confirmed: `.lisa/.gitignore` = `signals/`).

## Contract boundaries (what owns what)

- **`head-build-core.ts`** owns the *judgment* — what `{0,1,2}` MEANS. Unchanged.
- **`check-head.ts`** owns the *build mechanism* — worktree, install, check, exit.
  Unchanged.
- **`on-clear.sh`** owns only the *trigger behavior* — when to run it (the coarse
  boundary), and how an exit code maps to an andon flag (warn, never block) and to
  background execution. This is the sole new surface.
- **`settings.json`** already maps `SessionStart/clear → on-clear.sh`. **No change
  needed** — we edit the script the existing wiring already calls.

## Control flow (one on-clear event)

1. Write `.cleared` (load-bearing) — always, first.
2. Preflight (bun? git repo?) — if not, `exit 0` (fail-open).
3. `mkdir` lock — if held, `exit 0` (a build is already running).
4. Background-launch (or foreground if `LISA_HEAD_SYNC`) the worker; **return
   immediately** (never wedge).
5. Worker: run `check:head`, `case` on exit → set/clear andon flag + log;
   `trap` releases the lock on every path.

## Ordering / dependencies

- The `.cleared` write must stay **before** the gate (it is load-bearing for pane
  orchestration; on-stop draws the same line for its signal write).
- The lock `mkdir` must be **before** the launch and released **only** in the
  worker's `trap` (not the foreground hook), or the prod background path would
  release it before the build finishes.
