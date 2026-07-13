import { describe, expect, test } from "bun:test";
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  StoryDraft,
  TicketDraft,
  WorkPlan,
} from "../../baml_client/index.ts";
import { stripNonGoalAdvances } from "../play/decompose-epic-core.ts";
import { type ClearContext, clear, GATE_NAMES, isStop, STORY_CONTRACT_FIELDS } from "./gates.ts";

// T-002-02 clearing-gates: pure module, fabricated WorkPlan fixtures only — no spawn, no fs, no
// BAML native call. Every BAML import is TYPE-ONLY (erased at runtime): `clear` judges an
// already-parsed value, so unlike decompose.test.ts there is no native addon and no subprocess
// bridge. Enum fields are the member-name string literals `b.parse` returns ("Task"/"Open"/…),
// cast to the (erased) enum types — the proven type-only pattern.

// A charter excerpt carrying the live invariant/non-goal ids the bounds gate greps for. Mirrors
// charter.md's spine: P1..P7 invariants, N1..N4 non-goals. The bounds gate derives its valid set
// from THIS string, so the fixture and the rule share one source of truth.
const CHARTER = `
  P1 — Author once, run forever. P2 — The run is two gestures. P3 — Gates are the contract.
  P4 — Autonomy by default. P5 — Local-first. P6 — Executor-agnostic. P7 — Budget is a hard contract.
  N1 — Not a chat copilot. N2 — Not a babysitting dashboard. N3 — Not a one-off runner. N4 — Not an executor.
`;
const CTX: ClearContext = { epic: "E-001 dispense-slice — advances P1, P3, P7", charter: CHARTER };
const DEFINITION_CHARTER = `
- **P1 — Author once, run forever.** Cost lives at authoring.
- **P3 — Gates are the contract.** Quality lives inside the work.
`;
const DEFINITION_CTX: ClearContext = { ...CTX, charter: DEFINITION_CHARTER };

/** A fully-valid ticket; failing cases override exactly one field. */
function ticket(over: Partial<TicketDraft> = {}): TicketDraft {
  return {
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
  };
}

/** A fully-valid story — CONTRACT-SHAPED since T-066-01-02: it carries all five story-contract
 *  fields (S-066-01-flavored), so it clears the story-completeness gate and every pre-existing
 *  fixture keeps its original verdict. Failing cases override one field. */
function story(over: Partial<StoryDraft> = {}): StoryDraft {
  return {
    id: "S-009",
    title: "lay-the-foundation",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    tickets: ["T-009-01"],
    scope: "The module skeleton and its gate — src/gate only; nothing downstream changes shape.",
    storyAcceptance: "A failing fixture trips the gate and the suite pins the refusal reason.",
    honestBoundary: "Fixture-proven and free; the live metered cast is deferred to the epic close.",
    waveRationale: "The scaffold ticket runs alone; the gate ticket follows on the settled shape.",
    outOfSlice: "Materializer output and workflow docs — sibling tickets own those files.",
    ...over,
  };
}

function plan(tickets: TicketDraft[], stories: StoryDraft[] = [story({ tickets: tickets.map((t) => t.id) })]): WorkPlan {
  return { stories, tickets };
}

// The shared "what good means": two ordered tickets with a real depends_on edge, one story.
const VALID: WorkPlan = plan([
  ticket(),
  ticket({
    id: "T-009-02",
    title: "wire-the-gate",
    priority: "Medium" as DraftPriority,
    depends_on: ["T-009-01"],
    purpose: "Add the clearing gate that makes the module's output trustworthy",
    advances: ["P3"],
    doneSignal: "a failing fixture trips the gate and stops the line with a named reason",
  }),
]);

describe("clear — happy path", () => {
  test("a valid plan clears every gate, in value-order", () => {
    const r = clear(VALID, CTX);
    expect(r.status).toBe("clear");
    if (r.status === "clear") expect(r.cleared).toEqual([...GATE_NAMES]);
    expect(isStop(r)).toBe(false);
  });
});

describe("value gate", () => {
  test("an empty plan is MALFORMED — it advances nothing (the SAP empty-degradation case)", () => {
    const r = clear({ stories: [], tickets: [] }, CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value", unit: "<plan>" });
  });

  test("a ticket with empty `advances` stops the line", () => {
    const r = clear(plan([ticket({ advances: [] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("advances");
  });

  test("`advances` with a blank entry stops the line", () => {
    const r = clear(plan([ticket({ advances: ["  "] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value" });
  });

  test("a doneSignal that merely restates the title stops the line", () => {
    const r = clear(plan([ticket({ doneSignal: "Scaffold-the-Module" })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("doneSignal");
  });

  test("an empty `purpose` stops the line", () => {
    const r = clear(plan([ticket({ purpose: "  " })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value" });
    if (isStop(r)) expect(r.reason).toContain("purpose");
  });
});

// All five contract fields as typed absences — today's ten-line shell at the parse layer (the
// exact SHELL_CANNED shape decompose.test.ts pins; a model may emit explicit `null` or omit, and
// both parse to the same absence).
const SHELL: Partial<StoryDraft> = Object.fromEntries(STORY_CONTRACT_FIELDS.map((f) => [f, null]));

describe("story-completeness gate", () => {
  test("a shell story STOPs with the story-incomplete andon naming the story id and ALL missing sections", () => {
    const r = clear(plan([ticket()], [story({ ...SHELL })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "story-completeness", unit: "S-009" });
    if (isStop(r)) {
      expect(r.reason).toContain("story-incomplete");
      for (const field of STORY_CONTRACT_FIELDS) expect(r.reason).toContain(field);
    }
  });

  test("a partial story names EXACTLY its missing sections, in schema order", () => {
    const r = clear(plan([ticket()], [story({ honestBoundary: null, outOfSlice: null })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "story-completeness", unit: "S-009" });
    if (isStop(r)) expect(r.reason).toBe("story-incomplete — missing: honestBoundary, outOfSlice");
  });

  test("an empty/whitespace-only section is MISSING — the meaning the schema cannot refuse", () => {
    const r = clear(plan([ticket()], [story({ scope: "  " })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "story-completeness", unit: "S-009" });
    if (isStop(r)) expect(r.reason).toBe("story-incomplete — missing: scope");
  });

  test("a contract-shaped story passes — the gate refuses shells, not stories", () => {
    expect(clear(plan([ticket()]), CTX).status).toBe("clear");
  });

  test("the FIRST offending story is the unit (first-offense-wins, like every gate)", () => {
    const stories = [story({ tickets: ["T-009-01"] }), story({ ...SHELL, id: "S-010", tickets: [] }), story({ ...SHELL, id: "S-011", tickets: [] })];
    const r = clear(plan([ticket()], stories), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "story-completeness", unit: "S-010" });
  });

  test("ordering: value still outranks it — a purposeless ticket is reported before the shell story", () => {
    const r = clear(plan([ticket({ purpose: "  " })], [story({ ...SHELL })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value" });
  });

  test("ordering: it outranks allocation — a shell story is reported before a dangling depends_on", () => {
    const r = clear(plan([ticket({ depends_on: ["T-404-99"] })], [story({ ...SHELL })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "story-completeness", unit: "S-009" });
  });
});

describe("allocation gate", () => {
  test("an unresolved depends_on ref stops the line", () => {
    const r = clear(plan([ticket({ depends_on: ["T-404-99"] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "allocation", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("T-404-99");
  });

  test("a dependency cycle stops the line (not a DAG)", () => {
    const a = ticket({ id: "T-009-01", depends_on: ["T-009-02"] });
    const b = ticket({ id: "T-009-02", depends_on: ["T-009-01"] });
    const r = clear(plan([a, b]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "allocation" });
    if (isStop(r)) expect(r.reason).toContain("cycle");
  });

  test("a duplicate ticket id stops the line", () => {
    const r = clear(plan([ticket(), ticket()], [story({ tickets: ["T-009-01"] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "allocation", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("duplicate");
  });

  test("a story listing a non-existent ticket stops the line", () => {
    const r = clear(plan([ticket()], [story({ tickets: ["T-009-01", "T-404-99"] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "allocation", unit: "S-009" });
  });
});

describe("bounds gate", () => {
  test("a dangling cite normalized beside a real advance clears instead of tripping bounds", () => {
    const normalized = stripNonGoalAdvances(
      plan([ticket({ advances: ["P3", "P9"] })]),
      DEFINITION_CHARTER,
    );
    expect(normalized.tickets[0]!.advances).toEqual(["P3"]);
    expect(clear(normalized, DEFINITION_CTX).status).toBe("clear");
  });

  test("a dangling-only cite normalizes to empty and still refuses at the value gate", () => {
    const normalized = stripNonGoalAdvances(
      plan([ticket({ advances: ["P9"] })]),
      DEFINITION_CHARTER,
    );
    expect(normalized.tickets[0]!.advances).toEqual([]);
    expect(clear(normalized, DEFINITION_CTX)).toMatchObject({
      status: "stop",
      gate: "value",
      unit: "T-009-01",
    });
  });

  test("an `advances` ref not in the charter is a dangling claim", () => {
    const r = clear(plan([ticket({ advances: ["P9"] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "bounds", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("P9");
  });

  test("advancing a non-goal (N-ref) is incoherent and stops the line", () => {
    const r = clear(plan([ticket({ advances: ["N1"] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "bounds", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("non-goal");
  });

  test("free-text `advances` (an epic-outcome phrase) passes bounds — not over-failed by rule", () => {
    // Only P\d+/N\d+ are rule-checkable; epic outcomes carry no grep-able id, so they are
    // human-judgment territory and must clear the bounds RULE.
    const r = clear(plan([ticket({ advances: ["faster-clearing-of-this-epic"] })]), CTX);
    expect(r.status).toBe("clear");
  });
});

describe("structural gate", () => {
  test("a ticket missing a required lisa field (empty phase) stops the line", () => {
    const r = clear(plan([ticket({ phase: "" as DraftPhase })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "structural", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("phase");
  });

  test("a ticket missing its `story` field stops the line", () => {
    const r = clear(plan([ticket({ story: "" })], [story({ tickets: ["T-009-01"] })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "structural", unit: "T-009-01" });
    if (isStop(r)) expect(r.reason).toContain("story");
  });
});

describe("value-ordering, narrowing, and guards", () => {
  test("a plan failing value AND structural reports VALUE — the higher-priority defect", () => {
    // Empty advances (value) AND empty phase (structural) on the same ticket.
    const r = clear(plan([ticket({ advances: [], phase: "" as DraftPhase })]), CTX);
    expect(r).toMatchObject({ status: "stop", gate: "value" });
  });

  test("isStop narrows a STOP for the runner", () => {
    const r = clear({ stories: [], tickets: [] }, CTX);
    expect(isStop(r)).toBe(true);
    if (isStop(r)) {
      expect(r.gate).toBe("value");
      expect(typeof r.reason).toBe("string");
    }
  });

  test("a non-object plan is a programmer error — it throws, never a STOP", () => {
    // @ts-expect-error — deliberately wrong call shape
    expect(() => clear(null, CTX)).toThrow(TypeError);
  });

  test("non-string context is a programmer error — it throws", () => {
    // @ts-expect-error — deliberately wrong context shape
    expect(() => clear(VALID, { epic: 1, charter: 2 })).toThrow(TypeError);
  });
});
