# T-032-02 — Structure

The file-level blueprint. Seven files: 1 created (`.mcp.json`), 1 new module
(`mcp-registry.ts`), 4 modified source, 3 modified/extended tests. Shape only — not code.

## Changeset overview

| File | Action | What |
| --- | --- | --- |
| `.mcp.json` | **create** | committed portable project MCP registry (codebase-memory-mcp) |
| `src/engine/mcp-registry.ts` | **create** | `parseMcpServerIds` (pure) + `readProjectMcpServers` (impure) |
| `src/engine/mcp-registry.test.ts` | **create** | unit tests for `parseMcpServerIds` |
| `src/engine/cast-core.ts` | modify | add `ToolFlags` + pure `toolFlags(resolved, path)` |
| `src/engine/cast-core.test.ts` | modify | `toolFlags` cases + the decompose live-proof argv test |
| `src/executor/claude.ts` | modify | `DispenseOptions` gains 3 keys; `dispense` forwards them |
| `src/engine/cast.ts` | modify | resolve tools at top; andon on `!ok`; thread flags to `dispense` |
| `src/log/run-log.ts` | modify | add `"missing-capability"` to `RUN_OUTCOMES` |
| `src/play/decompose-epic-core.ts` | modify | export `DECOMPOSE_TOOLS: PlayTools` |
| `src/play/decompose-epic.ts` | modify | `decomposeEpicPlay.tools = DECOMPOSE_TOOLS` |

## New: `.mcp.json` (repo root)

```json
{
  "mcpServers": {
    "codebase-memory-mcp": {
      "type": "stdio",
      "command": "${CODEBASE_MEMORY_MCP_BIN:-codebase-memory-mcp}",
      "args": [],
      "env": {}
    }
  }
}
```

Portable: `${VAR:-default}` indirection, no secrets, no absolute machine path. Defines the
project's servers; `readProjectMcpServers` yields `["codebase-memory-mcp"]`; `--mcp-config`
points here for declared casts.

## New: `src/engine/mcp-registry.ts`

Public interface:
- `parseMcpServerIds(text: string): string[]` — PURE, total. `JSON.parse` → `Object.keys(mcpServers ?? {})`; any throw / missing key ⇒ `[]`.
- `readProjectMcpServers(root: string): Promise<{ available: string[]; path: string }>` — IMPURE.
  `path = join(root, ".mcp.json")`; read file → `parseMcpServerIds`; ENOENT/read error ⇒
  `{ available: [], path }`. The one untested verb (its parse half is covered).

Module doc: states the pure/impure split, the "absent ⇒ [] ⇒ declared plays andon (safe
direction)" contract, and that `available` is what `resolveTools` consumes.

Imports: `node:fs/promises` (`readFile`), `node:path` (`join`). No engine cycles (it's a leaf the
cast loop imports up into — actually `cast.ts` imports it).

## Modify: `src/engine/cast-core.ts`

Add after `resolveTools` (keep it beside its sibling resolver):

```ts
export interface ToolFlags {
  readonly mcpConfig?: string;
  readonly allowedTools?: readonly string[];
  readonly strictMcp?: boolean;
}
export function toolFlags(resolved: ResolvedTools, mcpConfigPath: string): ToolFlags
```

Behavior (D2): `!ok` or passthrough ⇒ `{}`; strict ⇒ `allowedTools = [...allow, ...mcp.map(id =>
"mcp__"+id)]`, `strictMcp: true`, and `mcpConfig` only when `mcp.length > 0`. PURE — re-exported
via `cast.ts`'s `export *`. Doc-comment notes the `mcp__<id>` allowlist rationale.

## Modify: `src/executor/claude.ts`

- `DispenseOptions` (L70–92): add
  ```ts
  /** Per-play MCP config path → --mcp-config (E-032, T-032-02). */ mcpConfig?: string;
  /** Per-play tool allowlist → --allowedTools. */ allowedTools?: readonly string[];
  /** Close the global MCP firehose → --strict-mcp-config. */ strictMcp?: boolean;
  ```
- `dispense` (L287–288): destructure the three new keys and pass them:
  `const args = buildArgs({ model, effort, system, maxTurns, mcpConfig, allowedTools, strictMcp });`

No other change — `buildArgs` already guards each. Absent keys ⇒ byte-identical argv.

## Modify: `src/engine/cast.ts`

Two edits inside `castPlay`:

1. **Resolve + andon** (after `runId` ~L121, before `prompt = play.render` L124). Import
   `resolveTools`, `toolFlags` (already via `./cast-core.ts`), `readProjectMcpServers` (new),
   `resolveLoggedModel` (already imported). Add:
   ```ts
   const { available, path: mcpConfigPath } = await readProjectMcpServers(root);
   const resolved = resolveTools(play.tools, available);
   if (!resolved.ok) {
     const startedRefusal = startedAt; const endedAt = new Date().toISOString();
     process.stdout.write(`· andon: missing-capability — required MCP absent from project registry: ${resolved.missing.join(", ")}\n`);
     await appendRunLog({ runId, play: play.name, epic: opts.subject,
       model: resolveLoggedModel(undefined, opts.model), envelope: budget, project,
       ...(opts.intervened !== undefined ? { intervened: opts.intervened } : {}),
       outcome: "missing-capability", usage: {} as Usage, costUsd: 0, gateResults: [],
       startedAt: startedRefusal, endedAt },
       opts.runLogPath ? { path: opts.runLogPath } : {});
     return { runId, outcome: "missing-capability", materialized: false,
       actuals: { usage: {} as Usage, wallMs: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)) } };
   }
   const tflags = toolFlags(resolved, mcpConfigPath);
   ```
   (`Usage` type already imported from budget.ts.)

2. **Thread flags into dispense** (L145–151): spread `tflags`:
   ```ts
   result = await dispense({ prompt, model: opts.model, maxTurns, onMessage,
     timeoutMs: timeoutMsFor(budget), ...tflags });
   ```

New import line: `import { readProjectMcpServers } from "./mcp-registry.ts";`. `toolFlags` /
`resolveTools` come through the existing `cast-core.ts` import (extend the named import list at
L28).

Back-compat: undeclared plays ⇒ `resolved.passthrough` ⇒ `toolFlags` returns `{}` ⇒ the spread
adds nothing ⇒ dispense argv byte-identical. The andon branch never fires for them.

## Modify: `src/log/run-log.ts`

`RUN_OUTCOMES` (L46): append `"missing-capability"`:
```ts
export const RUN_OUTCOMES = ["success","gate-failed","timed-out","budget-exhausted","id-collision","missing-capability"] as const;
```
Update the adjacent doc-comment (L37–45) to note `missing-capability` ← E-032 pre-dispense
refusal: a declared play's required MCP absent from the project registry. No other run-log change
(`assertOutcome` validates by membership; `OutcomeMix` auto-seeds the key).

## Modify: `src/play/decompose-epic-core.ts`

Add (beside `DECOMPOSE_MAX_TURNS`), importing `PlayTools` type from `../engine/play.ts`:
```ts
export const DECOMPOSE_TOOLS: PlayTools = { mcp: ["codebase-memory-mcp"], allow: ["Read", "Grep", "Glob"] };
```
Doc-comment: the proof-play declaration (E-032); read-only built-ins (the agent reasons by
reading; writes are the play's own `effect`), plus the codebase-memory server the E-031 tickets
wired by hand. Addon-free home so the live-proof test reads it without BAML.

## Modify: `src/play/decompose-epic.ts`

Import `DECOMPOSE_TOOLS` from `./decompose-epic-core.ts` (already imports `DECOMPOSE_MAX_TURNS`
from there) and add to the play literal:
```ts
tools: DECOMPOSE_TOOLS,
```
Placed beside `maxTurns:` (its sibling). No other change.

## Tests

- `src/engine/mcp-registry.test.ts` (new): `parseMcpServerIds` — full body → ids; missing
  `mcpServers` → `[]`; malformed JSON → `[]`; empty `{}` → `[]`; ids in declared order.
- `src/engine/cast-core.test.ts` (extend): `toolFlags` —
  - passthrough → `{}`; `!ok` (missing) → `{}`;
  - strict w/ mcp+allow → `{ mcpConfig, allowedTools: [...allow, "mcp__<id>"...], strictMcp:true }`;
  - strict w/ allow only (no mcp) → no `mcpConfig`, `strictMcp:true`, allow list (no mcp wildcard);
  - empty `{}` declaration → `strictMcp:true`, empty allowedTools, no mcpConfig.
  - **Live proof (no cast):** `buildArgs(toolFlags(resolveTools(DECOMPOSE_TOOLS, ["codebase-memory-mcp"]), "/r/.mcp.json"))`
    contains `--mcp-config /r/.mcp.json`, `--allowedTools Read,Grep,Glob,mcp__codebase-memory-mcp`,
    `--strict-mcp-config`; and the undeclared/passthrough argv equals today's base (regression).
  - **Andon proof:** `resolveTools(DECOMPOSE_TOOLS, [])` → `{ ok:false, missing:["codebase-memory-mcp"] }`.
- `src/executor/claude.test.ts`: already covers `buildArgs` tool flags (T-032-01); no new case
  strictly required, but `dispense` forwarding is covered indirectly by the cast-core live proof.

## Ordering (why this sequence)

1. `.mcp.json` + `mcp-registry.ts` + its test — the registry source, standalone, green.
2. `run-log.ts` outcome + `cast-core.ts` `toolFlags` + tests — pure additions, green.
3. `claude.ts` dispense threading — opens the conduit, no behavior change yet.
4. `cast.ts` resolve+andon+thread — wires the live path.
5. `decompose-epic-core.ts` + `decompose-epic.ts` — the proof declaration; live-proof test green.

Each step compiles and tests green independently; commits fall on the natural seams (see plan).
</content>
