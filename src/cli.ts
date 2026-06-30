#!/usr/bin/env bun
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
import type { Seat } from "./present/presets.ts";
// The build-embedded semver (T-061-02). A cheap, BAML-free value import — unlike the
// heavy dispatch deps it does NOT belong behind a lazy `await import`, so `vend
// --version` resolves without touching the executor graph.
import { VERSION } from "./version.ts";

/** Usage banner, printed on any parse error. */
export const USAGE =
  "usage: vend run <play> <epic.md> --budget <ms>,<tokens> [--no-gates] [--intervened|--no-intervened]\n" +
  "       vend chain <signal> [--budget <ms>,<tokens>]\n" +
  "       vend expand <fragment> [--budget <ms>,<tokens>]\n" +
  '       vend annotate <node-id> "<feedback>" [--seat <designer|dev>]\n' +
  "       vend survey [--budget <ms>,<tokens>]\n" +
  "       vend steer [--budget <ms>,<tokens>]\n" +
  "       vend work [--budget <ms>,<tokens>] [--board <path>] [--stale-ok]\n" +
  "       vend svg [--seat <designer|dev>] [--out <path>]\n" +
  "       vend shelf\n" +
  "       vend init [--template <name>]\n" +
  "       vend doctor\n" +
  "       vend --version\n" +
  "       vend envelope <play> [--tier <keystone|high|standard|leaf>] [--estimate <ms>,<tokens>] [--project <id>]\n" +
  "       vend audit [<play>] [--tier <keystone|high|standard|leaf>] [--window <n>]";

/** The four leverage tiers (mirrors {@link ValueTier} in shelf/menu.ts), as a value tuple
 *  so `parseEnvelopeArgs` can membership-check a `--tier` word without importing the
 *  shelf at parse time. cli already owns local routing constants (cf. `SELECTION_SHAPE`). */
const VALUE_TIERS = ["keystone", "high", "standard", "leaf"] as const;

/** The seats the SVG seam can project for (mirrors {@link Seat} in present/presets.ts), as a value
 *  tuple so `parseSvgArgs` can membership-check a `--seat` word without importing the present layer
 *  at parse time — the local-routing-constant idiom (cf. `VALUE_TIERS`). */
const SVG_SEATS = ["designer", "dev"] as const;

/** A successfully parsed command, or a usage request carrying the reason. */
export type ParsedCommand =
  | {
      readonly cmd: "run";
      readonly play: string;
      readonly epicPath: string;
      readonly budget: Budget;
      /** The E2 `--no-gates` run mode (T-014-02): skip the gate phase so the output
       *  materializes ungated. Spread only when the flag is present, so the gated default
       *  parses to the same object shape as before. */
      readonly skipGates?: boolean;
      /** The E1 trust self-report (T-014-01): `--intervened` ⇒ true (author stepped in),
       *  `--no-intervened` ⇒ false (let it clear), neither ⇒ absent (unknown). Spread only
       *  when supplied, so an unreported run keeps the same object shape. */
      readonly intervened?: boolean;
    }
  | { readonly cmd: "chain"; readonly signal: string; readonly budget?: Budget }
  | { readonly cmd: "expand"; readonly fragment: string; readonly budget?: Budget }
  | {
      readonly cmd: "annotate";
      /** The board work-item id the feedback was left on (`E-…`/`S-…`/`T-…`) — the back-link target
       *  the staged signal's provenance trailer references. */
      readonly nodeId: string;
      /** The non-dev's raw feedback text — cast as the expand fragment AND carried as the
       *  Annotation's `text` (they are the same string per the Annotation reuse contract). */
      readonly feedback: string;
      /** The seat that left the feedback. Validated against {@link SVG_SEATS} (the seats the
       *  work-graph renders for), so it is one of `designer`/`dev`; assignable to the wider
       *  `Annotation.seat: string` at dispatch. */
      readonly seat: Seat;
    }
  | { readonly cmd: "survey"; readonly budget?: Budget }
  | { readonly cmd: "steer"; readonly budget?: Budget }
  | {
      readonly cmd: "work";
      /** The macro-wallet allocation; absent ⇒ the dispatch defaults to the "two-hour" macro budget. */
      readonly budget?: Budget;
      /** An explicit staged-board path; absent ⇒ the steer→survey fallback at dispatch. */
      readonly board?: string;
      /** Spend even when the staged board is stale (IA-5 override, T-027-01); absent ⇒ the freshness
       *  gate refuses a board older than the project's live state. */
      readonly staleOk?: boolean;
      /** The E1 trust self-report for the walk-away session (T-026-02): `--intervened` ⇒ true,
       *  `--no-intervened` ⇒ false, neither ⇒ absent (unknown). Spread only when supplied, so a
       *  bare `work` keeps the same object shape. Forwarded to every chain cast in the sweep. */
      readonly intervened?: boolean;
    }
  | { readonly cmd: "svg"; readonly seat: Seat; readonly out?: string }
  | { readonly cmd: "shelf" }
  | { readonly cmd: "version" }
  | {
      readonly cmd: "init";
      /** Overlay a named template over the base scaffold (E-058, T-058-01); absent ⇒ bare base
       *  scaffold, byte-identical to E-040. The name is validated at DISPATCH against the registry
       *  (an unknown name → a clean refusal), never here — keeping the parser registry-free. */
      readonly template?: string;
    }
  | { readonly cmd: "doctor" }
  | { readonly cmd: "browse"; readonly all: boolean }
  | { readonly cmd: "select"; readonly selection: string; readonly all: boolean; readonly budget?: Budget }
  | {
      readonly cmd: "envelope";
      readonly play: string;
      readonly tier: ValueTier;
      readonly estimate?: Budget;
      readonly project?: string;
    }
  | {
      readonly cmd: "audit";
      /** Restrict the walk-away audit to one play; absent ⇒ every play (T-014-01). */
      readonly play?: string;
      readonly tier: ValueTier;
      readonly window?: number;
    }
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
  // `--version` is a global flag, not a sub-verb (T-061-02): intercept it BEFORE the
  // verb table and before `parseSelectOrBrowse` (which would otherwise reject it as
  // `unknown command: --version`). Short-circuits — any trailing tokens are ignored,
  // the conventional `--version` behavior.
  if (argv[0] === "--version") return { cmd: "version" };
  if (argv[0] === "run") return parseRunArgs(argv);
  if (argv[0] === "chain") return parseChainArgs(argv);
  if (argv[0] === "expand") return parseExpandArgs(argv);
  if (argv[0] === "annotate") return parseAnnotateArgs(argv);
  if (argv[0] === "survey") return parseSurveyArgs(argv);
  if (argv[0] === "steer") return parseSteerArgs(argv);
  if (argv[0] === "work") return parseWorkArgs(argv);
  if (argv[0] === "svg") return parseSvgArgs(argv);
  if (argv[0] === "shelf") return parseShelfArgs(argv);
  if (argv[0] === "init") return parseInitArgs(argv);
  if (argv[0] === "doctor") return parseDoctorArgs(argv);
  if (argv[0] === "envelope") return parseEnvelopeArgs(argv);
  if (argv[0] === "audit") return parseAuditArgs(argv);
  return parseSelectOrBrowse(argv);
}

/**
 * Parse the read-only `shelf` path — the SUPPLY view (T-030-02): list the authored playbooks
 * with their worth + warranted envelope (the shelf beside the demand board, DL-6). PURE. Like
 * `audit` it is a no-actuation READ, and UNLIKE every other verb it takes NO arguments AT ALL
 * — not even `--budget` (nothing is cast, so there is nothing to fund). Any token after `shelf`
 * is therefore an error. The board (`vend`) is untouched; this is its own verb.
 */
function parseShelfArgs(argv: readonly string[]): ParsedCommand {
  if (argv.length > 1) return { cmd: "usage", error: `unexpected shelf argument: ${argv[1]}` };
  return { cmd: "shelf" };
}

/**
 * Parse the `svg [--seat <designer|dev>] [--out <path>]` path — the file-output seam gesture
 * (T-055-03): render the live board to one static `.svg`. PURE. Flags-only (the `work` shape minus
 * `--budget`): `--seat` picks the projecting preset (default `designer`, the non-dev seat), validated
 * against the two seats; `--out` OPTIONALLY overrides the full output path (default ⇒ the seam's
 * `.vend/work-graph.svg`). Read-only over the board — nothing is cast — so there is no `--budget`. Any
 * positional token is an error (the subject is the whole board, implicit).
 */
function parseSvgArgs(argv: readonly string[]): ParsedCommand {
  let seat: Seat = "designer";
  let out: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--seat") {
      const word = argv[++i];
      const match = SVG_SEATS.find((s) => s === word);
      if (!match) return { cmd: "usage", error: `--seat must be one of ${SVG_SEATS.join(" | ")}, got ${JSON.stringify(word)}` };
      seat = match;
    } else if (a === "--out") {
      const word = argv[++i];
      if (!word || word.startsWith("--")) return { cmd: "usage", error: "missing --out <path>" };
      out = word;
    } else {
      return { cmd: "usage", error: `unexpected svg argument: ${a}` };
    }
  }
  return { cmd: "svg", seat, ...(out ? { out } : {}) };
}

/**
 * Parse the `init [--template <name>]` scaffold-the-cwd path (T-040-03; overlay T-058-01) — lay the
 * vend board/PM/archive/knowledge tree over a bare lisa project, no-clobber, optionally overlaying a
 * named template. PURE. The cwd is the implicit subject (no positional to type) and nothing is cast
 * (no `--budget`), so the ONE recognized token is the optional `--template <name>` flag (the
 * `parseSvgArgs` `--out` idiom: a missing or `--`-prefixed value is a clean usage error). The name is
 * NOT validated here — an unknown template is the dispatch arm's clean refusal against the registry
 * (keeping the parser registry-free, like a play name). Any other token is `unexpected init argument`.
 * Bare `vend init` parses to `{ cmd: "init" }` with NO `template` key — byte-identical to E-040.
 */
function parseInitArgs(argv: readonly string[]): ParsedCommand {
  let template: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--template") {
      const word = argv[++i];
      if (!word || word.startsWith("--")) return { cmd: "usage", error: "missing --template <name>" };
      template = word;
    } else {
      return { cmd: "usage", error: `unexpected init argument: ${a}` };
    }
  }
  return template ? { cmd: "init", template } : { cmd: "init" };
}

/**
 * Parse the read-only `doctor` preflight path (T-042-03) — probe the vend-specific deps (lisa &
 * claude on PATH, the BAML native addon loadable, the active executor's config present) and
 * report. PURE. Like `shelf`/`init`, doctor takes NO arguments AT ALL: there is no subject to type
 * (the host environment is the implicit, only target) and nothing is cast, so there is no
 * `--budget` to fund. Any token after `doctor` — a positional or a flag — is therefore an error.
 * The probe, render, print, and exit are the dispatch arm's composition over `probeDoctor`
 * (doctor-probe.ts) and `renderDoctorReport` (doctor-core.ts).
 */
function parseDoctorArgs(argv: readonly string[]): ParsedCommand {
  if (argv.length > 1) return { cmd: "usage", error: `unexpected doctor argument: ${argv[1]}` };
  return { cmd: "doctor" };
}

/**
 * Parse the read-only `envelope <play> [--tier <t>] [--estimate <ms>,<tokens>] [--project <id>]`
 * path — the Ledger readout that shows a play's measured envelope proposed from its history
 * (T-013-02, IA-12/13) and, bias-corrected against its {play, project} ratio history
 * (T-013-03, IA-16). PURE. The play name is taken verbatim (any non-flag token); `--tier` is
 * OPTIONAL, defaulting to `standard` (p90 — the neutral middle), validated against the four
 * leverage tiers. `--estimate` is the OPTIONAL raw envelope to bias-correct (absent ⇒ the
 * measured default feeds through, AC #4), parsed by {@link parseBudgetArg}; `--project` is the
 * OPTIONAL project to correct against (absent ⇒ the dispatch shell defaults to the cwd
 * basename). This command never dispatches a cast — it only displays — so it takes no
 * `--budget`.
 */
function parseEnvelopeArgs(argv: readonly string[]): ParsedCommand {
  const play = argv[1];
  if (!play || play.startsWith("--")) return { cmd: "usage", error: "missing <play>" };

  let tier: ValueTier = "standard";
  let estimate: Budget | undefined;
  let project: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--tier") {
      const word = argv[++i];
      const match = VALUE_TIERS.find((t) => t === word);
      if (!match) return { cmd: "usage", error: `--tier must be one of ${VALUE_TIERS.join(" | ")}, got ${JSON.stringify(word)}` };
      tier = match;
    } else if (a === "--estimate") {
      const word = argv[++i];
      if (word === undefined) return { cmd: "usage", error: "missing --estimate <ms>,<tokens>" };
      try {
        estimate = parseBudgetArg(word);
      } catch (e) {
        return { cmd: "usage", error: e instanceof Error ? e.message : String(e) };
      }
    } else if (a === "--project") {
      const word = argv[++i];
      if (!word || word.startsWith("--")) return { cmd: "usage", error: "missing --project <id>" };
      project = word;
    } else {
      return { cmd: "usage", error: `unknown envelope flag: ${a}` };
    }
  }
  return { cmd: "envelope", play, tier, ...(estimate ? { estimate } : {}), ...(project ? { project } : {}) };
}

/**
 * Parse the read-only `audit [<play>] [--tier <t>] [--window <n>]` path — the E1 walk-away
 * trust readout over `.vend/runs.jsonl` (T-014-01, PRD KR1–KR2): andon-rate vs the IA-12
 * budget, outcome mix, cost-vs-envelope, and the intervention rate/trend. PURE. The play name
 * is OPTIONAL (the first non-flag token; absent ⇒ every play), `--tier` defaults to `standard`
 * (the 10% andon budget — the neutral middle) and is validated against the four leverage tiers,
 * `--window` is the OPTIONAL recency cap (a positive integer). Read-only — it never dispatches a
 * cast, so it takes no `--budget`.
 */
function parseAuditArgs(argv: readonly string[]): ParsedCommand {
  let play: string | undefined;
  let tier: ValueTier = "standard";
  let window: number | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--tier") {
      const word = argv[++i];
      const match = VALUE_TIERS.find((t) => t === word);
      if (!match) return { cmd: "usage", error: `--tier must be one of ${VALUE_TIERS.join(" | ")}, got ${JSON.stringify(word)}` };
      tier = match;
    } else if (a === "--window") {
      const word = argv[++i];
      const n = Number(word);
      if (word === undefined || !Number.isInteger(n) || n <= 0) {
        return { cmd: "usage", error: `--window must be a positive integer, got ${JSON.stringify(word)}` };
      }
      window = n;
    } else if (a.startsWith("--")) {
      return { cmd: "usage", error: `unknown audit flag: ${a}` };
    } else if (play === undefined) {
      play = a;
    } else {
      return { cmd: "usage", error: `unexpected audit argument: ${a}` };
    }
  }
  return { cmd: "audit", tier, ...(play ? { play } : {}), ...(window !== undefined ? { window } : {}) };
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

/**
 * Parse the `expand <fragment> [--budget <v>]` path — the demand-extraction gesture (T-016-02). PURE.
 * A copy of {@link parseChainArgs}'s shape: the fragment is every non-flag token after `expand`,
 * joined with a space (so an unquoted multi-word fragment and a quoted single-token one both
 * round-trip); `--budget` is OPTIONAL (the gesture defaults to the play's warranted envelope). PE-1:
 * exactly one explicitly typed fragment, never a TODO-file drain — that is why `expand` is its own
 * command, like `chain`.
 */
function parseExpandArgs(argv: readonly string[]): ParsedCommand {
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

  if (positional.length === 0) return { cmd: "usage", error: "missing <fragment>" };

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

  const fragment = positional.join(" ");
  return budget ? { cmd: "expand", fragment, budget } : { cmd: "expand", fragment };
}

/**
 * Parse the `annotate <node-id> "<feedback>" [--seat <seat>]` path — the annotation→demand
 * round-trip gesture (T-057-03), the OUTBOUND mouth of E-057. PURE. A HYBRID of `parseExpandArgs`
 * and `parseSvgArgs`: the FIRST non-flag token is peeled as the `node-id`; the REST are joined with
 * a space into the `feedback` (so an unquoted multi-word note and a quoted single-token one both
 * round-trip, the `expand` join with the head removed). `--seat` is OPTIONAL — its block is the
 * `parseSvgArgs` idiom verbatim: default `designer` (the non-dev seat, the round-trip's
 * protagonist), validated against {@link SVG_SEATS} (the seats the work-graph renders for; a founder
 * has no preset, so no view to annotate). UNLIKE `expand` it carries NO `--budget` (the thin
 * gesture; the dispatch defaults to the play's warranted envelope). A missing node-id OR feedback is
 * a clean usage error, mirroring `parseExpandArgs`'s missing-subject refusal.
 */
function parseAnnotateArgs(argv: readonly string[]): ParsedCommand {
  const positional: string[] = [];
  let seat: Seat = "designer";
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--seat") {
      const word = argv[++i];
      const match = SVG_SEATS.find((s) => s === word);
      if (!match) return { cmd: "usage", error: `--seat must be one of ${SVG_SEATS.join(" | ")}, got ${JSON.stringify(word)}` };
      seat = match;
    } else {
      positional.push(a);
    }
  }

  const [nodeId, ...rest] = positional;
  if (!nodeId) return { cmd: "usage", error: "missing <node-id>" };
  if (rest.length === 0) return { cmd: "usage", error: "missing <feedback>" };
  return { cmd: "annotate", nodeId, feedback: rest.join(" "), seat };
}

/**
 * Parse the `survey [--budget <v>]` path — the cold-start board-bootstrap gesture (T-017-02). PURE.
 * UNLIKE `expand`/`chain`, survey takes NO positional subject — it reads the WHOLE project — so this is
 * a flags-only command: `--budget` is OPTIONAL (the gesture defaults to the play's warranted envelope),
 * and any positional token is an error (there is no subject to type). The whole-project read IS the
 * gesture; read-never-invent is the gate, not a per-row pull.
 */
function parseSurveyArgs(argv: readonly string[]): ParsedCommand {
  let budgetVal: string | undefined;
  let sawBudgetFlag = false;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--budget") {
      sawBudgetFlag = true;
      budgetVal = argv[++i];
    } else {
      return { cmd: "usage", error: `unexpected survey argument: ${a}` };
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

  return budget ? { cmd: "survey", budget } : { cmd: "survey" };
}

/**
 * Parse the `steer [--budget <v>]` path — the steering-capstone gesture (T-018-02). PURE. Like `survey`
 * (and UNLIKE `expand`/`chain`), steer takes NO positional subject — it reads the WHOLE project and stages
 * a ranked board AND the real forks — so this is a flags-only command: `--budget` is OPTIONAL (the gesture
 * defaults to the play's warranted envelope), and any positional token is an error (there is no subject to
 * type). A copy of {@link parseSurveyArgs}'s shape (the no-shared-util idiom: copy the five lines rather
 * than couple two commands' parsers).
 */
function parseSteerArgs(argv: readonly string[]): ParsedCommand {
  let budgetVal: string | undefined;
  let sawBudgetFlag = false;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--budget") {
      sawBudgetFlag = true;
      budgetVal = argv[++i];
    } else {
      return { cmd: "usage", error: `unexpected steer argument: ${a}` };
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

  return budget ? { cmd: "steer", budget } : { cmd: "steer" };
}

/**
 * Parse the `work [--budget <v>] [--board <path>]` path — the counter gesture (T-024-03): fund a
 * macro-wallet and spend it down on the staged ranked board (the Confirm→Run→Settle spine, IA-6).
 * PURE. Like `survey`/`steer`, work takes NO positional subject — it reads the staged board — so a
 * positional token is an error. UNLIKE the others, `--budget` is OPTIONAL with a real default (the
 * "two-hour" macro budget, IA-6 — adjust is the exception, applied at dispatch); a present-but-empty
 * `--budget` or a malformed value is still a clean usage error. `--board` OPTIONALLY points at a
 * specific staged board (default ⇒ the dispatch's steer→survey fallback).
 */
function parseWorkArgs(argv: readonly string[]): ParsedCommand {
  let budgetVal: string | undefined;
  let sawBudgetFlag = false;
  let board: string | undefined;
  let staleOk = false;
  let intervened: boolean | undefined;
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--budget") {
      sawBudgetFlag = true;
      budgetVal = argv[++i];
    } else if (a === "--board") {
      const word = argv[++i];
      if (!word || word.startsWith("--")) return { cmd: "usage", error: "missing --board <path>" };
      board = word;
    } else if (a === "--stale-ok") {
      // The freshness-gate override (T-027-01, IA-5) — a presence flag, like `run`'s `--no-gates`.
      staleOk = true;
    } else if (a === "--intervened") {
      // The E1 trust self-report (T-014-01/T-026-02) — a presence-flag pair, order-independent.
      intervened = true;
    } else if (a === "--no-intervened") {
      intervened = false;
    } else {
      return { cmd: "usage", error: `unexpected work argument: ${a}` };
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

  return {
    cmd: "work",
    ...(budget ? { budget } : {}),
    ...(board ? { board } : {}),
    ...(staleOk ? { staleOk: true } : {}),
    ...(intervened !== undefined ? { intervened } : {}),
  };
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
  // `--no-gates` is a presence flag (the E2 run mode, T-014-02) — order-independent vs
  // `--budget`. Spread `skipGates` only when present so the gated default keeps its shape.
  const skipGates = argv.includes("--no-gates");
  // `--intervened` / `--no-intervened` is the E1 trust self-report (T-014-01) — a presence
  // flag pair: present-and-true ⇒ the author stepped in, present-and-false ⇒ a clean walk-away,
  // neither ⇒ absent (unknown). Spread only when one was given so an unreported run keeps shape.
  const intervened = argv.includes("--intervened") ? true : argv.includes("--no-intervened") ? false : undefined;
  return {
    cmd: "run",
    play,
    epicPath,
    budget,
    ...(skipGates ? { skipGates: true } : {}),
    ...(intervened !== undefined ? { intervened } : {}),
  };
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
  if (parsed.cmd === "version") {
    // Print the build-embedded semver (T-061-02) and exit 0 — a successful query,
    // like `shelf`/`doctor`'s readouts. `VERSION` is statically in scope (no lazy
    // import); it is the manifest version inlined at `bun build --compile`, so this
    // is correct even from a single-file binary with no `package.json` on disk.
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }
  if (parsed.cmd === "browse") {
    // Bare `vend`: the fused DL-6 Home — board (ranked pull, persisted to `.vend/menu.json`) leading,
    // shelf (authored supply) receding beneath, ledger (E1 walk-away) at the foot. browseShelf stays
    // THE single cache writer (the press contract `vend <sel>` resolves against); `--all` reveals
    // hidden board rows. Instant, deterministic, no LLM. Lazy import keeps the Home deps (and their
    // transitive BAML addon) off the pure-parse path, exactly as the browse arm kept gather lazy.
    const { homeText } = await import("./shelf/home-shell.ts");
    process.stdout.write(`${await homeText({ all: parsed.all })}\n`);
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

  if (parsed.cmd === "expand") {
    // The demand-extraction gesture (T-016-02): cast ExpandFragment on ONE explicitly typed fragment
    // (PE-1). On success it STAGES a structured signal under `docs/active/pm/staged/` for a human
    // pull; an honest-empty / read-never-invent refusal halts as a `gate-failed` andon with nothing
    // staged. `--budget` defaults to the play's warranted envelope. Lazy import keeps the shell (and
    // its BAML addon) off the pure-parse path, exactly as the chain/run arms do.
    const { castExpandFragment, expandFragmentPlay } = await import("./play/expand-fragment.ts");
    const budget = parsed.budget ?? expandFragmentPlay.budget;
    const summary = await castExpandFragment({ fragment: parsed.fragment, budget });
    process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
    process.exit(summary.outcome === "success" ? 0 : 1);
  }

  if (parsed.cmd === "annotate") {
    // The annotation→demand round-trip gesture (T-057-03): cast ExpandFragment on the feedback TEXT as
    // ONE fragment, carrying the annotation provenance (the node id it was left on + the seat). On
    // success it STAGES a provenance-bearing signal under `docs/active/pm/staged/` — the inbound demand
    // half of E-057 — touching NOTHING on the board (the inherited one-way-authority staging from
    // T-057-02; the trailer + back-link are rendered by `renderAnnotationProvenance`). A
    // read-never-invent / honest-empty refusal halts as a `gate-failed` andon with nothing staged. The
    // budget is the play's warranted envelope (no `--budget` on this thin gesture). Lazy import keeps
    // the cast (and its BAML addon) off the pure-parse path, exactly as the expand arm — the seam
    // REUSES expand-fragment whole (T-057-02 made the cast annotation-capable), building no new effect.
    const { castExpandFragment, expandFragmentPlay } = await import("./play/expand-fragment.ts");
    const summary = await castExpandFragment({
      fragment: parsed.feedback,
      budget: expandFragmentPlay.budget,
      annotation: { text: parsed.feedback, nodeId: parsed.nodeId, seat: parsed.seat },
    });
    process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
    process.exit(summary.outcome === "success" ? 0 : 1);
  }

  if (parsed.cmd === "survey") {
    // The cold-start board-bootstrap gesture (T-017-02): cast Survey on the WHOLE project. On success it
    // STAGES a ranked demand board under `docs/active/pm/staged/survey-board.md` for a human pull; a
    // honest-empty (padded board) / read-never-invent refusal halts as a `gate-failed` andon with
    // nothing staged. `--budget` defaults to the play's warranted (generous, project-scale) envelope.
    // Lazy import keeps the shell (and its BAML addon) off the pure-parse path, exactly as the other arms.
    const { castSurvey, surveyPlay } = await import("./play/survey.ts");
    const budget = parsed.budget ?? surveyPlay.budget;
    const summary = await castSurvey({ budget });
    process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
    process.exit(summary.outcome === "success" ? 0 : 1);
  }

  if (parsed.cmd === "steer") {
    // The steering-capstone gesture (T-018-02): cast Steer on the WHOLE project. On success it STAGES the
    // ranked demand board AND the real forks under `docs/active/pm/staged/steer.md` for human assent; a
    // read-never-invent / fork-genuineness refusal halts as a `gate-failed` andon with nothing staged (no
    // fabricated board or manufactured fork materializes). `--budget` defaults to the play's warranted
    // (generous, heaviest-read) envelope. Lazy import keeps the shell (and its BAML addon) off the
    // pure-parse path, exactly as the other arms.
    const { castSteer, steerProjectPlay } = await import("./play/steer.ts");
    const budget = parsed.budget ?? steerProjectPlay.budget;
    const summary = await castSteer({ budget });
    process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
    process.exit(summary.outcome === "success" ? 0 : 1);
  }

  if (parsed.cmd === "work") {
    // The counter gesture (T-024-03): fund the macro-wallet ONCE and spend it down on the staged
    // ranked board — Confirm→Run→Settle at macro scale (IA-6). `castWork` reads the board, prices each
    // pull, and drives the autonomous loop; the `onStep` callback streams the IA-7 production line
    // (which pull is running against the two-denomination burn, IA-8) — never the raw executor stream.
    // On a settled session it prints the receipt (cleared / per-cast cost / remaining / stop reason,
    // the andon rendered amber per IA-9) and exits 0 — an andon is a SUCCESSFUL refusal, not a crash;
    // only a broken precondition (unfit env / missing / empty / stale board) exits non-zero. The
    // doctor preflight (T-042-04) runs first inside `castWork`: a broken dep refuses at the door with
    // the `vend doctor` report before any budget is committed. Lazy import keeps the shell (and its
    // BAML addon) off the pure-parse path, exactly as the other arms.
    const { castWork } = await import("./play/work.ts");
    const { renderReceipt, formatStepSignal, renderStaleBoard, renderBudgetQuote } = await import("./play/work-core.ts");
    // `--budget` omitted ⇒ `castWork` defaults to the calibrated cold-start envelope (T-060-02-02) and
    // emits the resolved plan via `onPlan` BEFORE the loop. Capture `funded` from it (so the IA-7 meter
    // renders against the real wallet) and print the honest p90 quote when the default is in force.
    let funded: Budget | undefined = parsed.budget;
    const result = await castWork({
      ...(parsed.budget ? { budget: parsed.budget } : {}),
      ...(parsed.board ? { boardPath: parsed.board } : {}),
      ...(parsed.staleOk ? { staleOk: true } : {}),
      ...(parsed.intervened !== undefined ? { intervened: parsed.intervened } : {}),
      onPlan: (plan) => {
        funded = plan.funded;
        if (plan.usedDefault) process.stdout.write(`${renderBudgetQuote(plan, { color: true })}\n`);
      },
      onStep: (s) => process.stdout.write(`${formatStepSignal(s, funded!)}\n`),
    });
    if (result.kind === "unfit-env") {
      // The doctor preflight refused (T-042-04): a broken dependency. Print the doctor report (the
      // named checks + fix-it hints) and exit with its code — a clean precondition refusal at the
      // door, before any budget was committed, exactly like the no-board / stale-board family.
      process.stderr.write(`${result.report.report}\n`);
      process.exit(result.report.exitCode);
    }
    if (result.kind === "no-board") {
      process.stderr.write(
        `no staged board found (tried ${result.tried.join(", ")}) — run \`vend steer\` or \`vend survey\` first\n`,
      );
      process.exit(1);
    }
    if (result.kind === "empty-board") {
      process.stderr.write(`staged board ${result.boardPath} has no signals to spend on\n`);
      process.exit(1);
    }
    if (result.kind === "stale-board") {
      // The freshness gate refused (T-027-01, IA-9): the board predates the project's live state. An
      // amber andon — a SUCCESSFUL refusal — handed back with the re-survey move, exiting like the
      // other broken-precondition outcomes (no-board/empty-board), NOT a crash. `--stale-ok` overrides.
      process.stderr.write(`${renderStaleBoard(result, { color: true })}\n`);
      process.exit(1);
    }
    const wallet = { funded: result.funded, remaining: result.session.remaining };
    process.stdout.write(`${renderReceipt(result.session, wallet, { color: true })}\n`);
    process.exit(0);
  }

  if (parsed.cmd === "svg") {
    // The file-output seam gesture (T-055-03): render the live board to one static `.svg` and write
    // it under `.vend` (default) — the unblocked, MCP-independent visual half of the non-dev
    // round-trip. `writeBoardSvg` loads → projects (under the seat's preset) → renders → writes, and
    // returns the path + IR counts (one swimlane/group, box/card, edge/link). Read-only over the
    // board (one-way authority: writes `.vend`, never docs/active); a `--out` path overrides the
    // destination, split into dir/filename here. Lazy import keeps the seam (and its transitive deps)
    // off the pure-parse path, exactly as the other arms keep their deps lazy.
    const { writeBoardSvg } = await import("./present/svg-file.ts");
    const { dirname, basename } = await import("node:path");
    const result = await writeBoardSvg({
      seat: parsed.seat,
      ...(parsed.out ? { outDir: dirname(parsed.out), fileName: basename(parsed.out) } : {}),
    });
    process.stdout.write(
      `wrote ${result.path} — ${result.groupCount} groups, ${result.cardCount} cards, ${result.linkCount} links\n`,
    );
    process.exit(0);
  }

  if (parsed.cmd === "shelf") {
    // The supply view (T-030-02): gather the authored playbooks + the run ledger, pair each
    // with its warranted envelope (shelfRows), render clean-typographic (renderShelf), print.
    // Read-only — it DISPLAYS the shelf, never actuates — so it always exits 0. Lazy import
    // keeps the play modules (and their BAML addon) off the pure-parse path, like the other arms.
    const { shelfText } = await import("./shelf/shelf.ts");
    process.stdout.write(`${await shelfText()}\n`);
    process.exit(0);
  }

  if (parsed.cmd === "init") {
    // The scaffold gesture (T-040-03): lay the vend tree over the cwd, no-clobber. `runInit`
    // composes the lisa-project gate with the scaffold apply and hands back a typed outcome — the
    // refusal is DATA, not a throw. A non-lisa cwd is a clean, SUCCESSFUL refusal (a typed andon +
    // fix-it hint) that still exits non-zero (an environment precondition, the no-board family).
    // A scaffolded cwd prints the create/skip tally and exits 0 — a fully-scaffolded re-run (all
    // skipped) is idempotent success, not an error. Lazy import keeps the effect off the pure-parse
    // path, exactly as the other arms keep their deps lazy.
    const { runInit } = await import("./init/init-effect.ts");
    const outcome = await runInit(process.cwd(), parsed.template);
    if (outcome.kind === "not-lisa") {
      process.stderr.write(
        `not a lisa project (no CLAUDE.md or .lisa.toml in ${outcome.root}) — run \`lisa init\` first\n`,
      );
      process.exit(1);
    }
    if (outcome.kind === "unknown-template") {
      // The E-058 overlay refusal (T-058-01): a clean, SUCCESSFUL refusal naming the valid set — DATA
      // + fix-it hint + non-zero exit, the `not-lisa` shape. Nothing was written (checked pre-apply).
      process.stderr.write(
        `unknown template "${outcome.name}" — available: ${outcome.available.join(", ")}\n`,
      );
      process.exit(1);
    }
    const { created, skipped } = outcome.result;
    const label = parsed.template ? `scaffolded --template ${parsed.template}` : "scaffolded";
    process.stdout.write(`vend init: ${label} — ${created.length} created, ${skipped.length} skipped\n`);
    process.exit(0);
  }

  if (parsed.cmd === "doctor") {
    // The preflight gate (T-042-03): probe the vend-specific deps (lisa & claude on PATH, the BAML
    // native addon loadable, the active executor's config present), render the verdict, print it,
    // and exit with the CORE-computed code (0 all-green / 1 any-broken). A broken dep is DATA — a
    // clean `✗ <check> — <fix-it>` line, never a stack trace: `probeDoctor` never rejects (every
    // check is wrapped by safeCheck) and `renderDoctorReport` never throws. Read-only — nothing is
    // cast, so there is no budget. The report prints to STDOUT green OR red (it is a status
    // checklist, not an error stream, like `work`'s receipt). Lazy import keeps the probe (and its
    // transitive BAML addon) off the pure-parse path, exactly as the other arms keep their deps lazy.
    const { probeDoctor } = await import("./doctor/doctor-probe.ts");
    const { renderDoctorReport } = await import("./doctor/doctor-core.ts");
    const report = renderDoctorReport(await probeDoctor());
    process.stdout.write(`${report.report}\n`);
    process.exit(report.exitCode);
  }

  if (parsed.cmd === "envelope") {
    // The Ledger readout (T-013-02): load the ledger, recalibrate this play at the tier
    // percentile over its successful history, and PRINT the proposed envelope + an honest
    // confidence label. Read-only — it DISPLAYS the measured default, it does not actuate
    // it into a dispatch (IA-14 — auto-widen/slow-tighten — is a later rung), so it always
    // exits 0. Lazy imports keep the ledger/shelf deps off the pure-parse path.
    const { loadRunLog, forPlay } = await import("./log/run-log.ts");
    const { recalibrate, formatEnvelopeLabel, calibrate, learnBiasFactor, formatCorrectionLabel } = await import(
      "./ledger/recalibrate.ts"
    );
    const { budgetForTier } = await import("./shelf/gather.ts");
    const { basename } = await import("node:path");
    const { records } = await loadRunLog();
    const result = recalibrate(parsed.play, records, parsed.tier, budgetForTier(parsed.tier));
    const { timeMs, tokens } = result.envelope;
    process.stdout.write(`${parsed.play} [${parsed.tier}]: ${tokens} tokens / ${timeMs} ms — ${formatEnvelopeLabel(result)}\n`);

    // T-013-03: bias-correct a raw estimate against this {play, project}'s ratio history (IA-16).
    // The estimate is the one supplied with --estimate, else the measured default feeds through
    // (AC #4). The generic prior pools the play across ALL projects; the project level is this
    // project's slice. Read-only — display, never actuation (IA-14 deferred), so still exit 0.
    const project = parsed.project ?? basename(process.cwd());
    const estimate = parsed.estimate ?? result.envelope;
    const genericPrior = learnBiasFactor(forPlay(records, parsed.play));
    const projectRecords = forPlay(records, parsed.play, { project });
    const corr = calibrate(estimate, { play: parsed.play, project }, projectRecords, genericPrior);
    process.stdout.write(
      `  ↳ corrected [${project}]: ${corr.corrected.tokens} tokens / ${corr.corrected.timeMs} ms — ${formatCorrectionLabel(corr)}\n`,
    );
    process.exit(0);
  }

  if (parsed.cmd === "audit") {
    // The E1 walk-away readout (T-014-01, PRD KR1–KR2): load the ledger, audit the trust
    // numbers (andon-rate vs the IA-12 budget, outcome mix, cost-vs-envelope, intervention
    // rate/trend), and PRINT the findings fragment T-014-03's note quotes. Read-only — it
    // never actuates, so it always exits 0. Lazy imports keep the ledger deps off the pure
    // parse path, exactly as the envelope arm does.
    const { loadRunLog } = await import("./log/run-log.ts");
    const { auditWalkAway, formatWalkAwayFindings } = await import("./ledger/walk-away.ts");
    const { records } = await loadRunLog();
    const report = auditWalkAway(records, {
      tier: parsed.tier,
      ...(parsed.play ? { play: parsed.play } : {}),
      ...(parsed.window !== undefined ? { window: parsed.window } : {}),
    });
    process.stdout.write(`${formatWalkAwayFindings(report)}\n`);
    process.exit(0);
  }

  // The run path: look the play up BY NAME in the registry and cast it (no hardcoded
  // decompose-epic branch). Lazy import keeps the dispatcher (and its BAML addon) off the
  // pure-parse path, exactly as the browse/press arms keep their deps lazy. An unknown play
  // is the registry's typed andon → stderr + exit 2.
  const { runPlay } = await import("./play/dispatch.ts");
  const res = await runPlay(parsed.play, {
    epicPath: parsed.epicPath,
    budget: parsed.budget,
    skipGates: parsed.skipGates,
    intervened: parsed.intervened,
  });
  if (res.kind === "no-play") {
    process.stderr.write(`${res.error.message}\n`);
    process.exit(2);
  }
  const summary = res.summary;
  process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
  process.exit(summary.outcome === "success" ? 0 : 1);
}
