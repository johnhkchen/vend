import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { Signal, SignalTier } from "../../baml_client/index.ts";
import type { ExpandBridgeOp, ExpandBridgeResult } from "./expand-bridge.ts";

// IMPORTANT: every BAML import here is TYPE-ONLY (erased at runtime). A value import of the
// generated client would load the BAML native addon INTO this `bun test` process, whose
// once-driven runtime reactor then makes the suite flaky. All native work happens only in the
// spawned child. (The decompose/note/propose discipline, applied to the fourth play.) The enum
// field is compared against its string-literal member name — `b.parse` returns the enum MEMBER
// name (alias "keystone" -> SignalTier.Keystone === "Keystone").
//
// T-016-01 baml-expand-fragment: offline authoring pins for ExpandFragment — no model call, no
// network. The PARSE pin (canned reply -> typed Signal via b.parse), the SAP-rejection pin (a
// garbage reply is REJECTED because Signal has required scalars, unlike all-array WorkPlan), and
// the RENDER pin (b.request renders the three inputs into the prompt). They run BAML in a child
// `bun` via expand-bridge.ts; see the bridge header for the native-addon-limit rationale.

const BRIDGE = fileURLToPath(new URL("./expand-bridge.ts", import.meta.url));

/** Spawn the bridge in a child bun process, feed it ops, return its results in order. */
async function runBridge(ops: ExpandBridgeOp[]): Promise<ExpandBridgeResult[]> {
  const proc = Bun.spawn(["bun", "run", BRIDGE], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  proc.stdin.write(JSON.stringify({ ops }));
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`expand-bridge exited ${code}; stdout: ${out}`);
  return (JSON.parse(out) as { results: ExpandBridgeResult[] }).results;
}

// A canned model reply — the demand.md ALIASES `{{ ctx.output_format }}` shows the model
// (tier "keystone"). b.parse maps them back to MEMBER names ("Keystone"). A plausible board-ready
// signal read off a real fragment, with a named grounding (the read-never-invent citation).
const CANNED = JSON.stringify({
  what: "Register expandFragmentPlay and the vend expand gesture",
  why: "Lets a felt 'this is rough' become a staged, priced signal in one gesture (O1).",
  tier: "keystone",
  budget: "~1 block (≈2h)",
  advances: ["P2"],
  grounding: "TODO in docs/active/pm/proposed-batch.md #1; the E-016 demand.md row",
  readiness: "ready",
});

const FRAGMENT = "FRAGMENT_SENTINEL_rough_one_liner";
const CHARTER = "CHARTER_SENTINEL_value_function_P2_P7";
const PROJECT = "PROJECT_SENTINEL_go_and_see_snapshot";

// One spawn covers every op the suite asserts on (the native-addon limit is per process).
const RESULTS: Promise<ExpandBridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: "this is not a demand signal at all" },
  { mode: "render", fragment: FRAGMENT, charter: CHARTER, project: PROJECT },
]);

describe("ExpandFragment — parse (SAP, offline)", () => {
  test("a canned reply parses into a typed Signal", async () => {
    const r = (await RESULTS)[0]!;
    expect(r.ok).toBe(true);
    const signal = (r as { signal: Signal }).signal;

    expect(signal.what).toContain("expandFragmentPlay");
    expect(signal.why.length).toBeGreaterThan(0);
    // b.parse returns the enum MEMBER name (alias "keystone" -> SignalTier.Keystone === "Keystone").
    expect(signal.tier).toBe("Keystone" as SignalTier);
    expect(signal.budget).toContain("block");
    expect(signal.advances).toEqual(["P2"]);
    // the read-never-invent citation survived the round-trip.
    expect(signal.grounding).toContain("proposed-batch.md");
    expect(signal.readiness).toBe("ready");
  });

  test("a garbage reply is REJECTED by SAP — Signal has required scalars (unlike WorkPlan)", async () => {
    // Signal's what/why/tier/... are required (no array fallback), so a reply with none of them does
    // not degrade to empty — b.parse THROWS (missing required fields). This is the divergence from
    // decompose's all-array WorkPlan (which degrades to empty), and mirrors EpicCard/Note. The play's
    // parse closure (T-016-02) catches this and coerces it, so a bad reply becomes a clean
    // honest-empty andon instead of crashing castPlay.
    const r = (await RESULTS)[1]!;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("required field");
  });
});

describe("ExpandFragment — render (b.request, offline, render-only key)", () => {
  test("renders the fragment, charter, and project inputs into the prompt", async () => {
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(FRAGMENT);
    expect(prompt).toContain(CHARTER);
    expect(prompt).toContain(PROJECT);
    // The demand-extractor framing is rendered too (the authored judgment, paid once).
    expect(prompt).toContain("demand-extractor");
  });
});
