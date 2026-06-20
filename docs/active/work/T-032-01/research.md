# T-032-01 — Research

The pure foundation for per-play tool/MCP provisioning: a `tools?` declaration on the
`Play` contract, a `buildArgs` extension that emits the CLI scoping flags, and a pure
`resolveTools` decision function. **No I/O** — reading `.mcp.json` and cast-time wiring are
T-032-02. This phase maps what exists, where, and how it connects. Descriptive only.

## The precedent to mirror: `maxTurns` (E-015)

`maxTurns` is the exact field→resolve→seam pattern this ticket replicates. Tracing it end to
end (so the new `tools` path lands in the same three seams):

1. **Contract field** — `Play.maxTurns?: number` at `src/engine/play.ts:157`. Optional,
   `readonly`, doc-commented as "the per-play sibling of `budget`". An omitted field leaves
   the play unchanged. This is the slot `tools?` mirrors (~line 157, same doc block).
2. **Resolver** — `resolveMaxTurns(override, dflt)` at `src/engine/cast-core.ts:54`. PURE,
   one-line `??` precedence, unit-tested in `cast-core.test.ts`. Sits beside
   `resolveLoggedModel`/`resolveTurnsUsed`. This is where `resolveTools` belongs.
3. **Seam flag** — `buildArgs` at `src/executor/claude.ts:115` appends `--max-turns` only
   when truthy (`if (maxTurns) args.push("--max-turns", String(maxTurns))`, line 122). The
   omit-when-absent discipline keeps the no-flag argv byte-identical to before E-015.
4. **Threading** — `castPlay` (`src/engine/cast.ts:140`) calls `resolveMaxTurns`, passes the
   result to `dispense` (`:145`), which forwards to `buildArgs` (`src/executor/claude.ts:260`).

**This ticket implements steps 1–3 only.** Step 4 (cast-time threading + the project file
read that feeds `available` into `resolveTools`, + the missing-MCP andon) is T-032-02.

## File-by-file map

### `src/engine/play.ts` (the contract — 256 lines, PURE: types + a Map)
- `Play<I, O>` interface, lines 127–160. Members: `name`, `summary`, `render`, `parse`,
  `gates`, `effect`, `budget`, `maxTurns?` (157), `card`. Both imports are `type`-only
  (`Budget`, `RunOutcome`) — the addon-free guarantee. A new `PlayTools` type + a
  `tools?: PlayTools` field are purely additive: no runtime value, no new import.
- `AnyPlay = Play<any, any>` (171) is the registry's erased element. Adding an optional field
  does not change registration or lookup — every existing concrete play stays assignable.
- The six concrete plays (`src/play/*.ts`) construct `Play` object literals; an **optional**
  field means none of them need to change to keep compiling (back-compat AC).

### `src/executor/claude.ts` (the metered seam — 288 lines)
- `buildArgs({ model, effort, system, maxTurns })` at 115–124. The PURE argv builder. Base
  flags always (`-p --output-format stream-json --verbose`); each optional flag appended only
  when truthy. **Sole caller: `dispense` at line 260** (confirmed by grep — no other call
  site, so widening the options object is safe).
- `DispenseOptions` (71–92) and `dispense` (259) are the IMPURE spawn path. **Untouched by
  this ticket** — threading the resolved flags through `dispense` is T-032-02's wiring. We
  extend `buildArgs`'s signature only; `dispense`'s existing call passes the same four keys,
  so its argv stays byte-identical.

### `src/engine/cast-core.ts` (the pure decision core — 152 lines)
- Home of `resolveLoggedModel` (41), `resolveMaxTurns` (54), `resolveTurnsUsed` (64),
  `classify` (107), `castGateRows` (95). Every import is `type`-only; no fs/clock/process.
- Already imports `type { GateVerdict } from "./play.ts"` (line 25) — adding `PlayTools` to
  that same import is the natural way to give `resolveTools` its input type. `resolveTools`
  belongs here beside `resolveMaxTurns`, and is re-exported via `cast.ts`'s `export *`.

### Tests
- `src/executor/claude.test.ts` — 8 `buildArgs` cases (lines 21–73), including the critical
  "max-turns absent ⇒ argv identical to today" (66) and "0 treated as absent" (71). New
  tool-flag cases extend this file; the existing 8 must stay green unchanged (byte-identical
  no-tools argv).
- `cast-core.test.ts` — where `resolveMaxTurns` is tested; `resolveTools`'s three-variant
  unit tests join it.

## The one external contract: `claude -p --help` (verified this session)

Ran `claude -p --help`. Exact spellings and syntax confirmed (NOT assumed):

| Flag | Help text | Shape |
|------|-----------|-------|
| `--mcp-config <configs...>` | "Load MCP servers from JSON files or strings (space-separated)" | path/string value |
| `--allowedTools, --allowed-tools <tools...>` | "Comma or space-separated list of tool names to allow (e.g. `Bash(git *) Edit`)" | comma-or-space list |
| `--strict-mcp-config` | "Only use MCP servers from --mcp-config, ignoring all other MCP configurations" | boolean (no value) |
| `--tools <tools...>` | built-in set selection (`""`/`default`/names) | not used this slice |

Notes that constrain the design:
- `--allowedTools` accepts **comma OR space**. Since `dispense` spawns with no shell, a
  single comma-joined argv element (`"Read,Grep"`) is unambiguous and avoids the variadic
  swallowing following flags — comma-join is the safe choice.
- `--strict-mcp-config` is the current flag name (no value). It scopes the `claude -p`
  subprocess only — never the user's interactive session.
- `--mcp-config` takes a path; T-032-01 only passes a string through `buildArgs` — it does
  not construct or read the file (that's T-032-02).

## `resolveTools` — the three states the design must produce

The cast path (T-032-02) needs a tagged result to branch on. Three distinct cases, drawn
from the ticket and the contract:
1. **Undeclared** (`tools === undefined`) → passthrough: no flags, inherit the global MCP set
   — byte-identical to today (back-compat).
2. **Declared + all required `mcp` present in `available`** → emit `--mcp-config` +
   `--allowedTools` + `--strict-mcp-config` (least-privilege, strict on).
3. **Declared + one or more required `mcp` absent** → andon: `{ ok: false, missing }`, so the
   cast can refuse to dispense rather than silently inherit the wrong tool set.

`available` is **passed in** (the set of server ids the project provides) — `resolveTools`
performs NO file read. That read is T-032-02.

## Constraints & assumptions

- **Purity is load-bearing.** `play.ts` and `cast-core.ts` must stay addon-free (type-only
  imports). `buildArgs` must stay total and pure.
- **Back-compat is an AC, not a nicety.** Undeclared plays produce byte-identical argv; the 8
  existing `buildArgs` tests are the guard.
- **Scope cut: `skills` is forward-compatible only.** The field may exist on `PlayTools`, but
  this slice injects no skills (no `--tools`/skills flag wired). `resolveTools` carries it
  through structurally but emits nothing for it.
- **No `dispense`/`castPlay` behavior change.** Only the `buildArgs` signature widens; its one
  caller passes the same keys, so the live path is unchanged until T-032-02 threads tools in.
- No project `.mcp.json` exists today; MCP config is global at `~/.claude.json`. E-032 builds
  per-play scoping from scratch — this ticket is its pure half.
