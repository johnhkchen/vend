// Gather + persist + the bare-`vend` browse entry (T-003-02) — wiring the pure menu
// model (T-003-01) to reality.
//
// Bare `vend` shows the shelf: read the value model (`demand.md`) + readiness
// (`lisa status`), shape them into `Action[]`, rank → render → persist to
// `.vend/menu.json` → print. Instant and deterministic (no LLM). `.vend/menu.json`
// is the index-stability seam between the browse gesture (`vend`) and the press
// gesture (`vend <sel>`, T-003-04): it stores the displayed actions in display order,
// plus a freshness marker (timestamp + state-hash) so a materially-stale menu can be
// detected rather than acted on.
//
// PURITY (house pattern, cf. project-context's buildProjectSnapshot / assembleInputs):
// every nontrivial decision is a PURE, fixture-tested function — parse the demand
// signals, parse lisa's done-epics, derive readiness, derive the warranted budget,
// shape the actions, fold the state-hash. Only `gather` / `writeMenuCache` /
// `browseShelf` are IMPURE (read `demand.md`, spawn `lisa status`, read the clock,
// write `.vend/menu.json`); they are the single untested shell — their logic IS the
// pure helpers plus thin I/O.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type Action,
  type MenuCache,
  type Readiness,
  type ValueTier,
  MENU_CACHE_VERSION,
  rankActions,
  renderMenu,
  visibleActions,
} from "./menu.ts";
import type { Budget } from "../budget/budget.ts";

/** Default value-model location (demand.md is the single source of truth). */
export const DEMAND_PATH = "docs/active/demand.md";

/** Where the menu is persisted — the browse↔press index-stability seam. Gitignored
 *  runtime telemetry: regenerated each browse, never committed. */
export const MENU_CACHE_FILE = ".vend/menu.json";

/**
 * Warranted default budget per leverage tier — "budget ∝ value" (demand.md): keystone
 * fat, leaf thin. demand.md's envelopes are human prose (`≈2h`, `mins`), so the tier
 * IS the budget signal; these are the default envelopes `vend <sel>` opens with,
 * overridable via `--budget` (T-003-04). Calibration-pending — set from the run log's
 * measured fat tails once enough runs exist (demand.md). TOKEN values are cost units
 * (fresh-input-token equivalents): E-068 re-denominates the old parity priors by the
 * representative ~0.5 conversion observed in the run-log classes. Renders human-scale through
 * {@link formatBudget} (`2h/40k`, `15m/4k`).
 */
export const TIER_BUDGET: Record<ValueTier, Budget> = {
  keystone: { timeMs: 7_200_000, tokens: 40_000 }, // 2h / 40k cost
  high: { timeMs: 7_200_000, tokens: 25_000 }, //     2h / 25k cost
  standard: { timeMs: 3_600_000, tokens: 12_500 }, // 1h / 12.5k cost
  leaf: { timeMs: 900_000, tokens: 4_000 }, //        15m / 4k cost
};

/** A signal row parsed from a demand.md table, before readiness/budget policy. */
export interface RawSignal {
  /** The bold lead phrase naming the signal, verbatim. */
  readonly name: string;
  /** Leverage tier parsed from the Value cell. */
  readonly tier: ValueTier;
  /** The Status cell, verbatim (readiness + any staged epic id live here). */
  readonly statusText: string;
  /** First `E-###` board id referenced in the Status cell, if any. */
  readonly epicId?: string;
}

/** Where the browse gesture reads/writes. `projectRoot` defaults to cwd. */
export interface BrowseOpts {
  /** Reveal blocked/leaf rows otherwise hidden. */
  readonly all?: boolean;
  /** Project root; defaults to `process.cwd()`. */
  readonly projectRoot?: string;
  /** Override the demand.md path; defaults to `<root>/docs/active/demand.md`. */
  readonly demandPath?: string;
}

/** What {@link browseShelf} hands the thin CLI shell. */
export interface BrowseResult {
  /** The rendered menu, ready to print. */
  readonly menu: string;
  /** Exactly what was persisted to `.vend/menu.json`. */
  readonly cache: MenuCache;
  /** Absolute path written. */
  readonly cachePath: string;
}

// ---- private pure helpers ----

/** Tier words recognized in a Value cell, longest-first is irrelevant (disjoint). */
const TIER_WORDS: readonly ValueTier[] = ["keystone", "high", "standard", "leaf"];
/** A signal's OWN staged epic, by demand.md convention — `… → E-003` (staged/done
 *  arrow) or `epic/E-003.md` (the card link). Deliberately NOT "any E-### in the
 *  cell": a Status cell freely names prerequisite epics in prose (`needs E-004`,
 *  `composes after E-004`), which are not this signal's vendable target. */
const OWN_EPIC_ARROW_RE = /→\s*(E-\d{3})/;
const OWN_EPIC_CARD_RE = /epic\/(E-\d{3})/;
/** A `lisa status` ticket row, anchored to the line start so the LEADING ticket id +
 *  its phase are captured — never the `deps:`/`blocks:` ticket refs later in the row.
 *  `T-003-02` → epic group `E-003`. */
const TICKET_ROW_RE = /^\s*T-(\d{3})-\d{2}\s+(\S+)/;

/** The LEADING status word of a Status cell (skipping `**`/punctuation/whitespace),
 *  lowercased — `"**done → E-001**"` → `"done"`, `"**ready** — E-001 done."` →
 *  `"ready"`, `"blocked — needs E-004"` → `"blocked"`. This is the signal's OWN state;
 *  a `done`/`blocked` mentioned later in prose (another epic's state, `unblocked`) is
 *  deliberately ignored. Pure/total. */
function leadStatusWord(statusText: string): string {
  return (statusText.match(/[a-z]+/i)?.[0] ?? "").toLowerCase();
}

/** Kebab-case a signal name for display: lowercase, strip punctuation/backticks,
 *  collapse to single hyphens, drop empty segments. Pure/total. */
function kebab(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** 32-bit FNV-1a fold to hex — deterministic, dependency-free, total. The freshness
 *  fingerprint: same input ⇒ same hash; any one-char change flips it. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// ---- pure exports (unit-tested) ----

/** The warranted default envelope for a tier (budget ∝ value). PURE/TOTAL. */
export function budgetForTier(tier: ValueTier): Budget {
  return TIER_BUDGET[tier];
}

/** Map a Status cell to a two-state readiness by its LEADING word: `blocked` →
 *  `blocked`, else `ready`. PURE/TOTAL. (Done is a drop, not a readiness — see
 *  {@link isDoneStatus}; in-progress is layered on in {@link signalsToActions}.) */
export function deriveReadiness(statusText: string): Readiness {
  return leadStatusWord(statusText) === "blocked" ? "blocked" : "ready";
}

/** Whether a signal's OWN leading status word marks it cleared (`done → E-###`). A
 *  done signal is not an action you can take, so it is dropped. PURE/TOTAL. */
export function isDoneStatus(statusText: string): boolean {
  return leadStatusWord(statusText) === "done";
}

/**
 * Parse the signal rows out of demand.md's pipe tables. PURE/TOTAL. Keeps lines that
 * are table rows (start with `|`, not a `|---|` separator) whose first cell holds a
 * `**bold**` name — skipping the column-title row (`| Signal | … |`). For each: the
 * bold name, the first tier word found in the Value (2nd) cell, the Status (last)
 * cell verbatim, and any `E-###` in it. A row missing a tier is skipped — a prose
 * edit degrades the menu, never throws.
 */
export function parseDemandSignals(md: string): RawSignal[] {
  const out: RawSignal[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line.startsWith("|")) continue;
    if (/^\|[\s|:-]*\|?\s*$/.test(line)) continue; // separator row (|---|---|)
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2) continue;
    const nameCell = cells[0] ?? "";
    const boldName = nameCell.match(/\*\*(.+?)\*\*/)?.[1]?.trim();
    if (!boldName || boldName.toLowerCase() === "signal") continue; // title row
    const valueCell = (cells[1] ?? "").toLowerCase();
    const tier = TIER_WORDS.find((t) => valueCell.includes(t));
    if (!tier) continue;
    const statusText = cells[cells.length - 1] ?? "";
    const epicId = statusText.match(OWN_EPIC_ARROW_RE)?.[1] ?? statusText.match(OWN_EPIC_CARD_RE)?.[1];
    out.push(epicId ? { name: boldName, tier, statusText, epicId } : { name: boldName, tier, statusText });
  }
  return out;
}

/**
 * Parse the epics `lisa status` shows as actively being decomposed — having ≥1 ticket
 * NOT yet phase `done`. PURE/TOTAL. Groups ticket lines by epic prefix (`T-003-xx` →
 * `E-003`); an epic is in-progress iff some ticket is unfinished. An in-progress epic
 * must not be re-vended (it would re-run `DecomposeEpic` over in-flight work), so
 * {@link signalsToActions} marks it `blocked` (hidden behind `--all`).
 *
 * NB: this reads `lisa status` for the IN-PROGRESS signal only, NOT done-ness. Ticket
 * ids do not reliably encode their epic (E-001's work spans `T-001-*` AND `T-002-*`),
 * so deriving an epic's *done-ness* from prefix grouping is unsound — it would phantom
 * E-002 as done from E-001's `T-002-*` tickets. Done-ness comes from demand.md's own
 * Status cell ({@link isDoneStatus}); only the phantom-free "has unfinished tickets"
 * signal is taken from lisa. Empty / unrecognized stdout → `[]`.
 */
export function parseLisaInProgressEpics(stdout: string): string[] {
  const phases = new Map<string, string[]>();
  for (const line of stdout.split("\n")) {
    const m = line.match(TICKET_ROW_RE);
    if (!m) continue;
    const epic = `E-${m[1]}`;
    (phases.get(epic) ?? phases.set(epic, []).get(epic)!).push(m[2] ?? "");
  }
  const inProgress: string[] = [];
  for (const [epic, ps] of phases) {
    if (ps.some((p) => p !== "done")) inProgress.push(epic);
  }
  return inProgress.sort();
}

/**
 * Shape parsed signals into the menu's `Action[]`. PURE/TOTAL. A signal becomes an
 * action only when it names a staged epic id (today the only play, `DecomposeEpic`,
 * targets an epic file); a `done` signal is dropped (not an action you can take).
 * Readiness comes from the demand Status cell, then is OVERRIDDEN to `blocked` for an
 * epic `lisa` shows in-progress (`inProgressEpicIds`) — re-vending a mid-decompose
 * epic would clobber in-flight work, so it is hidden behind `--all`. Demand-board
 * order is preserved (rankActions re-sorts by leverage). Fresh array; inputs never
 * mutated.
 */
export function signalsToActions(signals: readonly RawSignal[], inProgressEpicIds: readonly string[]): Action[] {
  const inProgress = new Set(inProgressEpicIds);
  const out: Action[] = [];
  for (const s of signals) {
    if (!s.epicId || isDoneStatus(s.statusText)) continue;
    const readiness: Readiness = inProgress.has(s.epicId) ? "blocked" : deriveReadiness(s.statusText);
    out.push({ id: s.epicId, title: kebab(s.name), tier: s.tier, readiness, budget: budgetForTier(s.tier) });
  }
  return out;
}

/**
 * The freshness fingerprint of the board state a menu was computed from. PURE/TOTAL,
 * deterministic. Folds the raw demand text + lisa output + the `all` mode, so
 * T-003-04 can recompute from freshly-read inputs and detect a materially-stale menu
 * by hash mismatch — without re-deriving the menu itself.
 */
export function stateHash(input: { demand: string; lisa: string; all: boolean }): string {
  return fnv1a(`${input.demand} ${input.lisa} ${input.all ? "all" : ""}`);
}

// ---- impure verbs (the untested shell) ----

/** Run `lisa status` and capture stdout. Tolerant: a missing/erroring `lisa` yields
 *  `""` (the menu still renders from demand alone), never rejects. IMPURE. */
async function lisaStatus(root: string): Promise<string> {
  try {
    const proc = Bun.spawn(["lisa", "status"], { cwd: root, stdout: "pipe", stderr: "ignore" });
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    return text;
  } catch {
    return "";
  }
}

/**
 * Read the two inputs and shape them into `Action[]`. The IMPURE verb: reads
 * `demand.md` (absent → `""`) and `lisa status` (absent → `""`), then calls the pure
 * parsers/shaper. Returns the raw inputs alongside so {@link browseShelf} can hash
 * them for the freshness marker.
 */
export async function gather(opts: BrowseOpts = {}): Promise<{ actions: Action[]; demand: string; lisa: string }> {
  const root = opts.projectRoot ?? process.cwd();
  const demandPath = opts.demandPath ?? join(root, DEMAND_PATH);
  const demand = await readFile(demandPath, "utf8").catch(() => "");
  const lisa = await lisaStatus(root);
  const actions = signalsToActions(parseDemandSignals(demand), parseLisaInProgressEpics(lisa));
  return { actions, demand, lisa };
}

/** Persist a {@link MenuCache} to `<root>/.vend/menu.json`, ensuring `.vend/`. Returns
 *  the path written. IMPURE. */
export async function writeMenuCache(root: string, cache: MenuCache): Promise<string> {
  const path = join(root, MENU_CACHE_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`);
  return path;
}

/**
 * The bare-`vend` browse flow: gather → rank → render → persist → return. The IMPURE
 * orchestrator the CLI shell calls. Render and cache derive from the SAME `ranked`
 * array and the SAME `all`, and the cache stores `visibleActions(ranked, all)` — the
 * exact filter `renderMenu` uses — so the printed numbering and the persisted list
 * can never disagree (the index contract `vend <sel>` resolves against). Stamps the
 * freshness marker: an ISO `generatedAt` (the lone clock read) + a `stateHash` of the
 * gathered inputs.
 */
export async function browseShelf(opts: BrowseOpts = {}): Promise<BrowseResult> {
  const root = opts.projectRoot ?? process.cwd();
  const all = opts.all ?? false;
  const { actions, demand, lisa } = await gather(opts);
  const ranked = rankActions(actions);
  const cache: MenuCache = {
    version: MENU_CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    stateHash: stateHash({ demand, lisa, all }),
    all,
    actions: visibleActions(ranked, all),
  };
  const cachePath = await writeMenuCache(root, cache);
  return { menu: renderMenu(ranked, { all }), cache, cachePath };
}
