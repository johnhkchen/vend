import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  WorkPlan,
} from "../../baml_client/index.ts";
import type { BridgeOp, BridgeResult } from "./decompose-bridge.ts";

// IMPORTANT: every BAML import here is TYPE-ONLY (erased at runtime). A value import of the
// generated client would load the BAML native addon INTO this `bun test` process, whose
// once-driven runtime reactor then makes the suite flaky. All native work happens only in
// the spawned child. Enum fields are therefore compared against their string-literal values
// — `b.parse` returns the enum MEMBER name (e.g. DraftType.Task === "Task").

// T-002-01 baml-decompose-epic: offline authoring tests — no model call, no network. The
// PARSE pin (canned reply -> typed WorkPlan via b.parse) and the RENDER pin (b.request
// renders the three inputs into the prompt) are the AC.
//
// They run BAML in a child `bun` process via decompose-bridge.ts. The BAML native addon
// only lets ONE native call succeed per `bun test` process (subsequent calls hang on the
// addon's once-driven runtime reactor); a plain `bun` child has no such limit. So we batch
// the ops, spawn the bridge once, and assert on its JSON — deterministic and fast. See the
// bridge header for the full rationale.

const BRIDGE = fileURLToPath(new URL("./decompose-bridge.ts", import.meta.url));

/** Spawn the bridge in a child bun process, feed it ops, return its results in order. */
async function runBridge(ops: BridgeOp[]): Promise<BridgeResult[]> {
  const proc = Bun.spawn(["bun", "run", BRIDGE], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "inherit",
  });
  proc.stdin.write(JSON.stringify({ ops }));
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`decompose-bridge exited ${code}; stdout: ${out}`);
  return (JSON.parse(out) as { results: BridgeResult[] }).results;
}

// A canned model reply. The model emits the lisa-token ALIASES ("task"/"open"/"ready"/
// "in-progress") because `{{ ctx.output_format }}` shows aliases; b.parse maps them back to
// the enum MEMBER names ("Task"/"Open"/"Ready"/"InProgress"). One story, two ordered
// tickets, a depends_on edge, a full value triplet per ticket.
const CANNED = JSON.stringify({
  stories: [
    {
      id: "S-009",
      title: "lay-the-foundation",
      type: "task",
      status: "open",
      priority: "high",
      tickets: ["T-009-01", "T-009-02"],
    },
  ],
  tickets: [
    {
      id: "T-009-01",
      story: "S-009",
      title: "scaffold-the-module",
      type: "task",
      status: "open",
      priority: "high",
      phase: "ready",
      depends_on: [],
      purpose: "Stand up the module skeleton the rest of the story builds on",
      advances: ["P1"],
      doneSignal: "bun run check is green on an empty module export",
    },
    {
      id: "T-009-02",
      story: "S-009",
      title: "wire-the-gate",
      type: "task",
      status: "open",
      priority: "medium",
      phase: "ready",
      depends_on: ["T-009-01"],
      purpose: "Add the clearing gate that makes the module's output trustworthy",
      advances: ["P3"],
      doneSignal: "a failing fixture trips the gate and stops the line with a named reason",
    },
  ],
});

const EPIC = "EPIC_SENTINEL_dispense_slice_intent";
const CHARTER = "CHARTER_SENTINEL_value_function_P1_P7";
const PROJECT = "PROJECT_SENTINEL_go_and_see_snapshot";

// One spawn covers every op the suite asserts on (the native-addon limit is per process).
const RESULTS: Promise<BridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: "this is not a work plan at all" },
  { mode: "render", epic: EPIC, charter: CHARTER, project: PROJECT },
]);

describe("DecomposeEpic — parse (SAP, offline)", () => {
  test("a canned reply parses into a typed WorkPlan", async () => {
    const r = (await RESULTS)[0]!;
    expect(r.ok).toBe(true);
    const plan = (r as { plan: WorkPlan }).plan;

    expect(plan.stories).toHaveLength(1);
    expect(plan.tickets).toHaveLength(2);

    const story = plan.stories[0]!;
    expect(story.id).toBe("S-009");
    // b.parse returns the enum MEMBER name (alias "task" -> DraftType.Task === "Task").
    // The literals are cast to the (type-only, erased) enum types — no native addon load.
    expect(story.type).toBe("Task" as DraftType);
    expect(story.status).toBe("Open" as DraftStatus);
    // Ticket order is preserved positionally (no separate index field).
    expect(plan.tickets.map((t) => t.id)).toEqual(["T-009-01", "T-009-02"]);

    const [first, second] = plan.tickets;
    // Enum aliases map back to member names; the value triplet survives the round-trip.
    expect(first!.type).toBe("Task" as DraftType);
    expect(first!.status).toBe("Open" as DraftStatus);
    expect(first!.phase).toBe("Ready" as DraftPhase);
    expect(first!.priority).toBe("High" as DraftPriority);
    expect(first!.advances).toEqual(["P1"]);
    expect(first!.depends_on).toEqual([]);
    expect(first!.doneSignal).toContain("bun run check");

    expect(second!.priority).toBe("Medium" as DraftPriority);
    expect(second!.depends_on).toEqual(["T-009-01"]);
    expect(second!.purpose.length).toBeGreaterThan(0);
  });

  test("a malformed reply degrades to an EMPTY plan (pins SAP leniency for T-002-02/03)", async () => {
    // WorkPlan is an all-array class, so SAP never REJECTS — it degrades to empty arrays
    // rather than throwing. Downstream (value gate / runner) must treat empty as MALFORMED.
    const r = (await RESULTS)[1]!;
    expect(r.ok).toBe(true);
    const plan = (r as { plan: WorkPlan }).plan;
    expect(plan.stories).toHaveLength(0);
    expect(plan.tickets).toHaveLength(0);
  });
});

describe("DecomposeEpic — render (b.request, offline, render-only key)", () => {
  test("renders the epic, charter, and project inputs into the prompt", async () => {
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(EPIC);
    expect(prompt).toContain(CHARTER);
    expect(prompt).toContain(PROJECT);
    // The clearing framing is rendered too (the authored judgment, paid once).
    expect(prompt).toContain("clearing function");
  });
});
