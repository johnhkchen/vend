# T-008-02 — Structure: wire-the-lisa-stop-hook

*File-level blueprint. What changes, the exact shape of the hook, module
boundaries, and ordering. Not code — the shape of the code.*

---

## File inventory

| File | Action | Why |
|---|---|---|
| `.lisa/hooks/on-stop.sh` | **modified** | Add the `check:committed` invocation + exit-code translation on top of the existing signal write. The only behavioral change in the ticket. |
| `docs/active/work/T-008-02/*.md` | **created** | RDSPI artifacts (research, design, structure, plan, progress, review). |

**Nothing else changes.** No new source modules, no `package.json` edit (the
`check:committed` script already exists from T-008-01), no test files (the hook is
a shell trigger; its *logic* — the classifier — is already unit-tested in
T-008-01, matching the "logic is tested, the invoker is smoke-tested" discipline
of `check-committed.ts`/`cli.ts`). No change to `committed-core.ts`,
`check-committed.ts`, or `.claude/settings.local.json` (the `Stop` wiring is
already present and correct).

---

## Module boundary (Central Rule, restated for this file)

```
.claude/settings.local.json   Stop → invokes .lisa/hooks/on-stop.sh   (trigger registration; unchanged)
.lisa/hooks/on-stop.sh        TRIGGER  — signal write + invoke + translate exit codes   ← this ticket
package.json  check:committed → src/ci/check-committed.ts             IMPURE verb (git + exit)   (T-008-01)
src/ci/committed-core.ts      DEFINITION of "good" (pure classifier, SOURCE_PREFIXES)   (T-008-01)
```

The hook holds **no** definition of "uncommitted source." It runs the script and
reacts to a numeric exit code + relays the script's stderr. If `committed-core.ts`
widens scope tomorrow, the hook needs zero edits.

---

## The shape of the new `on-stop.sh`

Ordered top to bottom; each block is small and independent. Prose, not final
syntax (Implement writes the exact shell).

```sh
#!/bin/sh
# Lisa stop hook — (1) lisa pane signal (existing, load-bearing), then
# (2) E-008 "done means committed" gate: run `bun run check:committed` and, on
# uncommitted source, BLOCK the stop (exit 2) so the andon is fed back to Claude.
# Central Rule: this only INVOKES; the definition lives in committed-core.ts.

# ---- Block 1: lisa signal (UNCHANGED, runs first, never gated) ----
SIGNAL_DIR=".lisa/signals"
mkdir -p "$SIGNAL_DIR"
[ -n "$LISA_PANE_ID" ] && echo "<utc-iso>" > "$SIGNAL_DIR/pane-$LISA_PANE_ID.stopped"

# ---- Block 2: read the stop-hook guard from stdin, only if stdin is a pipe ----
STDIN=""
[ ! -t 0 ] && STDIN="$(cat)"
ALREADY_BLOCKED=0
printf '%s' "$STDIN" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' && ALREADY_BLOCKED=1

# ---- Block 3: locate repo root + bun; fail OPEN if the toolchain isn't usable ----
command -v bun >/dev/null 2>&1 || exit 0           # no bun → can't check → allow
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$ROOT" ] || exit 0

# ---- Block 4: run the gate, capture stderr (the offending-paths andon) ----
GATE_ERR="$(cd "$ROOT" && bun run check:committed 2>&1 1>/dev/null)"
GATE_CODE=$?

# ---- Block 5: translate check:committed exit → Stop-hook behavior ----
case "$GATE_CODE" in
  0) exit 0 ;;                                       # clean → allow stop
  1)                                                 # andon → uncommitted source
     printf '%s\n' "on-stop: done-means-committed gate (E-008) — refusing to stop:" 1>&2
     printf '%s\n' "$GATE_ERR" 1>&2                  # relay the offending paths verbatim
     [ "$ALREADY_BLOCKED" -eq 1 ] && exit 0          # already blocked once → warn, don't wedge
     exit 2 ;;                                        # block: feed andon back to Claude
  *) printf '%s\n' "on-stop: check:committed could not run (exit $GATE_CODE) — allowing stop" 1>&2
     exit 0 ;;                                        # env error / unknown → fail open
esac
```

### Why each block is shaped this way

- **Block 1 first and unconditional** — the lisa signal is the hook's original
  contract; nothing downstream may prevent it. (Robustness invariant.)
- **Block 2 tty-guarded `cat`** — consuming stdin only on a pipe prevents a hang
  when the hook is run by hand in the dirty-tree demo (Design D3).
- **Block 3 fail-open guards** — missing `bun` or no git root means "can't
  check," which must never block. Two early `exit 0`s, each after the signal is
  already written.
- **Block 4 captures stderr, discards stdout** — the andon (paths) is on stderr;
  the "ok" line on stdout is noise here. `cd "$ROOT"` makes the gate cwd-robust.
- **Block 5 the translation table** — exactly the Design D2 mapping. The
  `ALREADY_BLOCKED` short-circuit is the single infinite-loop guard.

---

## Public interface / contract the hook depends on

From T-008-01, treated as a frozen contract (do not re-implement):
- Command: `bun run check:committed`.
- Exit codes: `0` clean · `1` uncommitted source · `2` environment error.
- The offending paths arrive on the script's **stderr**, already labelled.

The hook's own contract to lisa/Claude Code:
- Always writes `pane-$LISA_PANE_ID.stopped` when `LISA_PANE_ID` is set.
- Exit `2` ⇔ "uncommitted source, blocking this stop" (first block only).
- Exit `0` otherwise (clean, fail-open, or already-blocked-once).

---

## Ordering of changes (matters)

1. Write the new `on-stop.sh` (single file edit).
2. Keep it executable (`chmod +x` already set; preserve the mode).
3. Demonstrate via the dirty-tree demo *before* committing, so the andon is
   observed, then clean up the demo artifact.
4. Commit the hook + artifacts (the commit itself must leave the tree clean, or
   the gate would flag this very work — eat-your-own-dogfood check).

---

## Risk surface (carried to Plan/Review)

- **Effect is next-loop** — editing the hook changes only future stops; the live
  hook-fires path is unverifiable this session. Deferred E2E flagged.
- **No `timeout`** — a pathological `git status` hang is theoretically possible;
  accepted as minimal-and-portable over a fragile dependency.
- **`stop_hook_active` not guaranteed** in the stdin payload — if absent, the hook
  may block once per *real* stop rather than once per *sequence*; still bounded
  and safe (Claude commits, next stop is clean).
