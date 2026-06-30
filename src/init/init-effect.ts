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

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  availableTemplates,
  isLisaProject,
  isStandaloneTemplate,
  mergeManifests,
  planInit,
  resolveTemplate,
  SCAFFOLD_MANIFEST,
  type ScaffoldEntry,
} from "./init-core.ts";

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

/** The outcome of the refuse-or-apply composition (T-040-03; template overlay T-058-01): a typed
 *  andon when the root is not a lisa project OR when a named template is unknown (clean refusals —
 *  DATA, nothing written), or the scaffold's apply result. The CLI maps `not-lisa`/`unknown-template`
 *  to a fix-it hint + a non-zero exit; `scaffolded` to the tally + exit 0. The "a clean refusal
 *  returns data, a real fault throws" rule (cf. `pathExists`). `unknown-template` carries the
 *  available names so the refusal can name the valid set. */
export type InitOutcome =
  | { readonly kind: "not-lisa"; readonly root: string }
  | { readonly kind: "unknown-template"; readonly name: string; readonly available: readonly string[] }
  | { readonly kind: "scaffolded"; readonly result: InitApplyResult };

/**
 * Drive `vend init [--template <name>]` against `projectRoot`: REFUSE if a named `template` is
 * unknown, REFUSE if it is not a lisa project (UNLESS a STANDALONE template is named), else APPLY the
 * scaffold (base, plus the named template's overlay when given). This is the seam the init-effect.ts
 * header flagged for T-040-03, extended for the E-058 overlay (T-058-01) and the E-061 standalone
 * path (T-064-01) — the `isLisaProject` gate + the registry lookup composed with `applyInitScaffold`.
 * The CLI dispatch arm owns the user-facing hint strings and exit codes; this seam owns only the typed
 * branch, so both refusal paths are unit-testable (the `pressShelf`/`castWork`/`runPlay` returned-kind
 * discipline) rather than buried in the untested `import.meta.main` shell.
 *
 * STANDALONE (E-061, T-064-01): a brew-installed binary runs in an EMPTY dir with no checkout, where
 * the lisa gate would refuse. A template named in {@link isStandaloneTemplate} (e.g. `minimal`)
 * declares "make a fresh workspace HERE, no lisa project required" and BYPASSES the gate — so
 * `vend init --template minimal` lays the workspace into an empty, no-Doppler dir. A non-standalone
 * overlay (`hackathon`) still requires an existing lisa project (it overlays onto one). One-way-to-lisa
 * holds: the bypass relaxes only the GATE, it writes no lisa-owned file.
 *
 * ORDER (T-064-01): the template is resolved BEFORE the gate (the standalone bit needs the name
 * resolved). So an UNKNOWN template now refuses (`unknown-template`) ahead of the `not-lisa` gate —
 * an unknown name is a usage error independent of the directory, so the more specific arg error wins.
 * A KNOWN non-standalone template in a non-lisa dir still refuses as `not-lisa` (the gate runs next).
 *
 * The template OVERLAY rides the SAME writer: `applyInitScaffold` is called with the EFFECTIVE
 * manifest `mergeManifests(SCAFFOLD_MANIFEST, overlay)` — so the overlay's files are written through
 * the identical write-if-absent / no-clobber / `wx` path (the plan it reaches is exactly
 * `planTemplate(existing, base, overlay)`; for the empty `minimal` overlay that merge is the base
 * manifest unchanged). Honest-empty + one-way-to-lisa hold because the overlay names only vend-owned
 * paths and adds no demand row. An `unknown-template` refusal is checked BEFORE any apply, so it
 * writes NOTHING (parity with `not-lisa`). Bare `vend init` (no template) is the unchanged E-040 path.
 *
 * Detection reads ONLY the top-level entries (`readdir`) — both {@link LISA_MARKERS} are
 * project-ROOT files, so a recursive walk would be wasted work and could false-positive on a
 * nested marker. A `not-lisa` refusal writes NOTHING. A genuine `readdir` fault (anything but a
 * caller passing a missing root, which for the cwd cannot happen) propagates — never masked as
 * `not-lisa`. IMPURE.
 */
export async function runInit(projectRoot: string, template?: string): Promise<InitOutcome> {
  const entries = await readdir(projectRoot);
  // Resolve the template first (an unknown name is a usage error regardless of the directory) so the
  // gate below can honor a standalone template's workspace-making intent.
  let overlay: readonly ScaffoldEntry[] | undefined;
  if (template !== undefined) {
    overlay = resolveTemplate(template);
    if (!overlay) return { kind: "unknown-template", name: template, available: availableTemplates() };
  }
  // The gate: bare init AND non-standalone overlays require an existing lisa project (overlay onto a
  // checkout). A STANDALONE template (E-061) bypasses it — the brew binary's empty-dir path.
  const standalone = template !== undefined && isStandaloneTemplate(template);
  if (!standalone && !isLisaProject(entries)) return { kind: "not-lisa", root: projectRoot };
  const manifest = overlay ? mergeManifests(SCAFFOLD_MANIFEST, overlay) : SCAFFOLD_MANIFEST;
  return { kind: "scaffolded", result: await applyInitScaffold(projectRoot, manifest) };
}
