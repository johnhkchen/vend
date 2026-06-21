import { describe, expect, test } from "bun:test";
import {
  countDemandRows,
  isLisaProject,
  LISA_MARKERS,
  planInit,
  SCAFFOLD_MANIFEST,
  type ScaffoldEntry,
} from "./init-core.ts";

// T-040-01 init-core: the PURE scaffold manifest + converge planner + lisa predicate.
// Imports ONLY ./init-core.ts — no fs, no process, no BAML addon — so this is an ordinary
// pure-function test, the same discipline committed-core / work-core follow. The fs write
// effect and its guarded-live temp-dir test are T-040-02; nothing here touches disk.

/** Every path the full manifest will create — a "fully scaffolded" filesystem listing. */
const ALL_PATHS = SCAFFOLD_MANIFEST.map((e) => e.path);

describe("planInit — create-vs-skip set (AC clause 1)", () => {
  test("empty listing → full scaffold (every entry creates)", () => {
    const plan = planInit([]);
    expect(plan.creates.length).toBe(SCAFFOLD_MANIFEST.length);
    expect(plan.skips.length).toBe(0);
    expect(plan.actions.every((a) => a.op === "create")).toBe(true);
    // one action per manifest entry, in manifest order
    expect(plan.actions.length).toBe(SCAFFOLD_MANIFEST.length);
  });

  test("fully-scaffolded listing → zero creates (idempotent re-run)", () => {
    const plan = planInit(ALL_PATHS);
    expect(plan.creates.length).toBe(0);
    expect(plan.skips.length).toBe(SCAFFOLD_MANIFEST.length);
    expect(plan.actions.every((a) => a.op === "skip")).toBe(true);
    // a second plan over the same listing is identical — converge is stable
    expect(planInit(ALL_PATHS)).toEqual(plan);
  });

  test("partial listing → only the gap creates", () => {
    // a bare lisa project: markers + the top docs dirs exist, the rest does not
    const present = ["CLAUDE.md", ".lisa.toml", "docs/active", "docs/active/epic"];
    const plan = planInit(present);
    const createdPaths = plan.creates.map((e) => e.path);
    // present structural dirs are skipped...
    expect(plan.skips).toContain("docs/active");
    expect(plan.skips).toContain("docs/active/epic");
    expect(createdPaths).not.toContain("docs/active");
    // ...and absent entries are created
    expect(createdPaths).toContain("docs/active/demand.md");
    expect(createdPaths).toContain(".vend/.gitignore");
    expect(createdPaths).toContain("docs/archive/demand-cleared.md");
    // exactly the gap: creates + skips partition the manifest, no overlap, no loss
    expect(plan.creates.length + plan.skips.length).toBe(SCAFFOLD_MANIFEST.length);
    expect(plan.creates.length).toBe(SCAFFOLD_MANIFEST.length - 2);
  });

  test("trailing-slash / './' listing still matches the manifest (normalization)", () => {
    const present = ["docs/active/", "./.vend", "docs/archive/"];
    const plan = planInit(present);
    expect(plan.skips).toContain("docs/active");
    expect(plan.skips).toContain(".vend");
    expect(plan.skips).toContain("docs/archive");
    expect(plan.creates.map((e) => e.path)).not.toContain(".vend");
  });

  test("focused fixture manifest proves the create/skip partition", () => {
    const fixture: readonly ScaffoldEntry[] = [
      { kind: "dir", path: "a" },
      { kind: "file", path: "a/seed.md", contents: "hi" },
    ];
    const plan = planInit(["a"], fixture);
    expect(plan.skips).toEqual(["a"]);
    expect(plan.creates).toEqual([{ kind: "file", path: "a/seed.md", contents: "hi" }]);
  });
});

describe("isLisaProject (AC clause 2)", () => {
  test("CLAUDE.md present → true", () => {
    expect(isLisaProject(["CLAUDE.md", "README.md"])).toBe(true);
  });
  test(".lisa.toml present → true", () => {
    expect(isLisaProject([".lisa.toml", "src"])).toBe(true);
  });
  test("both markers present → true", () => {
    expect(isLisaProject(["CLAUDE.md", ".lisa.toml"])).toBe(true);
  });
  test("neither marker → false", () => {
    expect(isLisaProject(["README.md", "package.json", "src"])).toBe(false);
  });
  test("empty listing → false", () => {
    expect(isLisaProject([])).toBe(false);
  });
  test("normalized markers still detected (./CLAUDE.md)", () => {
    expect(isLisaProject(["./CLAUDE.md"])).toBe(true);
  });
  test("LISA_MARKERS is the documented contract", () => {
    expect([...LISA_MARKERS]).toEqual(["CLAUDE.md", ".lisa.toml"]);
  });
});

describe("zero demand rows (AC clause 3)", () => {
  const board = SCAFFOLD_MANIFEST.find((e) => e.path === "docs/active/demand.md");
  const archive = SCAFFOLD_MANIFEST.find((e) => e.path === "docs/archive/demand-cleared.md");

  test("the manifest seeds both the board and the cleared archive", () => {
    expect(board?.kind).toBe("file");
    expect(archive?.kind).toBe("file");
  });

  test("board seed carries zero demand rows", () => {
    expect(board && board.kind === "file" ? countDemandRows(board.contents) : -1).toBe(0);
  });

  test("cleared-archive seed carries zero demand rows", () => {
    expect(archive && archive.kind === "file" ? countDemandRows(archive.contents) : -1).toBe(0);
  });

  test("positive control — countDemandRows actually fires (so the zero is meaningful)", () => {
    const populated = 'vend chain "do the thing"\n- **E-001 — delivered the thing**\n';
    expect(countDemandRows(populated)).toBe(2);
  });

  test("empty-state prose bullets do not false-positive", () => {
    // ordinary list bullets that are NOT cleared-epic rows must count as zero
    expect(countDemandRows("- a point\n- another point\n")).toBe(0);
  });
});

describe("manifest sanity", () => {
  test("paths are unique", () => {
    const paths = SCAFFOLD_MANIFEST.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("every file entry has contents; no leading './'", () => {
    for (const e of SCAFFOLD_MANIFEST) {
      expect(e.path.startsWith("./")).toBe(false);
      if (e.kind === "file") expect(typeof e.contents).toBe("string");
    }
  });

  test("parent dirs precede their children (creation-safe order)", () => {
    const seen = new Set<string>();
    for (const e of SCAFFOLD_MANIFEST) {
      const slash = e.path.lastIndexOf("/");
      if (slash > 0) {
        const parent = e.path.slice(0, slash);
        // the parent must be a dir entry already seen, OR not be a manifest dir at all
        const parentIsManifestDir = SCAFFOLD_MANIFEST.some((x) => x.kind === "dir" && x.path === parent);
        if (parentIsManifestDir) expect(seen.has(parent)).toBe(true);
      }
      seen.add(e.path);
    }
  });
});
