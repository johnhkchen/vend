import { describe, expect, test } from "bun:test";
import type { Board, Signal, SignalTier } from "../../baml_client/index.ts";
import { clear, renderBoard, SURVEY_GATE_NAMES } from "./survey-core.ts";

// T-017-01: the OFFLINE pure-function test for the Survey core. Every BAML import is TYPE-ONLY (erased at
// runtime) and the enum member is supplied as a string-literal cast — `b.parse` returns exactly the
// member string ("Keystone"). So no native addon loads into this `bun test` process (the expand-core /
// propose-core / gates.ts discipline; survey-core's only value import is the PURE renderSignalRow). The
// play's render/parse (which call BAML) are proven separately in ../baml/survey.test.ts via the subprocess
// bridge; here we prove the bits the engine plugs in: the three board gates (pass + each stop) and the
// board renderer.

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

describe("clear — a grounded, leverage-ordered board clears all three gates", () => {
  test("a ranked grounded board → clear, echoing every gate name in order", () => {
    const v = clear(RANKED);
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([...SURVEY_GATE_NAMES]);
  });

  test("equal-tier adjacent signals (ties) → clear (non-strict ordering)", () => {
    const v = clear(mkBoard(mkSignal("High" as SignalTier), mkSignal("High" as SignalTier)));
    expect(v.status).toBe("clear");
  });

  test("a single-signal board → clear (ordering is trivial)", () => {
    expect(clear(mkBoard(mkSignal("Leaf" as SignalTier))).status).toBe("clear");
  });
});

describe("clear — honest-empty gate (the board must be honest about emptiness)", () => {
  test("an EMPTY board → clear (the honest abstention, NOT a stop — the polarity proof)", () => {
    const v = clear(mkBoard());
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([...SURVEY_GATE_NAMES]);
  });

  test("a blank/filler signal padding the board → honest-empty STOP (manufactured busywork refused)", () => {
    const filler = mkSignal("Standard" as SignalTier, { what: "  ", why: "  " });
    const v = clear(mkBoard(mkSignal("Keystone" as SignalTier), filler));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("honest-empty");
      expect(v.reason).toContain("manufacture");
    }
  });
});

describe("clear — read-never-invent gate (every candidate must trace to real state)", () => {
  test("a candidate with blank `grounding` → read-never-invent STOP (speculation refused)", () => {
    const ungrounded = mkSignal("High" as SignalTier, { grounding: "   " });
    const v = clear(mkBoard(mkSignal("Keystone" as SignalTier), ungrounded));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("read-never-invent");
      expect(v.reason).toContain("speculative");
    }
  });
});

describe("clear — leverage-rank gate (the board must be ordered highest-leverage first)", () => {
  test("a high signal placed BEFORE a keystone → leverage-rank STOP naming the inversion", () => {
    const v = clear(mkBoard(mkSignal("High" as SignalTier), mkSignal("Keystone" as SignalTier)));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("leverage-rank");
      expect(v.reason).toContain("highest-leverage first");
    }
  });

  test("a leaf placed before a standard (deeper inversion) → leverage-rank STOP", () => {
    const v = clear(mkBoard(mkSignal("Leaf" as SignalTier), mkSignal("Standard" as SignalTier)));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("leverage-rank");
  });

  test("an out-of-map tier member throws RangeError (enum/map drift guard)", () => {
    const drift = mkBoard(mkSignal("Mythic" as SignalTier), mkSignal("Keystone" as SignalTier));
    expect(() => clear(drift)).toThrow(RangeError);
  });
});

describe("renderBoard — one demand row per signal, reusing the shared row contract", () => {
  test("a ranked board renders one row per signal, each carrying its `what`", () => {
    const out = renderBoard(RANKED);
    const rows = out.split("\n");
    expect(rows).toHaveLength(3);
    expect(out).toContain("Move at Keystone");
    expect(out).toContain("Move at High");
    expect(out).toContain("Move at Standard");
    expect(out).toContain("[P2]"); // advances round-tripped through renderSignalRow
  });

  test("an empty board renders the empty string (the honest abstention carries no markup)", () => {
    expect(renderBoard(mkBoard())).toBe("");
  });

  test("an out-of-map tier member throws RangeError (propagated from renderSignalRow)", () => {
    expect(() => renderBoard(mkBoard(mkSignal("Legendary" as SignalTier)))).toThrow(RangeError);
  });
});
