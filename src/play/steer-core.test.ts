import { describe, expect, test } from "bun:test";
import type { Signal, Fork, Steer, SignalTier } from "../../baml_client/index.ts";
import {
  clear,
  renderFork,
  renderForks,
  STEER_GATE_NAMES,
  MAX_FORK_OPTIONS,
} from "./steer-core.ts";

// T-018-01: the OFFLINE pure-function test for the Steer core. Every BAML import is TYPE-ONLY (erased at
// runtime) and the enum member is supplied as a string-literal cast — `b.parse` returns exactly the
// member string ("Keystone"). So no native addon loads into this `bun test` process (the survey-core /
// expand-core / gates.ts discipline; steer-core's only value imports are the PURE renderSignalRow +
// TIER_RANK). The play's render/parse (which call BAML) are proven separately in ../baml/steer.test.ts via
// the subprocess bridge; here we prove the bits the engine plugs in: the three steer gates (pass + each
// stop, esp. the signature fork-genuineness gate) and the fork renderer.

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

describe("clear — a grounded, leverage-ordered board with a genuine fork clears all three gates", () => {
  test("a ranked grounded board + a genuine fork → clear, echoing every gate name in order", () => {
    const v = clear(RANKED);
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([...STEER_GATE_NAMES]);
  });

  test("an EMPTY steer → clear (the honest abstention on BOTH sides — empty board, no forks)", () => {
    const v = clear(mkSteer([], []));
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([...STEER_GATE_NAMES]);
  });

  test("a grounded board with NO forks → clear (a clear path surfaces no fork)", () => {
    expect(clear(mkSteer([mkSignal("Keystone" as SignalTier)], [])).status).toBe("clear");
  });
});

describe("clear — read-never-invent gate (every board candidate must trace to real state)", () => {
  test("a signal with blank `grounding` → read-never-invent STOP (speculation refused)", () => {
    const ungrounded = mkSignal("High" as SignalTier, { grounding: "   " });
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier), ungrounded], [mkFork()]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("read-never-invent");
      expect(v.reason).toContain("speculative");
    }
  });
});

describe("clear — fork-genuineness gate (the signature gate: a fork must be a real, framed decision)", () => {
  test("an EMPTY forks[] with a real board → clear (a clear path surfaces no fork — the abstention)", () => {
    expect(clear(mkSteer([mkSignal("Keystone" as SignalTier)], [])).status).toBe("clear");
  });

  test("a genuine 2-option fork → clear", () => {
    expect(clear(mkSteer([mkSignal("Keystone" as SignalTier)], [mkFork()])).status).toBe("clear");
  });

  test("a fork with ONE option → fork-genuineness STOP (not a real trade-off)", () => {
    const oneOption = mkFork({ options: ["Just do this"] });
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [oneOption]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("fork-genuineness");
      expect(v.reason).toContain("distinct");
    }
  });

  test("a fork with DUPLICATE options → fork-genuineness STOP (fewer than 2 DISTINCT options)", () => {
    const dup = mkFork({ options: ["Ship it", "ship it"] });
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [dup]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("fork-genuineness");
  });

  test("a fork with a BLANK question → fork-genuineness STOP (inconsequential — nothing to decide)", () => {
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [mkFork({ question: "  " })]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("fork-genuineness");
      expect(v.reason).toContain("inconsequential");
    }
  });

  test("a fork with blank `whyItMatters` → fork-genuineness STOP (no stakes named)", () => {
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [mkFork({ whyItMatters: "" })]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("fork-genuineness");
  });

  test("a fork with MORE than 4 options → fork-genuineness STOP (an un-narrowed menu)", () => {
    const menu = mkFork({ options: ["a", "b", "c", "d", "e"] });
    expect(menu.options.length).toBeGreaterThan(MAX_FORK_OPTIONS);
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [menu]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("fork-genuineness");
      expect(v.reason).toContain("menu");
    }
  });

  test("a fork with no `recommendation` → fork-genuineness STOP (Vend must frame it)", () => {
    const v = clear(mkSteer([mkSignal("Keystone" as SignalTier)], [mkFork({ recommendation: "  " })]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("fork-genuineness");
      expect(v.reason).toContain("recommendation");
    }
  });
});

describe("clear — leverage-rank gate (the board must be ordered highest-leverage first)", () => {
  test("a high signal placed BEFORE a keystone → leverage-rank STOP naming the inversion", () => {
    const v = clear(mkSteer([mkSignal("High" as SignalTier), mkSignal("Keystone" as SignalTier)], []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("leverage-rank");
      expect(v.reason).toContain("highest-leverage first");
    }
  });

  test("equal-tier adjacent signals (ties) → clear (non-strict ordering)", () => {
    expect(clear(mkSteer([mkSignal("High" as SignalTier), mkSignal("High" as SignalTier)], [])).status).toBe("clear");
  });

  test("an out-of-map tier member throws RangeError (enum/map drift guard)", () => {
    const drift = mkSteer([mkSignal("Mythic" as SignalTier), mkSignal("Keystone" as SignalTier)], []);
    expect(() => clear(drift)).toThrow(RangeError);
  });
});

describe("renderFork / renderForks — a legible markdown block per fork", () => {
  test("renderFork carries the question, every option (numbered), and the recommendation", () => {
    const out = renderFork(mkFork());
    expect(out).toContain("### Fork — Build the wallet now or measure trust first?");
    expect(out).toContain("1. Build the wallet now");
    expect(out).toContain("2. Measure trust first, then build");
    expect(out).toContain("Why it matters:");
    expect(out).toContain("Vend recommends:");
  });

  test("renderForks joins multiple forks and renders the empty list as the empty string", () => {
    expect(renderForks([])).toBe("");
    const two = renderForks([mkFork(), mkFork({ question: "Deeper-per-epic or chain-more-epics?" })]);
    expect(two).toContain("Build the wallet now");
    expect(two).toContain("Deeper-per-epic or chain-more-epics?");
    expect(two.split("### Fork —")).toHaveLength(3); // 2 forks ⇒ 2 headings ⇒ split into 3
  });
});
