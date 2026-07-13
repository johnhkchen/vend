// The bare-`vend` Home shell (T-031-02) — the IMPURE orchestrator that gathers the three DL-6 regions
// and composes them into the fused Home screen. The board LEADS (ranked demand pull), the shelf RECEDES
// beneath (authored supply), the ledger sits at the FOOT (E1 walk-away glance) — IA-1/DL-6.
//
// This is the convergence shell for E-031: it wires the pure board (gather.ts), shelf (shelf-row.ts),
// ledger (home.ts / walk-away.ts), and composer (home.ts `renderHome`) together. It does THREE things,
// in this order:
//   1. BOARD — browseShelf({ all }): rank the demand board, render it, and persist `.vend/menu.json`.
//      browseShelf stays THE SINGLE WRITER of that cache (the press contract `vend <sel>` resolves
//      against — T-003-04 / press.ts); we reuse its rendered `menu` verbatim as the board region and
//      never re-persist. `--all` reveals hidden board rows (board only).
//   2. SHELF + LEDGER — read the run log ONCE (loadRunLog) and fan the records to BOTH shelfRows
//      (warranted envelopes, E-030) and auditWalkAway → homeLedgerLine (the trust foot, E-028).
//   3. COMPOSE — renderHome({ boardMenu, shelfRows, ledger }) (the pure composer, T-031-01).
//
// IMPURE (the thin untested shell, cf. shelf.ts `shelfText` / gather.ts `browseShelf` / dispatch.ts):
// it reads files and VALUE-IMPORTS the six play modules via SHELF_PLAYS (which pull the BAML addon as a
// transitive cost of carrying the real play literals) — so it is kept OFF every pure-test path and is
// proven by smoke (the AC#3 live proof: `bun run src/cli.ts`), exactly like its siblings. All the real
// work is the pure browseShelf / shelfRows / homeLedgerLine / renderHome it composes; this only wires
// the I/O around them. Degrades gracefully: no demand.md → the board's plain empty-state guidance
// line; no run log → every shelf row `default` + the honest "no runs yet" foot. Instant,
// deterministic, no LLM — nothing is cast.

import { browseShelf, type BrowseOpts } from "./gather.ts";
import { loadRunLog } from "../log/run-log.ts";
import { auditWalkAway } from "../ledger/walk-away.ts";
import { shelfRows } from "./shelf-row.ts";
import { homeLedgerLine, renderHome } from "./home.ts";
import { SHELF_PLAYS } from "./shelf.ts";

/**
 * Options for {@link homeText}. `all` reveals hidden board rows (the board's `--all`, threaded into
 * browseShelf — the shelf/ledger are informational and unaffected). `projectRoot` + `runLogPath` are
 * the I/O testability seams; the CLI calls with none, so the defaults (cwd, `.vend/runs.jsonl`) apply,
 * matching today's `browseShelf({ all })`.
 */
export interface HomeTextOptions {
  /** Reveal blocked/leaf board rows otherwise hidden (board region only). */
  readonly all?: boolean;
  /** Project root for the board gather; defaults to `process.cwd()` (via browseShelf). */
  readonly projectRoot?: string;
  /** Override the run-log location (the loadRunLog seam). Default `.vend/runs.jsonl`. */
  readonly runLogPath?: string;
}

/**
 * Gather the three DL-6 Home regions and compose them into the fused Home screen. The IMPURE
 * orchestrator bare `vend` calls. Returns the ready-to-print string; printing + exit code are the CLI
 * shell's job. See the module header for the board/shelf/ledger flow and the single-writer / read-once
 * invariants. PURE-by-delegation: every decision is a pure helper (renderHome, shelfRows,
 * homeLedgerLine, browseShelf's cache fold); this shell only does the I/O.
 */
export async function homeText(opts: HomeTextOptions = {}): Promise<string> {
  // BOARD — ranks + renders + persists `.vend/menu.json` (the single cache writer; the press contract).
  // Reuse its rendered menu verbatim; never re-persist.
  const browseOpts: BrowseOpts = {
    all: opts.all ?? false,
    ...(opts.projectRoot ? { projectRoot: opts.projectRoot } : {}),
  };
  const { menu: boardMenu } = await browseShelf(browseOpts);

  // SHELF + LEDGER — read the run log ONCE, fan the records to both consumers (no double read).
  const { records } = await loadRunLog(opts.runLogPath ? { path: opts.runLogPath } : {});
  const ledger = homeLedgerLine(auditWalkAway(records));

  return renderHome({ boardMenu, shelfRows: shelfRows(SHELF_PLAYS, records), ledger });
}
