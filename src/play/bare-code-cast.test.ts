import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DraftPhase, DraftPriority, DraftStatus, DraftType, TicketDraft, WorkPlan } from "../../baml_client/index.ts";
import { castPlay } from "../engine/cast.ts";
import type { Play } from "../engine/play.ts";
import type { Budget } from "../budget/budget.ts";
import type { DispenseOptions, Executor, ResultMessage } from "../executor/executor.ts";
import { clear } from "../gate/gates.ts";
import { BareCodeError, materialize } from "./materialize.ts";
import type { DegradeDisposition } from "./degrade-disposition.ts";

// T-077-02-02 AC — the cast-level degrade-not-discard proof, both sides:
//
//  1. EDITORIAL DEGRADE: a dispensed plan that clears every REAL gate but whose ticket PROSE
//     cites codes the charter never defines materializes with honest annotations and exact
//     occurrence-level dispositions. The bounds gate checks only `advances`, so this drives the
//     inline materializer surface directly.
//  2. STRUCTURAL REFUSAL: a plan missing the required story contract still stops at the real
//     story-completeness gate and writes zero files.
//  3. GREP-CLEAN: a full plan (five-section story contract, two tickets, prose + advances
//     citations) casts to success, and every written body greps clean of bare unexplained
//     P/N codes — the story-acceptance bar, token-free.
//
// story-gate-cast.test.ts's skeleton (T-066-01-02), retargeted: stub executor dispensing a
// canned WorkPlan, a decompose-SHAPED fixture play wiring the REAL `clear` + REAL
// `materialize` (and decomposeEffect's exact BareCodeError relabel arm), the REAL castPlay.
// No BAML addon: every baml_client import is TYPE-ONLY.

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "vend-bare-code-"));
  tmps.push(d);
  return d;
}

/** A high envelope so nothing exhausts — the cast turns on the write guard, not the budget. */
const BIG_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 };

/** Bold DEFINITION shape — the only shape that mints snapshot entries. N4/N2 are deliberately
 *  NOT defined; they are the editorial codes the degraded plan cites in prose. */
const CHARTER = [
  "- **P1 — Author once, run forever.** Cost lives at authoring.",
  "- **P3 — Gates are the contract.** Quality lives inside the work.",
  "- **P4 — Autonomy by default, not supervision.** Work proceeds against gates.",
  "- **N1 — Not a chat copilot.** Removing yourself from the loop.",
].join("\n");

const ticket = (over: Partial<TicketDraft> = {}): TicketDraft => ({
  id: "T-900-01",
  story: "S-900",
  title: "register-the-first-play",
  type: "Task" as DraftType,
  status: "Open" as DraftStatus,
  priority: "High" as DraftPriority,
  phase: "Ready" as DraftPhase,
  depends_on: [],
  purpose: "Register a play on the shelf so it is pickable (P1).",
  advances: ["P1"],
  doneSignal: "A play resolves by name from the registry.",
  ...over,
});

/** The five-section story contract, honored — every gate passes; only the write guard can
 *  refuse what these plans render. */
const storyOf = (tickets: readonly string[]) => ({
  id: "S-900",
  title: "stand-up-the-shelf",
  type: "Task" as DraftType,
  status: "Open" as DraftStatus,
  priority: "High" as DraftPriority,
  tickets: [...tickets],
  scope: "The shelf registry and its first entry — src/shelf only (P3).",
  storyAcceptance: "A registered play resolves by name and the suite pins the lookup.",
  honestBoundary: "Fixture-proven and free (P4); the live cast closes the epic, not this story.",
  waveRationale: "T-900-01 settles the registry; T-900-02 then builds on it.",
  outOfSlice: "The auto-drainer and the press — sibling epics own those (N1).",
});

/** Clears every gate (advances resolve, contract complete); only inline prose cites miss. */
const EDITORIAL_PLAN: WorkPlan = {
  stories: [storyOf(["T-900-01"])],
  tickets: [ticket({
    purpose: "Vend is N4 — Not an executor; the shelf is N2 — Not a babysitting dashboard.",
  })],
};

/** A structural shell: value can clear, but the required story contract is absent. */
const STRUCTURAL_PLAN: WorkPlan = {
  stories: [{
    id: "S-900",
    title: "stand-up-the-shelf",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    tickets: ["T-900-01"],
  }],
  tickets: [ticket()],
};

/** The full plan whose written bodies must grep clean: prose and advances citations only
 *  of codes the charter defines. */
const CLEAN_PLAN: WorkPlan = {
  stories: [storyOf(["T-900-01", "T-900-02"])],
  tickets: [
    ticket(),
    ticket({
      id: "T-900-02",
      title: "wire-the-drain",
      depends_on: ["T-900-01"],
      purpose: "Wire the drain so cleared work flows without supervision (P4).",
      advances: ["P4"],
      doneSignal: "Bodies honor N1 while the drain runs unattended.",
    }),
  ],
};

/** A stub Executor whose "dispensed" reply is the given text (cast.test.ts pattern). */
function stubExecutor(resultText: string): Executor {
  return {
    id: "stub",
    async probe() { return { ok: true }; },
    async dispense(opts: DispenseOptions): Promise<ResultMessage> {
      const result = {
        type: "result",
        subtype: "success",
        result: resultText,
        usage: { input_tokens: 7, output_tokens: 3 },
        total_cost_usd: 0,
        model: "stub-model-1",
      } as ResultMessage;
      opts.onMessage?.(result);
      return result;
    },
  };
}

/** A decompose-SHAPED fixture play: REAL `clear`, REAL `materialize`, and the retained
 *  BareCodeError relabel arm. The callback observes materializer dispositions before the generic
 *  cast-summary/run-log join lands in T-077-02-04. */
function decomposeShapedPlay(
  dirs: { storiesDir: string; ticketsDir: string },
  onDegrades?: (degrades: readonly DegradeDisposition[]) => void,
): Play<{ epic: string; charter: string }, WorkPlan> {
  return {
    name: "bare-code-fixture",
    summary: "cast a canned WorkPlan through the real gates, materializer, and write guard (test fixture)",
    render: (i) => `decompose (fixture): ${i.epic}`,
    parse: (text) => JSON.parse(text) as WorkPlan,
    gates: (plan, ctx) => clear(plan, { epic: ctx.inputs.epic, charter: ctx.inputs.charter }),
    effect: async (plan, ctx) => {
      try {
        const { storyFiles, ticketFiles, degrades } = await materialize(plan, dirs, ctx.inputs.charter);
        onDegrades?.(degrades);
        return { ok: true, detail: "materialized (fixture)", artifacts: [...storyFiles, ...ticketFiles] };
      } catch (e) {
        if (e instanceof BareCodeError) {
          const where = e.hits.map((h) => `${h.file}: ${h.codes.join(", ")}`).join("; ");
          return { ok: false, outcome: "bare-code", detail: `bare-code — charter cannot resolve cited code(s): ${where}` };
        }
        throw e;
      }
    },
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
}

/** The AC's grep, hardened at the trailing boundary the way the guard is: a P/N code not
 *  followed by ` — ` is bare, and an italic `_` after the digits must not hide it. */
const BARE_PN = /\b[PN]\d+(?![0-9A-Za-z])(?! —)/;

test("unresolved inline prose cites annotate and materialize with ordered degradation dispositions", async () => {
  const root = await tmp();
  const dirs = { storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  const runLogPath = join(root, "runs.jsonl");
  let observedDegrades: readonly DegradeDisposition[] | undefined;

  const summary = await castPlay(decomposeShapedPlay(dirs, (degrades) => {
    observedDegrades = degrades;
  }), { epic: "E-900 fixture", charter: CHARTER }, BIG_BUDGET, {
    subject: "E-900",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(JSON.stringify(EDITORIAL_PLAN)),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(observedDegrades).toEqual([
    { code: "N4", location: "T-900-01.md#purpose", action: "annotate" },
    { code: "N2", location: "T-900-01.md#purpose", action: "annotate" },
  ]);
  expect(await readdir(dirs.storiesDir)).toEqual(["S-900.md"]);
  expect(await readdir(dirs.ticketsDir)).toEqual(["T-900-01.md"]);

  const ticketBody = await readFile(join(dirs.ticketsDir, "T-900-01.md"), "utf8");
  expect(ticketBody).toContain(
    "Vend is [unresolved charter cite] Not an executor; the shelf is [unresolved charter cite] Not a babysitting dashboard.",
  );
  expect(ticketBody).not.toContain("N4");
  expect(ticketBody).not.toContain("N2");

  // The ledger join is T-077-02-04; for now it truthfully records successful clearance and every
  // real gate while the fixture callback proves the disposition returned at the effect seam.
  const rec = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(rec.outcome).toBe("success");
  expect(rec.gateResults).toEqual(
    ["value", "story-completeness", "allocation", "bounds", "structural"].map((gate) => ({ gate, passed: true })),
  );
});

test("a structural story-contract defect still refuses at the real gate with ZERO files written", async () => {
  const root = await tmp();
  const dirs = { storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  const runLogPath = join(root, "runs.jsonl");
  let effectObserved = false;

  const summary = await castPlay(decomposeShapedPlay(dirs, () => {
    effectObserved = true;
  }), { epic: "E-900 fixture", charter: CHARTER }, BIG_BUDGET, {
    subject: "E-900",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(JSON.stringify(STRUCTURAL_PLAN)),
  });

  expect(summary.outcome).toBe("gate-failed");
  expect(summary.materialized).toBe(false);
  expect(effectObserved).toBe(false);
  expect(await readdir(dirs.storiesDir).catch(() => null)).toBeNull();
  expect(await readdir(dirs.ticketsDir).catch(() => null)).toBeNull();

  const rec = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(rec.outcome).toBe("gate-failed");
  expect(rec.gateResults.find((row: { gate: string }) => row.gate === "story-completeness")).toMatchObject({
    gate: "story-completeness",
    passed: false,
  });
});

test("the full-plan contrast: every written body greps clean of bare unexplained P/N codes", async () => {
  const root = await tmp();
  const dirs = { storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(decomposeShapedPlay(dirs), { epic: "E-900 fixture", charter: CHARTER }, BIG_BUDGET, {
    subject: "E-900",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(JSON.stringify(CLEAN_PLAN)),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);

  // The story-acceptance grep, over every written body: no bare unexplained P/N code.
  const bodies: Array<{ file: string; body: string }> = [];
  for (const [dir, names] of [
    [dirs.storiesDir, await readdir(dirs.storiesDir)],
    [dirs.ticketsDir, await readdir(dirs.ticketsDir)],
  ] as const) {
    for (const name of names) bodies.push({ file: name, body: await readFile(join(dir, name), "utf8") });
  }
  expect(bodies.map((b) => b.file).sort()).toEqual(["S-900.md", "T-900-01.md", "T-900-02.md"]);
  for (const { file, body } of bodies) {
    expect({ file, bare: body.match(BARE_PN) }).toEqual({ file, bare: null });
  }

  // And the grep is not vacuous: the codes are THERE, carrying their cut-time text.
  const t1 = bodies.find((b) => b.file === "T-900-01.md")!.body;
  expect(t1).toContain("_Advances: P1 — Author once, run forever_");
  expect(t1).toContain("pickable (P1 — Author once, run forever)");
  const s = bodies.find((b) => b.file === "S-900.md")!.body;
  expect(s).toContain("**Scope:** The shelf registry and its first entry — src/shelf only (P3 — Gates are the contract).");
});
