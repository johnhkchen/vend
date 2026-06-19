import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { CardColor, CardRarity, CardType, EpicCard } from "../../baml_client/index.ts";
import type { ProposeBridgeOp, ProposeBridgeResult } from "./propose-bridge.ts";

// IMPORTANT: every BAML import here is TYPE-ONLY (erased at runtime). A value import of the
// generated client would load the BAML native addon INTO this `bun test` process, whose
// once-driven runtime reactor then makes the suite flaky. All native work happens only in the
// spawned child. (The decompose/note discipline, applied to the third play.) Enum fields are
// compared against their string-literal member names — `b.parse` returns the enum MEMBER name
// (alias "blue" -> CardColor.Blue === "Blue").
//
// T-009-01 baml-propose-epic: offline authoring pins for ProposeEpic — no model call, no network.
// The PARSE pin (canned reply -> typed EpicCard via b.parse), the SAP-rejection pin (a garbage
// reply is REJECTED because EpicCard has required scalars, unlike all-array WorkPlan), and the
// RENDER pin (b.request renders the three inputs into the prompt). They run BAML in a child `bun`
// via propose-bridge.ts; see the bridge header for the native-addon-limit rationale.

const BRIDGE = fileURLToPath(new URL("./propose-bridge.ts", import.meta.url));

/** Spawn the bridge in a child bun process, feed it ops, return its results in order. */
async function runBridge(ops: ProposeBridgeOp[]): Promise<ProposeBridgeResult[]> {
  const proc = Bun.spawn(["bun", "run", BRIDGE], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  proc.stdin.write(JSON.stringify({ ops }));
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`propose-bridge exited ${code}; stdout: ${out}`);
  return (JSON.parse(out) as { results: ProposeBridgeResult[] }).results;
}

// A canned model reply — the card-model ALIASES `{{ ctx.output_format }}` shows the model
// (kind/type "permanent", color "blue", rarity "rare"). b.parse maps them back to MEMBER names
// ("Permanent"/"Blue"/"Rare"). A plausible Blue permanent epic proposal with a full body.
const CANNED = JSON.stringify({
  id: "E-010",
  title: "vend-the-whole-roadmap",
  kind: "permanent",
  advances: ["P1"],
  serves: "Chain ProposeEpic into DecomposeEpic so a raw signal clears end to end from one press.",
  manaCost: "{2}{U}",
  color: ["blue"],
  type: "permanent",
  rarity: "rare",
  intent: "Compose the two clearing functions so a demand signal becomes an epic and then tickets.",
  value: "Completes signal -> epic -> tickets, advancing author-once-run-forever (P1).",
  doneLooksLike: "One press on a demand signal yields a gated epic card and its cleared tickets.",
  context: "Builds on E-007's engine and E-009's ProposeEpic registration. Out: the auto-drainer (PE-1).",
});

const SIGNAL = "SIGNAL_SENTINEL_pulled_demand_one_liner";
const CHARTER = "CHARTER_SENTINEL_value_function_P1_P7";
const PROJECT = "PROJECT_SENTINEL_go_and_see_snapshot";

// One spawn covers every op the suite asserts on (the native-addon limit is per process).
const RESULTS: Promise<ProposeBridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: "this is not an epic card at all" },
  { mode: "render", signal: SIGNAL, charter: CHARTER, project: PROJECT },
]);

describe("ProposeEpic — parse (SAP, offline)", () => {
  test("a canned reply parses into a typed EpicCard", async () => {
    const r = (await RESULTS)[0]!;
    expect(r.ok).toBe(true);
    const card = (r as { card: EpicCard }).card;

    // frontmatter
    expect(card.id).toBe("E-010");
    expect(card.title).toBe("vend-the-whole-roadmap");
    // b.parse returns the enum MEMBER name (alias "permanent" -> CardType.Permanent === "Permanent").
    expect(card.kind).toBe("Permanent" as CardType);
    expect(card.advances).toEqual(["P1"]);
    expect(card.serves).toContain("end to end");

    // stat-block
    expect(card.manaCost).toBe("{2}{U}");
    expect(card.color).toEqual(["Blue"] as CardColor[]);
    expect(card.type).toBe("Permanent" as CardType);
    expect(card.rarity).toBe("Rare" as CardRarity);
    // kind and type are the same axis — they agree.
    expect(card.kind).toBe(card.type);

    // body
    expect(card.intent.length).toBeGreaterThan(0);
    expect(card.value).toContain("P1");
    expect(card.doneLooksLike).toContain("press");
    expect(card.context).toContain("PE-1");
  });

  test("a garbage reply is REJECTED by SAP — EpicCard has required scalars (unlike WorkPlan)", async () => {
    // EpicCard's id/title/serves/... are required strings (no array fallback), so a reply with none
    // of them does not degrade to empty — b.parse THROWS (missing required fields). This is the
    // divergence from decompose's all-array WorkPlan (which degrades to empty), and mirrors Note.
    // The play's parse closure (T-009-03) catches this and coerces it, so a bad reply becomes a
    // clean gate-failed andon instead of crashing castPlay.
    const r = (await RESULTS)[1]!;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("required field");
  });
});

describe("ProposeEpic — render (b.request, offline, render-only key)", () => {
  test("renders the signal, charter, and project inputs into the prompt", async () => {
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(SIGNAL);
    expect(prompt).toContain(CHARTER);
    expect(prompt).toContain(PROJECT);
    // The proposer framing is rendered too (the authored judgment, paid once).
    expect(prompt).toContain("epic-proposer");
  });
});
