import { describe, expect, test } from "bun:test";
import type { Signal, SignalTier } from "../../baml_client/index.ts";
import {
  clear,
  EXPAND_GATE_NAMES,
  renderSignalRow,
  type ExpandClearContext,
} from "./expand-core.ts";

// T-016-01: the OFFLINE pure-function test for the ExpandFragment core. Every BAML import is
// TYPE-ONLY (erased at runtime) and the enum member is supplied as a string-literal cast —
// `b.parse` returns exactly the member string ("Keystone"). So no native addon loads into this
// `bun test` process (the propose-core / note-core / gates.ts discipline). The play's render/parse
// (which call BAML) are proven separately in ../baml/expand.test.ts via the subprocess bridge; here
// we prove the bits the engine plugs in: the three gates (pass + each stop) and the row renderer.

// A complete, clearing Signal — built directly (no model call); the shape `b.parse` yields.
const FULL_SIGNAL: Signal = {
  what: "Register expandFragmentPlay + the vend expand gesture",
  why: "Closes the articulation gap O1 — edit a draft instead of composing from blank.",
  tier: "Keystone" as SignalTier,
  budget: "~1 block (≈2h)",
  advances: ["P2"],
  grounding: "TODO in docs/active/pm/proposed-batch.md #1; demand.md E-016 row",
  readiness: "ready",
};

// A charter snippet carrying the live invariant/non-goal ids the value-link gate greps.
const CHARTER = "P2 fewer-gestures. P7 budget-hard. N1 not-a-copilot. N4 not-an-executor.";

const ctxWith = (charter: string): ExpandClearContext => ({ charter });

describe("clear — a grounded, value-linked signal clears all three gates", () => {
  test("a full signal → clear, echoing every gate name in order", () => {
    const v = clear(FULL_SIGNAL, ctxWith(CHARTER));
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([...EXPAND_GATE_NAMES]);
  });
});

describe("clear — honest-empty gate (a fragment that grounds no demand)", () => {
  test("blank `what` AND `why` → honest-empty STOP (not a fabricated signal)", () => {
    const v = clear({ ...FULL_SIGNAL, what: "   ", why: "  " }, ctxWith(CHARTER));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("honest-empty");
      expect(v.reason).toContain("no demand");
    }
  });

  test("an SAP-degraded empty signal (all-blank) → honest-empty STOP", () => {
    const empty: Signal = { what: "", why: "", tier: "Standard" as SignalTier, budget: "", advances: [], grounding: "", readiness: "" };
    const v = clear(empty, ctxWith(CHARTER));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("honest-empty");
  });
});

describe("clear — read-never-invent gate (the signal must trace to real state)", () => {
  test("a stated move with blank `grounding` → read-never-invent STOP (speculation refused)", () => {
    const v = clear({ ...FULL_SIGNAL, grounding: "   " }, ctxWith(CHARTER));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("read-never-invent");
      expect(v.reason).toContain("speculative");
    }
  });
});

describe("clear — value-link gate (the signal must name a real value it serves)", () => {
  test("an empty `advances` → value-link STOP", () => {
    const v = clear({ ...FULL_SIGNAL, advances: [] }, ctxWith(CHARTER));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("value-link");
  });

  test("advancing a non-goal (N4) → value-link STOP naming the non-goal", () => {
    const v = clear({ ...FULL_SIGNAL, advances: ["N4"] }, ctxWith(CHARTER));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("value-link");
      expect(v.reason).toContain("non-goal");
    }
  });

  test("a dangling invariant ref (P9, absent from the charter) → value-link STOP", () => {
    const v = clear({ ...FULL_SIGNAL, advances: ["P9"] }, ctxWith(CHARTER));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("value-link");
  });

  test("a free-text advance (core-feature prose, no grep-able id) passes value-link", () => {
    const v = clear({ ...FULL_SIGNAL, advances: ["the v1 surface widening"] }, ctxWith(CHARTER));
    expect(v.status).toBe("clear");
  });
});

describe("renderSignalRow — the demand row round-trips every Signal field", () => {
  const row = renderSignalRow(FULL_SIGNAL);

  test("carries what, why, the title-cased tier, budget, readiness, and the advances note", () => {
    expect(row).toContain(FULL_SIGNAL.what);
    expect(row).toContain(FULL_SIGNAL.why);
    expect(row).toContain("**Keystone**"); // member "Keystone" → alias "keystone" → title-cased
    expect(row).toContain("~1 block");
    expect(row).toContain("ready");
    expect(row).toContain("[P2]"); // advances round-tripped
    expect(row).toContain("grounded in"); // grounding round-tripped
  });

  test("a multi-invariant signal renders each advances id", () => {
    const multi = renderSignalRow({ ...FULL_SIGNAL, advances: ["P2", "P4"] });
    expect(multi).toContain("[P2, P4]");
  });

  test("an out-of-map tier member throws RangeError (enum/map drift guard)", () => {
    expect(() => renderSignalRow({ ...FULL_SIGNAL, tier: "Legendary" as SignalTier })).toThrow(RangeError);
  });
});
