# Structure — T-001-02 claude-p-dispense-seam

The blueprint: exact files, their boundaries, public interfaces, and internal
organization. Not code — the shape of the code. Grounded in the Design decisions.

## Files

| File | Action | Owner / collision note |
|---|---|---|
| `src/executor/claude.ts` | **create** | this ticket; fills the `executor/` dir |
| `src/executor/claude.test.ts` | **create** | this ticket; colocated `bun:test` |
| `src/executor/.gitkeep` | leave / optionally remove | scaffold placeholder, now superseded by real files |

Nothing else changes. **No** edits to `package.json`, `tsconfig.json`,
`src/budget/`, `src/log/`, or any sibling-owned path (rdspi §Concurrency). The
`.gitkeep` may be deleted once `claude.ts` exists (the dir is no longer empty), but
leaving it is harmless — Implement will remove it for tidiness only if it does not
risk a lock conflict.

## `src/executor/claude.ts` — internal organization (top to bottom)

A single module, ordered so dependencies precede dependents:

1. **Imports**
   - `import { spawn } from "node:child_process";`
   - `import type { ChildProcess } from "node:child_process";` *(only if node
     types resolve; otherwise omit — `ChildLike` stands alone.)*

2. **Constants**
   - `export const CLAUDE_CLI = process.env.CLAUDE_CLI || "claude";` — env override
     (AC #5). Read once at module load, matching the reference.

3. **Types** (Design 7 + the structural child type)
   - `export type StreamMessage = { type: string } & Record<string, unknown>;`
   - `export type ResultMessage = StreamMessage & { type: "result"; subtype:
     string; result?: string; usage?: Record<string, unknown>; total_cost_usd?:
     number };`
   - `export interface ChildLike` — the minimal surface `awaitChildClose` needs:
     ```
     on(event: "error", cb: (err: Error) => void): unknown;
     on(event: "close", cb: (code: number | null) => void): unknown;
     kill(signal?: string): unknown;
     ```
     A real `ChildProcess` and the test's fake child both satisfy it structurally.
   - `export interface DispenseOptions { prompt: string; model?: string; effort?:
     string; system?: string; onMessage?: (msg: StreamMessage) => void; timeoutMs?:
     number; }`

4. **`ClaudeTimeoutError`** (export class extends Error) — ported. Sets `name =
   "ClaudeTimeoutError"`, `code = "ETIMEDOUT_CLAUDE"`, `timeoutMs`. Public field
   `code: string` and `timeoutMs: number` typed explicitly (strict).

5. **`buildArgs({ model?, effort?, system? }) → string[]`** (export, pure) — base
   `["-p","--output-format","stream-json","--verbose"]`, then conditional
   `--model`/`--effort`/`--system-prompt`. `effort` coerced via `String(effort)`.

6. **`parseStreamJsonLine(line: string) → StreamMessage | null`** (export, pure) —
   trim; `""` → null; `JSON.parse` in try/catch, catch → null. Cast parsed to
   `StreamMessage`.

7. **`createLineBuffer(onLine: (line: string) => void) → { push(chunk: string):
   void; flush(): void }`** (export, pure) — closes over `let buf = ""`. `push`
   appends and drains complete `\n`-terminated lines; `flush` emits a trailing
   non-empty unterminated line then clears `buf`.

8. **`makeStreamConsumer(onMessage?) → { buffer: ReturnType<typeof
   createLineBuffer>; state: { result: ResultMessage | null } }`** (export, pure) —
   builds a `state` object and a `createLineBuffer` whose `onLine` runs:
   parse → if null return → `onMessage?.(msg)` → if `msg.type === "result"` set
   `state.result = msg as ResultMessage`. This is the canonical routing used by
   both `dispense` and the tests.

9. **`awaitChildClose(child: ChildLike, { cli?, timeoutMs? } = {}) →
   Promise<number | null>`** (export) — ported latch (Design 5). `settle(action)`
   guard ensures one settle + clears timer; timeout path `kill("SIGKILL")` in
   try/catch then `reject(new ClaudeTimeoutError(...))`; `on("error")` rejects with
   a launch-failure `Error`; `on("close")` resolves the exit code.

10. **`dispense(opts: DispenseOptions) → Promise<ResultMessage>`** (export, the
    seam, the ONLY impure/untested fn) — the thin shell:
    - `const args = buildArgs(opts);`
    - `const child = spawn(CLAUDE_CLI, args, { stdio: ["pipe","pipe","pipe"] });`
    - `child.stdin?.end(opts.prompt);`
    - `const { buffer, state } = makeStreamConsumer(opts.onMessage);`
    - `let stderr = "";`
    - `child.stdout?.on("data", c => buffer.push(c.toString()));`
    - `child.stderr?.on("data", c => { stderr += c.toString(); });`
    - `const exitCode = await awaitChildClose(child, { timeoutMs: opts.timeoutMs });`
    - `buffer.flush();`
    - if `state.result === null` → `throw new Error(\`${CLAUDE_CLI} -p produced no
      result message (exit ${exitCode})\` + stderr-context)`
    - `return state.result;`

## `src/executor/claude.test.ts` — coverage map (AC #3)

`import { expect, test, mock } from "bun:test";` then import every pure helper +
`ClaudeTimeoutError` + `CLAUDE_CLI` from `./claude.ts`. **No `dispense` spawn.**

- **`buildArgs`**
  - defaults: exactly `["-p","--output-format","stream-json","--verbose"]`.
  - with `model`/`effort`/`system`: appends `--model m`, `--effort e`,
    `--system-prompt s` in order; `effort` number → stringified.
  - omits each flag when its option is absent.

- **`parseStreamJsonLine`**
  - valid JSON object → parsed message (deep-equal).
  - `""` / whitespace → `null`.
  - non-JSON noise (`"not json"`, a bare log line) → `null`.

- **`createLineBuffer`**
  - two complete lines in one chunk → `onLine` twice, in order.
  - a line split across two `push` calls → emitted once, whole, after the second.
  - `flush()` emits a trailing unterminated line; a second `flush()` emits nothing.
  - blank trailing buffer → `flush` emits nothing.

- **`makeStreamConsumer`** (the real routing path)
  - feed sample stream-json lines (system init, an assistant turn, a terminal
    `result`): `onMessage` called once per message **in order** (assert the
    sequence of `type`s); `state.result` is the `result` message with `usage`,
    `total_cost_usd`, `subtype` intact.
  - lines split across chunk boundaries still route correctly (push partial, then
    rest, then flush).
  - noise lines between JSON lines are skipped (not passed to `onMessage`).
  - no `result` line → `state.result` stays `null`.

- **`awaitChildClose`** (fake child = `{ on, kill }` over a tiny emitter)
  - resolves with exit code when `close` fires.
  - rejects with a launch-failure `Error` when `error` fires.
  - with small `timeoutMs` and a child that never closes: rejects with
    `ClaudeTimeoutError`, `e.code === "ETIMEDOUT_CLAUDE"`, `e.timeoutMs` set, and
    the `kill` spy was called with `"SIGKILL"`.
  - latch: after `close`, a later (manually fired) timeout/`error` does not change
    the settled outcome; after timeout, a later `close` is ignored. (Assert single
    settlement — e.g. resolve wins if `close` precedes the timer.)
  - `timeoutMs` undefined → no kill, resolves normally on `close` (no dangling
    timer; test completes without a leaked handle).

- **`ClaudeTimeoutError`**
  - `instanceof Error`, `name`, `code === "ETIMEDOUT_CLAUDE"`, `timeoutMs` carried,
    message mentions the cli + ms.

### Fake child helper (test-local)

A small factory returning an object implementing `ChildLike` backed by stored
callbacks: `emitError(err)`, `emitClose(code)`, and a `kill` mock (`mock(() =>
{})`) recording calls. No EventEmitter import needed — a plain callback registry
satisfies `ChildLike`.

## Ordering of changes

1. `src/executor/claude.ts` (types → constants → error → pure helpers → latch →
   `dispense`).
2. `src/executor/claude.test.ts`.
3. Remove `src/executor/.gitkeep` (optional tidy).
4. `bun run check` (typecheck + test) must be green before Review.

## Public interface summary (what other tickets may import)

`dispense`, `DispenseOptions`, `StreamMessage`, `ResultMessage`,
`ClaudeTimeoutError`, `CLAUDE_CLI`. The pure helpers (`buildArgs`,
`parseStreamJsonLine`, `createLineBuffer`, `makeStreamConsumer`, `awaitChildClose`,
`ChildLike`) are exported primarily for tests but are stable, reusable seam
internals.
