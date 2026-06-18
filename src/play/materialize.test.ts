import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  StoryDraft,
  TicketDraft,
  WorkPlan,
} from "../../baml_client/index.ts";
import {
  IdCollisionError,
  materialize,
  PHASE_ALIAS,
  PRIORITY_ALIAS,
  renderStoryFile,
  renderTicketFile,
  STATUS_ALIAS,
  TYPE_ALIAS,
} from "./materialize.ts";

// T-002-03 materialize: the PURE render pair + alias maps, covered to the branch with
// fabricated drafts. EVERY baml import is TYPE-ONLY (erased at runtime) — a value
// import would load the BAML native addon into this `bun test` process and reintroduce
// the once-driven-reactor flakiness (T-002-01). Drafts are plain objects; enum members
// are string literals cast to the (erased) enum types — `b.parse` returns those member
// names. `materialize` itself (the fs verb) is deliberately NOT exercised here, exactly
// as `appendRunLog`/`dispense` are not — its logic is this tested render pair.

/** A full TicketDraft fixture; tests override one field at a time. */
const ticket = (over: Partial<TicketDraft> = {}): TicketDraft => ({
  id: "T-009-01",
  story: "S-009",
  title: "scaffold-the-module",
  type: "Task" as DraftType,
  status: "Open" as DraftStatus,
  priority: "High" as DraftPriority,
  phase: "Ready" as DraftPhase,
  depends_on: [],
  purpose: "Stand up the module skeleton the rest of the story builds on",
  advances: ["P1"],
  doneSignal: "bun run check is green on an empty module export",
  ...over,
});

const story = (over: Partial<StoryDraft> = {}): StoryDraft => ({
  id: "S-009",
  title: "lay-the-foundation",
  type: "Task" as DraftType,
  status: "Open" as DraftStatus,
  priority: "High" as DraftPriority,
  tickets: ["T-009-01", "T-009-02"],
  ...over,
});

describe("renderTicketFile — member→alias + lisa frontmatter", () => {
  test("maps enum members to lisa aliases and renders the eight fields", () => {
    const { name, body } = renderTicketFile(
      ticket({ status: "InProgress" as DraftStatus, phase: "Research" as DraftPhase, priority: "Medium" as DraftPriority }),
    );
    expect(name).toBe("T-009-01.md");
    // member → alias (the T-002-01 gap closed here)
    expect(body).toContain("type: task");
    expect(body).toContain("status: in-progress");
    expect(body).toContain("priority: medium");
    expect(body).toContain("phase: research");
    // identity fields verbatim
    expect(body).toContain("id: T-009-01");
    expect(body).toContain("story: S-009");
    expect(body).toContain("title: scaffold-the-module");
  });

  test("depends_on renders as a YAML flow array, empty and non-empty", () => {
    expect(renderTicketFile(ticket({ depends_on: [] })).body).toContain("depends_on: []");
    expect(renderTicketFile(ticket({ depends_on: ["T-009-01", "T-008-02"] })).body).toContain(
      "depends_on: [T-009-01, T-008-02]",
    );
  });

  test("body carries the value triplet (purpose, advances, doneSignal)", () => {
    const { body } = renderTicketFile(ticket({ advances: ["P1", "P3"] }));
    expect(body).toContain("## Context");
    expect(body).toContain("Stand up the module skeleton");
    expect(body).toContain("_Advances: P1, P3_");
    expect(body).toContain("## Acceptance Criteria");
    expect(body).toContain("- [ ] bun run check is green");
  });

  test("an unknown enum member throws (enum/map drift is a programmer error)", () => {
    expect(() => renderTicketFile(ticket({ status: "Archived" as DraftStatus }))).toThrow(/no alias for status/);
  });
});

describe("renderStoryFile — story frontmatter", () => {
  test("hardcodes type: story (not the draft's DraftType) and maps status/priority", () => {
    const { name, body } = renderStoryFile(story({ status: "Open" as DraftStatus, priority: "High" as DraftPriority }));
    expect(name).toBe("S-009.md");
    expect(body).toContain("id: S-009");
    expect(body).toContain("type: story"); // NOT "task", despite DraftType Task
    expect(body).not.toContain("type: task");
    expect(body).toContain("status: open");
    expect(body).toContain("priority: high");
    expect(body).toContain("tickets: [T-009-01, T-009-02]");
  });

  test("an unknown enum member throws", () => {
    expect(() => renderStoryFile(story({ priority: "Urgent" as DraftPriority }))).toThrow(/no alias for priority/);
  });
});

describe("alias maps cover every BAML enum member", () => {
  test("each map has the exact lisa tokens", () => {
    expect(TYPE_ALIAS).toEqual({ Task: "task", Bug: "bug", Spike: "spike" });
    expect(STATUS_ALIAS.InProgress).toBe("in-progress");
    expect(PRIORITY_ALIAS.Critical).toBe("critical");
    expect(PHASE_ALIAS.Structure).toBe("structure");
  });
});

// T-004-02 collision guard: a REAL-FS fixture test (no BAML addon — the WorkPlan is a
// plain object cast to the erased type, exactly as the draft fixtures above are). The
// guard lives inside `materialize`, so we exercise `materialize` directly: gather →
// detectCollisions → refuse-before-write. fs is addon-safe; only the BAML native addon
// is forbidden in `bun test`. Each test gets its own mkdtemp dir, removed in afterEach.

/** A plain-object WorkPlan from id-only stories/tickets, reusing the draft fixtures for
 *  the rest of the required fields. Cast to the (runtime-erased) WorkPlan type. */
const workPlan = (over: { storyIds?: string[]; ticketIds?: string[] } = {}): WorkPlan =>
  ({
    stories: (over.storyIds ?? []).map((id) => story({ id, tickets: [] })),
    tickets: (over.ticketIds ?? []).map((id) => ticket({ id })),
  }) as unknown as WorkPlan;

describe("materialize — cross-board collision guard (T-004-02)", () => {
  const dirs: string[] = [];
  async function targets(): Promise<{ storiesDir: string; ticketsDir: string; root: string }> {
    const root = await mkdtemp(join(tmpdir(), "vend-materialize-"));
    dirs.push(root);
    return { root, storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  }
  afterEach(async () => {
    while (dirs.length) await rm(dirs.pop() as string, { recursive: true, force: true });
  });

  test("populated board → refuses (names the reused id) and writes nothing", async () => {
    const { storiesDir, ticketsDir } = await targets();
    // Seed a hand-authored ticket the plan is about to re-mint.
    await mkdir(ticketsDir, { recursive: true });
    const sentinelPath = join(ticketsDir, "T-001-01.md");
    const sentinelBody = "hand-authored — must not be clobbered\n";
    await writeFile(sentinelPath, sentinelBody, "utf8");

    const plan = workPlan({ ticketIds: ["T-001-01", "T-009-02"] });

    let caught: unknown;
    await materialize(plan, { storiesDir, ticketsDir }).catch((e) => {
      caught = e;
    });
    expect(caught).toBeInstanceOf(IdCollisionError);
    expect((caught as IdCollisionError).collisions).toEqual(["T-001-01"]);

    // Verified on disk, not just a flag: no NEW files; sentinel untouched.
    expect((await readdir(ticketsDir)).sort()).toEqual(["T-001-01.md"]);
    expect(await readFile(sentinelPath, "utf8")).toBe(sentinelBody);
    // The stories dir was never created (the throw preceded every mkdir).
    expect(await readdir(storiesDir).catch(() => "ENOENT")).toBe("ENOENT");
  });

  test("fresh/disjoint board → materializes normally", async () => {
    const { storiesDir, ticketsDir } = await targets();
    const plan = workPlan({ storyIds: ["S-009"], ticketIds: ["T-009-01"] });

    const result = await materialize(plan, { storiesDir, ticketsDir });

    expect((await readdir(storiesDir)).sort()).toEqual(["S-009.md"]);
    expect((await readdir(ticketsDir)).sort()).toEqual(["T-009-01.md"]);
    expect(result.storyFiles).toHaveLength(1);
    expect(result.ticketFiles).toHaveLength(1);
  });
});
