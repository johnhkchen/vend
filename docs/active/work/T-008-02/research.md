# T-008-02 — Research: wire-the-lisa-stop-hook

*Descriptive map of what exists today. No solutions here — that is Design's job.
Goal: understand exactly how the lisa stop hook fires, what it currently does,
what `check:committed` (T-008-01) gives us, and what "block vs warn" actually
means on this machine — so the design isn't built on an assumption.*

---

## What this ticket must do

Make the E-008 gate *fire automatically*: when a session stops, run
`bun run check:committed` (built in T-008-01) and surface a clear
**uncommitted-code andon** (the offending source paths) so a loop cannot quietly
mark a ticket done with uncommitted source. The Central Rule holds — the hook
only *invokes*; the judgment lives in `committed-core.ts`.

---

## The hook trigger: it is a Claude Code `Stop` hook (verified, not assumed)

`.lisa/hooks/on-stop.sh` is not a lisa-private mechanism. It is wired as a
**Claude Code `Stop` hook** in `.claude/settings.local.json`:

```json
"Stop": [
  { "hooks": [
      { "type": "command",
        "command": "test -x .lisa/hooks/on-stop.sh && .lisa/hooks/on-stop.sh" } ] } ]
```

So the trigger and its semantics are Claude Code's hook contract, and the R11
"does a non-zero hook block or warn?" question is answerable precisely from the
Claude Code hooks docs (confirmed this session, source
`https://code.claude.com/docs/en/hooks.md`):

| Stop-hook exit code | Effect |
|---|---|
| **0** | Stop proceeds. (May emit JSON to block via `decision:"block"`.) |
| **2** | **Blocking.** Stop is prevented; **stderr is fed back to Claude** so it can act on the feedback and keep working. |
| **other non-zero (e.g. 1)** | **Non-blocking warning.** stderr shows in the transcript as a hook-error notice; the stop proceeds. |

Stdin to a Stop hook is a JSON object (`session_id`, `transcript_path`, `cwd`,
`hook_event_name:"Stop"`, …). Claude Code historically also passes a
`stop_hook_active` flag that is true when this stop is itself a continuation
triggered by a prior blocking stop hook — the standard guard against an infinite
block loop. The docs reviewed did **not** enumerate it, so the design must treat
its presence as best-effort, not guaranteed.

**Consequence:** blocking is genuinely available here (exit 2), not merely
warn-only. The ticket's hedge ("if it only warns…") is now resolved: we can
choose. That choice, and its safety, is the central Design decision.

---

## What `on-stop.sh` does today (must be preserved)

```sh
#!/bin/sh
SIGNAL_DIR=".lisa/signals"
mkdir -p "$SIGNAL_DIR"
if [ -n "$LISA_PANE_ID" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$SIGNAL_DIR/pane-$LISA_PANE_ID.stopped"
fi
```

It writes a per-pane `*.stopped` signal file that the lisa zellij plugin reads to
know the pane is ready for input — this is **load-bearing for lisa's pane
orchestration**. The four sibling hooks (`on-heartbeat`, `on-idle`, `on-clear`,
`on-stop`) all follow the identical signal-write shape. `.lisa/signals/` is
gitignored (`.lisa/.gitignore` → `signals/`).

**Hard constraint:** whatever this ticket adds, the signal write must still
happen on every stop, first and unconditionally. If a new check ever errored
before the signal write, lisa would stop advancing the pane — the exact "wedge
the loop" meta-risk the ticket warns about.

---

## What `check:committed` gives us (the thing we invoke)

From T-008-01 (`phase: done`, all ACs met):

- **`package.json`** → `"check:committed": "bun run src/ci/check-committed.ts"`.
- **`src/ci/check-committed.ts`** — thin impure entry. Resolves repo root via
  `git rev-parse --show-toplevel`, runs `git status --porcelain`, delegates to
  the pure classifier, and exits with:
  - **0** — clean (all source committed); prints `ok` to stdout.
  - **1** — **andon**: uncommitted/untracked source. Prints to **stderr**:
    `check:committed: uncommitted source — commit before stopping (D-005):`
    followed by one indented offending path per line.
  - **2** — environment error (not a git repo / `git status` failed). stderr.
- **`src/ci/committed-core.ts`** — pure classifier. Exports the R12 shared
  contract `SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"]` and
  `classifyPorcelain()`. 16 unit tests green.

So the hook's job is purely: run the script, read its exit code, and translate it
into the right Stop-hook behavior — naming the offending paths in the andon. The
paths are already on the script's stderr, so the hook can simply relay them.

Exit-code collision to handle deliberately: the **script** uses `2` for
"environment error", while the **Stop hook** uses `2` for "block". The hook must
*translate*, never blindly propagate the script's code.

---

## The architectural reason this is a hook, not a `/ci` sub-class

`check:committed` reads the **host git working tree**. The Dagger CI module
(`docs/knowledge/ci-strategy.md`, the Central Rule) runs checks **inside a
container**, which cannot see the host's uncommitted/untracked files. So the
"is everything committed?" check is structurally un-runnable in `/ci` — the only
correct enforcement point is a host-side lisa hook. This is by design, not a
shortcut (the ticket's design note confirms it).

The Central Rule still holds, just relocated: the hook is the *trigger* (like a
Dagger sub-class), and `committed-core.ts` is the *definition of good*. Logic
never enters the hook shell.

---

## lisa loop context (shapes the meta-risk)

`.lisa.toml`: `max_threads = 2`, `auto_advance = false`,
`session_timeout_secs = 3600`, `wind_down_secs = 300`. Tickets advance through
RDSPI phases via artifact detection; multiple panes can run concurrently on the
shared branch. Each pane has its own `$LISA_PANE_ID` and its own signal file.

Two facts this forces onto the design:
1. **Effect is next-loop, not this-loop.** Editing `.lisa/hooks/on-stop.sh` only
   changes how *future* stops behave. The live hook-trigger path cannot be
   verified inside this session — it is observed at the next real session-stop.
   So end-to-end (hook-fires) verification is necessarily deferred; only
   `check:committed` standalone + the script-translation logic are testable now.
2. **A wedge is expensive.** With autonomous, possibly unattended panes, a hook
   that hangs or errors before the signal write halts orchestration. Robustness
   (always-signal-first, fail-open on tooling error, never hang) outranks
   strictness.

---

## D-005: the target this closes

D-005 is the recurring "loop ended with source written but never committed,
leaving HEAD broken" andon — it recurred across E-001 / E-006 / E-007, most
recently during E-007's cross-file refactor (shared-file churn). The fileset of
all three incidents was source under `src/`/`baml_src/` — exactly
`SOURCE_PREFIXES`. A stop-time gate that sees that dirty source is the
structural fix; whether it *warns* or *blocks* decides whether D-005 is merely
surfaced or actually prevented.

---

## Current baseline (this session, pre-change)

- `git status --porcelain`: only the two T-008 ticket files (M) and the
  T-008-01 work artifacts (??) are dirty — **no source paths**, so
  `bun run check:committed` exits **0** ("ok — all source committed").
- `bun test`: **282 pass / 0 fail** across 20 files.
- The hook directory holds four executable `*.sh` siblings, all signal-writers.

---

## Open questions carried into Design

1. **Block or warn for the first slice?** Both are now available. Block (exit 2)
   prevents D-005 in the autonomous case but risks an infinite block loop without
   a guard; warn (non-zero) only surfaces. Decide and justify.
2. **How to guard a blocking hook** against infinite loops (`stop_hook_active`?)
   while keeping the script "minimal and robust."
3. **Translate the script's exit 2** (env error) — block, warn, or fail-open?
4. **Reading stdin safely** — must not hang when the hook is run manually
   (tty) for the dirty-tree demo.
5. **Ordering** — guarantee the lisa signal write happens first/always.
