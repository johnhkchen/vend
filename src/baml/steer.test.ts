import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { Steer, SignalTier } from "../../baml_client/index.ts";
import type { SteerBridgeOp, SteerBridgeResult } from "./steer-bridge.ts";

// IMPORTANT: every BAML import here is TYPE-ONLY (erased at runtime). A value import of the generated
// client would load the BAML native addon INTO this `bun test` process, whose once-driven runtime reactor
// then makes the suite flaky. All native work happens only in the spawned child. (The decompose/note/
// propose/expand/survey discipline, applied to the sixth play.) The enum field is compared against its
// string-literal member name — `b.parse` returns the enum MEMBER name (alias "keystone" -> "Keystone").
//
// T-018-01 baml-steer: offline authoring pins for SteerProject-lite — no model call, no network. The PARSE
// pin (a canned steer -> typed Steer with a ranked board AND a genuine fork), the SAP-DEGRADE pin, and the
// RENDER pin (b.request renders the two inputs). They run BAML in a child `bun` via steer-bridge.ts; see
// the bridge header for the native-addon-limit rationale.
//
// THE SAP-DEGRADE FINDING (probed live this ticket, plan Step 5): Steer is an all-array class with TWO
// array fields (`signals` + `forks`), so — exactly like WorkPlan and UNLIKE single-field Board — the SAP
// parser DEGRADES *both* an object-shaped reply lacking the fields AND a bare unstructured string to an
// EMPTY steer ({ signals: [], forks: [] }); it never throws. So (unlike survey, whose single-field Board
// throws on a bare string and needs a catch closure) T-018-02's parse closure needs NO try/catch — both
// garbage shapes already land an empty steer the gates clear as a clean abstention.

const BRIDGE = fileURLToPath(new URL("./steer-bridge.ts", import.meta.url));

/** Spawn the bridge in a child bun process, feed it ops, return its results in order. */
async function runBridge(ops: SteerBridgeOp[]): Promise<SteerBridgeResult[]> {
  const proc = Bun.spawn(["bun", "run", BRIDGE], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  proc.stdin.write(JSON.stringify({ ops }));
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`steer-bridge exited ${code}; stdout: ${out}`);
  return (JSON.parse(out) as { results: SteerBridgeResult[] }).results;
}

// A canned model reply — a ranked board of two grounded signals (demand.md ALIASES "keystone"/"high")
// AND one genuine fork (a real 2-option trade-off with stakes + a recommendation). b.parse maps the tier
// aliases back to MEMBER names ("Keystone"/"High"). Each signal names a grounding (read-never-invent).
const CANNED = JSON.stringify({
  signals: [
    {
      what: "Register steerProjectPlay and the vend steer gesture",
      why: "Lets a whole rough project become a staged board AND its real forks in one gesture.",
      tier: "keystone",
      budget: "~1 block (≈2h)",
      advances: ["P2"],
      grounding: "docs/active/epic/E-018.md; the T-018-02 ticket",
      readiness: "ready",
    },
    {
      what: "Calibrate Steer's cold-start token budget",
      why: "Steer is the heaviest read yet (board + forks); pre-fill above Survey's 300k.",
      tier: "high",
      budget: "small (~1h)",
      advances: ["P7"],
      grounding: "the E-016/E-017 budget findings; obs 21402",
      readiness: "blocked: needs T-018-02 live cast actuals",
    },
  ],
  forks: [
    {
      question: "Build the wallet now or measure trust first?",
      options: ["Build the wallet now", "Measure trust first, then build"],
      whyItMatters: "Sequencing commits scarce blocks; building first risks a trust gate we can't yet read.",
      recommendation: "Measure trust first — the cheaper, reversible move while the macro-wallet is parked.",
    },
  ],
});

const PROJECT = "PROJECT_SENTINEL_whole_repo_go_and_see";
const CHARTER = "CHARTER_SENTINEL_value_function_P2_P7";

// One spawn covers every op the suite asserts on (the native-addon limit is per process). The two garbage
// parses pin Steer's TWO-ARRAY SAP degrade (the WorkPlan pattern, probed live — plan Step 5): BOTH an
// object-shaped reply with no fields AND a bare unstructured string DEGRADE to an empty steer; neither
// throws (the divergence from survey's single-field Board, which rejects a bare string).
const RESULTS: Promise<SteerBridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: '{"notes":"nothing actionable here"}' },
  { mode: "parse", text: "this is not a steer at all" },
  { mode: "render", project: PROJECT, charter: CHARTER },
]);

describe("SteerProject — parse (SAP, offline)", () => {
  test("a canned reply parses into a typed Steer — a ranked board AND a genuine fork", async () => {
    const r = (await RESULTS)[0]!;
    expect(r.ok).toBe(true);
    const steer = (r as { steer: Steer }).steer;

    // the board half — two ranked, grounded signals.
    expect(steer.signals).toHaveLength(2);
    expect(steer.signals[0]!.what).toContain("steerProjectPlay");
    // b.parse returns the enum MEMBER name (alias "keystone" -> SignalTier.Keystone === "Keystone").
    expect(steer.signals[0]!.tier).toBe("Keystone" as SignalTier);
    expect(steer.signals[1]!.tier).toBe("High" as SignalTier);
    expect(steer.signals[0]!.grounding).toContain("E-018"); // the read-never-invent citation survived.

    // the fork half — the genuine decision round-tripped intact.
    expect(steer.forks).toHaveLength(1);
    expect(steer.forks[0]!.question).toContain("wallet");
    expect(steer.forks[0]!.options).toHaveLength(2);
    expect(steer.forks[0]!.recommendation).toContain("Measure trust first");
  });

  test("an OBJECT-shaped reply with no `signals`/`forks` DEGRADES to an empty steer (SAP leniency)", async () => {
    // Steer's two fields are arrays; an object reply lacking them does not THROW — SAP degrades it to
    // { signals: [], forks: [] }. That empty steer needs NO coercion closure: every gate clears it as a
    // clean abstention. The all-array degrade, mirroring WorkPlan.
    const r = (await RESULTS)[1]!;
    expect(r.ok).toBe(true);
    const steer = (r as { steer: Steer }).steer;
    expect(steer.signals).toEqual([]);
    expect(steer.forks).toEqual([]);
  });

  test("a bare UNSTRUCTURED reply ALSO degrades to an empty steer (two array fields, NOT Board's reject)", async () => {
    // The divergence from survey's single-field Board (which tries to coerce the bare string INTO its one
    // `signals` field and THROWS): Steer has TWO array fields, so — exactly like WorkPlan — SAP degrades a
    // bare string to { signals: [], forks: [] } rather than rejecting. T-018-02's parse closure therefore
    // needs no try/catch; an unstructured reply already reaches a clean honest-empty andon.
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(true);
    const steer = (r as { steer: Steer }).steer;
    expect(steer.signals).toEqual([]);
    expect(steer.forks).toEqual([]);
  });
});

describe("SteerProject — render (b.request, offline, render-only key)", () => {
  test("renders the project and charter inputs into the prompt", async () => {
    const r = (await RESULTS)[3]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(PROJECT);
    expect(prompt).toContain(CHARTER);
    // The steerer framing — board AND forks — is rendered too (the authored judgment, paid once).
    expect(prompt).toContain("project STEERER");
    expect(prompt).toContain("FORKS");
  });
});
