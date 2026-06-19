import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { loadWorkGraph } from "../graph/load.ts";
import { runCalibrationDemo, describeFlip } from "./calibration-demo.ts";

// T-021-08 — the CALIBRATION-LOOP DEMO. Composes load → spec/presets → project → paper into one
// turn of the loop and asserts its defining property: turn one knob, the projection + rendered
// paper change, while no docs/active markdown changes; reloading the saved preset reproduces the
// tuned render. Pure tests over a fabricated graph (the paper.test.ts mould) + the AC's live-board
// run bracketed by a docs/active byte-hash (the one-way-authority.test.ts mould).

// ── temp-dir plumbing (presets.test.ts precedent — never write the repo's .vend) ──────────────────

const tmpDirs: string[] = [];
async function freshDir(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "vend-calib-"));
  tmpDirs.push(d);
  return d;
}
afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true });
});

// ── docs/active byte-hash (one-way-authority.test.ts copy — the AC's teeth) ───────────────────────

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

/** Compare two hash trees → a human-readable list of added/removed/changed paths (empty == identical). */
function drift(before: Map<string, string>, after: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [path, hash] of before) {
    if (!after.has(path)) out.push(`removed:${path}`);
    else if (after.get(path) !== hash) out.push(`changed:${path}`);
  }
  for (const path of after.keys()) if (!before.has(path)) out.push(`added:${path}`);
  return out;
}

// ── fabricated frozen graph (paper.test.ts fixture) ───────────────────────────────────────────────

const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });
const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });
const story = (id: string, tickets: string[], status = "open"): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status, priority: "high", tickets });
const ticket = (
  id: string,
  story: string,
  fields: { status?: string; phase?: string; priority?: string; depends_on?: string[] } = {},
): RawNode =>
  raw(`${id}.md`, {
    id,
    story,
    title: `t-${id}`,
    type: "task",
    status: fields.status ?? "open",
    priority: fields.priority ?? "high",
    phase: fields.phase ?? "ready",
    depends_on: fields.depends_on ?? [],
  });

function miniGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001"), epic("E-002")],
    [story("S-001-01", ["T-001-01", "T-001-02"]), story("S-001-02", ["T-001-03"]), story("S-002-01", ["T-002-01"])],
    [
      ticket("T-001-01", "S-001-01", { status: "done", phase: "done" }),
      ticket("T-001-02", "S-001-01", { status: "open", priority: "low" }),
      ticket("T-001-03", "S-001-02", { status: "in-progress", priority: "critical" }),
      ticket("T-002-01", "S-002-01", { status: "open", priority: "medium", depends_on: ["T-001-03"] }),
    ],
  );
}

// ── unit: the loop over a fabricated graph ────────────────────────────────────────────────────────

describe("runCalibrationDemo — pure over a fabricated graph", () => {
  test("flips one knob (density low→full) and the rendered output differs (AC clause 1+2)", async () => {
    const dir = await freshDir();
    const d = await runCalibrationDemo({ graph: miniGraph(), presetsDir: dir });

    expect(d.knob).toEqual({ field: "density", from: "low", to: "full" });
    expect(d.baseSpec.density).toBe("low");
    expect(d.tunedSpec.density).toBe("full");
    expect(d.before).not.toBe(d.after); // re-render differs
    // the diff is visible in the self-describing preset header.
    expect(d.before).toContain("density: low");
    expect(d.after).toContain("density: full");
  });

  test("the knob reaches the projection IR, not just the rendered header", async () => {
    const dir = await freshDir();
    const d = await runCalibrationDemo({ graph: miniGraph(), presetsDir: dir });

    expect(d.baseProjection.density).toBe("low");
    expect(d.tunedProjection.density).toBe("full");
    expect(JSON.stringify(d.baseProjection)).not.toBe(JSON.stringify(d.tunedProjection));
  });

  test("reloading the saved preset reproduces the tuned render (AC clause 3)", async () => {
    const dir = await freshDir();
    const d = await runCalibrationDemo({ graph: miniGraph(), presetsDir: dir });

    expect(d.reloadedSpec).toEqual(d.tunedSpec); // save → load round-trips at the value level
    expect(d.reproduced).toBe(d.after); // and the rebuilt render is byte-identical to the tuned one
  });

  test("the tuned preset is saved OUTSIDE docs/active", async () => {
    const dir = await freshDir();
    const d = await runCalibrationDemo({ graph: miniGraph(), presetsDir: dir });

    expect(d.savedPath.startsWith(dir)).toBe(true);
    expect(d.savedPath).not.toContain("docs/active");
    expect(d.savedPath.endsWith(join("designer.yaml"))).toBe(true);
  });

  test("deterministic: same graph + dir → identical tuned render (P5)", async () => {
    const dir = await freshDir();
    const graph = miniGraph();
    const a = await runCalibrationDemo({ graph, presetsDir: dir });
    const b = await runCalibrationDemo({ graph, presetsDir: dir });
    expect(b.after).toBe(a.after);
    expect(b.reproduced).toBe(a.reproduced);
  });

  test("describeFlip summarizes the turn", async () => {
    const dir = await freshDir();
    const d = await runCalibrationDemo({ graph: miniGraph(), presetsDir: dir });
    expect(describeFlip(d)).toBe("designer · density: low → full · view changed, docs/active untouched");
  });
});

// ── AC: the loop over the LIVE board, proving docs/active is byte-unchanged ────────────────────────

describe("T-021-08 — AC (live board)", () => {
  const BOARD = "docs/active";

  test("turning the knob changes the view while no docs/active markdown changes", async () => {
    const graph = await loadWorkGraph();
    expect(graph.tickets.length).toBeGreaterThan(0); // a real board, not a vacuous pass

    const before = await hashTree(BOARD);
    expect(before.size).toBeGreaterThan(0);

    const dir = await freshDir(); // tuned preset goes to a throwaway dir, never the repo's .vend
    const d = await runCalibrationDemo({ graph, presetsDir: dir });

    // the view changed …
    expect(d.before).not.toBe(d.after);
    // … reloading the saved preset reproduces the tuned render …
    expect(d.reloadedSpec).toEqual(d.tunedSpec);
    expect(d.reproduced).toBe(d.after);

    // … and not one docs/active byte moved (the one-way-authority teeth).
    const after = await hashTree(BOARD);
    const moved = drift(before, after);
    expect(moved, `docs/active drifted during the calibration loop: ${moved.join(", ")}`).toEqual([]);
  });
});
