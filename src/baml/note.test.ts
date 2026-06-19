import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import type { Note } from "../../baml_client/index.ts";
import type { NoteBridgeOp, NoteBridgeResult } from "./note-bridge.ts";

// IMPORTANT: every BAML import here is TYPE-ONLY (erased at runtime). A value import of the
// generated client would load the BAML native addon INTO this `bun test` process, whose
// once-driven runtime reactor then makes the suite flaky. All native work happens only in the
// spawned child. (The decompose.test.ts discipline, applied to the second play.)
//
// T-007-04 second-play-proves-agnostic: the offline authoring pins for CaptureNote — no model
// call, no network. The PARSE pin (canned reply -> typed Note via b.parse), the SAP-leniency
// pin (a malformed reply degrades to an EMPTY note, which the play's `substance` gate then
// stops on — proven in ../play/note-core.test.ts), and the RENDER pin (b.request renders the
// two inputs into the prompt). They run BAML in a child `bun` via note-bridge.ts; see the
// bridge header for the native-addon-limit rationale.

const BRIDGE = fileURLToPath(new URL("./note-bridge.ts", import.meta.url));

/** Spawn the bridge in a child bun process, feed it ops, return its results in order. */
async function runBridge(ops: NoteBridgeOp[]): Promise<NoteBridgeResult[]> {
  const proc = Bun.spawn(["bun", "run", BRIDGE], { stdin: "pipe", stdout: "pipe", stderr: "inherit" });
  proc.stdin.write(JSON.stringify({ ops }));
  await proc.stdin.end();
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) throw new Error(`note-bridge exited ${code}; stdout: ${out}`);
  return (JSON.parse(out) as { results: NoteBridgeResult[] }).results;
}

// A canned model reply — the lisa-token shape `{{ ctx.output_format }}` shows the model.
const CANNED = JSON.stringify({
  title: "casting-engine-proven-agnostic",
  summary: "A second play casts through the same castPlay, so the engine is genuinely generic.",
  points: ["two plays now share one loop", "the loop has zero per-play branches", "each run appends one log record"],
});

const TOPIC = "TOPIC_SENTINEL_second_play_keystone";
const PROJECT = "PROJECT_SENTINEL_go_and_see_snapshot";

// A structurally-present but empty reply — the model emitted the fields but left them blank.
const EMPTY_REPLY = JSON.stringify({ title: "", summary: "", points: [] });

// One spawn covers every op the suite asserts on (the native-addon limit is per process).
const RESULTS: Promise<NoteBridgeResult[]> = runBridge([
  { mode: "parse", text: CANNED },
  { mode: "parse", text: "this is not a note at all" },
  { mode: "parse", text: EMPTY_REPLY },
  { mode: "render", topic: TOPIC, project: PROJECT },
]);

describe("CaptureNote — parse (SAP, offline)", () => {
  test("a canned reply parses into a typed Note", async () => {
    const r = (await RESULTS)[0]!;
    expect(r.ok).toBe(true);
    const note = (r as { note: Note }).note;
    expect(note.title).toBe("casting-engine-proven-agnostic");
    expect(note.summary).toContain("castPlay");
    expect(note.points).toHaveLength(3);
    expect(note.points[0]).toContain("two plays");
  });

  test("a garbage reply is REJECTED by SAP — unlike WorkPlan, Note has required scalars", async () => {
    // Note's `title`/`summary` are required strings (no array fallback), so a reply with none of
    // them does not degrade — b.parse THROWS (missing required fields). This is the divergence
    // from decompose's all-array WorkPlan (which degrades to empty). The play's `parse` closure
    // (note.ts) catches this and coerces it to an empty Note, so a bad reply becomes a clean
    // `gate-failed` andon instead of crashing castPlay.
    const r = (await RESULTS)[1]!;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("required field");
  });

  test("a present-but-empty reply degrades to an EMPTY note (the SAP-leniency pin)", async () => {
    // When the fields ARE present but blank, SAP coerces rather than throwing. The `substance`
    // gate (note-core.ts) classifies this empty note as a STOP — proven in note-core.test.ts.
    const r = (await RESULTS)[2]!;
    expect(r.ok).toBe(true);
    const note = (r as { note: Note }).note;
    expect(note.title).toBe("");
    expect(note.points).toHaveLength(0);
  });
});

describe("CaptureNote — render (b.request, offline, render-only key)", () => {
  test("renders the topic and project inputs into the prompt", async () => {
    const r = (await RESULTS)[3]!;
    expect(r.ok).toBe(true);
    const { prompt } = r as { prompt: string };
    expect(prompt).toContain(TOPIC);
    expect(prompt).toContain(PROJECT);
    // The capture framing is rendered too (the authored judgment, paid once).
    expect(prompt).toContain("note-taker");
  });
});
