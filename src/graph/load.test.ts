import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkGraph } from "./load.ts";

// T-021-01 — the IMPURE verb, against a real temp-dir fixture + a live-board smoke. The pure
// linking/integrity/freezing logic is covered in model.test.ts; here we prove the directory
// walk: TEMPLATE/id-less files are skipped, missing dirs are tolerated, and the real
// docs/active/** board loads clean with its edges resolved.

async function writeBoard(root: string, files: Record<string, string>): Promise<void> {
  for (const dir of ["epic", "stories", "tickets"]) await mkdir(join(root, "docs/active", dir), { recursive: true });
  for (const [rel, body] of Object.entries(files)) await writeFile(join(root, rel), body, "utf8");
}

describe("loadWorkGraph — temp-dir fixture", () => {
  test("loads a small board, skips TEMPLATE.md and id-less files", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-graph-"));
    await writeBoard(root, {
      "docs/active/epic/E-001.md": "---\nid: E-001\ntitle: e\nstatus: open\nadvances: [P1]\n---\nepic body\n",
      "docs/active/epic/TEMPLATE.md": "---\nid: E-000\ntitle: template\nstatus: open\n---\nignore me\n",
      "docs/active/stories/S-001-01.md": "---\nid: S-001-01\ntitle: s\ntype: story\nstatus: open\npriority: high\ntickets: [T-001-01]\n---\n",
      "docs/active/tickets/T-001-01.md": "---\nid: T-001-01\nstory: S-001-01\ntitle: t\ntype: task\nstatus: open\npriority: high\nphase: ready\ndepends_on: []\n---\nctx\n",
      "docs/active/tickets/notes.md": "---\nfoo: bar\n---\n", // a fenced .md with no `id` → skipped
    });

    const g = await loadWorkGraph({ root });

    expect(g.epics.map((e) => e.id)).toEqual(["E-001"]); // TEMPLATE (E-000) excluded
    expect(g.byId["E-000"]).toBeUndefined();
    expect(g.tickets.map((t) => t.id)).toEqual(["T-001-01"]); // notes.md (no id) excluded
    expect(g.epics[0]!.stories[0]!.tickets[0]!.body).toBe("ctx\n"); // body retained for the projection
  });

  test("a missing directory is tolerated (empty), not an error", async () => {
    const root = await mkdtemp(join(tmpdir(), "vend-graph-empty-"));
    const g = await loadWorkGraph({ root }); // no docs/active/** at all
    expect(g.epics).toEqual([]);
    expect(g.stories).toEqual([]);
    expect(g.tickets).toEqual([]);
  });
});

describe("loadWorkGraph — live board smoke", () => {
  test("the real docs/active/** board loads clean with edges resolved", async () => {
    const g = await loadWorkGraph(); // process.cwd() = repo root
    expect(g.epics.length).toBeGreaterThan(0);
    expect(g.stories.length).toBeGreaterThan(0);
    expect(g.tickets.length).toBeGreaterThan(0);

    // spot-check this very ticket's edge chain resolves through the graph
    const t = g.byId["T-021-01"];
    expect(t?.kind).toBe("ticket");
    const story = g.byId[(t as { storyId: string }).storyId];
    expect(story?.kind).toBe("story");
    expect((story as { epicId: string | null }).epicId).toBe("E-021");

    // every authored edge resolves into the index (no dangling references on the live board)
    for (const tk of g.tickets) {
      expect(g.byId[tk.storyId]).toBeDefined();
      for (const dep of tk.dependsOn) expect(g.byId[dep]).toBeDefined();
    }
  });
});
