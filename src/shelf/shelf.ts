// The `vend shelf` supply-read shell (T-030-02) — the SUPPLY half of Home behind its own
// read-only verb. Where bare `vend` (gather.ts `browseShelf`) is the DEMAND board, this is
// the SHELF: the catalog of authored playbooks, each row pairing its WORTH (`summary`) with
// its WARRANTED envelope + an honest confidence read (`shelfRows`, T-030-01), rendered
// clean-typographic (`renderShelf` — DL-6/9/3). The board (`vend`) is untouched: this stands
// beside it, not in it.
//
// IMPURE (the thin untested shell, cf. gather.ts `browseShelf` / dispatch.ts / the cli `audit`
// arm): it loads the run ledger (`loadRunLog`) and VALUE-IMPORTS the six play modules — which
// pull the BAML addon as a transitive cost of carrying the real play literals — so it stays off
// every pure-test path. UNLIKE `browseShelf` there is no persistence and no clock: the shelf is
// a pure READ (no `.vend/*` cache, no freshness marker to stamp). All the real work is the pure
// `shelfRows` → `renderShelf`; this only wires the I/O around them.
//
// THE SIX PLAYS are enumerated as an explicit list of the registered literals (not via the
// registry, which exposes `names()`/`get()` but no `values()`): the same import cost as
// side-effect registration, but a DETERMINISTIC display order and a single, typed place a
// seventh play is added. Order is leverage-descending so the keystone leads and the leaf trails
// (renderShelf preserves input order — ranking is the shell's concern, the menu.ts split).

import type { AnyPlay } from "../engine/play.ts";
import { loadRunLog } from "../log/run-log.ts";
import { decomposeEpicPlay } from "../play/decompose-epic.ts";
import { expandFragmentPlay } from "../play/expand-fragment.ts";
import { captureNotePlay } from "../play/note.ts";
import { proposeEpicPlay } from "../play/propose-epic.ts";
import { steerProjectPlay } from "../play/steer.ts";
import { surveyPlay } from "../play/survey.ts";
import { renderShelf, shelfRows } from "./shelf-row.ts";

/** The authored playbooks the shelf displays, leverage-descending (keystone → leaf). The single
 *  place a new play joins the supply catalog. Each is a registered {@link AnyPlay} literal. */
const SHELF_PLAYS: readonly AnyPlay[] = [
  decomposeEpicPlay,
  surveyPlay,
  steerProjectPlay,
  proposeEpicPlay,
  expandFragmentPlay,
  captureNotePlay,
];

/** Options for {@link shelfText} — `path` overrides the ledger location (the `loadRunLog`
 *  testability seam). The CLI calls with none (the default `.vend/runs.jsonl`). */
export interface ShelfTextOptions {
  readonly path?: string;
}

/**
 * Gather the supply shelf and render it. The IMPURE orchestrator the `vend shelf` arm calls:
 * read the ledger (a missing one is a clean empty — a cold project simply shows every row as
 * `default`), pair each authored play with its warranted envelope (`shelfRows`), and render
 * (`renderShelf`). Returns the ready-to-print string; printing/exit is the CLI shell's job.
 */
export async function shelfText(opts: ShelfTextOptions = {}): Promise<string> {
  const { records } = await loadRunLog(opts.path ? { path: opts.path } : {});
  return renderShelf(shelfRows(SHELF_PLAYS, records));
}
