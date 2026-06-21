// The `vend init` scaffold's WRITE EFFECT (T-040-02, story S-040-01, epic E-040) — the
// thin impure shell that APPLIES a plan the pure core (init-core.ts, T-040-01) produces.
//
// THE CENTRAL RULE (mirrors src/play/propose-effect.ts): the converge *logic* lives in
// init-core.ts — addon-free, committed, unit-tested. This module is the world-touching
// verb: scan which manifest paths exist, ask `planInit` for the create-vs-skip set, then
// materialize the `creates`. Re-opening the reviewed pure core to bolt on an fs verb is
// exactly what the pure/impure split exists to prevent, so the effect lives HERE.
//
// ADDON-FREE but IMPURE: imports only `node:fs/promises`, `node:path`, and the pure core.
// No BAML, no engine, no addon — so init-effect.test.ts exercises it as an ordinary
// `bun test` against a real temp-dir projectRoot (the propose-effect.ts discipline).
//
// NO-CLOBBER IS ABSOLUTE (the headline AC, E-040 A5): a pre-existing file ends
// byte-identical; a second apply adds no files and changes none. Two layers enforce it:
//   (1) the plan — `planInit` marks a present path `skip`; we write only `plan.creates`;
//   (2) the write — dirs via `mkdir({recursive:true})` (an existing dir is a silent no-op)
//       and files via the EXCLUSIVE `wx` flag (O_CREAT|O_EXCL). An EEXIST (a file that
//       appeared in the window between scan and write, or two concurrent applies racing)
//       is caught, the existing file left untouched, and the entry reclassified
//       create→skip. We NEVER read-modify-write or truncate an existing file.
// A genuine fs failure (anything but EEXIST/ENOENT) propagates — the house "a real fault
// throws, a clean refusal returns data" rule (captureNoteEffect / proposeEpicEffect).
//
// ONE-WAY TO LISA (E-040): the effect writes ONLY manifest (vend-owned) paths, so it never
// mutates a lisa-owned file (the root `.gitignore` etc.). The `isLisaProject` refusal +
// fix-it hint is the CLI's composition (T-040-03 init-cli-command), not this seam.

import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { planInit, SCAFFOLD_MANIFEST, type ScaffoldEntry } from "./init-core.ts";

/** The outcome of an apply: the manifest-relative POSIX paths created, and those skipped
 *  (already present, left byte-identical). The CLI (T-040-03) reports these as "created N,
 *  skipped M"; the test asserts on them. Slim by design — this is not a play, so it does
 *  NOT borrow the engine's `EffectResult` (no cast loop consumes it). */
export interface InitApplyResult {
  readonly created: readonly string[];
  readonly skipped: readonly string[];
}

/** Does this path already exist? `stat` → true; an ENOENT (not there) → false; any other
 *  fs error propagates (a real fault — never swallowed). The single place the scan decides
 *  "is this manifest path present", feeding `planInit`'s `existing` set. The uniform house
 *  ENOENT idiom (src/present/presets.ts, src/log/run-log.ts, src/graph/load.ts). */
async function pathExists(abs: string): Promise<boolean> {
  try {
    await stat(abs);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}

/**
 * Apply the vend scaffold to `projectRoot`, write-if-absent, never clobbering. Scans which
 * manifest paths already exist, asks the pure {@link planInit} for the create-vs-skip set,
 * then materializes only the `creates` — dirs via recursive mkdir, files via the exclusive
 * `wx` flag. Reports back the created/skipped manifest-relative paths as DATA.
 *
 * Idempotent (A5): a bare root → the full tree created; a fully-scaffolded root → zero
 * creates, all skips; a partial root → only the gap. A pre-existing file is left
 * byte-identical (the plan skips it; the `wx` flag is the TOCTOU-safe net if it appears
 * late). The `manifest` defaults to {@link SCAFFOLD_MANIFEST}; tests pass a focused fixture.
 */
export async function applyInitScaffold(
  projectRoot: string,
  manifest: readonly ScaffoldEntry[] = SCAFFOLD_MANIFEST,
): Promise<InitApplyResult> {
  // 1. Scan: which manifest paths already exist on disk.
  const existing: string[] = [];
  for (const entry of manifest) {
    if (await pathExists(join(projectRoot, entry.path))) existing.push(entry.path);
  }

  // 2. Plan: the single source of the create-vs-skip decision (no re-implementation here).
  const plan = planInit(existing, manifest);

  // 3. Apply only the creates; the skips are already untouched-by-construction.
  const created: string[] = [];
  const skipped: string[] = [...plan.skips];
  for (const entry of plan.creates) {
    const abs = join(projectRoot, entry.path);
    if (entry.kind === "dir") {
      await mkdir(abs, { recursive: true });
      created.push(entry.path);
      continue;
    }
    // file — ensure the parent exists (defense-in-depth against a future manifest reorder),
    // then write EXCLUSIVELY. An EEXIST means it appeared after the scan: keep it, skip it.
    await mkdir(dirname(abs), { recursive: true });
    try {
      await writeFile(abs, entry.contents, { flag: "wx" });
      created.push(entry.path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") {
        skipped.push(entry.path);
        continue;
      }
      throw e;
    }
  }

  return { created, skipped };
}
