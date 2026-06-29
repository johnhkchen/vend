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

  // E-059 (T-059-01): the seed's stated intent rides inside the snapshot. The section is the
  // DELIBERATE exception to "names, not contents" — present only when intent is non-blank, so an
  // absent/blank intent leaves the snapshot byte-identical (the honest-empty safety).
  test("emits a '## Stated intent (SEED.md)' section (verbatim) before Source modules when intent present", () => {
    const out = buildProjectSnapshot({
      root: "/repo",
      srcFiles: ["src/a.ts"],
      stories: [],
      tickets: [],
      intent: "A web app that helps solo hackathon-goers find a team by skill + idea overlap",
    });
    expect(out).toContain("## Stated intent (SEED.md)");
    expect(out).toContain("A web app that helps solo hackathon-goers find a team by skill + idea overlap");
    // the intent leads — it is what the steer prompt grounds demand against, ahead of the listing.
    expect(out.indexOf("## Stated intent (SEED.md)")).toBeLessThan(out.indexOf("## Source modules"));
  });

  test("intent absent ⇒ NO section, byte-identical to the no-intent snapshot (honest-empty preserved)", () => {
    const parts = { root: "/repo", srcFiles: ["src/a.ts"], stories: ["S-001"], tickets: ["T-001-01"] };
    const out = buildProjectSnapshot(parts);
    expect(out).not.toContain("Stated intent");
    // adding the optional field as `undefined` changes NOTHING — the absent case is byte-identical.
    expect(buildProjectSnapshot({ ...parts, intent: undefined })).toBe(out);
  });

  test("blank / whitespace-only intent is treated as absent (no fabricated empty section)", () => {
    const out = buildProjectSnapshot({ root: "/repo", srcFiles: [], stories: [], tickets: [], intent: "  \n " });
    expect(out).not.toContain("Stated intent");
    // identical to the no-intent snapshot — a present-but-empty SEED is the same as no SEED.
    expect(out).toBe(buildProjectSnapshot({ root: "/repo", srcFiles: [], stories: [], tickets: [] }));
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
