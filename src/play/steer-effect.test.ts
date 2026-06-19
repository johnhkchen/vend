import { describe, expect, test } from "bun:test";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Signal, Fork, Steer, SignalTier } from "../../baml_client/index.ts";
import type { CastContext } from "../engine/play.ts";
import { classify } from "../engine/cast-core.ts";
import { clear, renderForks, STEER_GATE_NAMES } from "./steer-core.ts";
import { renderBoard } from "./survey-core.ts";
import { STAGING_DIR } from "./expand-effect.ts";
import { STEER_STEM, renderStagedSteer, steerEffect, type SteerInputs } from "./steer-effect.ts";

// T-018-02: the OFFLINE demonstration of the Steer cast — the AC#3 proof that does not need a live model.
// Every BAML import is TYPE-ONLY (erased at runtime) and the enum field is a string-literal cast (`b.parse`
// returns exactly the member string "Keystone"), so NO native addon loads into this `bun test` process
// (the survey-effect.test.ts / steer-core.test.ts discipline). We prove the two halves the cast plugs in
// beyond the already-pinned pure core (steer-core.test.ts) and BAML bridge (../baml/steer.test.ts):
//   (1) the impure effect STAGES the ranked board AND the forks under docs/active/pm/staged/steer.md on a
//       real temp-dir projectRoot — and writes NOTHING to demand.md or the board (the staging contract), and
//   (2) the clear→classify wiring — a grounded board + a genuine fork materializes (the effect would run);
//       an ungrounded board is read-never-invent gate-failed; a manufactured fork is fork-genuineness
//       gate-failed; both andons stage nothing.

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

/** A genuine, well-framed Fork — a real 2-option trade-off with stakes and a recommendation. */
function mkFork(over: Partial<Fork> = {}): Fork {
  return {
    question: "Build the wallet now or measure trust first?",
    options: ["Build the wallet now", "Measure trust first, then build"],
    whyItMatters: "Sequencing commits scarce blocks; building first risks a trust gate we can't yet read.",
    recommendation: "Measure trust first — the cheaper, reversible move while the macro-wallet is parked.",
    ...over,
  };
}

const mkSteer = (signals: Signal[], forks: Fork[] = []): Steer => ({ signals, forks });

// A ranked board (keystone → high → standard, all grounded) + one genuine fork — the clearing case.
const RANKED = mkSteer(
  [mkSignal("Keystone" as SignalTier), mkSignal("High" as SignalTier), mkSignal("Standard" as SignalTier)],
  [mkFork()],
);

const ctxFor = (root: string): CastContext<SteerInputs> => ({
  inputs: { project: "# Project snapshot", charter: "P2 two-gestures." },
  projectRoot: root,
});

/** A throwaway projectRoot — the effect creates docs/active/pm/staged/ under it on demand. */
async function seedRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-steer-"));
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

describe("steerEffect — stages the board AND the forks under the PM desk, never the board", () => {
  test("writes docs/active/pm/staged/steer.md carrying the demand rows, a pull line per signal, AND the forks", async () => {
    const root = await seedRoot();
    try {
      const res = await steerEffect(RANKED, ctxFor(root));
      expect(res.ok).toBe(true);
      expect(res.outcome).toBeUndefined();

      const expected = join(root, STAGING_DIR, `${STEER_STEM}.md`);
      expect(res.artifacts).toEqual([expected]);
      // parity with the other effects: `produced` (the threadable handle) == artifacts[0].
      expect(res.produced).toBe(expected);
      expect(res.produced).toBe(res.artifacts?.[0]);

      const written = await readFile(expected, "utf8");
      // the board half IS the demand.md rows (every Signal field round-trips via the shared renderer).
      expect(written).toContain(renderBoard({ signals: RANKED.signals }));
      expect(written).toContain("| Signal | Value | Budget (envelope) | Status |");
      // a pull-ready `vend chain` gesture for each signal, top-ranked recommended.
      expect(written).toContain(`vend chain "${RANKED.signals[0]!.what} — ${RANKED.signals[0]!.why}"`);
      expect(written).toContain("recommended next pull");
      // the fork half — the genuine decision, framed for assent (question, options, recommendation).
      expect(written).toContain("## Forks");
      expect(written).toContain(renderForks(RANKED.forks));
      expect(written).toContain("Build the wallet now or measure trust first?");
      expect(written).toContain("Vend recommends:");
      // honest about its origin + un-promoted status.
      expect(written).toContain("steer");
      expect(written).toContain("not promoted");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("writes ONLY under docs/active/pm/ — never demand.md or the board (epic/stories/tickets)", async () => {
    const root = await seedRoot();
    try {
      await steerEffect(RANKED, ctxFor(root));
      // the staging contract: the active board is untouched by a steer cast.
      expect(await exists(join(root, "docs/active/demand.md"))).toBe(false);
      expect(await exists(join(root, "docs/active/epic"))).toBe(false);
      expect(await exists(join(root, "docs/active/stories"))).toBe(false);
      expect(await exists(join(root, "docs/active/tickets"))).toBe(false);
      // the staged steer is the only thing written.
      expect(await exists(join(root, STAGING_DIR, `${STEER_STEM}.md`))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a board with NO forks stages the board + a clear-path note (no ## Forks blocks)", async () => {
    const root = await seedRoot();
    try {
      const boardOnly = mkSteer([mkSignal("Keystone" as SignalTier)], []);
      const res = await steerEffect(boardOnly, ctxFor(root));
      expect(res.ok).toBe(true);
      const written = await readFile(join(root, STAGING_DIR, `${STEER_STEM}.md`), "utf8");
      // the board half is present...
      expect(written).toContain("| Signal | Value | Budget (envelope) | Status |");
      // ...and the fork half states the clear-path abstention, not a fabricated fork block.
      expect(written).toContain("the path is clear");
      expect(written).not.toContain("### Fork —");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a FULLY empty steer still stages — an honest abstention note, no table, no forks", async () => {
    const root = await seedRoot();
    try {
      const res = await steerEffect(mkSteer([], []), ctxFor(root));
      expect(res.ok).toBe(true);
      const written = await readFile(join(root, STAGING_DIR, `${STEER_STEM}.md`), "utf8");
      expect(written).toContain("nothing to stage");
      expect(written).toContain("honest empty steer");
      // the abstention carries no demand table and no fork blocks.
      expect(written).not.toContain("| Signal | Value | Budget (envelope) | Status |");
      expect(written).not.toContain("### Fork —");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clear → classify wiring — a grounded steer stages; a refusal stages nothing", () => {
  const inBudget = { status: "ok", spent: 100, ceiling: 400000, remaining: 399900 } as const;

  test("a ranked grounded board + a genuine fork → success + materialize, three passed gate rows", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clear(RANKED) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog).toEqual([...STEER_GATE_NAMES].map((gate) => ({ gate, passed: true })));
  });

  test("an EMPTY steer → success + materialize (the honest abstention CLEARS — both sides)", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clear(mkSteer([], [])) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
  });

  test("an ungrounded candidate → read-never-invent gate-failed + no materialize", () => {
    const ungrounded = mkSignal("High" as SignalTier, { grounding: "" });
    const stop = clear(mkSteer([mkSignal("Keystone" as SignalTier), ungrounded], [mkFork()]));
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "read-never-invent" && !r.passed)).toBe(true);
  });

  test("a manufactured one-option fork → fork-genuineness gate-failed + no materialize", () => {
    const fake = mkFork({ options: ["Just do this"] });
    const stop = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [fake]));
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "fork-genuineness" && !r.passed)).toBe(true);
  });
});

describe("renderStagedSteer — pure helper", () => {
  test("a board + forks embeds the table, a pull line per signal, and the fork blocks", () => {
    const body = renderStagedSteer(RANKED);
    expect(body.startsWith("# Steer — staged board + forks")).toBe(true);
    expect(body).toContain(renderBoard({ signals: RANKED.signals }));
    for (const s of RANKED.signals) expect(body).toContain(`vend chain "${s.what} — ${s.why}"`);
    expect(body).toContain(renderForks(RANKED.forks));
  });

  test("a fully empty steer renders the abstention note and no demand table", () => {
    const body = renderStagedSteer(mkSteer([], []));
    expect(body.startsWith("# Steer — nothing to stage")).toBe(true);
    expect(body).not.toContain("| Signal | Value | Budget (envelope) | Status |");
  });
});
