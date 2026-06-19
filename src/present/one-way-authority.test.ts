import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { loadWorkGraph } from "../graph/load.ts";
import { projectGraph } from "./project.ts";
import { DESIGNER_PRESET, DEV_PRESET } from "./spec.ts";
import { loadSeatSpec } from "./presets.ts";
import { classifyAuthorityViolations } from "./authority-guard.ts";

// T-021-07 — the RUNTIME half of one-way authority (the static half is authority-guard.test.ts).
// Snapshot docs/active/** byte-hashes, run the full READ path (load → project → render), and assert
// every source file is byte-identical afterward. "render" has no module yet (deferred TUI epic,
// T-021-05 review), so JSON.stringify(projection) is the honest stand-in — the byte-hash brackets
// the WHOLE pipeline regardless of what render becomes, so a real renderer inherits this guarantee.

/** Recursively SHA-256 every file under `root` → `relpath → hex`. Read-only; a missing dir → empty. */
async function hashTree(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) {
        out.set(relative(root, p), createHash("sha256").update(await readFile(p)).digest("hex"));
      }
    }
  }
  await walk(root);
  return out;
}

describe("one-way authority — docs/active is byte-unchanged by the read path", () => {
  const BOARD = "docs/active";

  test("load → project → render leaves every source file byte-identical", async () => {
    const before = await hashTree(BOARD);
    expect(before.size).toBeGreaterThan(0); // the board exists — not a vacuous pass

    // 1. load the live board (process.cwd() = repo root, the load.test.ts precedent).
    const graph = await loadWorkGraph();

    // 2. project under several specs (breadth: two presets + a regrouped spec) and 3. "render" each.
    const specs = [DESIGNER_PRESET, DEV_PRESET, { ...DESIGNER_PRESET, groupBy: "status" as const }];
    for (const spec of specs) {
      const rendered = JSON.stringify(projectGraph(graph, spec));
      expect(rendered.length).toBeGreaterThan(0); // the pipeline produced output
    }

    // 4. also drive the CALIBRATION read path (reads .vend, never the board) and project under it.
    const seatSpec = await loadSeatSpec("designer");
    expect(JSON.stringify(projectGraph(graph, seatSpec)).length).toBeGreaterThan(0);

    // 5. re-snapshot and assert byte-for-byte identical, naming any drift.
    const after = await hashTree(BOARD);
    const drift: string[] = [];
    for (const [path, hash] of before) {
      if (!after.has(path)) drift.push(`removed:${path}`);
      else if (after.get(path) !== hash) drift.push(`changed:${path}`);
    }
    for (const path of after.keys()) if (!before.has(path)) drift.push(`added:${path}`);
    expect(drift, `docs/active drifted during the read path: ${drift.join(", ")}`).toEqual([]);
  });

  test("the graph object is reference-unchanged and frozen after projection", async () => {
    const graph = await loadWorkGraph();
    const ticketsRef = graph.tickets;
    projectGraph(graph, DESIGNER_PRESET);
    expect(graph.tickets).toBe(ticketsRef); // no node re-allocated/mutated
    expect(Object.isFrozen(graph)).toBe(true);
  });

  test("the loader — the one module that names docs/active in code — imports no writer", async () => {
    const src = await readFile(join(import.meta.dir, "../graph/load.ts"), "utf8");
    // load.ts references docs/active in CODE (the default dirs) yet imports only readers → clean.
    expect(classifyAuthorityViolations([["load.ts", src]])).toEqual([]);
  });
});
