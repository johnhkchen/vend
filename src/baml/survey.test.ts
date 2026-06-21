import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { Board, SignalTier } from "../../baml_client/index.ts";
import type { SurveyBridgeOp, SurveyBridgeResult } from "./survey-bridge.ts";

// IMPORTANT: every BAML import here is TYPE-ONLY (erased at runtime). A value import of the generated
// client would load the BAML native addon INTO this `bun test` process, whose once-driven runtime reactor
// then makes the suite flaky. All native work happens only in the spawned child. (The decompose/note/
// propose/expand discipline, applied to the fifth play.) The enum field is compared against its
// string-literal member name — `b.parse` returns the enum MEMBER name (alias "keystone" -> "Keystone").
//
// T-017-01 baml-survey: offline authoring pins for Survey — no model call, no network. The PARSE pin
// (a canned multi-signal reply -> typed Board via b.parse), the SAP-DEGRADE pin (a garbage reply DEGRADES
// to an empty board — Board is all-array like WorkPlan, NOT a required-scalar reject like Signal), and the
// RENDER pin (b.request renders the two inputs). They run BAML in a child `bun` via survey-bridge.ts; see
// the bridge header for the native-addon-limit rationale.

const BRIDGE = fileURLToPath(new URL("./survey-bridge.ts", import.meta.url));

/** Spawn the bridge in a child bun process, feed it ops, return its results in order. */
async function runBridge(ops: SurveyBridgeOp[]): Promise<SurveyBridgeResult[]> {
  const proc = Bun.spawn(["bun", "run", BRIDGE], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  proc.stdin.write(JSON.stringify({ ops }));
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`survey-bridge exited ${code}; stdout: ${out}`);
  return (JSON.parse(out) as { results: SurveyBridgeResult[] }).results;
}

// A canned model reply — a ranked board of two grounded signals (the demand.md ALIASES the
// `{{ ctx.output_format }}` shows the model: tier "keystone"/"high"). b.parse maps them back to MEMBER
// names ("Keystone"/"High"). Each signal names a grounding (the read-never-invent citation).
const CANNED = JSON.stringify({
  signals: [
    {
      what: "Register surveyPlay and the vend survey gesture",
      why: "Lets a whole rough project become a ranked, staged board in one gesture.",
      tier: "keystone",
      budget: "~1 block (≈2h)",
      advances: ["P2"],
      grounding: "docs/active/epic/E-017.md; the T-017-02 ticket",
      readiness: "ready",
    },
    {
      what: "Calibrate Survey's cold-start token budget",
      why: "E-016 under-shot its budget 100k vs 211k; Survey is heavier and must pre-fill generously.",
      tier: "high",
      budget: "small (~1h)",
      advances: ["P7"],
      grounding: "obs 21333; the E-016 budget-overrun finding",
      readiness: "blocked: needs T-017-02 live cast actuals",
    },
  ],
});

const PROJECT = "PROJECT_SENTINEL_whole_repo_go_and_see";
const CHARTER = "CHARTER_SENTINEL_value_function_P2_P7";

// One spawn covers every op the suite asserts on (the native-addon limit is per process). The two
// garbage parses pin Survey's HYBRID honest-empty handle (a genuine T-017-01 finding — see the two
// degrade tests): an OBJECT-shaped reply with no `signals` DEGRADES to an empty board, but a bare
// UNSTRUCTURED string THROWS — Board's single array field cannot absorb a bare string the way WorkPlan's
// two fields do, so it rejects rather than degrades. T-017-02's parse closure must CATCH that throw and
// coerce to an empty board (exactly as expand's closure does), so both garbage shapes reach honest-empty.
const RESULTS: Promise<SurveyBridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: '{"notes":"nothing actionable here"}' },
  { mode: "parse", text: "this is not a demand board at all" },
  { mode: "render", project: PROJECT, charter: CHARTER },
]);

describe("Survey — parse (SAP, offline)", () => {
  test("a canned reply parses into a typed Board of ranked signals", async () => {
    const r = (await RESULTS)[0]!;
    expect(r.ok).toBe(true);
    const board = (r as { board: Board }).board;

    expect(board.signals).toHaveLength(2);
    expect(board.signals[0]!.what).toContain("surveyPlay");
    // b.parse returns the enum MEMBER name (alias "keystone" -> SignalTier.Keystone === "Keystone").
    expect(board.signals[0]!.tier).toBe("Keystone" as SignalTier);
    expect(board.signals[1]!.tier).toBe("High" as SignalTier);
    // the read-never-invent citation survived the round-trip on every signal.
    expect(board.signals[0]!.grounding).toContain("E-017");
    expect(board.signals[1]!.advances).toEqual(["P7"]);
  });

  test("an OBJECT-shaped reply with no `signals` DEGRADES to an empty board (SAP leniency)", async () => {
    // Board's one field is `signals Signal[]`; an object reply lacking it does not THROW — SAP degrades
    // it to { signals: [] }. That empty board needs NO coercion closure: the honest-empty gate clears it
    // as a clean abstention. The all-array degrade, mirroring WorkPlan.
    const r = (await RESULTS)[1]!;
    expect(r.ok).toBe(true);
    const board = (r as { board: Board }).board;
    expect(board.signals).toEqual([]);
  });

  test("a bare UNSTRUCTURED reply is REJECTED — Board's single array field cannot absorb a bare string", async () => {
    // The divergence from WorkPlan (whose TWO array fields both fall to [] on a bare string): Board has
    // ONE array field, so SAP tries to coerce the bare string INTO `signals` and fails -> b.parse THROWS.
    // The honest-empty handle is therefore HYBRID: T-017-02's parse closure must CATCH this and coerce to
    // an empty board (as expand's closure does), so an unstructured reply still reaches a clean
    // honest-empty andon rather than crashing castPlay.
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("coerce");
  });
});

describe("Survey — render (b.request, offline, render-only key)", () => {
  test("renders the project and charter inputs into the prompt", async () => {
    const r = (await RESULTS)[3]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(PROJECT);
    expect(prompt).toContain(CHARTER);
    // The demand-surveyor framing is rendered too (the authored judgment, paid once).
    expect(prompt).toContain("demand-surveyor");
  });

  // T-044-01 concrete-demand recalibration: the survey ranker shares the board shape with steer, so it
  // carries the SAME steering (kept consistent). Deterministic prompt-contract assertion (no live
  // model) that a board signal must be concrete product demand and self-referential / operational
  // meta-tasks are demoted beneath it or excluded. Live confirmation is DEFERRED to the next cast.
  test("the prompt carries the concrete-demand / anti-self-referential steering (T-044-01)", async () => {
    const r = (await RESULTS)[3]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain("concrete product demand");
    expect(prompt).toContain("self-referential");
  });
});
