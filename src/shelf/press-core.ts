// The press's PURE decision core (T-003-04) — the addon-free heart of `vend <sel>`.
//
// Split out from press.ts (the impure orchestrator) for the same ONE reason the
// runner's core is split (decompose-epic-core.ts): the orchestrator value-imports
// `runDecomposeEpic`, which transitively loads the BAML native addon, and that addon
// makes a `bun test` process flaky (memory 20213/20218). Keeping the press's judgment
// here — epic-path derivation, staleness compare, run planning — lets press-core.test.ts
// exercise it as ordinary pure-function tests with NO native addon ever loaded. The
// linchpin: `RunSummary` enters via `import type` (erased at compile, no runtime load).
//
// PURE: every export takes plain values and returns fresh ones, never touching fs,
// clock, network, process, or the addon. The IMPURE verbs (read `.vend/menu.json`,
// re-gather demand+lisa, dispatch the runner) live in press.ts.

import { join } from "node:path";
import { type MenuCache, MENU_CACHE_VERSION } from "./menu.ts";
import { stateHash } from "./gather.ts";
import type { SelectionError } from "./select.ts";
import type { Budget } from "../budget/budget.ts";
import type { RunSummary } from "../play/decompose-epic.ts"; // TYPE-ONLY — never loads the addon

/** Where epic specs live, relative to the project root (singular `epic`). The press's
 *  only play today, `DecomposeEpic`, targets `<root>/docs/active/epic/<id>.md`. */
export const EPIC_DIR = "docs/active/epic";

/** One resolved pick, ready for the runner: the board id, the epic file to decompose,
 *  and the budget it runs under (the action's warranted envelope, or an override). */
export interface PlannedRun {
  readonly id: string;
  readonly epicPath: string;
  readonly budget: Budget;
}

/** What {@link press.pressShelf} reads. `selection` is the raw mini-language string;
 *  `all` is the press's mode (folded into the staleness hash); `budget` overrides every
 *  pick's warranted envelope when present. */
export interface PressOpts {
  readonly selection: string;
  readonly all?: boolean;
  readonly budget?: Budget;
  readonly projectRoot?: string;
  readonly demandPath?: string;
}

/**
 * The discriminated outcome of a press, mapped to stderr + exit codes by the CLI shell.
 * `no-menu`/`stale` are andons ("re-run vend"); `bad-selection` is a caller input error
 * (out-of-range / malformed); `dispatched` carries one {@link RunSummary} per pick.
 * Expected terminal states are VALUES, never thrown (cf. budget's `exhausted`).
 */
export type PressResult =
  | { readonly kind: "no-menu"; readonly cachePath: string }
  | { readonly kind: "stale" }
  | { readonly kind: "bad-selection"; readonly error: SelectionError }
  | { readonly kind: "dispatched"; readonly runs: readonly RunSummary[] };

/** Derive the epic file the press dispatches `DecomposeEpic` on, from a board id.
 *  PURE/TOTAL — `epicPathFor("/r", "E-003")` → `/r/docs/active/epic/E-003.md`. */
export function epicPathFor(root: string, id: string): string {
  return join(root, EPIC_DIR, `${id}.md`);
}

/**
 * Whether the persisted menu no longer matches freshly-read board state — the "never
 * act on stale indices" guard (AC#1). PURE. Stale iff the cache's schema version has
 * moved, OR a rehash of the fresh inputs under the PRESS's `all` mode disagrees with
 * the stamped `cache.stateHash`. Using the press's `all` (not the cache's) is
 * deliberate: `all` is folded into the hash, so pressing in a different mode than you
 * browsed (whose numbering differs) is itself a staleness — one compare catches both a
 * board change and a mode mismatch, always erring toward re-running.
 */
export function isMenuStale(cache: MenuCache, fresh: { demand: string; lisa: string }, pressAll: boolean): boolean {
  if (cache.version !== MENU_CACHE_VERSION) return true;
  return cache.stateHash !== stateHash({ demand: fresh.demand, lisa: fresh.lisa, all: pressAll });
}

/**
 * Resolve already-validated 1-indexed picks against the persisted menu into ordered
 * runs. PURE/TOTAL. `indices` MUST come from {@link select.parseSelection} (validated
 * against `cache.actions.length`), so `actions[i - 1]` is always present — a direct
 * resolution honoring the index contract (no re-rank, no re-filter). `override`, when
 * given, supersedes every pick's warranted `action.budget` (the one `--budget` applies
 * to the whole press). Input arrays are never mutated.
 */
export function planRuns(
  cache: MenuCache,
  indices: readonly number[],
  root: string,
  override?: Budget,
): PlannedRun[] {
  return indices.map((i) => {
    const action = cache.actions[i - 1]!; // pre-validated by parseSelection
    return { id: action.id, epicPath: epicPathFor(root, action.id), budget: override ?? action.budget };
  });
}
