# Research — T-060-01-01: decompose graceful-degrades on absent codebase-memory-mcp

## Ticket in one line

Reclassify `codebase-memory-mcp` from a **required-STOP** MCP into a **missing-OPTIONAL
capability** in decompose's tool resolution, so a fresh seed without the MCP **clears with
reduced grounding** instead of firing the missing-capability andon.

## Where the behavior lives

The tool-resolution path is a clean three-stop pipeline, split pure-core / impure-shell:

1. **`PlayTools`** — the per-play tool declaration (the data).
   `src/engine/play.ts:135-140`. Fields: `mcp?`, `allow?`, `deny?`, `skills?` — all optional,
   all `readonly`. An undeclared `tools` field ⇒ passthrough (inherit the global MCP set).

2. **`DECOMPOSE_TOOLS`** — decompose's concrete declaration.
   `src/play/decompose-epic-core.ts:68-72`:
   ```ts
   export const DECOMPOSE_TOOLS: PlayTools = {
     mcp: ["codebase-memory-mcp"],   // ← REQUIRED today; the source of the andon
     allow: ["Read", "Grep", "Glob"],
     deny: AUTONOMOUS_DENY,          // ["AskUserQuestion"]
   };
   ```
   Set onto the play at `src/play/decompose-epic.ts:205` (`tools: DECOMPOSE_TOOLS`). The
   comment at `decompose-epic.ts:202-204` is the line the ticket names: *"a project registry
   missing codebase-memory-mcp andons before dispense."*

3. **`resolveTools(declared, available)`** — the PURE decision.
   `src/engine/cast-core.ts:95-108`. Returns a discriminated `ResolvedTools`
   (`cast-core.ts:75-78`):
   - `{ ok: true, passthrough: true, deny }` — declared nothing scoping.
   - `{ ok: true, mcp, allowedTools, deny, strict: true }` — declared `mcp`/`allow`, all
     required MCP present.
   - `{ ok: false, missing }` — declared `mcp` but ≥1 required id absent ⇒ **the andon**.
   The absent branch is `missing.length > 0` at `cast-core.ts:100-101`.

4. **`toolFlags(resolved, mcpConfigPath)`** — PURE projection into argv flags.
   `src/engine/cast-core.ts:145-156`. `!ok` ⇒ `{}` (defensive — the andon is handled
   upstream). Strict ⇒ `mcpConfig` (only when `mcp.length>0`), `allowedTools` = `allow` +
   one `mcp__<id>` wildcard per server, `strictMcp: true`, `disallowedTools` when `deny`
   non-empty.

5. **`castPlay`** — the IMPURE orchestrator that consumes the resolution.
   `src/engine/cast.ts:128-178`. At `cast.ts:146-178`:
   - reads the project registry: `readProjectMcpServers(root)` → `{ available, path }`;
   - `const resolved = resolveTools(play.tools, available)`;
   - **`if (!resolved.ok)`** ⇒ writes `· andon: missing-capability …` to stdout
     (`cast.ts:150`), appends ONE run-log record with `outcome: "missing-capability"`,
     `usage:{}`, `costUsd:0` (`cast.ts:154-171`), and **returns early** with
     `outcome:"missing-capability", materialized:false` (`cast.ts:172-177`). Nothing
     rendered, nothing dispensed.
   - else threads `toolFlags(resolved, mcpConfigPath)` into `dispense` at `cast.ts:180`,
     `cast.ts:214` (`...tflags`).

## The MCP registry (the `available` set)

`src/engine/mcp-registry.ts`. `readProjectMcpServers(root)` reads `<root>/.mcp.json` and
returns the declared server ids plus the config path. On a **fresh seed** with no
`.mcp.json` (or one without `codebase-memory-mcp`), `available` is `[]` / lacks the id —
exactly the input that drives `resolveTools(DECOMPOSE_TOOLS, [])` to `{ok:false}` today.

## What the run log records (relevant to the sibling ticket)

`src/log/run-log.ts:50` — `RUN_OUTCOMES` includes `"missing-capability"`. The andon path
logs that outcome. There is **no** reduced-grounding field on the run record yet — that is
explicitly **T-060-01-02** (depends on this ticket). This ticket must surface the flag so
the sibling has something to thread; it must NOT change the run-log record shape.

## Existing tests (the contract to preserve / change)

`src/engine/cast-core.test.ts`:
- `resolveTools` suite, lines 157-229 — the present-case strict result is asserted with
  `toEqual({ ok:true, mcp, allowedTools, deny, strict:true })` at lines 163-172, 185-193,
  210-218. **Adding a field to the strict variant breaks these `toEqual`s** unless the field
  is omitted-when-false or the expectations are updated.
- `toolFlags` suite, lines 231-295 — present-case argv projections.
- **The live-proof `ABSENT MCP` test, lines 317-322** — currently asserts
  `resolveTools(DECOMPOSE_TOOLS, [])` equals `{ ok:false, missing:["codebase-memory-mcp"] }`
  and that the defensive `toolFlags` projection emits the base argv. **This test encodes the
  exact behavior the ticket reverses** — it is the test the AC rewrites.
- `WIRING GUARD`, lines 366-373 — asserts `DECOMPOSE_TOOLS.deny` carries `AskUserQuestion`
  and the resolved argv carries the deny flag. Unaffected by moving the mcp field, but the
  present-case argv at lines 301-310 asserts `Read,Grep,Glob,mcp__codebase-memory-mcp` —
  must stay green when the mcp is PRESENT.

`src/play/decompose-epic.test.ts` — pure core tests; **no** references to `mcp` /
`DECOMPOSE_TOOLS` resolution. Safe.

`buildArgs` — `src/executor/claude.ts:142-174`. Order: `--mcp-config`, `--allowedTools`,
`--disallowedTools`, `--strict-mcp-config`. Empty arrays emit no flag. Unchanged.

## Constraints & boundaries (from CLAUDE.md, the epic, the memory)

- **Engine ⊥ play** (E-007 keystone): `src/engine/` never imports `src/play/`. The
  resolution logic stays in `cast-core.ts`; the declaration stays in `decompose-epic-core.ts`.
- **Degrade stays in the existing branch** (epic): *"a missing-optional-capability branch
  where tool-resolution already lives — not a new andon path."* So the change is inside
  `resolveTools` + `PlayTools`, not a new code path in `castPlay`.
- **Pure-core discipline**: `resolveTools` / `toolFlags` are PURE and unit-tested; `castPlay`
  is impure and NOT unit-tested. The AC's test must land on the pure surface.
- **Empty-omitted discipline** (house pattern): `deny: []` is carried explicitly, but
  `disallowedTools`/flags are omitted when empty. A new flag must pick one convention
  deliberately.
- **Honest reduced-grounding marker** (epic, P5): the degrade must be *countable, not
  invisible* — the flag should ride toward the run record (the sibling ticket consumes it).
- **Out of scope**: changing the run-log record shape (T-060-01-02), shipping/bundling the
  MCP, deep-grounding quality work, the steer/board render wiring (E-059), budget calibration
  (S-060-02).

## Assumptions surfaced

- A fresh seed genuinely lacks `codebase-memory-mcp` in `.mcp.json` — confirmed by the epic's
  "Done looks like" ("a fresh seed with no codebase-memory-mcp present").
- `codebase-memory-mcp` is the ONLY MCP decompose declares, so after reclassification
  decompose has **no required MCP** — its andon path becomes unreachable for the absent case
  (but the andon code stays for any future required-MCP play).
- The read-only built-ins (`Read`, `Grep`, `Glob`) are sufficient grounding for a degraded
  clear — the epic asserts "the make-or-break steer→board path never needs the MCP."
- "reduced-grounding flag" = a signal on the resolution result, distinct from the (deferred)
  run-record field.
