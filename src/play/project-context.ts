// Assemble the three inputs DecomposeEpic(epic, charter, project) wants (T-002-03).
//
// The clearing function is steered by THREE strings: the epic (intent), the charter
// (the value function — the bounds gate greps it for live P#/N# ids, so it must be
// the REAL charter), and a thin "go-and-see" project snapshot (clear against what IS,
// charter criterion 2 / vision's go-and-see). This module builds them.
//
// PURITY (house pattern): `buildProjectSnapshot` is PURE — given the gathered parts it
// formats a stable, deterministic string, so its shape is test-pinned. `assembleInputs`
// is the IMPURE verb (reads the epic + charter files, walks src/, lists ids) and is not
// unit-tested — its logic is the pure formatter plus thin fs reads.

import { readFile, readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";

/** Default charter location (the real value function the bounds gate greps). */
export const CHARTER_PATH = "docs/knowledge/charter.md";

/** Where to read the inputs from. `projectRoot` defaults to cwd. */
export interface ContextSources {
  readonly epicPath: string;
  readonly charterPath?: string;
  readonly projectRoot?: string;
}

/** The three rendered strings handed to `b.request.DecomposeEpic`. */
export interface DecomposeInputs {
  readonly epic: string;
  readonly charter: string;
  readonly project: string;
}

/** The raw parts of a project snapshot, gathered impurely and formatted purely. */
export interface SnapshotParts {
  readonly root: string;
  readonly srcFiles: readonly string[];
  readonly stories: readonly string[];
  readonly tickets: readonly string[];
}

/**
 * Format a thin go-and-see snapshot of the project's current state. PURE. Sorted
 * lists so the output is deterministic (a stable prompt input = reproducible runs);
 * relative paths only (no absolute-path leakage into the model context). Kept
 * deliberately light — a listing, not the file contents (overproduced context is
 * waste, charter criterion 1).
 */
export function buildProjectSnapshot(parts: SnapshotParts): string {
  const sorted = (xs: readonly string[]): string[] => [...xs].sort();
  const list = (xs: readonly string[]): string => (xs.length ? sorted(xs).map((x) => `- ${x}`).join("\n") : "- (none)");
  return [
    `# Project snapshot — ${parts.root}`,
    "",
    "## Source modules (src/**)",
    list(parts.srcFiles),
    "",
    "## Existing stories",
    list(parts.stories),
    "",
    "## Existing tickets",
    list(parts.tickets),
    "",
  ].join("\n");
}

/** Recursively list files under `dir`, returned as paths relative to `root`. Returns
 *  `[]` when `dir` is absent (a fresh project), never throws on a missing tree. */
async function listFilesRel(root: string, dir: string): Promise<string[]> {
  const abs = join(root, dir);
  let entries: Dirent[];
  try {
    entries = await readdir(abs, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFilesRel(root, rel)));
    else out.push(rel);
  }
  return out;
}

/**
 * List the `*.md` ids (basename without extension) directly under `dir`. Tolerates a
 * missing dir (a fresh board) → `[]`, never throws. EXPORTED so the materialize
 * cross-board collision guard (T-004-02) reuses the exact listing the snapshot uses,
 * pointed at its own full target dirs.
 */
export async function listIdsIn(dir: string): Promise<string[]> {
  try {
    const entries: string[] = await readdir(dir);
    return entries.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
  } catch {
    return [];
  }
}

/** List the `*.md` ids directly under a docs dir, relative to `root`. Delegates to
 *  {@link listIdsIn} so the snapshot and the materialize guard share one listing. */
async function listIds(root: string, dir: string): Promise<string[]> {
  return listIdsIn(join(root, dir));
}

/**
 * Read + assemble the three DecomposeEpic inputs. The IMPURE verb. Reads the epic and
 * charter files verbatim (the charter MUST be the real one — bounds gate greps it),
 * gathers a thin snapshot via the directory walk, and formats it with the pure helper.
 */
export async function assembleInputs(src: ContextSources): Promise<DecomposeInputs> {
  const root = src.projectRoot ?? process.cwd();
  const charterPath = src.charterPath ?? join(root, CHARTER_PATH);

  const [epic, charter] = await Promise.all([
    readFile(src.epicPath, "utf8"),
    readFile(charterPath, "utf8"),
  ]);

  const [srcFiles, stories, tickets] = await Promise.all([
    listFilesRel(root, "src"),
    listIds(root, "docs/active/stories"),
    listIds(root, "docs/active/tickets"),
  ]);

  const project = buildProjectSnapshot({ root, srcFiles, stories, tickets });
  return { epic, charter, project };
}
