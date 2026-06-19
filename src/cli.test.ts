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
    // `run summon` parses past the (now-generic) play name and trips on the missing epic —
    // an unknown play is rejected at dispatch by the registry, not by the parser.
    expect(parseArgs(["run", "summon"])).toEqual({ cmd: "usage", error: "missing <epic.md>" });
  });
  test("run <play> captures any play name generically (validated at dispatch, not parse)", () => {
    expect(parseArgs(["run", "propose-epic", "e.md", "--budget", "1,2"])).toEqual({
      cmd: "run",
      play: "propose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
    });
  });
  test("run with no play name → usage", () => {
    expect(parseArgs(["run"])).toEqual({ cmd: "usage", error: "missing <play>" });
    expect(parseArgs(["run", "--budget", "1,2"])).toEqual({ cmd: "usage", error: "missing <play>" });
  });
  test("bare `vend` is the browse surface (T-003-02)", () => {
    expect(parseArgs([])).toEqual({ cmd: "browse", all: false });
  });
  test("`vend --all` browses with hidden rows revealed", () => {
    expect(parseArgs(["--all"])).toEqual({ cmd: "browse", all: true });
  });
  test("a selection token is the press (T-003-04)", () => {
    expect(parseArgs(["1,2,4-6"])).toEqual({ cmd: "select", selection: "1,2,4-6", all: false });
    expect(parseArgs(["1,2"])).toEqual({ cmd: "select", selection: "1,2", all: false });
  });
  test("shell-split selection tokens join with commas", () => {
    expect(parseArgs(["1", "2", "4-6"])).toEqual({ cmd: "select", selection: "1,2,4-6", all: false });
  });
  test("`vend <sel> --all` presses with hidden rows revealed", () => {
    expect(parseArgs(["1", "--all"])).toEqual({ cmd: "select", selection: "1", all: true });
  });
  test("`vend <sel> --budget` overrides the warranted envelope", () => {
    expect(parseArgs(["1,2", "--budget", "100,200"])).toEqual({
      cmd: "select",
      selection: "1,2",
      all: false,
      budget: { timeMs: 100, tokens: 200 },
    });
  });
  test("a non-selection token is still an unknown command, not a press", () => {
    expect(parseArgs(["frobnicate"])).toEqual({ cmd: "usage", error: "unknown command: frobnicate" });
  });
  test("a malformed press --budget surfaces as usage", () => {
    expect(parseArgs(["1,2", "--budget", "nope"]).cmd).toBe("usage");
  });
  test("`--budget` with no selection is usage, not a press", () => {
    expect(parseArgs(["--budget", "1,2"])).toEqual({ cmd: "usage", error: "missing selection" });
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

  // T-011-02: the propose→decompose chain gesture.
  test("chain <signal> (no budget) → a chain command, no budget", () => {
    expect(parseArgs(["chain", "ship-the-head-gate"])).toEqual({ cmd: "chain", signal: "ship-the-head-gate" });
  });
  test("chain joins multi-token and single-token signals to the same string", () => {
    const multi = parseArgs(["chain", "a", "pulled", "signal"]);
    const single = parseArgs(["chain", "a pulled signal"]);
    expect(multi).toEqual({ cmd: "chain", signal: "a pulled signal" });
    expect(single).toEqual({ cmd: "chain", signal: "a pulled signal" });
  });
  test("chain <signal> --budget carries the override applied to both steps", () => {
    expect(parseArgs(["chain", "ramp-the-shelf", "--budget", "100,200"])).toEqual({
      cmd: "chain",
      signal: "ramp-the-shelf",
      budget: { timeMs: 100, tokens: 200 },
    });
  });
  test("chain with no signal → usage", () => {
    expect(parseArgs(["chain"])).toEqual({ cmd: "usage", error: "missing <signal>" });
    expect(parseArgs(["chain", "--budget", "1,2"])).toEqual({ cmd: "usage", error: "missing <signal>" });
  });
  test("chain <signal> --budget malformed → usage", () => {
    expect(parseArgs(["chain", "sig", "--budget", "nope"]).cmd).toBe("usage");
    expect(parseArgs(["chain", "sig", "--budget"])).toEqual({ cmd: "usage", error: "missing --budget <ms>,<tokens>" });
  });
});
