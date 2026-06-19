# T-008-02 — Review: wire-the-lisa-stop-hook

*Self-assessment and handoff. What changed, test coverage, open concerns —
enough for a human to understand the work without reading every diff.*

---

## What this ticket delivers

The E-008 "done means committed" gate now **fires automatically**. The lisa
`on-stop` hook — which is a Claude Code `Stop` hook — runs
`bun run check:committed` (T-008-01) at every session stop and, when uncommitted
or untracked **source** (`src/`/`baml_src/`/`ci/`) is present, **blocks the stop**
(exit 2) and feeds the offending-paths andon back to Claude so it commits before
the session can end. This is the structural fix for **D-005** (loops ending with a
broken/uncommitted HEAD), and it closes the loop E-008 opened: T-008-01 built the
detector; T-008-02 pulls its trigger.

The Central Rule holds: the hook only **invokes**; the definition of "uncommitted
source" stays in `src/ci/committed-core.ts`. The gate runs on the **host** working
tree, which is why it is a lisa hook and not a `/ci` Dagger sub-class (a container
can't see the host tree).

---

## Files changed

| File | Action | Summary |
|---|---|---|
| `.lisa/hooks/on-stop.sh` | modified | Added the gate on top of the unchanged signal write: tty-guarded stdin read, `stop_hook_active` guard, fail-open toolchain guards, gate invocation, exit-code translation. |
| `docs/active/work/T-008-02/*.md` | created | RDSPI artifacts (research, design, structure, plan, progress, this review). |

Committed atomically in `55d7665`, leaving the tree with **no source paths
dirty** — the gate passes on its own work (dogfooded).

**Not changed (deliberately):** `package.json` (the `check:committed` script
already exists), `committed-core.ts` / `check-committed.ts` (consumed as a frozen
contract), `.claude/settings.local.json` (the `Stop`→hook wiring already exists),
and the three sibling hooks (`on-heartbeat`/`on-idle`/`on-clear`).

---

## How it works (one paragraph)

On stop, the hook (1) writes the lisa pane signal **first and unconditionally**
(load-bearing for pane orchestration — nothing may prevent it), then (2) reads the
Stop-hook stdin only if stdin is a pipe (so a manual run on a tty never hangs),
checks for `stop_hook_active`, fails open if `bun`/git aren't usable, runs
`bun run check:committed` from the repo root capturing its stderr, and translates
its exit code: **0** → allow stop; **1** (andon) → relay the paths and **exit 2 to
block** (or exit 0 if we already blocked once this sequence); **anything else**
(env error) → print a notice and **fail open**. The script's exit-2 ("can't
check") is intentionally *not* propagated as the hook's exit-2 ("block") — the
hook translates, never blindly forwards.

---

## Block-vs-warn decision (R11) — determined, not assumed

Confirmed against the Claude Code hooks docs (this session): a Stop hook's
**exit 2 blocks** and feeds stderr to Claude; other non-zero only warns; exit 0
allows. So blocking is genuinely available — the ticket's "if it only warns…"
hedge is resolved in favor of the stronger behavior.

**First-slice behavior (recorded): block, guarded, fail-open.** Block on dirty
source because the epic's value is *prevention*, and in an autonomous,
possibly-unattended lisa loop warn-only changes nothing about whether a broken
HEAD ships. The block is bounded by `stop_hook_active` (block at most once per
stop-sequence, then warn — never an infinite wedge) and by fail-open on any
tooling/env error. The documented **fallback** if blocking ever proves disruptive
in a live loop is a one-character downgrade to warn-only (`exit 2` → `exit 0` on
the andon branch); the lisa signal write is untouched by that change. No
"stronger" follow-up is deferred — guarded-block is the intended steady state.

---

## Acceptance criteria — all met

- **AC#1** — hook runs `bun run check:committed` at stop and, on failure,
  surfaces a clear andon naming the uncommitted source paths. ✅ Demoed: a stray
  `src/ci/_demo_dirty.ts` produced the andon with the path on the hook's stderr.
- **AC#2** — block-vs-warn determined and documented (not assumed); first-slice
  recorded, fallback flagged. ✅ See "Block-vs-warn decision" + design.md D1.
- **AC#3** — dirty-tree demo shows the andon fires; hook minimal/robust;
  effect-next-loop noted; `check:*` stay green. ✅ Demo in progress.md Step 4;
  `tsc --noEmit` clean, `bun test` 282/0, `check:committed` exit 0 on final tree.

---

## Test coverage

- **Logic: already covered.** What counts as uncommitted source is the pure
  `classifyPorcelain` — 16 unit tests in T-008-01. The hook adds **no logic**, so
  no new unit tests; it is a shell trigger, smoke-verified like
  `check-committed.ts`'s `import.meta.main` shell and `cli.ts`.
- **Hook: smoke-verified.** Clean→allow(0)+signal, dirty→block(2)+andon,
  `stop_hook_active`→warn(0), cleanup→clean — all observed (progress.md Steps 3–4).
- **Regression:** typecheck clean; full suite 282 pass / 0 fail.

---

## Open concerns (for human attention)

1. **Live hook-fires path is deferred (by nature).** Editing
   `.lisa/hooks/on-stop.sh` changes only *future* stops. The real "Claude Code
   invokes the hook at stop, gets exit 2, and continues" cannot be observed in the
   session that edits it. The translation logic + dirty-tree demo stand in;
   **confirm at the next real session-stop** that a dirty tree actually blocks and
   the andon reaches the model. This is the one thing a reviewer should watch for.
2. **`stop_hook_active` is best-effort.** The reviewed docs did not enumerate it
   in the Stop stdin payload. If Claude Code doesn't send it, the hook blocks once
   per *real* stop instead of once per *sequence* — still bounded and safe (Claude
   commits, the next stop is clean), just one extra block in the worst case.
3. **Relayed andon carries `bun run` wrapper noise.** Because AC#1 mandates
   `bun run check:committed`, the captured stderr includes Bun's own `$ bun run …`
   echo and `error: script … exited with code 1` lines above the offending path.
   Cosmetic — the path (the load-bearing content) is clearly present. If cleaner
   output is wanted later, invoke `bun run src/ci/check-committed.ts` directly, but
   that trades away the canonical `check:*` command surface.
4. **No `timeout` guard.** macOS ships no `timeout`(1); adding one would reduce
   portability. `check:committed` is sub-second, so a hang (e.g. a held
   `.git/index.lock`) is a remote theoretical risk, accepted in favor of a
   minimal, portable hook.
5. **env-error (exit 2) live branch not executed.** Constructing a no-git
   environment here was unsafe; the branch is straight-line `exit 0` (fail open).
   Low risk — mirrors T-008-01's analogous untested exit-2 gap.

---

## Handoff

No blocking issues. The gate is wired, dogfooded (its own commit leaves the tree
clean), and degrades safely (guarded block → warn → fail-open). The single
must-do for the next session: **watch the first real stop on a dirty tree** to
confirm the live block, and if the `stop_hook_active` guard turns out unavailable
or blocking is disruptive, apply the one-line warn-only downgrade documented
above.
