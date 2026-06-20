// The project MCP registry reader (E-032, T-032-02) — the impure half that feeds the pure
// `resolveTools` (T-032-01) its `available` set.
//
// Claude Code's native convention is a committed project `.mcp.json` at the repo root (the
// same file `claude -p --mcp-config` reads), shaped `{ "mcpServers": { "<id>": {...} } }`.
// The project's binding is therefore PROJECT-BASED (this committed file), not the global
// `~/.claude.json`. This module's only job is to surface the SET OF SERVER IDS that file
// declares — the `available` set the cast loop matches a play's declared `tools.mcp` against.
//
// PURE/IMPURE SPLIT (house pattern, cf. decompose-epic-core vs decompose-epic): the PARSE
// (`parseMcpServerIds`) is pure and unit-tested with literal bodies; the READ
// (`readProjectMcpServers`) is the one thin impure verb (touches fs), not unit-tested — its
// logic is the tested parse half.
//
// ABSENT/MALFORMED ⇒ []: a missing or unparseable registry must never crash a cast. An empty
// `available` set makes a DECLARED play andon (honest — the capability genuinely isn't bound)
// while an UNDECLARED play still passes through unchanged. Failing toward the IA-9 refusal is
// the safe direction: a required MCP absent is a STOP, never a silent blind run on the wrong
// tool set.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The committed project registry file name (Claude Code's native convention). */
export const MCP_CONFIG_FILE = ".mcp.json";

/**
 * The server ids a `.mcp.json` body declares. PURE and TOTAL — `JSON.parse` the text and
 * return the keys of `mcpServers` (declared order, which `Object.keys` preserves). Any throw
 * (malformed JSON) or a missing/`non-object` `mcpServers` ⇒ `[]`, so a broken registry reads
 * as "no servers available" rather than crashing the caller.
 */
export function parseMcpServerIds(text: string): string[] {
  try {
    const j = JSON.parse(text) as { mcpServers?: Record<string, unknown> };
    const servers = j?.mcpServers;
    if (servers && typeof servers === "object") return Object.keys(servers);
    return [];
  } catch {
    return [];
  }
}

/**
 * Read the project's `.mcp.json` and return both the `available` server-id set (for
 * `resolveTools`) and the config `path` (for the seam's `--mcp-config` flag). IMPURE — the
 * single fs touch. A MISSING file (ENOENT) or any read error ⇒ `{ available: [], path }`: an
 * unbound registry makes declared plays andon (the safe direction), undeclared plays unchanged.
 * Not unit-tested (its parse logic is covered by {@link parseMcpServerIds}).
 */
export async function readProjectMcpServers(root: string): Promise<{ available: string[]; path: string }> {
  const path = join(root, MCP_CONFIG_FILE);
  try {
    const text = await readFile(path, "utf8");
    return { available: parseMcpServerIds(text), path };
  } catch {
    return { available: [], path };
  }
}
