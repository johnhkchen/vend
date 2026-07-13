import { describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { buildGraph, type RawNode, type WorkGraph } from "../graph/model.ts";
import { loadWorkGraph } from "../graph/load.ts";
import { DESIGNER_PRESET } from "./spec.ts";
import { projectGraph } from "./project.ts";
import { projectionToSvg } from "./projection-svg.ts";
import { faceJargon } from "./translate.ts";
import { classifyAuthorityViolations } from "./authority-guard.ts";
import {
  boardSvgPath,
  writeBoardSvg,
  DEFAULT_SVG_DIR,
  DEFAULT_SVG_FILENAME,
} from "./svg-file.ts";

// T-055-03 — the SVG FILE-OUTPUT SEAM (the FOURTH composition over the E-021 Projection IR). Pure,
// no-live-model tests: every case injects a fabricated `graph` (via buildGraph, the
// projection-svg.test.ts mould) and a temp `outDir` (via mkdtemp, the expand-effect.test.ts mould),
// so no test touches the repo's real `.vend` or board. We prove the three AC teeth:
//   (1) running the seam writes a valid `.svg` (one swimlane/group, one box/card, one edge/link),
//   (2) the authority-guard build gate stays green — the write lands under `.vend`, never docs/active,
//       and a real live-board run leaves docs/active byte-identical, and
//   (3) the loaded graph object is reference-unchanged after the seam.

// ── fixtures: a genuine frozen projection via buildGraph (the projection-svg.test.ts mould) ────────

const raw = (file: string, data: Record<string, unknown>, body = ""): RawNode => ({ data, body, file });
const epic = (id: string): RawNode => raw(`${id}.md`, { id, title: `e-${id}`, status: "open", advances: ["P1"] });
const story = (id: string, tickets: string[], status = "open"): RawNode =>
  raw(`${id}.md`, { id, title: `s-${id}`, type: "story", status, priority: "high", tickets });
const ticket = (
  id: string,
  storyId: string,
  fields: { status?: string; phase?: string; priority?: string; depends_on?: string[] } = {},
): RawNode =>
  raw(`${id}.md`, {
    id,
    story: storyId,
    title: `t-${id}`,
    type: "task",
    status: fields.status ?? "open",
    priority: fields.priority ?? "high",
    phase: fields.phase ?? "ready",
    depends_on: fields.depends_on ?? [],
  });

// 2 epics → 3 stories → 5 tickets, ONE cross-story dep (T-002-01 → T-001-03) → exactly 1 link.
function miniGraph(): WorkGraph {
  return buildGraph(
    [epic("E-001"), epic("E-002")],
    [
      story("S-001-01", ["T-001-01", "T-001-02"]),
      story("S-001-02", ["T-001-03"]),
      story("S-002-01", ["T-002-01", "T-002-02"]),
    ],
    [
      ticket("T-001-01", "S-001-01", { status: "done", phase: "done" }),
      ticket("T-001-02", "S-001-01", { status: "open", priority: "low" }),
      ticket("T-001-03", "S-001-02", { status: "in-progress", priority: "critical" }),
      ticket("T-002-01", "S-002-01", { status: "open", priority: "medium", depends_on: ["T-001-03"] }),
      ticket("T-002-02", "S-002-01", { status: "done", phase: "done", priority: "low" }),
    ],
  );
}

const emptyGraph = (): WorkGraph => buildGraph([], [], []);

/** A throwaway outDir — the seam creates it on demand (the expand-effect.test.ts seedRoot idiom). */
async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-svg-file-"));
}

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const countOf = (s: string, re: RegExp): number => s.match(re)?.length ?? 0;

// ── AC tooth #1 — the seam writes a valid .svg (swimlane/group, box/card, edge/link) ───────────────

describe("writeBoardSvg — writes a valid .svg from the projected board", () => {
  test("writes the file at the chosen path, content === the returned svg", async () => {
    const dir = await tempDir();
    try {
      const graph = miniGraph();
      const result = await writeBoardSvg({ graph, outDir: dir });

      const expected = join(dir, DEFAULT_SVG_FILENAME);
      expect(result.path).toBe(expected);
      expect(result.path).toBe(boardSvgPath(dir));
      expect(await exists(expected)).toBe(true);

      const written = await readFile(expected, "utf8");
      expect(written).toBe(result.svg);
      expect(written.startsWith("<svg")).toBe(true);
      expect(written.trimEnd().endsWith("</svg>")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("one <rect> per card, one <line> per link, counts match the projection", async () => {
    const dir = await tempDir();
    try {
      const graph = miniGraph();
      const projection = projectGraph(graph, DESIGNER_PRESET);
      const cards = projection.groups.reduce((n, g) => n + g.cards.length, 0);

      const result = await writeBoardSvg({ graph, outDir: dir });
      expect(result.cardCount).toBe(cards); // 5 tickets → 5 cards
      expect(result.linkCount).toBe(projection.links.length); // exactly 1 cross-story dep
      expect(result.groupCount).toBe(projection.groups.length);

      expect(countOf(result.svg, /<rect\b/g)).toBe(cards);
      expect(countOf(result.svg, /<line\b/g)).toBe(projection.links.length);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the written bytes equal the direct render — the seam adds no rendering of its own", async () => {
    const dir = await tempDir();
    try {
      const graph = miniGraph();
      const direct = projectionToSvg(projectGraph(graph, DESIGNER_PRESET));
      const result = await writeBoardSvg({ graph, outDir: dir, seat: "designer" });
      expect(result.svg).toBe(direct);
      // determinism: a second run is byte-identical.
      const again = await writeBoardSvg({ graph, outDir: dir, seat: "designer" });
      expect(again.svg).toBe(direct);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("an accessible title threads through to a <title> element; absent → none", async () => {
    const dir = await tempDir();
    try {
      const graph = miniGraph();
      const titled = await writeBoardSvg({ graph, outDir: dir, title: "Vend board" });
      expect(titled.svg).toContain("<title>Vend board</title>");
      const bare = await writeBoardSvg({ graph, outDir: dir });
      expect(bare.svg).not.toContain("<title>");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("honest-empty: an empty board writes a minimal valid <svg>, cardCount 0, no throw", async () => {
    const dir = await tempDir();
    try {
      const result = await writeBoardSvg({ graph: emptyGraph(), outDir: dir });
      expect(result.cardCount).toBe(0);
      expect(result.linkCount).toBe(0);
      expect(await exists(result.path)).toBe(true);
      expect(result.svg).toContain("<svg");
      expect(result.svg.trimEnd().endsWith("</svg>")).toBe(true);
      expect(countOf(result.svg, /<rect\b/g)).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the seat selects the spec: dev (groupBy epic) differs from designer (groupBy status)", async () => {
    const dir = await tempDir();
    try {
      const graph = miniGraph();
      const designer = await writeBoardSvg({ graph, outDir: dir, seat: "designer" });
      const dev = await writeBoardSvg({ graph, outDir: dir, seat: "dev" });
      expect(dev.svg).not.toBe(designer.svg); // a different grouping → a different render
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("default dir/filename constants compose to the canonical path", () => {
    expect(boardSvgPath()).toBe(join(DEFAULT_SVG_DIR, DEFAULT_SVG_FILENAME));
    expect(boardSvgPath()).toBe(join(".vend", "work-graph.svg"));
  });
});

// ── AC tooth #3 — the loaded graph object is reference-unchanged after the seam ────────────────────

describe("writeBoardSvg — one-way authority: the graph is untouched", () => {
  test("graph.tickets is the same reference and the graph stays frozen", async () => {
    const dir = await tempDir();
    try {
      const graph = miniGraph();
      const ticketsRef = graph.tickets;
      await writeBoardSvg({ graph, outDir: dir });
      expect(graph.tickets).toBe(ticketsRef); // no node re-allocated/mutated
      expect(Object.isFrozen(graph)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

// ── AC tooth #2 — the build gate stays green: writes the staged artifact, never docs/active ────────

/** Recursively SHA-256 every file under `root` → `relpath → hex` (the one-way-authority.test.ts
 *  bracket). Read-only; a missing dir → empty. */
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
      else if (e.isFile()) out.set(relative(root, p), createHash("sha256").update(await readFile(p)).digest("hex"));
    }
  }
  await walk(root);
  return out;
}

describe("writeBoardSvg — the seam writes the staged artifact, never docs/active", () => {
  test("a real live-board run leaves docs/active byte-identical and writes under the temp dir", async () => {
    const dir = await tempDir();
    try {
      const before = await hashTree("docs/active");
      expect(before.size).toBeGreaterThan(0); // the board exists — not a vacuous pass

      // No injected graph → loadWorkGraph reads the LIVE board (the one-way-authority.test.ts path).
      const result = await writeBoardSvg({ outDir: dir });

      const after = await hashTree("docs/active");
      const drift: string[] = [];
      for (const [path, hash] of before) {
        if (!after.has(path)) drift.push(`removed:${path}`);
        else if (after.get(path) !== hash) drift.push(`changed:${path}`);
      }
      for (const path of after.keys()) if (!before.has(path)) drift.push(`added:${path}`);
      expect(drift, `docs/active drifted during the seam run: ${drift.join(", ")}`).toEqual([]);

      // the artifact landed under the temp .vend-style dir, NOT under docs/active.
      expect(result.path.startsWith(dir)).toBe(true);
      expect(result.path).not.toContain("docs/active");
      expect(await exists(result.path)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the default vend svg collapses the live board to a glanceable handful of status groups, not ~62 (T-056-01)", async () => {
    const dir = await tempDir();
    try {
      // Default seat = designer = the coarse `status` axis, over the LIVE board (no injected graph).
      const result = await writeBoardSvg({ outDir: dir });
      expect(result.groupCount).toBeLessThanOrEqual(6); // a handful of columns, not a strip

      // Non-vacuous: the SAME live board under the old `story` axis is far wider — proving the
      // collapse is real, not an artifact of an empty/tiny board.
      const live = await loadWorkGraph();
      const storyGroups = projectGraph(live, { ...DESIGNER_PRESET, groupBy: "story" }).groups.length;
      expect(storyGroups).toBeGreaterThan(6); // the strip was genuinely wide (guards the comparison)
      expect(result.groupCount).toBeLessThan(storyGroups);

      // Observable in the written artifact.
      expect(await exists(result.path)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("the live board cast through DESIGNER_PRESET has no card-face jargon", async () => {
    const projection = projectGraph(await loadWorkGraph(), DESIGNER_PRESET);
    const leaks = projection.groups.flatMap((group) =>
      group.cards.flatMap(({ card }) => {
        const jargon = faceJargon(card);
        return jargon.length ? [{ id: card.id, jargon }] : [];
      }),
    );

    expect(leaks).toEqual([]);
  });

  test("static reflex: the seam's own source is authority-guard clean (writes .vend, never names docs/active in code)", async () => {
    const src = await readFile(join(import.meta.dir, "svg-file.ts"), "utf8");
    // It imports writeFile/mkdir (a writer) but references docs/active only in its header comment,
    // which the guard strips — so the conjunction (writer AND docs/active in code) is never met.
    expect(classifyAuthorityViolations([["svg-file.ts", src]])).toEqual([]);
  });
});
