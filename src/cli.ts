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
import type { ValueTier } from "./shelf/menu.ts";

/** Usage banner, printed on any parse error. */
export const USAGE =
  "usage: vend run <play> <epic.md> --budget <ms>,<tokens>\n" +
  "       vend chain <signal> [--budget <ms>,<tokens>]\n" +
  "       vend envelope <play> [--tier <keystone|high|standard|leaf>]";

/** The four leverage tiers (mirrors {@link ValueTier} in shelf/menu.ts), as a value tuple
 *  so `parseEnvelopeArgs` can membership-check a `--tier` word without importing the
 *  shelf at parse time. cli already owns local routing constants (cf. `SELECTION_SHAPE`). */
const VALUE_TIERS = ["keystone", "high", "standard", "leaf"] as const;

/** A successfully parsed command, or a usage request carrying the reason. */
export type ParsedCommand =
  | { readonly cmd: "run"; readonly play: string; readonly epicPath: string; readonly budget: Budget }
  | { readonly cmd: "chain"; readonly signal: string; readonly budget?: Budget }
  | { readonly cmd: "browse"; readonly all: boolean }
  | { readonly cmd: "select"; readonly selection: string; readonly all: boolean; readonly budget?: Budget }
  | { readonly cmd: "envelope"; readonly play: string; readonly tier: ValueTier }
  | { readonly cmd: "usage"; readonly error?: string };

/** A selection token's shape: digits, commas, ranges, whitespace — nothing else. The
 *  cheap gate that routes `1,2,4-6` to `select` while leaving `frobnicate` an unknown
 *  command. Full validation (range/order/malformed) is `parseSelection`'s, downstream
 *  against the persisted menu's length — this only decides "is this a selection at all". */
const SELECTION_SHAPE = /^[\d\s,-]+$/;

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
 * exits. Recognizes `run <play> <epic.md> --budget <v>` (the play name is captured
 * generically — it is validated against the registry at DISPATCH, not here, so this parser
 * never imports a play / the BAML addon); anything else resolves to a `usage` result with an
 * error string for the shell to print.
 */
export function parseArgs(argv: readonly string[]): ParsedCommand {
  // Bare `vend` (no args) is the browse surface (T-003-02). `vend run …` is the static
  // decompose path (T-002-03). Everything else — `vend --all`, `vend 1,2`,
  // `vend 1 --budget …` — is the browse/press tail (T-003-04).
  if (argv.length === 0) return { cmd: "browse", all: false };
  if (argv[0] === "run") return parseRunArgs(argv);
  if (argv[0] === "chain") return parseChainArgs(argv);
  if (argv[0] === "envelope") return parseEnvelopeArgs(argv);
  return parseSelectOrBrowse(argv);
}

/**
 * Parse the read-only `envelope <play> [--tier <t>]` path — the Ledger readout that shows
 * a play's measured envelope proposed from its history (T-013-02, IA-12/13). PURE. The
 * play name is taken verbatim (any non-flag token); `--tier` is OPTIONAL, defaulting to
 * `standard` (p90 — the neutral middle), and is validated against the four leverage tiers
 * (an unknown tier is a usage error). This command never dispatches a cast — it only
 * displays — so it takes no `--budget`.
 */
function parseEnvelopeArgs(argv: readonly string[]): ParsedCommand {
  const play = argv[1];
  if (!play || play.startsWith("--")) return { cmd: "usage", error: "missing <play>" };

  let tier: ValueTier = "standard";
  const flagIdx = argv.indexOf("--tier", 2);
  if (flagIdx >= 0) {
    const word = argv[flagIdx + 1];
    const match = VALUE_TIERS.find((t) => t === word);
    if (!match) return { cmd: "usage", error: `--tier must be one of ${VALUE_TIERS.join(" | ")}, got ${JSON.stringify(word)}` };
    tier = match;
  }
  return { cmd: "envelope", play, tier };
}

/**
 * Parse the `chain <signal> [--budget <v>]` path — the propose→decompose capstone gesture
 * (T-011-02). PURE. The signal is every non-flag token after `chain`, joined with a space (so an
 * unquoted multi-word signal and a quoted single-token one both round-trip); `--budget` is OPTIONAL
 * (the chain defaults to each play's warranted envelope). PE-1: exactly one pulled signal, never a
 * board selection — that is why `chain` is its own command, not a `select` shape.
 */
function parseChainArgs(argv: readonly string[]): ParsedCommand {
  const positional: string[] = [];
  let budgetVal: string | undefined;
  let sawBudgetFlag = false;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--budget") {
      sawBudgetFlag = true;
      budgetVal = argv[++i];
    } else {
      positional.push(a);
    }
  }

  if (positional.length === 0) return { cmd: "usage", error: "missing <signal>" };

  let budget: Budget | undefined;
  if (budgetVal !== undefined) {
    try {
      budget = parseBudgetArg(budgetVal);
    } catch (e) {
      return { cmd: "usage", error: e instanceof Error ? e.message : String(e) };
    }
  } else if (sawBudgetFlag) {
    return { cmd: "usage", error: "missing --budget <ms>,<tokens>" };
  }

  const signal = positional.join(" ");
  return budget ? { cmd: "chain", signal, budget } : { cmd: "chain", signal };
}

/** Parse the `run <play> <epic.md> --budget <v>` static path. PURE. The play name is taken
 *  verbatim (any non-flag token); an UNKNOWN name is not a parse error — it parses to a
 *  `run` command and is rejected at dispatch by the registry (`PlayNotFoundError`), so the
 *  parser stays addon-free. */
function parseRunArgs(argv: readonly string[]): ParsedCommand {
  const play = argv[1];
  if (!play || play.startsWith("--")) return { cmd: "usage", error: "missing <play>" };
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
  return { cmd: "run", play, epicPath, budget };
}

/**
 * Parse the non-`run` tail: `--all` (a flag) plus optional `--budget <v>`, with any
 * remaining tokens forming the selection. PURE. No positional tokens ⇒ `browse` (bare
 * `--all` reveals hidden rows). Positional tokens that are all selection-shaped ⇒
 * `select` (joined with `,` so both `1,2,4-6` and the shell-split `1 2 4-6` round-trip
 * through `parseSelection`); a non-selection token ⇒ `usage` (`unknown command`).
 * `--budget` is OPTIONAL here (the press defaults to the action's warranted envelope),
 * unlike the required `run --budget`.
 */
function parseSelectOrBrowse(argv: readonly string[]): ParsedCommand {
  let all = false;
  let budgetVal: string | undefined;
  let sawBudgetFlag = false;
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--all") {
      all = true;
    } else if (a === "--budget") {
      sawBudgetFlag = true;
      budgetVal = argv[++i];
    } else {
      positional.push(a);
    }
  }

  let budget: Budget | undefined;
  if (budgetVal !== undefined) {
    try {
      budget = parseBudgetArg(budgetVal);
    } catch (e) {
      return { cmd: "usage", error: e instanceof Error ? e.message : String(e) };
    }
  } else if (sawBudgetFlag) {
    return { cmd: "usage", error: "missing --budget <ms>,<tokens>" };
  }

  if (positional.length === 0) {
    return all ? { cmd: "browse", all: true } : { cmd: "usage", error: "missing selection" };
  }
  if (!positional.every((t) => SELECTION_SHAPE.test(t))) {
    return { cmd: "usage", error: `unknown command: ${positional[0]}` };
  }
  const selection = positional.join(",");
  return budget ? { cmd: "select", selection, all, budget } : { cmd: "select", selection, all };
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
  if (parsed.cmd === "select") {
    // The press: resolve the selection against the persisted `.vend/menu.json` and
    // dispatch each pick's playbook in order. Lazy import keeps the runner (and its BAML
    // addon) off the pure-parse path, exactly as the browse arm keeps gather lazy.
    const { pressShelf } = await import("./shelf/press.ts");
    const result = await pressShelf({ selection: parsed.selection, all: parsed.all, budget: parsed.budget });
    switch (result.kind) {
      case "no-menu":
        process.stderr.write(`no menu at ${result.cachePath} — run \`vend\` first\n`);
        process.exit(1);
        break;
      case "stale":
        process.stderr.write(
          `menu is stale (board changed since \`vend\`) — re-run \`vend${parsed.all ? " --all" : ""}\`\n`,
        );
        process.exit(1);
        break;
      case "bad-selection":
        process.stderr.write(`${result.error.message}\n`);
        process.exit(2);
        break;
      case "dispatched": {
        for (const s of result.runs) {
          process.stdout.write(`run ${s.runId}: ${s.outcome} (materialized: ${s.materialized})\n`);
        }
        process.exit(result.runs.every((s) => s.outcome === "success") ? 0 : 1);
      }
    }
  }
  if (parsed.cmd === "chain") {
    // The capstone gesture (T-011-02): cast the propose→decompose chain on ONE pulled signal
    // (PE-1). On success it materializes BOTH the epic card AND its stories/tickets, each gated and
    // logged (two run-log records). A ProposeEpic gate STOP halts BEFORE DecomposeEpic — surfaced
    // as `halted`. Lazy import keeps the chain (and its BAML addon) off the pure-parse path.
    const { castProposeDecomposeChain } = await import("./play/chain-propose-decompose.ts");
    const result = await castProposeDecomposeChain({ signal: parsed.signal, budget: parsed.budget });
    for (const s of result.steps) {
      process.stdout.write(`run ${s.runId}: ${s.outcome} (materialized: ${s.materialized})\n`);
    }
    if (result.halted) process.stderr.write(`chain halted: ${result.haltReason}\n`);
    process.exit(result.outcome === "success" && !result.halted ? 0 : 1);
  }

  if (parsed.cmd === "envelope") {
    // The Ledger readout (T-013-02): load the ledger, recalibrate this play at the tier
    // percentile over its successful history, and PRINT the proposed envelope + an honest
    // confidence label. Read-only — it DISPLAYS the measured default, it does not actuate
    // it into a dispatch (IA-14 — auto-widen/slow-tighten — is a later rung), so it always
    // exits 0. Lazy imports keep the ledger/shelf deps off the pure-parse path.
    const { loadRunLog } = await import("./log/run-log.ts");
    const { recalibrate, formatEnvelopeLabel } = await import("./ledger/recalibrate.ts");
    const { budgetForTier } = await import("./shelf/gather.ts");
    const { records } = await loadRunLog();
    const result = recalibrate(parsed.play, records, parsed.tier, budgetForTier(parsed.tier));
    const { timeMs, tokens } = result.envelope;
    process.stdout.write(`${parsed.play} [${parsed.tier}]: ${tokens} tokens / ${timeMs} ms — ${formatEnvelopeLabel(result)}\n`);
    process.exit(0);
  }

  // The run path: look the play up BY NAME in the registry and cast it (no hardcoded
  // decompose-epic branch). Lazy import keeps the dispatcher (and its BAML addon) off the
  // pure-parse path, exactly as the browse/press arms keep their deps lazy. An unknown play
  // is the registry's typed andon → stderr + exit 2.
  const { runPlay } = await import("./play/dispatch.ts");
  const res = await runPlay(parsed.play, { epicPath: parsed.epicPath, budget: parsed.budget });
  if (res.kind === "no-play") {
    process.stderr.write(`${res.error.message}\n`);
    process.exit(2);
  }
  const summary = res.summary;
  process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
  process.exit(summary.outcome === "success" ? 0 : 1);
}
