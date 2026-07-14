# Review — T-001-02 claude-p-dispense-seam

Handoff for a human reviewer. What changed, how it was verified, what to watch.

## Summary

Implemented Vend's single metered seam: `dispense()` shells out to the `claude -p`
headless CLI (`--output-format stream-json --verbose`), writes the prompt to stdin,
streams every stream-json message to a caller hook in order, and returns the
terminal `result` message (carrying `usage` / `total_cost_usd` / `subtype`). Ported
the proven spawn → stream → capture spine plus the wall-clock timeout latch
(`awaitChildClose` / `ClaudeTimeoutError`) from `mc-design-eval/src/sdk-binding.mjs`,
dropping everything schema- and multimodal-specific (out of scope). Text path only,
budget-agnostic. Fills the `src/executor/` dir of the S-001 DAG.

## Files created (additive — nothing modified or deleted outside this dir)

| File | Purpose |
|---|---|
| `src/executor/claude.ts` | the seam: `dispense` + pure helpers + `ClaudeTimeoutError` + `CLAUDE_CLI` |
| `src/executor/claude.test.ts` | 33 unit tests (pure helpers + latch via fake child + sample stream-json lines) |
| `src/executor/.gitkeep` | **deleted** — superseded; the dir now holds real source |

No edits to `package.json`, `tsconfig.json`, or any sibling-owned path
(`src/budget/`, `src/log/`) — collision-free against the parallel S-001 wave.

## Acceptance criteria — all met

- [x] **AC #1** — `src/executor/claude.ts` exports `dispense({ prompt, model?,
      effort?, system?, onMessage?, timeoutMs? })` that spawns `claude -p
      --output-format stream-json --verbose` (`buildArgs`), writes the prompt to
      stdin, parses stream-json lines (`parseStreamJsonLine` + `createLineBuffer`),
      calls `onMessage` per message in order (`makeStreamConsumer`), and returns the
      terminal `result` (carrying `usage`/`total_cost_usd`/`subtype`).
- [x] **AC #2** — a non-returning child is SIGKILLed at `timeoutMs` and surfaces a
      typed `ClaudeTimeoutError` with `code === "ETIMEDOUT_CLAUDE"`; `awaitChildClose`
      is ported with the exactly-one-of-{timeout,close,error} latch (timer cleared on
      settle).
- [x] **AC #3** — pure helpers (line parsing, arg building, the timeout latch, plus
      the line buffer + message router) are unit-tested with a fake child / sample
      lines; **no live `claude` spawn** in the suite. `dispense` is the single
      untested function.
- [x] **AC #4** — budget-agnostic: `dispense` accepts `timeoutMs` (its only resource
      guard) and owns no token/cost budget; it returns `result` for any `subtype` so
      the runner (T-001-03) meters on `usage`/`total_cost_usd`.
- [x] **AC #5** — `CLAUDE_CLI` env override (`process.env.CLAUDE_CLI || "claude"`).

## Verification

```
$ bun run check          # = tsc --noEmit && bun test
  tsc --noEmit           → clean, exit 0
  bun test               → 39 pass / 0 fail / 71 expect() across 3 files
```

(39 includes the 33 new tests + the scaffold smoke + the existing files.)

**Manual live smoke (optional, not in `bun test`):** the live path can be confirmed
with a tiny harness importing `dispense` and printing `(await dispense({ prompt:
"reply with the word ok", timeoutMs: 60000 })).result`. The `claude` CLI is present
(v2.1.181 at `/Users/johnchen/.local/bin/claude`). Left out of the suite because it
is metered + environment/subscription dependent — matching the reference's rule.

## Test coverage

- **Covered:** `buildArgs` (defaults, all flags, independent omission);
  `parseStreamJsonLine` (valid / blank / non-JSON noise); `createLineBuffer`
  (multi-line chunk, split-across-pushes, flush of unterminated tail, empty flush);
  `makeStreamConsumer` (in-order routing + terminal-result capture with
  `usage`/`cost`/`subtype` intact, chunk-boundary splits, noise-skipping, no-result
  → null); `awaitChildClose` (resolve-on-close, reject-on-error, timeout
  kills + `ClaudeTimeoutError`/`ETIMEDOUT_CLAUDE`, latch single-settle, no-timer
  path); `ClaudeTimeoutError` fields/message.
- **Gaps (intentional):** `dispense`'s process I/O (the actual `spawn` + stream
  wiring) is not unit-tested — it is the metered live path, and all of its
  byte-handling is delegated to the tested pure helpers, so the untested surface is
  just the ~12-line spawn shell. This matches AC #3 and the reference's rule.

## Decisions a reviewer should sanity-check

1. **Returns the `result` for ANY `subtype`** (incl. error subtypes), unlike
   mc-design-eval's `invokeClaude` which throws on non-success. Rationale: this seam
   has no schema contract to satisfy and is budget-agnostic; the runner needs to see
   an `error_max_turns` / `error_during_execution` result to meter and branch on it.
   Only a genuinely absent terminal result throws. **Flag:** confirm the runner
   (T-001-03) is expected to inspect `subtype` rather than rely on the seam throwing.
2. **`node:child_process` used directly** — `@types/bun` provides the Node typings
   under Bun 1.3.9, so no `package.json` change was needed. The `ChildLike`
   structural interface is kept regardless because it is what makes the timeout latch
   testable with a fake child (and would have been the fallback had node types not
   resolved). `ChildLike.kill` is `string | number` so the real child is assignable.
3. **Pure/impure split** — line buffering + message routing were extracted into
   `createLineBuffer` / `makeStreamConsumer` (which `dispense` also uses) so the
   real parse/route/capture path is unit-tested, not a copy. One implementation,
   tested directly.

## Open concerns / TODO for downstream (not this ticket)

- **Runner composition (T-001-03):** wrap `dispense` with the budget/abort logic;
  the seam deliberately stops at `timeoutMs`. Decide there whether a non-success
  `subtype` is a hard failure.
- **Run-log consumption (T-001-04):** `onMessage` is the transcript/usage tap; the
  log module subscribes to it. Per-turn `usage` rides on `assistant` messages'
  `message.usage`; terminal totals on the `result` message.
- **Live round-trip** belongs in an integration/e2e harness once a runner exists —
  not in `bun test`.

## Commit status — NEEDS ORCHESTRATOR ACTION

This agent did **not** run `git commit` (per the run instruction and the T-001-01
precedent; lisa hooks are signal-only and the orchestrator owns commits on the
shared branch). Working tree is green and ready: two new files under
`src/executor/`, the `.gitkeep` removed, all gates passing.

## Risk assessment: LOW

Additive, isolated to `src/executor/`, all gates green, the only untested code is
the thin metered spawn shell whose logic is fully delegated to tested pure helpers.
