# Design — T-001-02 claude-p-dispense-seam

Decisions for porting the proven `claude -p` text seam to a typed Bun module.
Each is grounded in Research (the reference implementation + the scaffold reality).

## Decision 1 — Spawn API: `node:child_process` vs `Bun.spawn`

**Options:**
- (A) `node:child_process.spawn` — what the reference uses.
- (B) `Bun.spawn` — native, fully typed by `@types/bun`, no node-types question.

**Chosen: A.** AC #2/#3 explicitly say *port `awaitChildClose`* with its latch
("exactly one of timeout/close/error settles"). That latch is built on the
EventEmitter child surface (`.on("error")`, `.on("close")`, `.kill()`). `Bun.spawn`
exposes a different shape (an `exited` promise + web streams, no `.on("close")`),
so choosing B means *not* porting the proven pattern and rewriting the one piece
the ticket calls out as the thing to port verbatim. The latch is also what makes
the timeout unit-testable with a tiny fake child (an object with `on`/`kill`); the
`Bun.Subprocess` shape is harder to fake faithfully. Bun implements
`node:child_process` at runtime, so A works on Bun. Reject B despite its cleaner
typing — fidelity to the proven, testable pattern wins.

**Risk carried:** whether `ChildProcess`/`Buffer` *types* resolve under
`types: ["bun"]`. Mitigations, in order of preference (Decision 6).

## Decision 2 — Public surface: one `dispense`, helpers exported for tests

`src/executor/claude.ts` exports the seam `dispense(opts)` plus the pure helpers
the test suite needs (AC #3). Signature, matching the AC exactly:

```ts
export function dispense(opts: {
  prompt: string;
  model?: string;
  effort?: string;
  system?: string;
  onMessage?: (msg: StreamMessage) => void;
  timeoutMs?: number;
}): Promise<ResultMessage>;
```

Returns the **terminal `result` message** (carrying `usage`, `total_cost_usd`,
`subtype`), not a wrapped/validated artifact. The seam is generic: it does not
interpret `result` beyond confirming one arrived. This is the deliberate divergence
from mc-design-eval's `requestDesignArtifact` (which re-validates against a schema)
— Vend's seam is schema-free (Research: schema machinery is out of scope).

## Decision 3 — Where to draw the pure/impure line (testability)

The reference proved that arg-building, line parsing, and the timeout latch are the
pure, testable units. To also unit-test **stream parsing + onMessage ordering +
result capture** without spawning, I extract the line-buffering and message-routing
into pure helpers that `dispense` *also* uses (single source of truth, no logic
duplicated between code and test):

- `buildArgs({ model?, effort?, system? }) → string[]` — pure. (AC #3: "arg
  building".)
- `parseStreamJsonLine(line) → StreamMessage | null` — pure; trims, JSON-parses,
  returns `null` for blank/non-JSON noise. (AC #3: "stream-json line parsing".)
- `createLineBuffer(onLine) → { push(chunk), flush() }` — pure; the
  split-on-`\n`/carry-partial logic, isolated from any stream. Lets a test feed
  chunks across arbitrary boundaries.
- `makeStreamConsumer(onMessage?) → { buffer, state }` — composes the two above:
  routes each parsed message to `onMessage` in order and captures the terminal
  `result` into `state.result`. This is the exact body `dispense` runs on each
  stdout chunk, so testing it tests the real path.
- `awaitChildClose(child, { cli?, timeoutMs? }) → Promise<number|null>` — the
  latch, ported. (AC #2, #3: "the timeout latch".)
- `ClaudeTimeoutError` — ported class. (AC #2.)

`dispense` is then a thin shell: `spawn` → wire `stdout`→`buffer.push`,
`stderr`→accumulate → `await awaitChildClose` → `buffer.flush()` → throw-if-no-result
→ return result. Only `dispense` touches the process; everything it does to bytes is
in a tested pure helper. **`dispense` itself is the only untested function** — exactly
the reference's rule.

**Rejected:** inlining the buffer/route logic in `dispense` (as the reference does)
and testing parsing via a separate copy. That duplicates the splitter and risks the
test passing while `dispense` drifts. Extraction keeps one implementation.

## Decision 4 — Return on non-`success` subtype: return it, don't throw

**Options:** (A) throw on `subtype !== "success"` (reference's `invokeClaude`
does). (B) Return the `result` regardless of subtype; throw only when *no* result
message arrived at all.

**Chosen: B.** AC #1 says return the terminal result "carrying ... `subtype`" — the
caller is meant to read `subtype`. The reference throws on non-success because it
*must* produce a schema-valid artifact; this generic, budget-agnostic seam has no
such contract and should not bury an `error_max_turns` / `error_during_execution`
result the runner needs to meter and branch on. A genuinely absent terminal result
(process died emitting none) *is* a seam failure → throw with exit code + stderr
context (ported from the reference). Document this divergence in Review.

## Decision 5 — Timeout semantics & the latch (ported verbatim in spirit)

`timeoutMs` undefined or ≤ 0 ⇒ **no timer** ⇒ behaviour identical to an
un-guarded spawn (matches reference). When set: a `setTimeout` fires, `SIGKILL`s
the child (guarded by try/catch — a child that already exited can't be signalled),
and rejects with `ClaudeTimeoutError(timeoutMs, cli)` whose `code` is
`"ETIMEDOUT_CLAUDE"`. The latch guarantees exactly one settle and clears the timer
on any settle so it never dangles past the call (AC #2). The seam owns *only* this
wall-clock guard — no budget (AC #4).

## Decision 6 — The node-types question (no `package.json` edit if avoidable)

Order of attack during Implement:
1. Write the module importing `import { spawn } from "node:child_process"` and
   `import type { ChildProcess } from "node:child_process"`; run
   `bun run check:typecheck`. `@types/bun`/`bun-types` pulls in Node typings in
   recent versions, so this likely just works.
2. If `ChildProcess` does not resolve: type the child parameter of
   `awaitChildClose`/`dispense` against a **minimal structural interface**
   (`ChildLike` = `{ on(...): unknown; kill(signal?): unknown; stdin/stdout/stderr }`)
   instead of the node type. This both dodges the node-types dependency *and*
   makes the fake child trivially assignable in tests — a win either way. Avoid
   editing the T-001-01-owned `package.json` (collision risk with parallel
   siblings). `Buffer` → use `chunk.toString()` typing via `unknown`/`{ toString():
   string }` if needed.

**Chosen baseline: define `ChildLike`** regardless of whether node types resolve,
because the test's fake child must satisfy the `awaitChildClose` parameter type
without pretending to be a full `ChildProcess`. `dispense` passes the real spawned
child (which structurally satisfies `ChildLike`). This is the cleanest path to AC #3
and removes the dependency question entirely.

## Decision 7 — Types

```ts
export type StreamMessage = { type: string } & Record<string, unknown>;
export type ResultMessage = StreamMessage & {
  type: "result";
  subtype: string;
  result?: string;
  usage?: Record<string, unknown>;
  total_cost_usd?: number;
};
```

Loose-but-honest: the stream is external JSON, so an open record with a known
discriminant (`type`) and the documented `result`-message fields is the right
fidelity. No zod/validation lib (none in the stack; the seam doesn't validate).

## What this design deliberately does NOT do

- No schema/JSON enforcement, no artifact re-validation, no narration retry loop
  (mc-design-eval-specific; out of scope per Research).
- No image/multimodal path, no `--input-format stream-json`.
- No budget/token/cost ownership (AC #4 — runner's job, T-001-03).
- No executor *interface*/abstraction yet — this is the concrete first executor;
  the seam interface is extracted in a later ticket when a second executor exists.
- No edits outside `src/executor/` (collision avoidance).
