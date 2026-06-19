import { describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Board, Signal, SignalTier } from "../../baml_client/index.ts";
import type { CastContext } from "../engine/play.ts";
import { classify } from "../engine/cast-core.ts";
import { clear, renderBoard, SURVEY_GATE_NAMES } from "./survey-core.ts";
import { STAGING_DIR } from "./expand-effect.ts";
import { BOARD_STEM, renderStagedBoard, surveyBoardEffect, type SurveyInputs } from "./survey-effect.ts";

// T-017-02: the OFFLINE demonstration of the Survey cast — the AC#3 proof that does not need a live
// model. Every BAML import is TYPE-ONLY (erased at runtime) and the enum field is a string-literal cast
// (`b.parse` returns exactly the member string "Keystone"), so NO native addon loads into this
// `bun test` process (the expand-effect.test.ts / survey-core.test.ts discipline). We prove the two
// halves the cast plugs in beyond the already-pinned pure core (survey-core.test.ts):
//   (1) the impure effect STAGES the ranked board under docs/active/pm/staged/survey-board.md on a real
//       temp-dir projectRoot — and writes NOTHING to demand.md or the board (the staging contract), and
//   (2) the clear→classify wiring — a grounded ranked board materializes (the effect would run); an
//       EMPTY board materializes too (the honest abstention CLEARS); a padded/ungrounded board is a
//       gate-failed andon that stages nothing.

/** A complete, grounded Signal at a given tier — the shape `b.parse` yields (member-name tier). */
function mkSignal(tier: SignalTier, over: Partial<Signal> = {}): Signal {
  return {
    what: `Move at ${tier}`,
    why: `Closes vision-distance at the ${tier} tier.`,
    tier,
    budget: "~1 block (≈2h)",
    advances: ["P2"],
    grounding: "demand.md row; a TODO in docs/active/pm/",
    readiness: "ready",
    ...over,
  };
}

const mkBoard = (...signals: Signal[]): Board => ({ signals });

// A ranked board: keystone → high → standard, all grounded — the clearing case.
const RANKED = mkBoard(
  mkSignal("Keystone" as SignalTier),
  mkSignal("High" as SignalTier),
  mkSignal("Standard" as SignalTier),
);

const ctxFor = (root: string): CastContext<SurveyInputs> => ({
  inputs: { project: "# Project snapshot", charter: "P2 two-gestures." },
  projectRoot: root,
});

/** A throwaway projectRoot — the effect creates docs/active/pm/staged/ under it on demand. */
async function seedRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-survey-"));
}

/** True iff `path` exists. The negative assertion for "nothing was written to the board". */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("surveyBoardEffect — stages the ranked board under the PM desk, never the board", () => {
  test("writes docs/active/pm/staged/survey-board.md carrying the demand rows + a pull line per signal", async () => {
    const root = await seedRoot();
    try {
      const res = await surveyBoardEffect(RANKED, ctxFor(root));
      expect(res.ok).toBe(true);
      expect(res.outcome).toBeUndefined();

      const expected = join(root, STAGING_DIR, `${BOARD_STEM}.md`);
      expect(res.artifacts).toEqual([expected]);
      // parity with the other effects: `produced` (the threadable handle) == artifacts[0].
      expect(res.produced).toBe(expected);
      expect(res.produced).toBe(res.artifacts?.[0]);

      const written = await readFile(expected, "utf8");
      // the structured board IS the demand.md rows (every Signal field round-trips via the shared renderer).
      expect(written).toContain(renderBoard(RANKED));
      expect(written).toContain("| Signal | Value | Budget (envelope) | Status |");
      // a pull-ready `vend chain` gesture for each signal (the staging unit), top-ranked recommended.
      expect(written).toContain(`vend chain "${RANKED.signals[0]!.what} — ${RANKED.signals[0]!.why}"`);
      expect(written).toContain(`vend chain "${RANKED.signals[2]!.what} — ${RANKED.signals[2]!.why}"`);
      expect(written).toContain("recommended next pull");
      // honest about its origin + un-promoted status.
      expect(written).toContain("survey");
      expect(written).toContain("not promoted");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes ONLY under docs/active/pm/ — never demand.md or the board (epic/stories/tickets)", async () => {
    const root = await seedRoot();
    try {
      await surveyBoardEffect(RANKED, ctxFor(root));
      // the staging contract: the active board is untouched by a survey cast.
      expect(await exists(join(root, "docs/active/demand.md"))).toBe(false);
      expect(await exists(join(root, "docs/active/epic"))).toBe(false);
      expect(await exists(join(root, "docs/active/stories"))).toBe(false);
      expect(await exists(join(root, "docs/active/tickets"))).toBe(false);
      // the staged board is the only thing written.
      expect(await exists(join(root, STAGING_DIR, `${BOARD_STEM}.md`))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an EMPTY board still stages — an honest abstention note, no table (the cleared empty board)", async () => {
    const root = await seedRoot();
    try {
      const res = await surveyBoardEffect(mkBoard(), ctxFor(root));
      expect(res.ok).toBe(true);
      const written = await readFile(join(root, STAGING_DIR, `${BOARD_STEM}.md`), "utf8");
      expect(written).toContain("no real demand gradient");
      expect(written).toContain("honest empty board");
      // the abstention carries no demand table.
      expect(written).not.toContain("| Signal | Value | Budget (envelope) | Status |");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clear → classify wiring — a grounded board stages; a refusal stages nothing", () => {
  const inBudget = { status: "ok", spent: 100, ceiling: 300000, remaining: 299900 } as const;

  test("a ranked grounded board → success + materialize (the effect would run), three passed gate rows", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clear(RANKED) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog).toEqual([...SURVEY_GATE_NAMES].map((gate) => ({ gate, passed: true })));
  });

  test("an EMPTY board → success + materialize (the honest abstention CLEARS — the polarity proof)", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clear(mkBoard()) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
  });

  test("a board padded with a blank filler signal → honest-empty gate-failed + no materialize (the andon)", () => {
    const filler = mkSignal("Standard" as SignalTier, { what: "  ", why: "  " });
    const stop = clear(mkBoard(mkSignal("Keystone" as SignalTier), filler));
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "honest-empty" && !r.passed)).toBe(true);
  });

  test("an ungrounded candidate → read-never-invent gate-failed + no materialize", () => {
    const ungrounded = mkSignal("High" as SignalTier, { grounding: "" });
    const stop = clear(mkBoard(mkSignal("Keystone" as SignalTier), ungrounded));
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "read-never-invent" && !r.passed)).toBe(true);
  });
});

describe("renderStagedBoard — pure helper", () => {
  test("a non-empty board embeds every signal's row + a pull line + the table header", () => {
    const body = renderStagedBoard(RANKED);
    expect(body.startsWith("# Survey — staged demand board")).toBe(true);
    expect(body).toContain(renderBoard(RANKED));
    for (const s of RANKED.signals) expect(body).toContain(`vend chain "${s.what} — ${s.why}"`);
  });

  test("an empty board renders the abstention note and no demand table", () => {
    const body = renderStagedBoard(mkBoard());
    expect(body.startsWith("# Survey — no demand staged")).toBe(true);
    expect(body).not.toContain("| Signal | Value | Budget (envelope) | Status |");
  });
});
