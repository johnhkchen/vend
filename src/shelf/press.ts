// The press: `vend <sel>` resolve + dispatch (T-003-04) — the convergence node of E-003.
//
// The press half of the two-gesture transaction. Bare `vend` (T-003-02) renders +
// persists `.vend/menu.json`; this resolves a selection against THAT SAME persisted
// list and dispatches each pick's playbook in order, under its warranted budget. The
// only play today is `DecomposeEpic` → `runDecomposeEpic` (which streams live and
// appends exactly one run-log record per call, so "each pick appended to the log" — AC#2
// — is structural here, not extra wiring).
//
// PURITY (house pattern, cf. gather.ts's browseShelf): every decision — epic-path
// derivation, staleness compare, run planning — is a PURE, fixtured function in
// press-core.ts. This module is the single IMPURE shell: it reads `.vend/menu.json`,
// re-gathers demand+lisa for the freshness check, and spawns the runner. It is NOT
// unit-tested (its logic is the pure core + thin I/O), exactly as browseShelf/dispense
// are untested — proven by smoke. It value-imports `runDecomposeEpic` (the BAML addon
// load), which is why the pure core is split out: press-core.test.ts never loads it.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MenuCache } from "./menu.ts";
import { gather, MENU_CACHE_FILE } from "./gather.ts";
import { parseSelection, SelectionError } from "./select.ts";
import { runDecomposeEpic, type RunSummary } from "../play/decompose-epic.ts";
import { isMenuStale, planRuns, type PressOpts, type PressResult } from "./press-core.ts";

export * from "./press-core.ts";

/** A parsed cache shape good enough to resolve against: an object with an `actions`
 *  array. A corrupt / truncated `.vend/menu.json` is treated as no menu (re-run vend). */
function isMenuCache(v: unknown): v is MenuCache {
  return typeof v === "object" && v !== null && Array.isArray((v as { actions?: unknown }).actions);
}

/**
 * Resolve a selection against the persisted menu and dispatch the picks. The single
 * IMPURE orchestrator — reads the cache, re-gathers for the freshness check, parses +
 * resolves, then runs each pick IN ORDER. Returns a discriminated {@link PressResult}
 * the CLI shell maps to stderr + exit codes; expected terminal states (no-menu, stale,
 * bad-selection) are returned values, never thrown. A non-`SelectionError` from
 * `parseSelection` is a genuine bug and re-raised.
 */
export async function pressShelf(opts: PressOpts): Promise<PressResult> {
  const root = opts.projectRoot ?? process.cwd();
  const cachePath = join(root, MENU_CACHE_FILE);

  let cache: MenuCache;
  try {
    const parsed: unknown = JSON.parse(await readFile(cachePath, "utf8"));
    if (!isMenuCache(parsed)) return { kind: "no-menu", cachePath };
    cache = parsed;
  } catch {
    return { kind: "no-menu", cachePath };
  }

  // Re-read the inputs the menu was computed from and compare — never act on a menu the
  // board has moved out from under (AC#1). gather returns the raw demand+lisa precisely
  // so we can rehash without re-deriving the menu.
  const { demand, lisa } = await gather({ projectRoot: root, demandPath: opts.demandPath });
  if (isMenuStale(cache, { demand, lisa }, opts.all ?? false)) {
    return { kind: "stale" };
  }

  // Validate the WHOLE selection against the persisted length before any dispatch — an
  // out-of-range pick hard-errors here, never mid-run (AC#3).
  let indices: number[];
  try {
    indices = parseSelection(opts.selection, cache.actions.length);
  } catch (e) {
    if (e instanceof SelectionError) return { kind: "bad-selection", error: e };
    throw e;
  }

  const planned = planRuns(cache, indices, root, opts.budget);
  const runs: RunSummary[] = [];
  for (const run of planned) {
    runs.push(await runDecomposeEpic({ epicPath: run.epicPath, budget: run.budget, projectRoot: root }));
  }
  return { kind: "dispatched", runs };
}
