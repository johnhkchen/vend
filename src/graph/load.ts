// The work-graph LOADER — the IMPURE verb that feeds the pure model core (T-021-01, story
// S-021-01, epic E-021). Split from model.ts for the house testability reason (cf.
// materialize.ts / survey-effect.ts): all judgment — parsing, linking, integrity, freezing —
// lives in the pure model.ts (testable with string fixtures, no fs); the ONE world-touching
// verb lives HERE. This is the only file in the loader that touches the filesystem.
//
// READ-ONLY BY CONSTRUCTION (E-021's one-way-authority invariant, the ticket's "exposes no
// write path"): this module imports `readdir`/`readFile` ONLY — never `writeFile`/`mkdir`. The
// projection reads the canonical board through this verb and there is structurally no path back
// to it.
//
// TOLERANT of a partly-scaffolded board: a missing directory reads as empty (the
// project-context.ts ENOENT→[] precedent), so the loader works on a fresh project. It skips the
// epic `TEMPLATE.md` (a placeholder, id E-000) and any file whose frontmatter has no `id`, so
// only real nodes ever reach buildGraph. It does NOT reuse project-context.listIdsIn — that
// returns ids, and we need full file bodies (the projection reads Context/ACs from the body) —
// the no-shared-util idiom: do the thin readdir here rather than couple to a wrong-shaped helper.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { buildGraph, parseFrontmatter } from "./model.ts";
import type { RawNode, WorkGraph } from "./model.ts";

/** Where the canonical board lives. All optional; defaults point at the repo's docs/active/**,
 *  redirectable so tests load a temp-dir fixture instead of the live board. */
export interface LoadOptions {
  readonly root?: string;
  readonly epicDir?: string;
  readonly storyDir?: string;
  readonly ticketDir?: string;
}

/** A file the loader ignores even though it ends in .md — the epic dir's frontmatter template. */
const SKIP_FILES = new Set(["TEMPLATE.md"]);

/** Read every real `*.md` node under `dir` into RawNodes. Tolerates a missing dir → [] (a fresh
 *  board never throws). Skips TEMPLATE.md and any file whose frontmatter carries no `id` (a
 *  non-node/placeholder), so only real nodes reach the builder. */
async function readNodes(dir: string): Promise<RawNode[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const out: RawNode[] = [];
  for (const name of names) {
    if (!name.endsWith(".md") || SKIP_FILES.has(name)) continue;
    const raw = parseFrontmatter(await readFile(join(dir, name), "utf8"), name);
    if (typeof raw.data["id"] !== "string") continue;
    out.push(raw);
  }
  return out;
}

/**
 * Load the canonical epic→story→ticket board into one typed, deeply-frozen WorkGraph. The single
 * impure verb: it reads the three docs/active/** dirs and hands the raw files to the pure
 * {@link buildGraph}, which links, validates referential integrity, and freezes. Returns a graph
 * with no write path. Propagates GraphParseError (a malformed file) / GraphIntegrityError (an
 * unresolved edge) from the builder unchanged — a corrupt board is a loud, typed refusal.
 */
export async function loadWorkGraph(opts: LoadOptions = {}): Promise<WorkGraph> {
  const root = opts.root ?? process.cwd();
  const epicDir = opts.epicDir ?? join(root, "docs/active/epic");
  const storyDir = opts.storyDir ?? join(root, "docs/active/stories");
  const ticketDir = opts.ticketDir ?? join(root, "docs/active/tickets");

  const [epics, stories, tickets] = await Promise.all([
    readNodes(epicDir),
    readNodes(storyDir),
    readNodes(ticketDir),
  ]);

  return buildGraph(epics, stories, tickets);
}
