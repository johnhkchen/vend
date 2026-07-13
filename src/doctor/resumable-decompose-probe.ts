// The `vend doctor` RESUMABLE-DECOMPOSE probe (T-077-04-03, story S-077-04) — a
// read-only recovery surface over the active decompose draft store. It remains separate from
// doctor-probe.ts because that dependency probe also guards casts: resumable state must make
// doctor red without blocking the cast that can resume it.
//
// PURE CORE / IMPURE SHELL: decompose-draft.ts owns persistence and active-state reconciliation;
// doctor-core.ts owns rendering and exit codes. This module only maps readable draft facts to
// Checks and injects the loader for filesystem-free tests. It never repairs, resumes, or clears.

import {
  loadDecomposeDrafts,
  type DecomposeDraftRecord,
  type ReadDecomposeDraftsResult,
} from "../engine/decompose-draft.ts";
import { failed, passed, type Check } from "./doctor-core.ts";

/** Stable prefix shared by active, empty, and loader-failure checks. */
export const RESUMABLE_DECOMPOSE_CHECK = "resumable-decompose";

/** The green recovery-state check name. */
export const RESUMABLE_DECOMPOSE_OK = `${RESUMABLE_DECOMPOSE_CHECK}: no drafts`;

/** Injectable draft backend. The default reads the project-local store beneath process cwd. */
export interface ResumableDecomposeProbeDeps {
  readonly loadDrafts: () => Promise<ReadDecomposeDraftsResult>;
}

const DEFAULT_RESUMABLE_DECOMPOSE_DEPS: ResumableDecomposeProbeDeps = {
  loadDrafts: () => loadDecomposeDrafts(),
};

function resumeCommand(epic: string): string {
  return `vend run decompose-epic ${epic} --resume`;
}

/** Select the latest appended active record per epic, retaining representative append order. */
function latestPerEpic(
  records: readonly DecomposeDraftRecord[],
): readonly DecomposeDraftRecord[] {
  const seen = new Set<string>();
  const latest: DecomposeDraftRecord[] = [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record === undefined || seen.has(record.epic)) continue;
    seen.add(record.epic);
    latest.push(record);
  }
  return latest.reverse();
}

/** PURE conversion of active draft facts into actionable doctor checks. */
export function resumableDecomposeChecks(
  records: readonly DecomposeDraftRecord[],
): Check[] {
  const drafts = latestPerEpic(records);
  if (drafts.length === 0) return [passed(RESUMABLE_DECOMPOSE_OK)];

  return drafts.map(({ epic }) =>
    failed(
      `${RESUMABLE_DECOMPOSE_CHECK}: ${epic}`,
      `resume with \`${resumeCommand(epic)}\``,
    )
  );
}

/** Total conversion of any thrown value to a human-readable diagnostic. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Load the active draft view and return ordered recovery checks. A store read fault is diagnostic
 * data rather than a rejection, so the CLI renders one actionable red line without a stack trace.
 */
export async function probeResumableDecompose(
  deps: Partial<ResumableDecomposeProbeDeps> = {},
): Promise<Check[]> {
  const d: ResumableDecomposeProbeDeps = {
    ...DEFAULT_RESUMABLE_DECOMPOSE_DEPS,
    ...deps,
  };
  try {
    const { records } = await d.loadDrafts();
    return resumableDecomposeChecks(records);
  } catch (error) {
    return [
      failed(
        `${RESUMABLE_DECOMPOSE_CHECK}: drafts readable`,
        `repair the decompose draft store: ${messageOf(error)}`,
      ),
    ];
  }
}
