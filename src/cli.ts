// The `vend` CLI entry point (T-002-03) — the two-gesture transaction at its
// smallest honest size: pick the play + give it a budget + go. For this slice the
// single hardcoded play is `decompose-epic`:
//
//   vend run decompose-epic <epic.md> --budget <ms>,<tokens>
//
// PURITY (house pattern): arg parsing is PURE and tested (`parseBudgetArg`,
// `parseArgs`); the `import.meta.main` dispatch that calls the impure runner and
// exits the process is the thin untested shell. The richer TUI is a later epic
// (E-003) — this is just enough surface to dispense one real run from a shell/CI.

import type { Budget } from "./budget/budget.ts";

/** Usage banner, printed on any parse error. */
export const USAGE = "usage: vend run decompose-epic <epic.md> --budget <ms>,<tokens>";

/** A successfully parsed command, or a usage request carrying the reason. */
export type ParsedCommand =
  | { readonly cmd: "run"; readonly play: "decompose-epic"; readonly epicPath: string; readonly budget: Budget }
  | { readonly cmd: "browse"; readonly all: boolean }
  | { readonly cmd: "usage"; readonly error?: string };

/**
 * Parse the `--budget <ms>,<tokens>` value into a {@link Budget}. PURE. Requires
 * exactly two comma-separated integer fields; a wrong arity or a non-integer is a
 * `RangeError` surfaced at the boundary. The positive-int CONTRACT is enforced
 * downstream by budget's own `assertPositiveInt` when the run starts — this parser
 * only guarantees the shape (two integers).
 */
export function parseBudgetArg(s: string): Budget {
  const parts = s.split(",");
  if (parts.length !== 2) {
    throw new RangeError(`--budget must be "<ms>,<tokens>", got ${JSON.stringify(s)}`);
  }
  const [msStr, tokStr] = parts as [string, string];
  // Reject blank fields up front: Number("") coerces to 0 (an integer), which would
  // let "1000," slip past the integer guard as a malformed budget.
  if (msStr.trim() === "" || tokStr.trim() === "") {
    throw new RangeError(`--budget fields must be integers, got ${JSON.stringify(s)}`);
  }
  const timeMs = Number(msStr.trim());
  const tokens = Number(tokStr.trim());
  if (!Number.isInteger(timeMs) || !Number.isInteger(tokens)) {
    throw new RangeError(`--budget fields must be integers, got ${JSON.stringify(s)}`);
  }
  return { timeMs, tokens };
}

/**
 * Parse argv (without the `bun`/script head) into a command. PURE — never reads fs or
 * exits. Recognizes ONLY `run decompose-epic <epic.md> --budget <v>`; anything else
 * resolves to a `usage` result with an error string for the shell to print.
 */
export function parseArgs(argv: readonly string[]): ParsedCommand {
  // Bare `vend` (no args) is the browse surface (T-003-02); `vend --all` reveals the
  // hidden blocked/leaf rows. A selection like `1,2` is dispatch (T-003-04) — it falls
  // through to the existing usage path here until that ticket extends this parser.
  if (argv.length === 0) return { cmd: "browse", all: false };
  if (argv.every((a) => a === "--all")) return { cmd: "browse", all: true };
  if (argv[0] !== "run") return { cmd: "usage", error: argv.length ? `unknown command: ${argv[0]}` : undefined };
  if (argv[1] !== "decompose-epic") return { cmd: "usage", error: `unknown play: ${argv[1] ?? "(none)"}` };
  const epicPath = argv[2];
  if (!epicPath || epicPath.startsWith("--")) return { cmd: "usage", error: "missing <epic.md>" };

  const flagIdx = argv.indexOf("--budget", 3);
  const budgetVal = flagIdx >= 0 ? argv[flagIdx + 1] : undefined;
  if (!budgetVal) return { cmd: "usage", error: "missing --budget <ms>,<tokens>" };

  let budget: Budget;
  try {
    budget = parseBudgetArg(budgetVal);
  } catch (e) {
    return { cmd: "usage", error: e instanceof Error ? e.message : String(e) };
  }
  return { cmd: "run", play: "decompose-epic", epicPath, budget };
}

// The impure dispatch shell — only runs when executed directly (not when imported by
// the test for its pure parsers). Maps a non-`success` outcome to a non-zero exit so
// a shell/CI sees the andon; a usage error exits 2.
if (import.meta.main) {
  const parsed = parseArgs(Bun.argv.slice(2));
  if (parsed.cmd === "usage") {
    if (parsed.error) process.stderr.write(`${parsed.error}\n`);
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }
  if (parsed.cmd === "browse") {
    // Bare `vend`: gather → rank → render → persist `.vend/menu.json` → print. Instant,
    // deterministic, no LLM. Lazy import keeps the browse deps off the pure-parse path.
    const { browseShelf } = await import("./shelf/gather.ts");
    const { menu } = await browseShelf({ all: parsed.all });
    process.stdout.write(`${menu}\n`);
    process.exit(0);
  }
  const { runDecomposeEpic } = await import("./play/decompose-epic.ts");
  const summary = await runDecomposeEpic({ epicPath: parsed.epicPath, budget: parsed.budget });
  process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
  process.exit(summary.outcome === "success" ? 0 : 1);
}
