# Research — T-001-02 claude-p-dispense-seam

Descriptive map of the terrain this ticket lands in. What exists, where, how it
connects, and the constraints that bound the work. No solutions here.

## What the ticket asks for

The single **metered seam**: dispense a prompt to Claude via the `claude -p`
headless CLI (authenticated by the subscription, not a metered API key), streaming
every stream-json message to a caller hook so a runner can log transcript +
per-turn usage, and returning the terminal `result` message. Text path only — no
image/multimodal. Budget-agnostic: it accepts a `timeoutMs` wall-clock guard but
does not own or enforce a token/cost budget (that is composed by the runner,
T-001-03).

## Reference implementation (the proven pattern to port)

`/Volumes/ext1/swe/repos/mc-design-eval/src/sdk-binding.mjs` — read in full. It is
a working, in-production binding for the *same* `claude -p` invocation. Relevant
parts for the text-only slice:

- **`CLAUDE_CLI`** (line 41): `process.env.CLAUDE_CLI || "claude"` — env override
  for the binary path. Port verbatim (the AC requires `CLAUDE_CLI` override).
- **`ClaudeTimeoutError`** (49–57): an `Error` subclass with `name`,
  `code === "ETIMEDOUT_CLAUDE"`, and `timeoutMs`. A class (not a string sniff) so a
  caller branches its degrade path cleanly. Port verbatim (AC #2).
- **`awaitChildClose(child, { cli, timeoutMs })`** (71–99): the latch. Exactly one
  of {timeout, close, error} settles the promise; the timer is cleared on settle so
  it never dangles. On timeout it SIGKILLs the child and rejects with
  `ClaudeTimeoutError`. Dependency-free and unit-testable with a fake child
  (EventEmitter + `kill` spy). Port verbatim (AC #1, #2, #3).
- **The spawn → stream → capture spine** lives inside `invokeClaude` (261–318) and
  the leaner `_runClaude`/`requestText` (445–515). The text-only essence:
  1. `spawn(CLAUDE_CLI, args, { stdio: ["pipe","pipe","pipe"] })` — no shell.
  2. `child.stdin.end(stdin)` — write the prompt, close stdin.
  3. Accumulate `stdout` into a buffer, split on `\n`, parse each line as JSON
     (ignore non-JSON noise), call `onMessage(msg)` per message **in order**, and
     capture the message whose `type === "result"` as the terminal result.
  4. Accumulate `stderr` for diagnostics.
  5. `await awaitChildClose(child, { timeoutMs })`, then flush a final
     unterminated line.
  6. If no `result` was seen → throw with exit code + stderr context.
- **`args`** for the text path (344, 509): `["-p", "--output-format",
  "stream-json", "--verbose"]`, then conditionally `--model <m>`, `--effort <e>`,
  `--system-prompt <s>`. Omitting a flag ⇒ CLI default path unchanged.
- **The test rule** (header lines 30–32; 64–66): pure option/payload/JSON shaping
  and the timeout latch are unit-tested with **no CLI and no network**; only the
  request* functions that actually spawn are *not* tested. This is exactly AC #3.

### What in the reference is OUT of scope for this ticket

- **Schema-enforced structured output / artifact re-validation** (`parseArtifact`,
  `toModelSchema`, `withSchemaInstruction`, `stripToJson`, `extractArtifact`,
  `payloadOf`). mc-design-eval forces a design-artifact JSON schema; the Vend seam
  is a *generic* dispense that returns the raw terminal result. None of this ports.
- **Multimodal / image path** (`toImageBlock`, `buildImageTurn`,
  `serializeStreamJsonInput`, `requestDesignArtifactWithImage`,
  `requestTextWithImage`, `--input-format stream-json`). Ticket: "Only the text path
  is needed for the slice (no image/multimodal)."
- **The Agent-SDK alternative path** (`SDK_PACKAGE`, `designArtifactOutputFormat`).
  Not needed; the executor interface is a later concern.
- **The narration/JSON-corrective retry loop** (`requestDesignArtifact` retries).
  That exists only because the reference forces JSON output; a generic text seam has
  no JSON contract to retry against. Out of scope.

So the Vend seam is a *subset*: the spawn/stream/latch spine + the timeout error +
the env override, minus all the schema and multimodal machinery.

## Where it lands in this repo

From the T-001-01 scaffold (committed `7b38379`):

```
src/
  executor/.gitkeep   # ← this ticket fills this dir (src/executor/claude.ts)
  budget/.gitkeep     # ← T-001-03 owns (do NOT touch)
  log/.gitkeep        # ← T-001-04 owns (do NOT touch)
  gate/.gitkeep
  play/.gitkeep
  smoke.test.ts       # scaffold smoke test (top-level, collision-free)
```

- **`package.json`**: `"type": "module"`, `engines.bun >= 1.3.9`. Scripts:
  `check:test` = `bun test`, `check:typecheck` = `tsc --noEmit`, `check` =
  typecheck && test. Dep `@boundaryml/baml@^0.222.0`; devDeps `typescript@^5.7.0`,
  `@types/bun@latest`. Tests are `bun:test` (`import { expect, test } from
  "bun:test"`), file pattern `*.test.ts` colocated in `src/`.
- **`tsconfig.json`**: `strict: true`, `noUncheckedIndexedAccess: true`,
  `moduleResolution: "bundler"`, `allowImportingTsExtensions: true`,
  `verbatimModuleSyntax: true`, `types: ["bun"]`, `noEmit: true`,
  `skipLibCheck: true`. These shape the code: `verbatimModuleSyntax` forces
  `import type` for type-only imports; `noUncheckedIndexedAccess` means indexed
  access is `T | undefined`; strict null checks are on.

## Constraints & assumptions

1. **`.ts` source, ESM, Bun runtime.** The reference is `.mjs` (Node). Porting
   means TypeScript types + `bun:test`. `verbatimModuleSyntax` ⇒ any type-only
   import (e.g. `ChildProcess`) must use `import type`.
2. **`node:child_process` availability under Bun.** Bun implements `node:*`
   builtins; `spawn` works at runtime. Open question for Design: do the *types*
   (`ChildProcess`, `Buffer`) resolve under `types: ["bun"]` alone, or is a node
   types dep needed? Must be answered without modifying `package.json` if possible
   (sibling tickets T-001-03/04 also depend on T-001-01 and may run in parallel;
   editing shared `package.json` risks a lock-serialization collision).
3. **Collision avoidance (rdspi §Concurrency).** This ticket writes ONLY under
   `src/executor/`. Touching `budget/`, `log/`, or shared config files would be a
   missing-edge defect against the parallel S-001 wave.
4. **Unit-testable without a live spawn (AC #3).** The pure pieces (arg building,
   stream-json line parsing, the timeout latch, message routing/result capture)
   must be exercised with sample lines and a fake child. The live `claude` spawn
   path is *not* unit-tested — matching the reference's rule and avoiding a metered,
   environment-dependent test.
5. **`claude` CLI present** at `/Users/johnchen/.local/bin/claude` (v2.1.181) —
   confirmed. Relevant only for a manual/live smoke, never for `bun test`.
6. **Budget-agnostic (AC #4).** `timeoutMs` is the only resource guard the seam
   owns. No token counting, no cost ceiling, no abort-on-budget. The `result`
   carries `usage`/`total_cost_usd`/`subtype` for the runner to meter on.

## Stream-json shape the seam must consume (from the reference's usage)

Newline-delimited JSON, one object per line. Each object has a `type`. The seam
cares about exactly one terminal object: `type === "result"`, carrying `subtype`
(e.g. `"success"`), `usage`, `total_cost_usd`, and (on success) a `result` string.
Intermediate objects (`system`/init, `assistant` turns carrying `message.usage`,
`user`, etc.) are streamed to `onMessage` untouched and otherwise ignored by the
seam. Non-JSON lines on the stream are tolerated and skipped.
