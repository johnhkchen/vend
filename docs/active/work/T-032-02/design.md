# T-032-02 — Design

Five decisions, each weighed against the Research map. Throughline: keep every *decision* pure
and tested in `cast-core.ts`, confine I/O to a thin reader + the `castPlay` shell, and keep the
passthrough (undeclared) path byte-identical to today.

## D1 — The project MCP registry reader

**Decision.** A new tiny module `src/engine/mcp-registry.ts` with a pure parse half and an
impure read half:

```ts
/** Pure: the project's server ids from a `.mcp.json` body. Tolerant — bad JSON / missing
 *  `mcpServers` ⇒ []. */
export function parseMcpServerIds(text: string): string[] {
  try {
    const j = JSON.parse(text) as { mcpServers?: Record<string, unknown> };
    return j.mcpServers ? Object.keys(j.mcpServers) : [];
  } catch { return []; }
}

/** Impure: read `<root>/.mcp.json`. Returns the available id set AND the config path (for
 *  `--mcp-config`). A MISSING file ⇒ { available: [], path } (no registry ⇒ declared plays
 *  andon — the safe direction). */
export async function readProjectMcpServers(root: string): Promise<{ available: string[]; path: string }>;
```

**Why a split.** Mirrors the house pure/impure pattern (decompose-epic-core vs decompose-epic).
`parseMcpServerIds` is unit-tested with literal bodies; the fs read stays a thin untested verb
exactly like `dispense`.

**Why tolerant (absent/bad ⇒ []).** A missing or malformed registry must not crash a cast. An
empty `available` makes *declared* plays andon (honest: the capability genuinely isn't bound)
while *undeclared* plays still pass through unchanged. Failing toward the andon is the safe
direction — an IA-9 refusal, never a silent blind run on the wrong tool set.

**Why return the path too.** `castPlay` needs the `.mcp.json` path for `--mcp-config`; computing
it once in the reader (`join(root, ".mcp.json")`) keeps the seam call site clean and the path
definition single-sourced.

**Rejected — read in `cast-core.ts`.** That module is pure-by-contract (no fs). The read must
live in an impure module; `resolveTools` already takes `available` as a *parameter* precisely so
the read is someone else's job (T-032-01 D3). `mcp-registry.ts` is that someone.

**Rejected — `src/executor/`.** The executor seam is about spawning `claude`; the registry is a
project/engine concern feeding the cast loop. `src/engine/` is its home (beside `cast.ts`).

## D2 — Mapping `ResolvedTools` → seam flags (pure)

**Decision.** A pure helper in `cast-core.ts`, beside `resolveTools`:

```ts
export interface ToolFlags { mcpConfig?: string; allowedTools?: readonly string[]; strictMcp?: boolean; }

export function toolFlags(resolved: ResolvedTools, mcpConfigPath: string): ToolFlags {
  if (!resolved.ok || "passthrough" in resolved) return {};        // andon / passthrough → no flags
  const allowedTools = [...resolved.allowedTools, ...resolved.mcp.map((id) => `mcp__${id}`)];
  return {
    ...(resolved.mcp.length > 0 ? { mcpConfig: mcpConfigPath } : {}),
    allowedTools,
    strictMcp: true,
  };
}
```

**Why pure + in cast-core.** This is the *decision* "resolved tools → which argv flags," the
thing the AC's "live proof" inspects. Putting it in the addon-free core makes it unit-testable
without BAML and without spawning — the live proof becomes an ordinary pure test. `castPlay`
just spreads the result into `dispense`.

**Why fold `mcp__<id>` into `allowedTools`.** `--allowedTools` is an allowlist that, once
present, gates *all* tools including MCP tools (named `mcp__<server>__*`). To let a play actually
call its declared server's tools, the allowlist must carry an `mcp__<server>` wildcard entry per
declared id. This is what makes the scoping "only its servers": with `--strict-mcp-config` the
global firehose is closed, `--mcp-config` loads the project file, and `allowedTools` permits only
the declared servers' tools (plus the play's built-in `allow`). For `decompose-epic` the argv
shows `--allowedTools <built-ins>,mcp__codebase-memory-mcp` — satisfying the AC's "allowedTools …
for codebase-memory-mcp."

**Why `--mcp-config` only when `mcp.length>0`.** A play declaring only built-ins (`allow`, no
`mcp`) still opts into strict least-privilege: `--strict-mcp-config` + `--allowedTools`, but no
pointless `--mcp-config` (it needs no servers). `decompose-epic` (declares `mcp`) gets all three.

**Why not change `resolveTools`.** It shipped in T-032-01 with a fixed shape; `toolFlags`
*composes* over it rather than reopening it. Clean layering: `resolveTools` decides
allowed/missing/passthrough; `toolFlags` translates an allowed result into argv keys.

**Rejected — build the flags inline in `castPlay`.** That buries the load-bearing
`mcp__<id>` + `--mcp-config`-guard logic in the untested impure shell, defeating the "live proof
via inspection, no cast" AC. A pure helper is the testable seam.

## D3 — The missing-capability andon in `castPlay`

**Decision.** Resolve tools at the *top* of `castPlay` — after `root`/`runId`, **before**
`render`/`dispense` — and short-circuit on `!ok`:

```ts
const { available, path: mcpConfigPath } = await readProjectMcpServers(root);
const resolved = resolveTools(play.tools, available);
if (!resolved.ok) {
  process.stdout.write(`· andon: missing-capability — required MCP absent: ${resolved.missing.join(", ")}\n`);
  // log the refusal (honest, countable — IA-10) then return; nothing rendered/dispensed/materialized
  ... appendRunLog({ outcome: "missing-capability", usage: {}, costUsd: 0, gateResults: [], ... });
  return { runId, outcome: "missing-capability", materialized: false, actuals: { usage: {}, wallMs } };
}
const tflags = toolFlags(resolved, mcpConfigPath);
```

**Why before render.** "Nothing cast, nothing materialized" — and render calls BAML for
decompose. Andoning before render makes the refusal genuinely do nothing (not even build a
prompt). The resolve is a cheap fs read + a pure decision.

**Why a new `RunOutcome` `missing-capability` (logged).** The ticket says "reuse the existing
andon/gate-failure path … surfaced like the other honest refusals." The other refusals
(`gate-failed`, `budget-exhausted`) are *logged* with their own outcome, and IA-10/DL-8 want the
andon rate countable from the ledger. So the andon records a run with `outcome:
"missing-capability"`, usage `{}`, cost 0, `gateResults: []` — the same honest shape a timed-out
run logs (nothing metered). Ripple verified low in Research: `OutcomeMix` auto-seeds the new key;
no exhaustive switch breaks; `recalibrate` correctly leaves it uncensored.

**Why amber/stdout via the existing channel.** `castPlay` already prints `· andon: <outcome>` to
stdout (L196). The missing-cap branch prints the same `· andon: missing-capability …` line — the
backend orchestrator's andon channel. The TUI `amber()` rendering (DL-5) is a present-layer
concern keyed off the outcome string, unchanged here.

**Why short-circuit, not a `classify` member.** `classify` decides post-dispense outcomes
(timeout/budget/gate). A missing capability is a *pre-dispense* halt — structurally a guard at
the top, like a precondition, not a post-run classification. Keeping it out of `classify` keeps
that pure function's three-input contract intact.

**Rejected — don't log the andon.** Loses ledger countability (IA-10) and diverges from how
every other refusal is surfaced. The small duplication of an `appendRunLog` call is worth the
consistency; documented inline.

## D4 — `DispenseOptions` / `dispense` threading

**Decision.** Add `mcpConfig?: string`, `allowedTools?: readonly string[]`, `strictMcp?:
boolean` to `DispenseOptions`, and forward them in `dispense`:

```ts
const args = buildArgs({ model, effort, system, maxTurns, mcpConfig, allowedTools, strictMcp });
```

`castPlay` calls `dispense({ ...existing, ...tflags })`. `buildArgs` (T-032-01) already handles
the keys and their guards; this only opens the conduit from `dispense` to it.

**Why on `DispenseOptions` (not a separate param).** Keeps `dispense`'s single-options-object
shape; mirrors how `maxTurns` rides the same object straight to `buildArgs`.

**Rejected — pass `buildArgs` a pre-built object from `castPlay`.** `dispense` owns the
`buildArgs` call (it's the seam); threading three named keys keeps that ownership and the
guard-in-`buildArgs` single-sourced.

## D5 — `decompose-epic` declares its tools (the proof play)

**Decision.** Add `DECOMPOSE_TOOLS: PlayTools` to `decompose-epic-core.ts` (addon-free, beside
`DECOMPOSE_MAX_TURNS`) and reference it from `decomposeEpicPlay.tools`:

```ts
// decompose-epic-core.ts
export const DECOMPOSE_TOOLS: PlayTools = {
  mcp: ["codebase-memory-mcp"],
  allow: ["Read", "Grep", "Glob"],   // the read tools the decompose agent needs
};
// decompose-epic.ts
tools: DECOMPOSE_TOOLS,
```

**Why in the core.** Exactly the `DECOMPOSE_MAX_TURNS` precedent: a data constant that the proof
test must read without loading BAML. The play file imports it and hangs it on the contract.

**Why `["Read","Grep","Glob"]`.** The decompose agent reads the board/epic/charter and searches
the codebase (the playbook's "go and see"); these are the read-only built-ins it needs. No write
tools — decompose's *writes* are the play's own `effect` (materialize), not the agent's. Least
privilege: read to reason, the harness writes.

**Why `mcp: ["codebase-memory-mcp"]`.** This is the server the E-031 tickets wired by hand into
context; the play now *declares* it, so the cast scopes exactly it in (and andons if absent).

**Committed `.mcp.json`** (repo root), portable via `${VAR:-default}`:

```json
{ "mcpServers": { "codebase-memory-mcp": {
  "type": "stdio",
  "command": "${CODEBASE_MEMORY_MCP_BIN:-codebase-memory-mcp}",
  "args": [], "env": {}
} } }
```

No secrets, no absolute path — the bare `codebase-memory-mcp` (on PATH) is the default; an env
var overrides for a non-standard install. This is the `available` set's source and the
`--mcp-config` target.

## What this design explicitly does NOT do

- No `.vend/menu.json` / press / `CastOptions` schema changes; tools come off `play.tools`.
- No skills injection (`PlayTools.skills` carried, never emitted).
- No strict flag for undeclared plays — passthrough stays byte-identical.
- No `cli.ts` change — non-`success` already exits 1.
</content>
