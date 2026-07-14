# Progress — T-001-02 claude-p-dispense-seam

Implementation log. Status: **complete — `bun run check` green.**

## Completed

- [x] **Steps 1–6 — `src/executor/claude.ts`** (the module, all in one pass):
  - `CLAUDE_CLI` env override; `StreamMessage` / `ResultMessage` / `ChildLike` /
    `DispenseOptions` types; `ClaudeTimeoutError` (`code` = `ETIMEDOUT_CLAUDE`).
  - Pure helpers: `buildArgs`, `parseStreamJsonLine`, `createLineBuffer`,
    `makeStreamConsumer`, and the `awaitChildClose` latch.
  - `dispense` — the thin spawn shell: `buildArgs` → `spawn(CLAUDE_CLI, …)` →
    stdin write → stdout→`buffer.push` / stderr accumulate → timeout-guarded
    `awaitChildClose` → `flush` → no-result throw → return `result`.
- [x] **Step 7 — `src/executor/claude.test.ts`**: 33 unit tests covering every pure
  helper + the latch (fake child) + sample stream-json lines. No live spawn.
- [x] **Step 8 — tidy + gate**: removed `src/executor/.gitkeep`; `bun run check`
  (typecheck + test) green — **39 pass / 0 fail** across 3 files (incl. scaffold smoke).

## Deviations from the plan

1. **node-types question resolved in favour of "they resolve" (Design 6 / Plan
   risk).** `@types/bun` transitively provides Node typings under Bun 1.3.9 —
   `tsc` knew `ChildProcessWithoutNullStreams`/`Signals` with no `package.json`
   edit. So `dispense` uses `node:child_process` `spawn` directly. The `ChildLike`
   structural interface was kept anyway (it is what makes the latch fake-child
   testable — a genuine win, not just a fallback).
2. **`ChildLike.kill` widened to `signal?: string | number`** (was `string` in the
   blueprint). The real `ChildProcess.kill` takes `NodeJS.Signals | number`; the
   narrow `string` made the real child non-assignable to `ChildLike`. Widening to
   `string | number` keeps `"SIGKILL"`, the real child, and the fake spy all
   assignable. Tiny, documented in-code.
3. **Timeout test reads the rejection via a single `.catch` capture** rather than
   re-awaiting the already-settled promise (which tripped strict null/type
   narrowing on the `number | null` resolve type). Behaviour asserted is identical.

No deviation touched the AC surface or any file outside `src/executor/`.

## Verification run

```
$ bun run check
$ tsc --noEmit        # clean, exit 0
$ bun test            # 39 pass / 0 fail / 71 expect() — 3 files
```

## Not done (by design / out of scope)

- No `git commit` — per the run instruction ("simply stop — Lisa handles the rest")
  and the T-001-01 precedent, the orchestrator owns commits on the shared branch.
  Working tree left green and ready.
- No live `dispense` smoke in the suite (the metered/env-dependent path is the one
  untested function; a manual one-liner is noted in Review).
