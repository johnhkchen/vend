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

  // T-014-02: the `--no-gates` run mode (the E2 probe's ungated arm).
  test("run --no-gates sets skipGates:true", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--no-gates"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
      skipGates: true,
    });
  });
  test("run --no-gates is order-independent vs --budget", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--no-gates", "--budget", "1,2"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
      skipGates: true,
    });
  });
  test("run without --no-gates omits the skipGates key (gated default unchanged)", () => {
    const p = parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2"]);
    expect(p).not.toHaveProperty("skipGates");
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

  // T-016-02: the expand-fragment demand-extraction gesture (mirrors chain's parse shape).
  test("expand <fragment> (no budget) → an expand command, no budget", () => {
    expect(parseArgs(["expand", "this-is-rough"])).toEqual({ cmd: "expand", fragment: "this-is-rough" });
  });
  test("expand joins multi-token and single-token fragments to the same string", () => {
    const multi = parseArgs(["expand", "this", "feels", "rough"]);
    const single = parseArgs(["expand", "this feels rough"]);
    expect(multi).toEqual({ cmd: "expand", fragment: "this feels rough" });
    expect(single).toEqual({ cmd: "expand", fragment: "this feels rough" });
  });
  test("expand <fragment> --budget carries the override", () => {
    expect(parseArgs(["expand", "a rough TODO", "--budget", "100,200"])).toEqual({
      cmd: "expand",
      fragment: "a rough TODO",
      budget: { timeMs: 100, tokens: 200 },
    });
  });
  test("expand with no fragment → usage", () => {
    expect(parseArgs(["expand"])).toEqual({ cmd: "usage", error: "missing <fragment>" });
    expect(parseArgs(["expand", "--budget", "1,2"])).toEqual({ cmd: "usage", error: "missing <fragment>" });
  });
  test("expand <fragment> --budget malformed → usage", () => {
    expect(parseArgs(["expand", "frag", "--budget", "nope"]).cmd).toBe("usage");
    expect(parseArgs(["expand", "frag", "--budget"])).toEqual({ cmd: "usage", error: "missing --budget <ms>,<tokens>" });
  });

  // T-017-02: the survey cold-start board-bootstrap gesture (flags-only — no positional subject).
  test("survey (no budget) → a survey command, no budget", () => {
    expect(parseArgs(["survey"])).toEqual({ cmd: "survey" });
  });
  test("survey --budget carries the override", () => {
    expect(parseArgs(["survey", "--budget", "100,200"])).toEqual({
      cmd: "survey",
      budget: { timeMs: 100, tokens: 200 },
    });
  });
  test("survey with an unexpected positional → usage (there is no subject to type)", () => {
    expect(parseArgs(["survey", "junk"])).toEqual({ cmd: "usage", error: "unexpected survey argument: junk" });
  });
  test("survey --budget malformed / dangling → usage", () => {
    expect(parseArgs(["survey", "--budget", "nope"]).cmd).toBe("usage");
    expect(parseArgs(["survey", "--budget"])).toEqual({ cmd: "usage", error: "missing --budget <ms>,<tokens>" });
  });

  // T-018-02: the steering-capstone gesture (flags-only — no positional subject, like survey).
  test("steer (no budget) → a steer command, no budget", () => {
    expect(parseArgs(["steer"])).toEqual({ cmd: "steer" });
  });
  test("steer --budget carries the override", () => {
    expect(parseArgs(["steer", "--budget", "100,200"])).toEqual({
      cmd: "steer",
      budget: { timeMs: 100, tokens: 200 },
    });
  });
  test("steer with an unexpected positional → usage (there is no subject to type)", () => {
    expect(parseArgs(["steer", "junk"])).toEqual({ cmd: "usage", error: "unexpected steer argument: junk" });
  });
  test("steer --budget malformed / dangling → usage", () => {
    expect(parseArgs(["steer", "--budget", "nope"]).cmd).toBe("usage");
    expect(parseArgs(["steer", "--budget"])).toEqual({ cmd: "usage", error: "missing --budget <ms>,<tokens>" });
  });

  // T-024-03: the `vend work` counter gesture — fund the macro-wallet, spend down the staged board.
  test("work (no budget) → a work command, no budget (dispatch defaults the macro budget)", () => {
    expect(parseArgs(["work"])).toEqual({ cmd: "work" });
  });
  test("work --budget carries the macro-wallet allocation", () => {
    expect(parseArgs(["work", "--budget", "600000,120000"])).toEqual({
      cmd: "work",
      budget: { timeMs: 600000, tokens: 120000 },
    });
  });
  test("work --board points at a specific staged board", () => {
    expect(parseArgs(["work", "--board", "docs/active/pm/staged/survey-board.md"])).toEqual({
      cmd: "work",
      board: "docs/active/pm/staged/survey-board.md",
    });
    expect(parseArgs(["work", "--budget", "1,2", "--board", "b.md"])).toEqual({
      cmd: "work",
      budget: { timeMs: 1, tokens: 2 },
      board: "b.md",
    });
  });
  test("work --budget malformed / dangling → usage", () => {
    expect(parseArgs(["work", "--budget", "nope"]).cmd).toBe("usage");
    expect(parseArgs(["work", "--budget"])).toEqual({ cmd: "usage", error: "missing --budget <ms>,<tokens>" });
  });
  test("work --board with no value → usage", () => {
    expect(parseArgs(["work", "--board"])).toEqual({ cmd: "usage", error: "missing --board <path>" });
  });
  test("work with an unexpected positional → usage (there is no subject to type)", () => {
    expect(parseArgs(["work", "junk"])).toEqual({ cmd: "usage", error: "unexpected work argument: junk" });
  });

  // T-013-02: the read-only Ledger envelope readout.
  test("envelope <play> (no tier) → default tier standard", () => {
    expect(parseArgs(["envelope", "decompose-epic"])).toEqual({
      cmd: "envelope",
      play: "decompose-epic",
      tier: "standard",
    });
  });
  test("envelope <play> --tier carries the chosen leverage tier", () => {
    expect(parseArgs(["envelope", "decompose-epic", "--tier", "keystone"])).toEqual({
      cmd: "envelope",
      play: "decompose-epic",
      tier: "keystone",
    });
  });
  test("envelope with no play → usage", () => {
    expect(parseArgs(["envelope"])).toEqual({ cmd: "usage", error: "missing <play>" });
    expect(parseArgs(["envelope", "--tier", "leaf"])).toEqual({ cmd: "usage", error: "missing <play>" });
  });
  test("envelope --tier with an unknown tier → usage", () => {
    expect(parseArgs(["envelope", "decompose-epic", "--tier", "bogus"]).cmd).toBe("usage");
    expect(parseArgs(["envelope", "decompose-epic", "--tier"]).cmd).toBe("usage");
  });

  // T-013-03: the bias-correction flags on the envelope readout.
  test("envelope --estimate parses the raw envelope to correct", () => {
    expect(parseArgs(["envelope", "decompose-epic", "--estimate", "7200000,5000"])).toEqual({
      cmd: "envelope",
      play: "decompose-epic",
      tier: "standard",
      estimate: { timeMs: 7_200_000, tokens: 5000 },
    });
  });
  test("envelope --project carries the project to correct against", () => {
    expect(parseArgs(["envelope", "decompose-epic", "--project", "acme"])).toEqual({
      cmd: "envelope",
      play: "decompose-epic",
      tier: "standard",
      project: "acme",
    });
  });
  test("envelope --tier + --estimate + --project compose", () => {
    expect(parseArgs(["envelope", "p", "--tier", "keystone", "--estimate", "1000,2000", "--project", "x"])).toEqual({
      cmd: "envelope",
      play: "p",
      tier: "keystone",
      estimate: { timeMs: 1000, tokens: 2000 },
      project: "x",
    });
  });
  test("envelope --estimate with a malformed value → usage", () => {
    expect(parseArgs(["envelope", "p", "--estimate", "nope"]).cmd).toBe("usage");
    expect(parseArgs(["envelope", "p", "--estimate"]).cmd).toBe("usage");
  });
  test("envelope --project with no id → usage", () => {
    expect(parseArgs(["envelope", "p", "--project"]).cmd).toBe("usage");
  });
  test("envelope with an unknown flag → usage", () => {
    expect(parseArgs(["envelope", "p", "--bogus"]).cmd).toBe("usage");
  });
  test("the bare two-arg envelope form is unchanged (no estimate/project)", () => {
    const parsed = parseArgs(["envelope", "decompose-epic"]);
    expect(parsed).toEqual({ cmd: "envelope", play: "decompose-epic", tier: "standard" });
  });
});

describe("parseArgs — run --intervened / --no-intervened (T-014-01 E1 self-report)", () => {
  test("--intervened sets intervened:true", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--intervened"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
      intervened: true,
    });
  });
  test("--no-intervened sets intervened:false (a clean walk-away is a value)", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--no-intervened"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
      intervened: false,
    });
  });
  test("neither flag omits the intervened key (unknown — back-compat shape)", () => {
    const p = parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2"]);
    expect(p).not.toHaveProperty("intervened");
  });
  test("--intervened composes with --no-gates", () => {
    const p = parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--no-gates", "--intervened"]);
    expect(p).toMatchObject({ cmd: "run", skipGates: true, intervened: true });
  });
});

describe("parseArgs — audit (T-014-01 walk-away readout)", () => {
  test("bare `audit` defaults to standard tier, all plays, no window", () => {
    expect(parseArgs(["audit"])).toEqual({ cmd: "audit", tier: "standard" });
  });
  test("audit <play> scopes to one play", () => {
    expect(parseArgs(["audit", "decompose-epic"])).toEqual({ cmd: "audit", tier: "standard", play: "decompose-epic" });
  });
  test("audit --tier + --window compose (play optional)", () => {
    expect(parseArgs(["audit", "decompose-epic", "--tier", "keystone", "--window", "50"])).toEqual({
      cmd: "audit",
      tier: "keystone",
      play: "decompose-epic",
      window: 50,
    });
  });
  test("audit with a bad tier → usage", () => {
    expect(parseArgs(["audit", "--tier", "bogus"]).cmd).toBe("usage");
  });
  test("audit with a non-positive / non-integer window → usage", () => {
    expect(parseArgs(["audit", "--window", "0"]).cmd).toBe("usage");
    expect(parseArgs(["audit", "--window", "nope"]).cmd).toBe("usage");
  });
  test("audit with an unknown flag → usage", () => {
    expect(parseArgs(["audit", "--bogus"]).cmd).toBe("usage");
  });
});
