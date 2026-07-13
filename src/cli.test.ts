import { describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatRunSummaryLine, formatSvgWriteLine, parseArgs, parseBudgetArg, splitAfter, suggestCommand, USAGE } from "./cli.ts";

// T-002-03 CLI: the PURE arg parsers. The `import.meta.main` dispatch (which imports
// the impure runner and exits the process) does not run on import, so this test never
// touches the runner or the BAML addon — it only exercises parsing.

describe("parseBudgetArg", () => {
  test("parses <ms>,<tokens> into a Budget", () => {
    expect(parseBudgetArg("120000,50000")).toEqual({ timeMs: 120000, tokens: 50000 });
    expect(parseBudgetArg(" 1000 , 2000 ")).toEqual({ timeMs: 1000, tokens: 2000 });
  });
  test("parses humane time and token units to the same raw Budget", () => {
    expect(parseBudgetArg("40m,350k")).toEqual(parseBudgetArg("2400000,350000"));
    expect(parseBudgetArg("2h,1.5m")).toEqual({ timeMs: 7_200_000, tokens: 1_500_000 });
    expect(parseBudgetArg("2400000,350000")).toEqual({ timeMs: 2_400_000, tokens: 350_000 });
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
  test("rejects malformed humane suffixes with the existing RangeError shape", () => {
    const malformed = () => parseBudgetArg("40x,350k");
    expect(malformed).toThrow(RangeError);
    expect(malformed).toThrow(/integers/);
  });
});

describe("formatRunSummaryLine — honest editorial degradation marker", () => {
  test("a degraded clear states the exact occurrence count", () => {
    expect(formatRunSummaryLine({
      runId: "run-degraded",
      outcome: "success",
      materialized: true,
      degrades: [
        { code: "P9", location: "T-1.advances[1]", action: "strip" },
        { code: "N4", location: "T-1.md#purpose", action: "annotate" },
      ],
    })).toBe("run run-degraded: cleared; 2 cite(s) degraded (materialized: true)\n");
  });

  test("clean success and refusal lines retain the established outcome copy", () => {
    expect(formatRunSummaryLine({ runId: "run-clean", outcome: "success", materialized: true }))
      .toBe("run run-clean: success (materialized: true)\n");
    expect(formatRunSummaryLine({ runId: "run-stop", outcome: "gate-failed", materialized: false }))
      .toBe("run run-stop: gate-failed (materialized: false)\n");
  });
});

describe("suggestCommand", () => {
  const verbs = ["steer", "shelf", "doctor", "user-guide"] as const;

  test("maps insertion, deletion, and substitution near-misses to the nearest verb", () => {
    expect(suggestCommand("steeer", verbs)).toBe("steer");
    expect(suggestCommand("ster", verbs)).toBe("steer");
    expect(suggestCommand("doctar", verbs)).toBe("doctor");
  });

  test("chooses the lowest distance and keeps candidate order on a tie", () => {
    expect(suggestCommand("shel", ["steer", "shelf"])).toBe("shelf");
    expect(suggestCommand("cot", ["cat", "cut"])).toBe("cat");
  });

  test("uses an inclusive threshold and stays silent when nothing is close", () => {
    expect(suggestCommand("stxxr", verbs, 2)).toBe("steer");
    expect(suggestCommand("stxxr", verbs, 1)).toBeUndefined();
    expect(suggestCommand("frobnicate", verbs)).toBeUndefined();
    expect(suggestCommand("steeer", [])).toBeUndefined();
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
    expect(parseArgs(["frobnicate"])).toEqual({
      cmd: "usage",
      error: "unknown command: frobnicate",
    });
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
  test("`--help`, `-h`, and `help` are successful discovery commands", () => {
    expect(parseArgs(["--help"])).toEqual({ cmd: "help" });
    expect(parseArgs(["-h"])).toEqual({ cmd: "help" });
    expect(parseArgs(["help"])).toEqual({ cmd: "help" });
  });
  test("global help flags win at every argv position across every canonical verb", () => {
    const verbInvocations = [
      ["help"],
      ["run", "decompose-epic", "epic.md", "--budget", "1,2"],
      ["chain", "signal", "--budget", "1,2"],
      ["expand", "fragment", "--budget", "1,2"],
      ["annotate", "T-001", "feedback", "--seat", "dev"],
      ["survey", "--budget", "1,2"],
      ["steer", "--budget", "1,2"],
      ["svg", "--seat", "dev", "--out", "board.svg"],
      ["shelf"],
      ["init", "--template", "kitchen"],
      ["doctor"],
      ["user-guide"],
      ["envelope", "decompose-epic", "--tier", "leaf"],
      ["audit", "decompose-epic", "--tier", "leaf", "--window", "1"],
    ] as const;

    for (const invocation of verbInvocations) {
      for (const flag of ["--help", "-h"] as const) {
        for (let index = 0; index <= invocation.length; index++) {
          const argv = [...invocation.slice(0, index), flag, ...invocation.slice(index)];
          expect(parseArgs(argv)).toEqual({ cmd: "help" });
        }
      }
    }
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
    expect(parseArgs(["frobnicate"])).toEqual({
      cmd: "usage",
      error: "unknown command: frobnicate",
    });
    expect(parseArgs(["steeer"])).toEqual({
      cmd: "usage",
      error: "unknown command: steeer — did you mean steer?",
    });
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
  test("run decompose-epic <epic> --resume accepts the doctor's exact zero-dispense command", () => {
    expect(parseArgs(["run", "decompose-epic", "E-077", "--resume"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "E-077",
      resume: true,
    });
  });
  test("run decompose-epic accepts an explicit markdown path on resume", () => {
    expect(parseArgs(["run", "decompose-epic", "docs/active/epic/E-077.md", "--resume"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "docs/active/epic/E-077.md",
      resume: true,
    });
  });
  test("run --resume refuses cold-only funding, gate bypass, and effect-input flags", () => {
    for (const tail of [
      ["--budget", "1,2"],
      ["--no-gates"],
      ["--intervened"],
      ["--no-intervened"],
      ["--after", "T-001-01"],
      ["--agent", "codex"],
    ]) {
      expect(parseArgs(["run", "decompose-epic", "E-077", "--resume", ...tail]).cmd).toBe("usage");
    }
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
  test("chain --agent carries the Lisa routing seat", () => {
    expect(parseArgs(["chain", "sig", "--agent", "codex"])).toEqual({
      cmd: "chain",
      signal: "sig",
      agent: "codex",
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

  // Field fix #3: born-blocked mint — `--after <ticket>`.
  test("chain <signal> --after carries a single born-blocked target", () => {
    expect(parseArgs(["chain", "sig", "--after", "T-011-03-02"])).toEqual({
      cmd: "chain",
      signal: "sig",
      after: ["T-011-03-02"],
    });
  });
  test("chain --after accepts comma-separated AND repeated targets, de-duplicated in order", () => {
    expect(parseArgs(["chain", "sig", "--after", "T-011-03-02,T-012-01-01", "--after", "T-011-03-02"])).toEqual({
      cmd: "chain",
      signal: "sig",
      after: ["T-011-03-02", "T-012-01-01"],
    });
  });
  test("chain --after coexists with --budget (order-independent)", () => {
    expect(parseArgs(["chain", "sig", "--after", "T-1", "--budget", "100,200"])).toEqual({
      cmd: "chain",
      signal: "sig",
      budget: { timeMs: 100, tokens: 200 },
      after: ["T-1"],
    });
  });
  test("chain --after with no value → usage", () => {
    expect(parseArgs(["chain", "sig", "--after"])).toEqual({ cmd: "usage", error: "missing --after <ticket>" });
    expect(parseArgs(["chain", "sig", "--after", "--budget", "1,2"])).toEqual({ cmd: "usage", error: "missing --after <ticket>" });
  });
  test("run decompose-epic … --after carries born-blocked targets alongside --budget", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--after", "T-011-03-02"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
      after: ["T-011-03-02"],
    });
  });
  test("run decompose-epic --agent carries the Lisa routing seat alongside --budget", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--agent", "codex"])).toEqual({
      cmd: "run",
      play: "decompose-epic",
      epicPath: "e.md",
      budget: { timeMs: 1, tokens: 2 },
      agent: "codex",
    });
  });
  test("dangling --agent is a usage error on both board-writing gestures", () => {
    expect(parseArgs(["chain", "sig", "--agent"])).toEqual({ cmd: "usage", error: "missing --agent <seat>" });
    expect(parseArgs(["chain", "sig", "--agent", "--budget", "1,2"])).toEqual({
      cmd: "usage",
      error: "missing --agent <seat>",
    });
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--agent"])).toEqual({
      cmd: "usage",
      error: "missing --agent <seat>",
    });
  });
  test("usage advertises --agent on run and chain", () => {
    const lines = USAGE.split("\n");
    expect(lines.find((line) => line.includes("vend run <play>"))).toContain("[--agent <seat>]");
    expect(lines.find((line) => line.includes("vend chain <signal>"))).toContain("[--agent <seat>]");
  });
  test("run --after with no value → usage", () => {
    expect(parseArgs(["run", "decompose-epic", "e.md", "--budget", "1,2", "--after"])).toEqual({
      cmd: "usage",
      error: "missing --after <ticket>",
    });
  });
  test("splitAfter: comma-split, trimmed, blanks dropped", () => {
    expect(splitAfter("T-1, T-2 ,,T-3")).toEqual(["T-1", "T-2", "T-3"]);
    expect(splitAfter("T-1")).toEqual(["T-1"]);
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

  // `vend work` RETIRED: the fund-once-walk-away macro-drain was incompatible with the real driving
  // loop (steer → chain → lisa builds → sweep) — it auto-drained the staged board (overproduction),
  // its freshness gate refused inside an active loop, and it automated the cheap clearing half, not
  // the expensive build half (honey-kitchen field feedback). `work` is now an unknown command.
  test("work is retired — parses as an unknown command, not a gesture", () => {
    expect(parseArgs(["work"])).toEqual({ cmd: "usage", error: "unknown command: work" });
    expect(parseArgs(["work", "--budget", "1,2"]).cmd).toBe("usage");
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

describe("parseArgs — shelf (T-030-02 supply view)", () => {
  test("bare `shelf` parses to the read-only shelf command", () => {
    expect(parseArgs(["shelf"])).toEqual({ cmd: "shelf" });
  });
  test("shelf takes no arguments — a positional or a flag is usage", () => {
    expect(parseArgs(["shelf", "survey"]).cmd).toBe("usage");
    expect(parseArgs(["shelf", "--budget", "1,2"]).cmd).toBe("usage");
    expect(parseArgs(["shelf", "--all"]).cmd).toBe("usage");
  });
});

describe("parseArgs — svg (T-055-03 file-output seam)", () => {
  test("bare `svg` parses with the default designer seat", () => {
    expect(parseArgs(["svg"])).toEqual({ cmd: "svg", seat: "designer" });
  });
  test("--seat selects the projecting preset", () => {
    expect(parseArgs(["svg", "--seat", "dev"])).toEqual({ cmd: "svg", seat: "dev" });
    expect(parseArgs(["svg", "--seat", "designer"])).toEqual({ cmd: "svg", seat: "designer" });
  });
  test("--out overrides the output path", () => {
    expect(parseArgs(["svg", "--out", "out/board.svg"])).toEqual({
      cmd: "svg",
      seat: "designer",
      out: "out/board.svg",
    });
  });
  test("--seat and --out compose", () => {
    expect(parseArgs(["svg", "--seat", "dev", "--out", "x.svg"])).toEqual({
      cmd: "svg",
      seat: "dev",
      out: "x.svg",
    });
  });
  test("an unknown seat is a usage error naming the allowed seats", () => {
    const r = parseArgs(["svg", "--seat", "founder"]);
    expect(r.cmd).toBe("usage");
    if (r.cmd === "usage") expect(r.error).toContain("designer | dev");
  });
  test("--out with no value is usage", () => {
    expect(parseArgs(["svg", "--out"]).cmd).toBe("usage");
    expect(parseArgs(["svg", "--out", "--seat"]).cmd).toBe("usage");
  });
  test("an unexpected positional is usage", () => {
    expect(parseArgs(["svg", "frobnicate"])).toEqual({
      cmd: "usage",
      error: "unexpected svg argument: frobnicate",
    });
  });
});

describe("formatSvgWriteLine", () => {
  test("uses singular group, card, and link labels at count 1", () => {
    expect(formatSvgWriteLine("board.svg", 1, 1, 1)).toBe(
      "wrote board.svg — 1 group, 1 card, 1 link\n",
    );
  });

  test("uses plural group, card, and link labels when counts are greater than 1", () => {
    expect(formatSvgWriteLine("board.svg", 2, 3, 4)).toBe(
      "wrote board.svg — 2 groups, 3 cards, 4 links\n",
    );
  });
});

describe("parseArgs — annotate (T-057-03 annotation→demand round-trip)", () => {
  test("annotate <node-id> \"<feedback>\" --seat designer parses node id, feedback, and seat", () => {
    expect(parseArgs(["annotate", "T-055-01", "this is rough", "--seat", "designer"])).toEqual({
      cmd: "annotate",
      nodeId: "T-055-01",
      feedback: "this is rough",
      seat: "designer",
    });
  });
  test("--seat omitted defaults to the designer seat", () => {
    expect(parseArgs(["annotate", "T-055-01", "this is rough"])).toEqual({
      cmd: "annotate",
      nodeId: "T-055-01",
      feedback: "this is rough",
      seat: "designer",
    });
  });
  test("--seat dev selects the dev seat", () => {
    expect(parseArgs(["annotate", "E-057", "needs an edge", "--seat", "dev"])).toEqual({
      cmd: "annotate",
      nodeId: "E-057",
      feedback: "needs an edge",
      seat: "dev",
    });
  });
  test("peels the node-id and joins multi-token and single-token feedback to the same string", () => {
    const multi = parseArgs(["annotate", "T-055-01", "this", "feels", "rough"]);
    const single = parseArgs(["annotate", "T-055-01", "this feels rough"]);
    expect(multi).toEqual({ cmd: "annotate", nodeId: "T-055-01", feedback: "this feels rough", seat: "designer" });
    expect(single).toEqual({ cmd: "annotate", nodeId: "T-055-01", feedback: "this feels rough", seat: "designer" });
  });
  test("annotate with no node-id → usage", () => {
    expect(parseArgs(["annotate"])).toEqual({ cmd: "usage", error: "missing <node-id>" });
    expect(parseArgs(["annotate", "--seat", "dev"])).toEqual({ cmd: "usage", error: "missing <node-id>" });
  });
  test("annotate with a node-id but no feedback → usage", () => {
    expect(parseArgs(["annotate", "T-055-01"])).toEqual({ cmd: "usage", error: "missing <feedback>" });
    expect(parseArgs(["annotate", "T-055-01", "--seat", "dev"])).toEqual({ cmd: "usage", error: "missing <feedback>" });
  });
  test("an unknown seat is a usage error naming the allowed seats", () => {
    const r = parseArgs(["annotate", "T-055-01", "rough", "--seat", "founder"]);
    expect(r.cmd).toBe("usage");
    if (r.cmd === "usage") expect(r.error).toContain("designer | dev");
  });
  test("USAGE lists the annotate line", () => {
    expect(USAGE).toContain("vend annotate");
  });
});

describe("parseArgs — init (T-040-03 scaffold command)", () => {
  test("bare `init` parses to the no-arg init command", () => {
    expect(parseArgs(["init"])).toEqual({ cmd: "init" });
  });
  test("init takes no arguments — an unexpected positional is usage", () => {
    expect(parseArgs(["init", "junk"])).toEqual({ cmd: "usage", error: "unexpected init argument: junk" });
  });
  test("init takes no flags — an unknown flag is usage", () => {
    expect(parseArgs(["init", "--force"]).cmd).toBe("usage");
    expect(parseArgs(["init", "--budget", "1,2"]).cmd).toBe("usage");
  });
  test("USAGE lists the init line", () => {
    expect(USAGE).toContain("vend init");
  });
  // T-058-01: the optional `--template <name>` overlay flag (validated at dispatch, not here).
  test("`init --template hackathon` parses the template name", () => {
    expect(parseArgs(["init", "--template", "hackathon"])).toEqual({ cmd: "init", template: "hackathon" });
  });
  test("a missing --template value is a clean usage error", () => {
    expect(parseArgs(["init", "--template"])).toEqual({ cmd: "usage", error: "missing --template <name>" });
    expect(parseArgs(["init", "--template", "--force"])).toEqual({
      cmd: "usage",
      error: "missing --template <name>",
    });
  });
  test("USAGE advertises --template", () => {
    expect(USAGE).toContain("vend init [--template <name>]");
  });
});

describe("parseArgs — doctor (T-042-03 preflight command)", () => {
  test("bare `doctor` parses to the no-arg doctor command", () => {
    expect(parseArgs(["doctor"])).toEqual({ cmd: "doctor" });
  });
  test("doctor takes no arguments — an unexpected positional is usage", () => {
    expect(parseArgs(["doctor", "junk"])).toEqual({ cmd: "usage", error: "unexpected doctor argument: junk" });
  });
  test("doctor takes no flags — an unknown flag is usage", () => {
    expect(parseArgs(["doctor", "--json"]).cmd).toBe("usage");
    expect(parseArgs(["doctor", "--budget", "1,2"]).cmd).toBe("usage");
  });
  test("USAGE lists the doctor line", () => {
    expect(USAGE).toContain("vend doctor");
  });
});

describe("parseArgs — user-guide (T-066 fresh-repo orientation)", () => {
  test("all three spellings parse to the same no-arg command", () => {
    expect(parseArgs(["user-guide"])).toEqual({ cmd: "user-guide" });
    expect(parseArgs(["guide"])).toEqual({ cmd: "user-guide" });
    expect(parseArgs(["setup-guide"])).toEqual({ cmd: "user-guide" }); // the `lisa setup-guide` reflex
  });
  test("takes no arguments — a trailing token is usage, naming the spelling used", () => {
    expect(parseArgs(["user-guide", "junk"])).toEqual({ cmd: "usage", error: "unexpected user-guide argument: junk" });
    expect(parseArgs(["setup-guide", "x"])).toEqual({ cmd: "usage", error: "unexpected setup-guide argument: x" });
  });
  test("USAGE lists the guide line and a discovery hint", () => {
    expect(USAGE).toContain("vend user-guide");
    expect(USAGE).toContain("new here?");
  });
});

describe("help command and grouped usage (T-072-01-01)", () => {
  test("every real command appears in exactly its free or metered group", () => {
    const freeCommands = [
      "vend help | vend --help",
      "vend shelf",
      "vend doctor",
      "vend user-guide",
      "vend --version",
      "vend envelope",
      "vend audit",
      "vend svg",
      "vend init",
      "vend run decompose-epic <epic> --resume",
    ] as const;
    const meteredCommands = [
      "vend run <play>",
      "vend chain",
      "vend expand",
      "vend annotate",
      "vend survey",
      "vend steer",
      "vend <selection>",
    ] as const;

    const freeHeading = "free (no tokens):";
    const meteredHeading = "metered (uses tokens):";
    const freeStart = USAGE.indexOf(freeHeading);
    const meteredStart = USAGE.indexOf(meteredHeading);
    const hintStart = USAGE.indexOf("\n\nnew here?");
    expect(freeStart).toBeGreaterThan(-1);
    expect(meteredStart).toBeGreaterThan(freeStart);
    expect(hintStart).toBeGreaterThan(meteredStart);

    const freeSection = USAGE.slice(freeStart, meteredStart);
    const meteredSection = USAGE.slice(meteredStart, hintStart);
    for (const command of freeCommands) {
      expect(freeSection).toContain(command);
      expect(meteredSection).not.toContain(command);
    }
    for (const command of meteredCommands) {
      expect(meteredSection).toContain(command);
      expect(freeSection).not.toContain(command);
    }

    const completeInventory = [...freeCommands, ...meteredCommands];
    expect(new Set(completeInventory).size).toBe(completeInventory.length);
    expect(completeInventory).toHaveLength(17);
  });

  test("USAGE presents the exact resume gesture as free while cold run remains metered", () => {
    const freeSection = USAGE.slice(USAGE.indexOf("free (no tokens):"), USAGE.indexOf("metered (uses tokens):"));
    const meteredSection = USAGE.slice(USAGE.indexOf("metered (uses tokens):"));
    expect(freeSection).toContain("vend run decompose-epic <epic> --resume");
    expect(meteredSection).toContain("vend run <play> <epic.md> --budget");
  });

  test("both help spellings print the grouped banner to stdout and exit 0", async () => {
    for (const spelling of ["--help", "help"] as const) {
      const proc = Bun.spawn([process.execPath, "src/cli.ts", spelling], {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(exitCode).toBe(0);
      expect(stdout).toBe(`${USAGE}\n`);
      expect(stderr).toBe("");
    }
  });

  test("vend chain --help prints USAGE without invoking an executor or writing a run record", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-cli-help-free-"));
    const cliPath = join(process.cwd(), "src", "cli.ts");
    const sentinelPath = join(root, "executor-sentinel.sh");
    const markerPath = join(root, "executor-invoked");
    const runLogPath = join(root, ".vend", "runs.jsonl");
    try {
      await writeFile(
        sentinelPath,
        '#!/bin/sh\nprintf invoked > "$VEND_EXECUTOR_MARKER"\nexit 99\n',
        "utf8",
      );
      await chmod(sentinelPath, 0o755);

      const proc = Bun.spawn([process.execPath, cliPath, "chain", "--help"], {
        cwd: root,
        env: {
          ...process.env,
          CLAUDE_CLI: sentinelPath,
          VEND_EXECUTOR: "claude",
          VEND_EXECUTOR_MARKER: markerPath,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect({ stdout, stderr, exitCode }).toEqual({
        stdout: `${USAGE}\n`,
        stderr: "",
        exitCode: 0,
      });
      expect(await Bun.file(markerPath).exists()).toBe(false);
      expect(await Bun.file(runLogPath).exists()).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("unknown-verb suggestions (T-072-01-02)", () => {
  test("unknown verbs print one targeted line without the usage wall", async () => {
    const cases = [
      ["frobnicate", "unknown command: frobnicate\n"],
      ["steeer", "unknown command: steeer — did you mean steer?\n"],
    ] as const;

    for (const [token, expectedError] of cases) {
      const proc = Bun.spawn([process.execPath, "src/cli.ts", token], {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(exitCode).toBe(2);
      expect(stdout).toBe("");
      expect(stderr).toBe(expectedError);
    }
  });
});

describe("funding echo (T-072-03-02)", () => {
  async function invokeWithBudget(budget: string) {
    const proc = Bun.spawn(
      [process.execPath, "src/cli.ts", "run", "missing-play", "ignored.md", "--budget", budget],
      {
        cwd: process.cwd(),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { stdout, stderr, exitCode };
  }

  test("echoes one canonical humane line before dispatch for humane and raw input", async () => {
    const humane = await invokeWithBudget("40m,350k");
    const raw = await invokeWithBudget("2400000,350000");

    expect(humane).toEqual({
      stdout: "funding ~40m/350k\n",
      stderr: 'play "missing-play" is not registered — available: decompose-epic\n',
      exitCode: 2,
    });
    expect(raw).toEqual({ ...humane, stdout: humane.stdout });
  });

  test("the exact resume command emits no funding line and treats a stale draft hint as data", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-cli-resume-"));
    try {
      await Promise.all([
        mkdir(join(root, "docs", "active", "epic"), { recursive: true }),
        mkdir(join(root, "docs", "knowledge"), { recursive: true }),
      ]);
      await Promise.all([
        writeFile(join(root, "docs", "active", "epic", "E-077.md"), "---\nid: E-077\n---\n", "utf8"),
        writeFile(join(root, "docs", "knowledge", "charter.md"), "# Fixture charter\n", "utf8"),
      ]);
      const proc = Bun.spawn(
        [process.execPath, join(process.cwd(), "src", "cli.ts"), "run", "decompose-epic", "E-077", "--resume"],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect({ stdout, stderr, exitCode }).toEqual({
        stdout: "",
        stderr: "no active decompose draft for E-077\n",
        exitCode: 1,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
