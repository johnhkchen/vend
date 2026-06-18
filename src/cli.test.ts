import { describe, expect, test } from "bun:test";
import { parseArgs, parseBudgetArg } from "./cli.ts";

// T-002-03 CLI: the PURE arg parsers. The `import.meta.main` dispatch (which imports
// the impure runner and exits the process) does not run on import, so this test never
// touches the runner or the BAML addon — it only exercises parsing.

describe("parseBudgetArg", () => {
  test("parses <ms>,<tokens> into a Budget", () => {
    expect(parseBudgetArg("120000,50000")).toEqual({ timeMs: 120000, tokens: 50000 });
    expect(parseBudgetArg(" 1000 , 2000 ")).toEqual({ timeMs: 1000, tokens: 2000 });
  });
  test("rejects wrong arity", () => {
    expect(() => parseBudgetArg("1000")).toThrow(/<ms>,<tokens>/);
    expect(() => parseBudgetArg("1000,2000,3000")).toThrow(/<ms>,<tokens>/);
  });
  test("rejects non-integer fields", () => {
    expect(() => parseBudgetArg("a,b")).toThrow(/integers/);
    expect(() => parseBudgetArg("1000,")).toThrow(/integers/);
    expect(() => parseBudgetArg("1.5,2000")).toThrow(/integers/);
  });
});

describe("parseArgs", () => {
  test("happy path", () => {
    const p = parseArgs(["run", "decompose-epic", "docs/active/epic/E-001.md", "--budget", "120000,50000"]);
    expect(p).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "docs/active/epic/E-001.md",
      budget: { timeMs: 120000, tokens: 50000 },
    });
  });
  test("unknown command / play → usage", () => {
    expect(parseArgs(["frobnicate"])).toEqual({ cmd: "usage", error: "unknown command: frobnicate" } as never);
    expect(parseArgs(["run", "summon"]).cmd).toBe("usage");
    expect(parseArgs([])).toEqual({ cmd: "usage" });
  });
  test("missing epic path → usage", () => {
    expect(parseArgs(["run", "decompose-epic", "--budget", "1,2"])).toEqual({ cmd: "usage", error: "missing <epic.md>" });
  });
  test("missing --budget → usage", () => {
    expect(parseArgs(["run", "decompose-epic", "epic.md"])).toEqual({
      cmd: "usage",
      error: "missing --budget <ms>,<tokens>",
    });
  });
  test("malformed --budget surfaces the parse error as usage", () => {
    expect(parseArgs(["run", "decompose-epic", "epic.md", "--budget", "nope"]).cmd).toBe("usage");
  });
});
