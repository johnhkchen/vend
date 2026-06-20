import { describe, expect, test } from "bun:test";
import { parseMcpServerIds } from "./mcp-registry.ts";

// T-032-02: the PURE parse half of the project MCP registry reader. We import ONLY
// parseMcpServerIds — the fs read (`readProjectMcpServers`) is the thin impure verb whose
// logic IS this function, so it needs no separate test (house pattern).

describe("parseMcpServerIds — server ids from a .mcp.json body (pure, total)", () => {
  test("a full registry yields its server ids in declared order", () => {
    const text = JSON.stringify({
      mcpServers: {
        "codebase-memory-mcp": { type: "stdio", command: "x" },
        doppler: { type: "stdio", command: "y" },
      },
    });
    expect(parseMcpServerIds(text)).toEqual(["codebase-memory-mcp", "doppler"]);
  });

  test("the project's committed shape yields codebase-memory-mcp", () => {
    const text = JSON.stringify({
      mcpServers: { "codebase-memory-mcp": { type: "stdio", command: "${VAR:-codebase-memory-mcp}" } },
    });
    expect(parseMcpServerIds(text)).toEqual(["codebase-memory-mcp"]);
  });

  test("a missing mcpServers key ⇒ [] (not a crash)", () => {
    expect(parseMcpServerIds(JSON.stringify({ other: 1 }))).toEqual([]);
  });

  test("an empty mcpServers object ⇒ []", () => {
    expect(parseMcpServerIds(JSON.stringify({ mcpServers: {} }))).toEqual([]);
  });

  test("malformed JSON ⇒ [] (the safe direction — declared plays then andon)", () => {
    expect(parseMcpServerIds("{ not json")).toEqual([]);
    expect(parseMcpServerIds("")).toEqual([]);
  });

  test("a non-object mcpServers ⇒ []", () => {
    expect(parseMcpServerIds(JSON.stringify({ mcpServers: null }))).toEqual([]);
    expect(parseMcpServerIds(JSON.stringify({ mcpServers: "x" }))).toEqual([]);
  });
});
