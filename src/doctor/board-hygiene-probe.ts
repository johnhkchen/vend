// The `vend doctor` BOARD-HYGIENE probe (T-068-03-02, story S-068-03) — the thin impure
// shell that loads the canonical board and turns the pure orphan detector's finding into one
// doctor Check. It is deliberately separate from doctor-probe.ts: that probe also guards every
// cast through castPreflight, while orphan hygiene is a read-only `vend doctor` surface and must
// not prevent work that could repair a half-minted board.
//
// PURE CORE / IMPURE SHELL: graph/orphan.ts owns the orphan definition; doctor-core.ts owns the
// report and exit-code verdict. This module owns only the world read (`loadWorkGraph`) and the
// small graph-fact → Check bridge. Tests inject `loadGraph`, so both orphan and clean outcomes are
// proved with in-memory board facts and no filesystem dependency.
//
// NEVER THROWS: a corrupt or unreadable board becomes a red Check with a repair hint, just like
// doctor-probe's dependency failures. This probe reports only — it never deletes an epic or
// retries decompose (the story's explicit honest boundary).

import { failed, passed, type Check } from "./doctor-core.ts";
import { loadWorkGraph } from "../graph/load.ts";
import type { WorkGraph } from "../graph/model.ts";
import { findOrphanEpics } from "../graph/orphan.ts";

/** Stable prefix for the board-hygiene check and its loader-failure name. */
export const BOARD_HYGIENE_CHECK = "board hygiene";

/** The green board-hygiene check name. */
export const BOARD_HYGIENE_OK = `${BOARD_HYGIENE_CHECK}: no orphan epics`;

/** Injectable board backend. The default reads the canonical board beneath `process.cwd()`. */
export interface BoardHygieneProbeDeps {
  readonly loadGraph: () => Promise<WorkGraph>;
}

const DEFAULT_BOARD_HYGIENE_DEPS: BoardHygieneProbeDeps = {
  loadGraph: () => loadWorkGraph(),
};

/**
 * Turn a built board into its orphan-epic doctor check. PURE given `graph`: the graph module
 * remains the single source of the orphan definition; this bridge only supplies doctor wording.
 */
export function orphanEpicCheck(graph: WorkGraph): Check {
  const ids = findOrphanEpics(graph);
  if (ids.length === 0) return passed(BOARD_HYGIENE_OK);

  const subject = ids.length === 1 ? "orphan epic" : "orphan epics";
  const idList = ids.join(", ");
  return failed(
    `${BOARD_HYGIENE_CHECK}: ${subject} ${idList}`,
    `finish decomposing ${idList}, or remove the half-minted epic card only after verifying removal is safe`,
  );
}

/** Total conversion of any thrown value to a human-readable message. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Load and check the canonical board. Returns one ordered Check for easy composition with the
 * existing dependency probe. Any loader/parser/integrity fault is returned as a red check rather
 * than escaping as a stack trace.
 */
export async function probeBoardHygiene(
  deps: Partial<BoardHygieneProbeDeps> = {},
): Promise<Check[]> {
  const d: BoardHygieneProbeDeps = { ...DEFAULT_BOARD_HYGIENE_DEPS, ...deps };
  try {
    return [orphanEpicCheck(await d.loadGraph())];
  } catch (error) {
    return [
      failed(
        `${BOARD_HYGIENE_CHECK}: board readable`,
        `repair the board graph: ${messageOf(error)}`,
      ),
    ];
  }
}
