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

/** Default seed location — the root one-line intent doc `vend steer`/`survey` read into the
 *  snapshot (E-059). Root-relative; the impure verbs `join(root, …)` it (the `CHARTER_PATH` peer). */
export const SEED_PATH = "SEED.md";

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
  /** The seed's stated intent (root `SEED.md`), verbatim — the DELIBERATE exception to the
   *  snapshot's "names, not contents" rule (SEED *is* the intent doc, E-059). Optional: absent or
   *  blank/whitespace-only ⇒ no section ⇒ snapshot byte-identical to today (honest-empty preserved). */
  readonly intent?: string;
}

/**
 * Format a thin go-and-see snapshot of the project's current state. PURE. Sorted
 * lists so the output is deterministic (a stable prompt input = reproducible runs);
 * relative paths only (no absolute-path leakage into the model context). Kept
 * deliberately light — a listing, not the file contents (overproduced context is
 * waste, charter criterion 1). The ONE exception is the `intent` section: SEED *is* the
 * intent doc, so its content is emitted verbatim (E-059) — present only when `intent` is
 * non-blank, so an absent/blank intent leaves the snapshot byte-identical (honest-empty).
 */
export function buildProjectSnapshot(parts: SnapshotParts): string {
  const sorted = (xs: readonly string[]): string[] => [...xs].sort();
  const list = (xs: readonly string[]): string => (xs.length ? sorted(xs).map((x) => `- ${x}`).join("\n") : "- (none)");
  const intent = parts.intent?.trim();
  return [
    `# Project snapshot — ${parts.root}`,
    "",
    ...(intent ? ["## Stated intent (SEED.md)", "", intent, ""] : []),
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

/** An epic on the board paired with its frontmatter title — the unit
 *  {@link listEpicIdTitlesIn} yields and {@link import("./id-guard.ts").findExistingByTitle} reads. */
export interface EpicIdTitle {
  readonly id: string;
  readonly title: string;
}

/**
 * List each `*.md` on the board paired with its frontmatter `title:` (T-043-01) — the titled sibling
 * of {@link listIdsIn}, for the propose-epic effect's title-keyed adoption guard. `id` is the
 * BASENAME (so `pairs.map(p => p.id)` is byte-identical to {@link listIdsIn} — the new-title mint
 * path is unchanged), and `title` is greped from the file with the `epicIdOf` regex aimed at
 * `title:` (no YAML parser in the repo — frontmatter is string-matched), or `""` when absent.
 * Tolerates a missing dir → `[]` and skips an unreadable file, never throwing — the {@link listIdsIn}
 * discipline. `node:fs` only: this module imports no native addon, so the effect stays addon-free.
 */
export async function listEpicIdTitlesIn(dir: string): Promise<EpicIdTitle[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const out: EpicIdTitle[] = [];
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const id = name.slice(0, -3);
    let body: string;
    try {
      body = await readFile(join(dir, name), "utf8");
    } catch {
      continue;
    }
    const m = body.match(/^\s*title:\s*(\S+)/m);
    out.push({ id, title: m?.[1] ?? "" });
  }
  return out;
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
