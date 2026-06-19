# T-010-02 — Plan: trigger-check-head-at-ticket-boundary

*Ordered, independently-verifiable steps. Each maps to an AC. The work is one
hook edit + one demo harness; no `src/` change.*

## Testing strategy

- **No unit tests** — the hook adds no judgment (Central Rule; judgment is
  `head-build-core.ts`, already unit-tested by T-010-01). Shell wiring isn't in
  `bun test`, exactly as `on-stop.sh` isn't.
- **Deterministic demo (AC#3)** — `broken-head-demo.sh` drives all three exit
  branches via `LISA_HEAD_CHECK_CMD` (inject the exit) + `LISA_HEAD_SYNC=1`
  (foreground, no polling). Proves the *translation* (exit → andon flag); T-010-01
  already proved a real broken HEAD yields exit `1`.
- **Regression gate (AC#3)** — `bun run check:typecheck`, `check:test`,
  `check:committed`, and `check:head` must stay green (the edit is shell-only, so
  this is a non-regression confirmation, not new coverage).
- **Live-loop trigger** — deferred per the ticket (future-loop effect). Not
  asserted here.

## Step 1 — Edit `on-clear.sh`: keep signal, add fail-open preflight + lock

- Preserve section 1 verbatim (the `pane-$ID.cleared` write — load-bearing,
  first, unconditional).
- Append section 2 header documenting: the SessionStart/`clear` frequency (per
  ticket/pane boundary), **why not on-stop** (per-turn → catastrophic latency),
  the Central Rule, fail-open, WARN-not-block, and the background+timeout
  rationale. (AC#1 — rationale lives *in* the hook.)
- Define `SCOPE="${LISA_PANE_ID:-local}"`, `CHECK_CMD="${LISA_HEAD_CHECK_CMD:-bun
  run check:head}"`, and the `BROKEN`/`OK`/`LOG`/`LOCK` paths under
  `.lisa/signals/`.
- Fail-open preflight: `command -v bun || exit 0`; `ROOT="$(git rev-parse
  --show-toplevel)" || exit 0`; `[ -n "$ROOT" ] || exit 0`.
- **Verify:** `sh -n .lisa/hooks/on-clear.sh` parses; running with no env (bun
  present, in repo) doesn't error.

## Step 2 — Add the worker + launch (background detach, no function export)

The worker is a `sh` function `run_head_gate` (no lock/trap knowledge — pure
translate):

```
run_head_gate() {
    NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    OUT="$(cd "$ROOT" && eval "$CHECK_CMD" 2>&1)"; CODE=$?
    case "$CODE" in
        0) rm -f "$BROKEN"; printf '%s ok\n' "$NOW" > "$OK"
           printf '%s head-gate: committed HEAD builds\n' "$NOW" >> "$LOG" ;;
        1) rm -f "$OK"
           { printf '%s\n' "$NOW"; printf '%s' "$OUT" | tail -c 500; } > "$BROKEN"
           printf '%s head-gate ANDON: HEAD does not build from a clean checkout\n' "$NOW" >> "$LOG"
           printf 'on-clear: check:head ANDON — committed HEAD does not build (E-007 class):\n%s\n' "$OUT" 1>&2 ;;
        *) printf '%s head-gate: could not check (exit %s) — fail-open, prior state kept\n' "$NOW" "$CODE" >> "$LOG" ;;
    esac
}
```

Launch:

```
mkdir "$LOCK" 2>/dev/null || exit 0          # atomic; skip if a build is in flight
if [ -n "$LISA_HEAD_SYNC" ]; then
    run_head_gate; rmdir "$LOCK" 2>/dev/null  # demo/test: foreground, deterministic
else
    ( trap '' HUP; trap 'rmdir "$LOCK" 2>/dev/null' EXIT; run_head_gate ) \
        </dev/null >>"$LOG" 2>&1 &            # prod: detached subshell
fi
exit 0
```

- The **`( … ) &` subshell** inherits `run_head_gate` and all vars (no `sh -c`
  function-export problem — that was the structure.md note). `trap '' HUP` makes
  it survive the hook process exiting (macOS has no `setsid`; this is the POSIX
  equivalent). Stdio is fully redirected → detached. The hook `exit 0`s
  immediately → never wedges/slows session start (AC#1, R11). (AC#2 — fail-open +
  WARN.)
- The lock is released **only** in the subshell's `EXIT` trap (bg) or after the
  foreground call (sync) — never by the foreground hook in bg mode, or it'd free
  the lock before the build finishes.
- **Verify:** `sh -n` parses; `LISA_HEAD_SYNC=1 LISA_HEAD_CHECK_CMD='sh -c "exit
  0"' LISA_PANE_ID=smoke .lisa/hooks/on-clear.sh` writes `pane-smoke.head-ok`.

## Step 3 — Write `broken-head-demo.sh` (AC#3 demo, all three branches)

A self-contained harness (in the work dir) that, with `LISA_HEAD_SYNC=1` and a
unique `LISA_PANE_ID` per case, drives:

1. **Broken HEAD** (`exit 1`) → asserts `pane-<id>.head-broken` exists,
   `*.head-ok` absent, stderr shows the andon. **No block** (hook still exits 0).
2. **Green HEAD** (`exit 0`), after pre-seeding a stale `*.head-broken` → asserts
   the stale flag is **cleared** and `*.head-ok` written (the broken→fixed
   transition).
3. **Env error** (`exit 2`), after seeding a `*.head-broken` → asserts
   **fail-open**: flag untouched, log records "could not check".

Each case prints `PASS`/`FAIL`; the script exits non-zero if any case fails.
Cleans its `pane-demo-*` signal files at the end. **Verify:** run it; capture full
output into `progress.md`.

## Step 4 — Regression: `check:*` stay green (AC#3 tail)

- `bun run check:typecheck` → clean.
- `bun run check:test` → all green (no test touched).
- `bun run check:committed` → unaffected (on-stop path untouched).
- `bun run check:head` on the live HEAD → exit 0 (smoke; confirms the gate the
  hook now triggers still passes on a good HEAD).

## Step 5 — Write `progress.md` (demo output + any deviations), then `review.md`

- `progress.md`: per-step status, the captured demo output, the regression
  results, and any deviation from this plan + rationale.
- `review.md`: the handoff — what changed, AC-by-AC status, test/demo coverage +
  gaps, open concerns (async andon; stale-lock; live-trigger deferred), verdict.

## Step 6 — Commit (source + artifacts; D-005 staging discipline)

Stage `.lisa/hooks/on-clear.sh` + `docs/active/work/T-010-02/**` (+ the ticket is
left to lisa). Exclude `.lisa/signals/**` (gitignored) and `baml_client/`. One
atomic commit. *(Commit only when the loop/dev expects it — mirrors prior
tickets' final step.)*

## AC traceability

| AC | step(s) |
|---|---|
| #1 coarse trigger + documented frequency/latency rationale, in the hook | 1, 2 |
| #2 broken HEAD → andon (warn, determined like E-008); fail-open if can't run | 2 |
| #3 broken-HEAD demo shows andon; per-turn pitfall documented-as-avoided; future-loop effect noted; `check:*` green | 1 (header), 3, 4, 5 |
