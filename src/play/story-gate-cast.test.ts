import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DraftPhase, DraftPriority, DraftStatus, DraftType, WorkPlan } from "../../baml_client/index.ts";
import { castPlay } from "../engine/cast.ts";
import type { Play } from "../engine/play.ts";
import type { Budget } from "../budget/budget.ts";
import type { DispenseOptions, Executor, ResultMessage } from "../executor/executor.ts";
import { clear } from "../gate/gates.ts";
import { materialize } from "./materialize.ts";

// T-066-01-02 AC2 — the cast-level proof that a DISPENSED shell never reaches the effect: a stub
// executor "dispenses" today's ten-line shell (a WorkPlan whose story carries none of the five
// contract fields), the REAL `clear` refuses it at the story-completeness gate, and because
// `classify` blocks the effect on any gate stop, the REAL `materialize` is never called — no
// story or ticket file exists after the refused cast, and the run record carries the andon.
//
// Composes two proven precedents with NO BAML addon (every baml_client import is TYPE-ONLY;
// decompose-epic.ts itself is never value-imported by bun tests — the addon one-call limit):
//  - cast.test.ts (T-035-01): a stub Executor injected through `castPlay`;
//  - chain-propose-decompose.test.ts (T-011-02): type-only WorkPlan literals + the real
//    `materialize` into tmp dirs.
// The fixture play wires `gates` exactly as `decomposeEpicPlay.gates` does — the same `clear`
// over the same context shape — so the refusal proven here is the production gate's judgment.

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "vend-story-gate-"));
  tmps.push(d);
  return d;
}

/** A high envelope so nothing exhausts — the cast turns on the gate, not the budget. */
const BIG_BUDGET: Budget = { timeMs: 60_000, tokens: 1_000_000 };

// Bold DEFINITION shape (T-067-01-03): the write guard polices bare P/N codes in rendered
// bodies against the charter's snapshot, and only bold definitions mint entries — the old
// prose-shaped charter would refuse the contrast cast's `advances: [P1]` as bare.
const CHARTER =
  "**P1 — Author once, run forever.** **P3 — Gates are the contract.** **N1 — Not a chat copilot.**";

/** One fully-valid ticket, so value/allocation/bounds/structural ALL pass — the only gate that
 *  can stop the shell plan below is story-completeness (isolates the refusal to the new gate). */
const TICKET = {
  id: "T-900-01",
  story: "S-900",
  title: "register-the-first-play",
  type: "Task" as DraftType,
  status: "Open" as DraftStatus,
  priority: "High" as DraftPriority,
  phase: "Ready" as DraftPhase,
  depends_on: [],
  purpose: "Register a play on the shelf so it is pickable.",
  advances: ["P1"],
  doneSignal: "A play resolves by name from the registry.",
};

/** Today's ten-line shell at the parse layer: all five contract fields are typed absences
 *  (explicit nulls — what a JSON round-trip preserves; omission parses identically). */
const SHELL_PLAN: WorkPlan = {
  stories: [
    {
      id: "S-900",
      title: "stand-up-the-shelf",
      type: "Task" as DraftType,
      status: "Open" as DraftStatus,
      priority: "High" as DraftPriority,
      tickets: ["T-900-01"],
      scope: null,
      storyAcceptance: null,
      honestBoundary: null,
      waveRationale: null,
      outOfSlice: null,
    },
  ],
  tickets: [TICKET],
};

/** The same plan with the story contract honored — the passing contrast. */
const CONTRACT_PLAN: WorkPlan = {
  stories: [
    {
      ...SHELL_PLAN.stories[0]!,
      scope: "The shelf registry and its first entry — src/shelf only.",
      storyAcceptance: "A registered play resolves by name and the suite pins the lookup.",
      honestBoundary: "Fixture-proven and free; the live cast closes the epic, not this story.",
      waveRationale: "One ticket, one wave — nothing to parallelize yet.",
      outOfSlice: "The auto-drainer and the press — sibling epics own those.",
    },
  ],
  tickets: [TICKET],
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

/** A decompose-SHAPED fixture play: parse is JSON (the stub dispenses a serialized WorkPlan),
 *  `gates` is the REAL `clear` wired exactly as decomposeEpicPlay wires it, and `effect` calls
 *  the REAL `materialize` — the write the refused cast must never reach. */
function decomposeShapedPlay(dirs: { storiesDir: string; ticketsDir: string }): Play<{ epic: string; charter: string }, WorkPlan> {
  return {
    name: "decompose-shaped-fixture",
    summary: "cast a canned WorkPlan through the real gates and materializer (test fixture)",
    render: (i) => `decompose (fixture): ${i.epic}`,
    parse: (text) => JSON.parse(text) as WorkPlan,
    gates: (plan, ctx) => clear(plan, { epic: ctx.inputs.epic, charter: ctx.inputs.charter }),
    effect: async (plan, ctx) => {
      const { storyFiles, ticketFiles } = await materialize(plan, dirs, ctx.inputs.charter);
      return { ok: true, detail: "materialized (fixture)", artifacts: [...storyFiles, ...ticketFiles] };
    },
    budget: BIG_BUDGET,
    card: { color: ["blue", "white"], type: "sorcery", rarity: "common" },
  };
}

test("a dispensed shell never reaches the effect — gate-failed, story-incomplete andon, NO file written", async () => {
  const root = await tmp();
  const dirs = { storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(decomposeShapedPlay(dirs), { epic: "E-900 fixture", charter: CHARTER }, BIG_BUDGET, {
    subject: "E-900",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(JSON.stringify(SHELL_PLAN)),
  });

  // The cast REFUSED: the gate stopped the line, nothing materialized.
  expect(summary.outcome).toBe("gate-failed");
  expect(summary.materialized).toBe(false);

  // The effect never ran: materialize never created its target dirs, so NO story file (and no
  // ticket file) exists anywhere after the refused cast — the AC's observable.
  expect(await readdir(dirs.storiesDir).catch(() => null)).toBeNull();
  expect(await readdir(dirs.ticketsDir).catch(() => null)).toBeNull();

  // The ledger records the verdict: one failed story-completeness row whose detail names the
  // story id, the story-incomplete andon token, and every missing section.
  const lines = (await readFile(runLogPath, "utf8")).trim().split("\n");
  expect(lines).toHaveLength(1);
  const rec = JSON.parse(lines[0]!);
  expect(rec.outcome).toBe("gate-failed");
  expect(rec.gateResults).toEqual([
    {
      gate: "story-completeness",
      passed: false,
      detail: "S-900: story-incomplete — missing: scope, storyAcceptance, honestBoundary, waveRationale, outOfSlice",
    },
  ]);
});

test("the contrast cast: the SAME pipeline lands a contract-shaped plan — the refusal above is the gate's", async () => {
  const root = await tmp();
  const dirs = { storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(decomposeShapedPlay(dirs), { epic: "E-900 fixture", charter: CHARTER }, BIG_BUDGET, {
    subject: "E-900",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(JSON.stringify(CONTRACT_PLAN)),
  });

  expect(summary.outcome).toBe("success");
  expect(summary.materialized).toBe(true);
  expect(await readdir(dirs.storiesDir)).toHaveLength(1); // the story file EXISTS this time
  expect(await readdir(dirs.ticketsDir)).toHaveLength(1);

  // gateResults records the verdict either way (the AC's pass side): five passed rows, in order.
  const rec = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(rec.gateResults).toEqual(
    ["value", "story-completeness", "allocation", "bounds", "structural"].map((gate) => ({ gate, passed: true })),
  );
});
