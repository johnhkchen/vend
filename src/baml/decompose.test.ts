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
import { STORY_CONTRACT_EXEMPLAR, STORY_CONTRACT_FIELDS } from "../play/decompose-epic-core.ts";

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
// tickets, a depends_on edge, a full value triplet per ticket. The story carries all five
// contract fields (T-066-01-01) populated — the full round-trip fixture.
const CONTRACT_STORY = {
  id: "S-009",
  title: "lay-the-foundation",
  type: "task",
  status: "open",
  priority: "high",
  tickets: ["T-009-01", "T-009-02"],
  scope: "the module skeleton and its clearing gate — src/module plus the gate list",
  storyAcceptance: "a failing fixture trips the gate and bun run check is green end to end",
  honestBoundary: "fixture-proven only; the live metered cast is deferred and named here",
  waveRationale: "T-009-01 runs alone (settles the skeleton); T-009-02 builds on it",
  outOfSlice: "the sibling story's renderer; backfilling boards already minted",
};
const CANNED = JSON.stringify({
  stories: [CONTRACT_STORY],
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

// The SAME logical reply as CANNED, styled the way an OPEN model emits it (T-036-02): a chatty
// preamble, the JSON in a ```json fence, a trailing remark. The data is held byte-for-byte
// identical to CANNED (it wraps the exact CANNED text) on purpose — so b.parse producing the SAME
// typed WorkPlan proves parse keys on the embedded structure (SAP), not on a provider or its
// styling. No live model: the bridge SAP-parses this canned text exactly as it does a Claude reply.
const OPEN_MODEL_CANNED =
  "Sure — here's the decomposition you asked for:\n\n```json\n" +
  CANNED +
  "\n```\n\nLet me know if you'd like me to adjust the story/ticket split.";

// Contract-field absence fixtures (T-066-01-01). PARTIAL omits two of the five contract fields;
// SHELL omits all five (the pre-contract story shape — exactly what the T-066-01-02 completeness
// gate will refuse). Both reuse CANNED's plan so the ONLY variable is which fields are absent.
// The pin: an omitted OPTIONAL field parses to a TYPED ABSENCE (null/undefined), the story is
// NOT dropped from the all-array plan, and no default is fabricated.
const CANNED_PLAN = JSON.parse(CANNED) as { stories: Record<string, unknown>[]; tickets: unknown[] };
const omitFromStory = (fields: string[]): string => {
  const story = Object.fromEntries(
    Object.entries(CANNED_PLAN.stories[0]!).filter(([k]) => !fields.includes(k)),
  );
  return JSON.stringify({ stories: [story], tickets: CANNED_PLAN.tickets });
};
const PARTIAL_CANNED = omitFromStory(["honestBoundary", "outOfSlice"]);
const SHELL_CANNED = omitFromStory([...STORY_CONTRACT_FIELDS]);

const EPIC = "EPIC_SENTINEL_dispense_slice_intent";
const CHARTER = "CHARTER_SENTINEL_value_function_P1_P7";
const PROJECT = "PROJECT_SENTINEL_go_and_see_snapshot";

// One spawn covers every op the suite asserts on (the native-addon limit is per process). Op [3]
// renders the SAME inputs against OpenModelStub (T-036-01) — the prompt text is identical to [2]'s,
// the request SHAPE is openai-generic, which is the whole point.
// Op [4] (T-036-02) parses an OPEN-MODEL-STYLE reply — the provider-agnosticism proof. Same single
// spawn (the native-addon limit is per process); appended last so [0]–[3]'s indices are unchanged.
// Ops [5]/[6] (T-066-01-01) parse the contract-absence fixtures; appended last so [0]–[4]'s
// indices are unchanged.
const RESULTS: Promise<BridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: "this is not a work plan at all" },
  { mode: "render", epic: EPIC, charter: CHARTER, project: PROJECT },
  { mode: "render", epic: EPIC, charter: CHARTER, project: PROJECT, client: "OpenModelStub" },
  { mode: "parse", text: OPEN_MODEL_CANNED },
  { mode: "parse", text: PARTIAL_CANNED },
  { mode: "parse", text: SHELL_CANNED },
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

    // The five story-contract fields (T-066-01-01) survive the round-trip verbatim.
    for (const field of STORY_CONTRACT_FIELDS) {
      expect(story[field]).toBe(CONTRACT_STORY[field]);
    }
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

// T-066-01-01 — the story contract's TYPED-ABSENCE half. The five fields are optional in the
// schema on purpose: a reply omitting one must parse to null/undefined (a typed absence the
// T-066-01-02 gate refuses by name), the story must NOT be dropped from the all-array plan
// (a required-field coercion failure would silently disappear it), and no default may be
// fabricated. First optional fields in this repo's BAML — these tests PIN the behavior.
describe("DecomposeEpic — story contract fields parse to typed absences (offline)", () => {
  test("a story omitting some contract fields keeps the present ones and nulls the absent ones", async () => {
    const r = (await RESULTS)[5]!;
    expect(r.ok).toBe(true);
    const plan = (r as { plan: WorkPlan }).plan;

    // The story is ADMITTED incomplete, not dropped — the gate needs it to name the id.
    expect(plan.stories).toHaveLength(1);
    expect(plan.tickets).toHaveLength(2);
    const story = plan.stories[0]!;
    expect(story.id).toBe("S-009");

    // Present contract fields round-trip verbatim…
    expect(story.scope).toBe(CONTRACT_STORY.scope);
    expect(story.storyAcceptance).toBe(CONTRACT_STORY.storyAcceptance);
    expect(story.waveRationale).toBe(CONTRACT_STORY.waveRationale);
    // …and the omitted ones are TYPED ABSENCES: null/undefined, never a fabricated string.
    expect(story.honestBoundary ?? null).toBeNull();
    expect(story.outOfSlice ?? null).toBeNull();
    expect(typeof story.honestBoundary).not.toBe("string");
    expect(typeof story.outOfSlice).not.toBe("string");
  });

  test("a shell story (all five absent — the pre-contract shape) parses with all five as absences", async () => {
    const r = (await RESULTS)[6]!;
    expect(r.ok).toBe(true);
    const plan = (r as { plan: WorkPlan }).plan;

    expect(plan.stories).toHaveLength(1);
    const story = plan.stories[0]!;
    expect(story.id).toBe("S-009");
    // Exactly the shape T-066-01-02's completeness gate refuses: present story, five holes.
    for (const field of STORY_CONTRACT_FIELDS) {
      expect(story[field] ?? null).toBeNull();
      expect(typeof story[field]).not.toBe("string");
    }
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

// T-066-01-01 AC2 — the render's DEMAND half of the story contract. The prompt must demand all
// five sections by their JSON field names and embed the exemplar. Asserted against the CORE's
// canonical exports so the three copies (schema field names, prompt text, core constants)
// cannot drift apart: a rename in the schema breaks the `satisfies` pin at compile time; an
// exemplar edit in either decompose.baml or decompose-epic-core.ts without the other fails here.
describe("DecomposeEpic — render demands the story contract (offline)", () => {
  test("the prompt demands every contract field by its JSON name", async () => {
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain("Every story is a CONTRACT");
    for (const field of STORY_CONTRACT_FIELDS) {
      expect(prompt).toContain(`\`${field}\``);
    }
    // The honesty clause: absence over padding (aligns the model with the typed-absence design).
    expect(prompt).toContain("left ABSENT");
  });

  test("the prompt embeds the exemplar byte-identically to the core's canonical copy", async () => {
    const r = (await RESULTS)[2]!;
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(STORY_CONTRACT_EXEMPLAR);
  });
});

// T-036-01 open-model-baml-client: render can target a SELECTABLE client (the generated
// `{ client }` call option). Rendering DecomposeEpic against OpenModelStub builds a request in
// openai-generic FORMAT — asserted on the request SHAPE (the format fingerprint requestShape reads
// off the real built request in the bridge child), NOT on prompt text, which is identical to the
// default render. requestShape is exercised here on REAL BAML requests, the strongest coverage.
type RenderResult = Extract<BridgeResult, { mode: "render" }>;

describe("DecomposeEpic — render targets a selectable client (openai-generic format)", () => {
  test("the default client renders the anthropic format (unchanged back-compat)", async () => {
    const r = (await RESULTS)[2] as RenderResult;
    expect(r.ok).toBe(true);
    expect(r.shape.endsWithChatCompletions).toBe(false);
    expect(r.shape.url.endsWith("/v1/messages")).toBe(true);
    expect(r.shape.hasMaxTokens).toBe(true); // ClaudeStub's max_tokens 32000
    expect(r.shape.firstRole).toBe("user");
    expect(r.shape.contentIsString).toBe(false); // anthropic content is a blocks array
  });

  test("OpenModelStub renders the openai-generic format", async () => {
    const r = (await RESULTS)[3] as RenderResult;
    expect(r.ok).toBe(true);
    expect(r.shape.endsWithChatCompletions).toBe(true);
    expect(r.shape.url.endsWith("/chat/completions")).toBe(true);
    expect(r.shape.hasMaxTokens).toBe(false); // openai-generic omits max_tokens
    expect(r.shape.firstRole).toBe("system"); // instructions become a system message
    expect(r.shape.contentIsString).toBe(true); // openai content is a flat string
  });

  test("the proof is on SHAPE, not text — the prompt is identical across clients", async () => {
    const def = (await RESULTS)[2] as RenderResult;
    const open = (await RESULTS)[3] as RenderResult;
    // Same authored prompt text…
    expect(open.prompt).toBe(def.prompt);
    // …rendered into two distinct provider formats. The contract is the format, not the text.
    expect(open.shape.endsWithChatCompletions).not.toBe(def.shape.endsWithChatCompletions);
  });
});

// T-036-02 part 2 — parse is PROVIDER-AGNOSTIC: `b.parse.DecomposeEpic` SAP-parses text, not a
// provider. A canned OPEN-model-style reply (chatty preamble + ```json fence + trailing remark,
// same data as the Claude reply) parses into the SAME typed WorkPlan as the Claude reply. This is
// the half of the open-model path that needs NO code change — the test makes the neutrality
// explicit, run through the same subprocess bridge, with no live model.
describe("DecomposeEpic — parse is provider-agnostic (open-model reply, offline)", () => {
  test("an open-model-style reply parses into the SAME typed WorkPlan as the Claude reply", async () => {
    const claude = (await RESULTS)[0]!;
    const open = (await RESULTS)[4]!;
    expect(claude.ok).toBe(true);
    expect(open.ok).toBe(true);
    const claudePlan = (claude as { plan: WorkPlan }).plan;
    const openPlan = (open as { plan: WorkPlan }).plan;

    // Same counts, same story identity, same ordered ticket ids — provider styling did not change
    // the parsed structure (the proof: parse reads the embedded data, not the wrapping).
    expect(openPlan.stories).toHaveLength(claudePlan.stories.length);
    expect(openPlan.tickets).toHaveLength(claudePlan.tickets.length);
    expect(openPlan.stories[0]!.id).toBe(claudePlan.stories[0]!.id);
    expect(openPlan.stories[0]!.type).toBe(claudePlan.stories[0]!.type);
    expect(openPlan.stories[0]!.status).toBe(claudePlan.stories[0]!.status);
    expect(openPlan.tickets.map((t) => t.id)).toEqual(claudePlan.tickets.map((t) => t.id));

    // The full value triplet + the depends_on edge survive identically across providers.
    const [oFirst, oSecond] = openPlan.tickets;
    const [cFirst, cSecond] = claudePlan.tickets;
    expect(oFirst!.type).toBe(cFirst!.type);
    expect(oFirst!.status).toBe(cFirst!.status);
    expect(oFirst!.phase).toBe(cFirst!.phase);
    expect(oFirst!.priority).toBe(cFirst!.priority);
    expect(oFirst!.advances).toEqual(cFirst!.advances);
    expect(oFirst!.depends_on).toEqual(cFirst!.depends_on);
    expect(oSecond!.priority).toBe(cSecond!.priority);
    expect(oSecond!.depends_on).toEqual(cSecond!.depends_on);
  });

  test("the open-model parse is a real plan, not the empty-degrade (it actually parsed)", async () => {
    // Guards the proof above against vacuously passing on two empty plans (the malformed-degrade
    // path): the open-model reply must yield the populated plan, not [].
    const open = (await RESULTS)[4]!;
    const plan = (open as { plan: WorkPlan }).plan;
    expect(plan.stories.length).toBeGreaterThan(0);
    expect(plan.tickets.length).toBeGreaterThan(0);
  });
});
