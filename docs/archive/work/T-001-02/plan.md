# Plan — T-001-02 claude-p-dispense-seam

Ordered, independently-verifiable steps. Each is small enough to reason about and,
where it makes sense, commit atomically. The whole ticket is additive (two new
files under `src/executor/`), so rollback risk is near zero.

## Testing strategy (up front)

- **Unit tests only** (`src/executor/claude.test.ts`, `bun:test`), covering every
  pure helper + the timeout latch with a fake child + sample stream-json lines.
  **No live `claude` spawn** — that path (`dispense`'s process I/O) is the one
  untested function, matching the reference's rule and AC #3.
- **Verification gate:** `bun run check` (= `tsc --noEmit` then `bun test`) green.
- **Manual/live smoke (optional, not in `bun test`):** documented in Review as a
  one-liner a human can run (`echo "say hi" | claude -p --output-format stream-json
  --verbose`-equivalent through `dispense`) to confirm the live path end-to-end. Not
  required for the gate; the live path is environment/subscription dependent.
- **No integration test** in this ticket — there is no runner yet (T-001-03) to
  compose against, and the seam is deliberately budget-agnostic.

## Steps

### Step 1 — Module skeleton: constants, types, error class
Create `src/executor/claude.ts` with `CLAUDE_CLI`, `StreamMessage`,
`ResultMessage`, `ChildLike`, `DispenseOptions`, and `ClaudeTimeoutError`.
**Verify:** `bun run check:typecheck` clean. *(Confirms the node-types question
early — Design 6. If `node:child_process` types fail to resolve, the `ChildLike`
structural type already insulates `awaitChildClose`; only the `spawn` import in a
later step would surface a gap, addressed there.)*

### Step 2 — Pure helper: `buildArgs`
Add `buildArgs`. **Verify:** typecheck clean. (Tested in Step 7.)

### Step 3 — Pure helpers: `parseStreamJsonLine` + `createLineBuffer`
Add both. **Verify:** typecheck clean.

### Step 4 — Pure helper: `makeStreamConsumer`
Add it, composing the previous two; capture terminal `result` into `state`.
**Verify:** typecheck clean.

### Step 5 — `awaitChildClose` (the latch) + `ClaudeTimeoutError` wiring
Port the latch against `ChildLike`. **Verify:** typecheck clean.

### Step 6 — `dispense` (the seam)
Add `spawn` import, write the thin shell wiring stdout→buffer, stderr→accumulator,
the timeout-guarded `awaitChildClose`, flush, no-result throw, return result.
**Verify:** `bun run check:typecheck` clean (this is where a missing `spawn`/node
type would surface; fall back to a local `{ toString(): string }` chunk type if
`Buffer` is unresolved — no `package.json` edit).

### Step 7 — Unit tests
Create `src/executor/claude.test.ts` with the fake-child factory and the full
coverage map from Structure: `buildArgs`, `parseStreamJsonLine`, `createLineBuffer`,
`makeStreamConsumer` (ordering + result capture + chunk-split + noise-skip),
`awaitChildClose` (close / error / timeout-kills+ETIMEDOUT_CLAUDE / latch-single-
settle / no-timer), `ClaudeTimeoutError` fields.
**Verify:** `bun test` — all pass, including the scaffold smoke test.

### Step 8 — Tidy + full gate
Remove `src/executor/.gitkeep` (the dir now holds real files). Run `bun run check`
(typecheck + test) and confirm green. Re-check the AC list against the code.

## Per-step → AC traceability

- AC #1 (`dispense` spawns `claude -p --output-format stream-json --verbose`, writes
  prompt to stdin, parses lines, calls `onMessage` per message in order, returns
  terminal `result`): Steps 2,3,4,6 (+ ordering proven in Step 7 via
  `makeStreamConsumer`).
- AC #2 (SIGKILL at `timeoutMs`, typed `ClaudeTimeoutError`, `code ===
  "ETIMEDOUT_CLAUDE"`, ported latch, exactly-one-settle): Steps 1,5 (+ proven Step 7).
- AC #3 (pure helpers unit-tested with fake child / sample lines, no live spawn):
  Step 7 (enabled by the extraction in Steps 2–5).
- AC #4 (budget-agnostic — accepts `timeoutMs`, owns no budget): inherent to the
  `dispense` signature/body (Step 6); nothing token/cost-related is added.
- AC #5 (`CLAUDE_CLI` env override): Step 1.

## Commit strategy

The work is small and cohesive. Steps 1–6 can land as one commit (the module) and
Step 7 as a second (the tests), or all together as a single atomic
`feat(executor): claude -p dispense seam` — both are clean. **Note:** per the
T-001-01 precedent and the run instruction ("simply stop — Lisa handles the rest"),
this agent does **not** run `git commit`; the orchestrator owns commits on the
shared branch. The working tree is left green and ready. Progress is tracked in
`progress.md` during Implement.

## Risks & mitigations

- **node types under `types: ["bun"]`** — mitigated by the `ChildLike` structural
  type (latch needs no node type) and a fallback chunk type for `dispense`; no
  shared-config edit. Confirmed empirically at Steps 1 and 6.
- **`verbatimModuleSyntax`** — the `ChildProcess` import (if used at all) must be
  `import type`; otherwise typecheck fails. Caught at Step 1/6.
- **`noUncheckedIndexedAccess`** — no array indexing in the helpers (we use
  `indexOf`/`slice`/`push`), so no `T | undefined` friction expected.
- **Flaky timeout test** — use a small but non-zero `timeoutMs` (e.g. 5–10ms) and a
  fake child that never fires `close`, so the timer deterministically wins; assert
  via the rejected promise, not wall-clock timing.
