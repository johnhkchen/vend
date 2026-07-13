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

// T-067-01-03 AC — the cast-level proof of the bare-code write guard, both sides:
//
//  1. REFUSAL: a dispensed plan that clears every REAL gate but whose ticket PROSE cites a
//     code the charter never defines is refused with the named `bare-code` andon BEFORE any
//     writeFile — zero partial output. The bare code arrives through prose deliberately: the
//     bounds gate checks only `advances` arrays, so this is exactly the hole gates cannot
//     see and only the write guard covers.
//  2. GREP-CLEAN: a full plan (five-section story contract, two tickets, prose + advances
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

/** Bold DEFINITION shape — the only shape that mints snapshot entries. P9 is deliberately
 *  NOT defined; it is the code the refused plan cites in prose. */
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

/** Clears every gate (advances resolve, contract complete) — then the guard catches the
 *  prose-cited P9 the charter cannot resolve. */
const REFUSED_PLAN: WorkPlan = {
  stories: [storyOf(["T-900-01"])],
  tickets: [ticket({ purpose: "Register a play on the shelf; aligns the cut with P9 end to end." })],
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

/** A decompose-SHAPED fixture play: REAL `clear`, REAL `materialize`, and decomposeEffect's
 *  exact BareCodeError relabel arm — the refusal proven here is the production path's. */
function decomposeShapedPlay(dirs: { storiesDir: string; ticketsDir: string }): Play<{ epic: string; charter: string }, WorkPlan> {
  return {
    name: "bare-code-fixture",
    summary: "cast a canned WorkPlan through the real gates, materializer, and write guard (test fixture)",
    render: (i) => `decompose (fixture): ${i.epic}`,
    parse: (text) => JSON.parse(text) as WorkPlan,
    gates: (plan, ctx) => clear(plan, { epic: ctx.inputs.epic, charter: ctx.inputs.charter }),
    effect: async (plan, ctx) => {
      try {
        const { storyFiles, ticketFiles } = await materialize(plan, dirs, ctx.inputs.charter);
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

test("a cast whose charter is missing a prose-cited code is refused — bare-code andon, NO file written", async () => {
  const root = await tmp();
  const dirs = { storiesDir: join(root, "stories"), ticketsDir: join(root, "tickets") };
  const runLogPath = join(root, "runs.jsonl");

  const summary = await castPlay(decomposeShapedPlay(dirs), { epic: "E-900 fixture", charter: CHARTER }, BIG_BUDGET, {
    subject: "E-900",
    projectRoot: root,
    transcriptDir: root,
    runLogPath,
    executor: stubExecutor(JSON.stringify(REFUSED_PLAN)),
  });

  // The named andon: every REAL gate passed (the bare code hides in prose, invisible to the
  // bounds gate), yet the cast refused before the first byte.
  expect(summary.outcome).toBe("bare-code");
  expect(summary.materialized).toBe(false);

  // Zero partial output: materialize threw before its first mkdir — neither dir exists.
  expect(await readdir(dirs.storiesDir).catch(() => null)).toBeNull();
  expect(await readdir(dirs.ticketsDir).catch(() => null)).toBeNull();

  // The ledger records the named outcome, with all five gates passed on the record.
  const rec = JSON.parse((await readFile(runLogPath, "utf8")).trim());
  expect(rec.outcome).toBe("bare-code");
  expect(rec.gateResults).toEqual(
    ["value", "story-completeness", "allocation", "bounds", "structural"].map((gate) => ({ gate, passed: true })),
  );
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
