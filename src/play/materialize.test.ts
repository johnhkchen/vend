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
import { snapshotCharterCodes } from "./charter-snapshot.ts";
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

// T-067-01-02 charter fixture: the bold DEFINITION shape (the only shape the resolver
// parses), FABRICATED rather than the live charter — these goldens pin the RENDERER's
// composition, and coupling them to live wording would rewrite render goldens on every
// charter amendment (the live-text gold pin lives in charter-snapshot.test.ts). Built
// through the real resolver (pure, zero-import — addon-safe) so the fixture stays honest
// to the upstream contract.
const CHARTER = [
  "- **P1 — Author once, run forever.** Cost lives at authoring.",
  "- **P3 — Gates are the contract.** Quality lives inside the work.",
  "- **P4 — Autonomy by default, not supervision.** Work proceeds against gates.",
  "- **P6 — Executor-agnostic underneath.** Claude Code first.",
  "- **N1 — Not a chat copilot.** Removing yourself from the loop.",
].join("\n");
const SNAPSHOT = snapshotCharterCodes(CHARTER);
const EMPTY = snapshotCharterCodes("");

describe("renderTicketFile — member→alias + lisa frontmatter", () => {
  test("maps enum members to lisa aliases and renders the eight fields", () => {
    const { name, body } = renderTicketFile(
      ticket({ status: "InProgress" as DraftStatus, phase: "Research" as DraftPhase, priority: "Medium" as DraftPriority }),
      SNAPSHOT,
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
    expect(renderTicketFile(ticket({ depends_on: [] }), SNAPSHOT).body).toContain("depends_on: []");
    expect(renderTicketFile(ticket({ depends_on: ["T-009-01", "T-008-02"] }), SNAPSHOT).body).toContain(
      "depends_on: [T-009-01, T-008-02]",
    );
  });

  test("body carries the value triplet (purpose, advances, doneSignal)", () => {
    const { body } = renderTicketFile(ticket({ advances: ["P1", "P3"] }), SNAPSHOT);
    expect(body).toContain("## Context");
    expect(body).toContain("Stand up the module skeleton");
    expect(body).toContain("_Advances: P1 — Author once, run forever; P3 — Gates are the contract_");
    expect(body).toContain("## Acceptance Criteria");
    expect(body).toContain("- [ ] bun run check is green");
  });

  test("an unknown enum member throws (enum/map drift is a programmer error)", () => {
    expect(() => renderTicketFile(ticket({ status: "Archived" as DraftStatus }), SNAPSHOT)).toThrow(
      /no alias for status/,
    );
  });

  test("full-file golden — advances carry code + cut-time text (T-067-01-02 surface move)", () => {
    // The T-066-01-03-era golden's `_Advances: P1_` line moved DELIBERATELY in T-067-01-02:
    // every cited code now carries the one-liner the charter gave it at cut, code kept for
    // traceability. If this golden ever needs editing again, the ticket surface moved — a
    // deliberate decision, not a drive-by.
    expect(renderTicketFile(ticket(), SNAPSHOT).body).toBe(`---
id: T-009-01
story: S-009
title: scaffold-the-module
type: task
status: open
priority: high
phase: ready
depends_on: []
---

## Context

Stand up the module skeleton the rest of the story builds on

_Advances: P1 — Author once, run forever_

## Acceptance Criteria

- [ ] bun run check is green on an empty module export
`);
  });
});

describe("renderStoryFile — story frontmatter", () => {
  test("hardcodes type: story (not the draft's DraftType) and maps status/priority", () => {
    const { name, body } = renderStoryFile(
      story({ status: "Open" as DraftStatus, priority: "High" as DraftPriority }),
      [],
      "2026-07-10",
      SNAPSHOT,
    );
    expect(name).toBe("S-009.md");
    expect(body).toContain("id: S-009");
    expect(body).toContain("type: story"); // NOT "task", despite DraftType Task
    expect(body).not.toContain("type: task");
    expect(body).toContain("status: open");
    expect(body).toContain("priority: high");
    expect(body).toContain("tickets: [T-009-01, T-009-02]");
  });

  test("an unknown enum member throws", () => {
    expect(() => renderStoryFile(story({ priority: "Urgent" as DraftPriority }), [], "2026-07-10", SNAPSHOT)).toThrow(
      /no alias for priority/,
    );
  });
});

// T-066-01-03 contract body: the story writer now emits the five parsed sections, a `## DAG`
// block DERIVED from the tickets' depends_on edges, and the provenance line demoted to a dated
// footer. Byte-exact goldens (house "golden hash" style — inline literals, `toBe`), with the
// clock passed as data so the bytes are deterministic.

describe("renderStoryFile — contract body (T-066-01-03)", () => {
  const contractStory = (): StoryDraft =>
    story({
      tickets: ["T-009-01", "T-009-02", "T-009-03"],
      scope: "the module skeleton and its clearing gate — src/module plus the gate list (P3)",
      storyAcceptance: "a failing fixture trips the gate and bun run check is green end to end",
      honestBoundary: "fixture-proven only (P4); the live metered cast is deferred and named here",
      waveRationale: "T-009-01 runs alone (settles the skeleton); T-009-02 and T-009-03 then fan out",
      outOfSlice: "the sibling story's renderer; backfilling boards already minted",
    });
  const contractTickets = (): TicketDraft[] => [
    ticket(),
    ticket({ id: "T-009-02", title: "wire-the-gate", depends_on: ["T-009-01"] }),
    ticket({ id: "T-009-03", title: "document-the-gate", depends_on: ["T-009-01", "T-009-02"] }),
  ];

  test("contract golden — five sections with resolved citations, derived DAG (two-parent join), dated footer", () => {
    const { body } = renderStoryFile(contractStory(), contractTickets(), "2026-07-10", SNAPSHOT);
    expect(body).toBe(`---
id: S-009
title: lay-the-foundation
type: story
status: open
priority: high
tickets: [T-009-01, T-009-02, T-009-03]
---

**Scope:** the module skeleton and its clearing gate — src/module plus the gate list (P3 — Gates are the contract)

**Story acceptance:** a failing fixture trips the gate and bun run check is green end to end

**Honest boundary:** fixture-proven only (P4 — Autonomy by default, not supervision); the live metered cast is deferred and named here

## DAG

\`\`\`
T-009-01  scaffold-the-module
T-009-02  wire-the-gate  ← T-009-01
T-009-03  document-the-gate  ← T-009-01, T-009-02
\`\`\`

Wave rationale: T-009-01 runs alone (settles the skeleton); T-009-02 and T-009-03 then fan out

**Out of this slice:** the sibling story's renderer; backfilling boards already minted

---
_Materialized by Vend's \`decompose-epic\` play — 3 ticket(s), 2026-07-10._
`);
  });

  test("degraded golden — absent contract fields render NOTHING (the gate owns refusal), DAG + footer stay", () => {
    // story() carries no contract fields — the shell shape. The writer never fabricates a
    // placeholder for a section the parse didn't carry; the file is frontmatter + DAG + footer.
    const { body } = renderStoryFile(
      story(),
      [ticket(), ticket({ id: "T-009-02", title: "wire-the-gate", depends_on: ["T-009-01"] })],
      "2026-07-10",
      SNAPSHOT,
    );
    expect(body).toBe(`---
id: S-009
title: lay-the-foundation
type: story
status: open
priority: high
tickets: [T-009-01, T-009-02]
---

## DAG

\`\`\`
T-009-01  scaffold-the-module
T-009-02  wire-the-gate  ← T-009-01
\`\`\`

---
_Materialized by Vend's \`decompose-epic\` play — 2 ticket(s), 2026-07-10._
`);
  });

  test("edge fidelity — depends_on renders verbatim (even outside the story); a missing draft degrades to a bare id", () => {
    // T-009-01 depends on a ticket in ANOTHER story/epic (--after mints exactly this edge);
    // s.tickets also names T-009-02, for which no draft was passed.
    const { body } = renderStoryFile(
      story(),
      [ticket({ depends_on: ["T-008-77"] })],
      "2026-07-10",
      SNAPSHOT,
    );
    expect(body).toContain("T-009-01  scaffold-the-module  ← T-008-77");
    expect(body).toContain("\nT-009-02\n"); // bare id line — degrade, not a crash or a dropped node
  });
});

// T-067-01-02 code-carrying bodies: every cited charter code renders as `code — carried
// one-liner` — the advances line from the array (semicolon-joined), prose citations via a
// snapshot-GATED rewrite. The two safety properties (only-what-resolves, already-glossed
// passthrough) and the degrade contract T-067-01-03 builds on are pinned here.

describe("code-carrying bodies (T-067-01-02)", () => {
  test("multi-advance line: each code expanded, semicolon-joined", () => {
    const { body } = renderTicketFile(ticket({ advances: ["P4", "P6"] }), SNAPSHOT);
    expect(body).toContain(
      "_Advances: P4 — Autonomy by default, not supervision; P6 — Executor-agnostic underneath_",
    );
  });

  test("a code the snapshot misses degrades to the bare code (the T-067-01-03 guard's input, never a fabricated gloss)", () => {
    const { body } = renderTicketFile(ticket({ advances: ["P9", "P1"] }), SNAPSHOT);
    expect(body).toContain("_Advances: P9; P1 — Author once, run forever_");
  });

  test("purpose prose citations expand in place", () => {
    const { body } = renderTicketFile(
      ticket({ purpose: "full grounding for cold workers (P4, P6)" }),
      SNAPSHOT,
    );
    expect(body).toContain(
      "full grounding for cold workers (P4 — Autonomy by default, not supervision, P6 — Executor-agnostic underneath)",
    );
  });

  test("doneSignal prose resolves the same way", () => {
    const { body } = renderTicketFile(ticket({ doneSignal: "bodies honor N1 end to end" }), SNAPSHOT);
    expect(body).toContain("- [ ] bodies honor N1 — Not a chat copilot end to end");
  });

  test("non-charter tokens pass through untouched (only what the snapshot resolves is rewritten)", () => {
    const { body } = renderTicketFile(
      ticket({ purpose: "counts toward forward-E1; the A3 spike stays out" }),
      SNAPSHOT,
    );
    expect(body).toContain("counts toward forward-E1; the A3 spike stays out");
  });

  test("an already-glossed code is left alone (idempotent — no nested em-dash gloss)", () => {
    const { body } = renderTicketFile(ticket({ purpose: "P4 — the author's own gloss stands" }), SNAPSHOT);
    expect(body).toContain("P4 — the author's own gloss stands");
    expect(body).not.toContain("P4 — Autonomy by default, not supervision — the author's own gloss stands");
  });

  test("empty snapshot ⇒ the pre-T-067-01-02 bytes exactly (degrade, not crash)", () => {
    // The old T-066-01-03-era full-file golden, verbatim: with nothing to resolve, a cut
    // body is byte-identical to what the renderer wrote before this ticket landed.
    expect(renderTicketFile(ticket(), EMPTY).body).toBe(`---
id: T-009-01
story: S-009
title: scaffold-the-module
type: task
status: open
priority: high
phase: ready
depends_on: []
---

## Context

Stand up the module skeleton the rest of the story builds on

_Advances: P1_

## Acceptance Criteria

- [ ] bun run check is green on an empty module export
`);
  });

  test("story sections resolve citations the same way (waveRationale + outOfSlice spot-check)", () => {
    const { body } = renderStoryFile(
      story({ waveRationale: "safe because gates hold (P3)", outOfSlice: "read-side stripping (N1)" }),
      [ticket()],
      "2026-07-10",
      SNAPSHOT,
    );
    expect(body).toContain("Wave rationale: safe because gates hold (P3 — Gates are the contract)");
    expect(body).toContain("**Out of this slice:** read-side stripping (N1 — Not a chat copilot)");
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
    await materialize(plan, { storiesDir, ticketsDir }, CHARTER).catch((e) => {
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

    const result = await materialize(plan, { storiesDir, ticketsDir }, CHARTER);

    expect((await readdir(storiesDir)).sort()).toEqual(["S-009.md"]);
    expect((await readdir(ticketsDir)).sort()).toEqual(["T-009-01.md"]);
    expect(result.storyFiles).toHaveLength(1);
    expect(result.ticketFiles).toHaveLength(1);
  });
});
