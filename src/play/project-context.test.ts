import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProjectSnapshot, listEpicIdTitlesIn } from "./project-context.ts";

// T-002-03 project-context: the PURE snapshot formatter, pinned for shape +
// determinism. `assembleInputs` is the IMPURE read verb (epic/charter files + dir
// walk) and is deliberately NOT exercised — its logic is this formatter plus thin fs.

describe("buildProjectSnapshot — thin, deterministic go-and-see", () => {
  test("renders headed sections for src files, stories, and tickets", () => {
    const out = buildProjectSnapshot({
      root: "/repo",
      srcFiles: ["src/play/decompose-epic.ts", "src/gate/gates.ts"],
      stories: ["S-001", "S-002"],
      tickets: ["T-001-01", "T-002-03"],
    });
    expect(out).toContain("# Project snapshot — /repo");
    expect(out).toContain("## Source modules (src/**)");
    expect(out).toContain("- src/gate/gates.ts");
    expect(out).toContain("## Existing stories");
    expect(out).toContain("- S-001");
    expect(out).toContain("## Existing tickets");
    expect(out).toContain("- T-002-03");
  });

  test("sorts each list so the prompt input is reproducible", () => {
    const out = buildProjectSnapshot({
      root: "/repo",
      srcFiles: ["src/z.ts", "src/a.ts"],
      stories: [],
      tickets: [],
    });
    expect(out.indexOf("- src/a.ts")).toBeLessThan(out.indexOf("- src/z.ts"));
  });

  test("empty sections render '(none)', not a blank", () => {
    const out = buildProjectSnapshot({ root: "/repo", srcFiles: [], stories: [], tickets: [] });
    // every section should carry the placeholder
    expect(out.match(/- \(none\)/g)?.length).toBe(3);
  });
});

// T-043-01: the titled board read — the impure sibling of `listIdsIn` the propose-epic effect's
// adoption guard consults. Exercised against a real temp-dir board (the `propose-effect.test.ts`
// idiom), since it reads frontmatter off disk.
describe("listEpicIdTitlesIn — basename id + frontmatter title", () => {
  const card = (id: string, title: string): string => `---\nid: ${id}\ntitle: ${title}\nstatus: open\n---\n`;

  test("returns {id (basename), title} for each *.md, ignoring non-md files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vend-titles-"));
    try {
      await writeFile(join(dir, "E-001.md"), card("E-001", "ramp-the-shelf"), "utf8");
      await writeFile(join(dir, "E-042.md"), card("E-042", "vend-doctor-preflight"), "utf8");
      await writeFile(join(dir, "README.txt"), "not a card", "utf8");
      const pairs = await listEpicIdTitlesIn(dir);
      expect(pairs).toContainEqual({ id: "E-001", title: "ramp-the-shelf" });
      expect(pairs).toContainEqual({ id: "E-042", title: "vend-doctor-preflight" });
      expect(pairs).toHaveLength(2); // README.txt excluded
      // the ids equal what `listIdsIn` would return — the new-title mint path is unchanged.
      expect(pairs.map((p) => p.id).sort()).toEqual(["E-001", "E-042"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a card with no title: line → title \"\"", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vend-titles-"));
    try {
      await writeFile(join(dir, "E-003.md"), "---\nid: E-003\nstatus: open\n---\n", "utf8");
      const pairs = await listEpicIdTitlesIn(dir);
      expect(pairs).toEqual([{ id: "E-003", title: "" }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("a missing dir → [] (a fresh board), never throws", async () => {
    const dir = join(await mkdtemp(join(tmpdir(), "vend-titles-")), "does-not-exist");
    expect(await listEpicIdTitlesIn(dir)).toEqual([]);
  });

  test("an empty dir → []", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vend-titles-"));
    try {
      await mkdir(join(dir, "sub"), { recursive: true });
      expect(await listEpicIdTitlesIn(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
