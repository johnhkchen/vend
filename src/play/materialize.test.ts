import { describe, expect, test } from "bun:test";
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  StoryDraft,
  TicketDraft,
} from "../../baml_client/index.ts";
import {
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
