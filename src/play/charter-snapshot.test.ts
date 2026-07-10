// Pure tests for charter-snapshot.ts (T-067-01-01). No fs, no BAML addon: the LIVE charter
// (and the kitchen-seed charter, the K-code generality proof) arrive as Bun text imports —
// resolved at module load, typed `string` by seed-text-modules.d.ts's `*.md` wildcard — so
// no test body touches the filesystem (the kitchen-overlay.ts precedent).
//
// The live-charter suite is a deliberate GOLD PIN (the EXPECTED-OUTCOME house pattern):
// amending the charter fails it and forces the snapshot contract to be re-ratified
// consciously — that failure is the contract doing its job, not brittleness to sand off.

import { describe, expect, test } from "bun:test";
import { snapshotCharterCodes } from "./charter-snapshot.ts";
import liveCharter from "../../docs/knowledge/charter.md" with { type: "text" };
import kitchenCharter from "../../examples/templates/kitchen-seed/charter.md" with { type: "text" };

/** Every code the live charter defines, with its one-line text — transcribed from
 *  docs/knowledge/charter.md §Invariants + §Non-goals. */
const LIVE_EXPECTED: readonly (readonly [string, string])[] = [
  ["P1", "Author once, run forever"],
  ["P2", "The run is two gestures"],
  ["P3", "Gates are the contract"],
  ["P4", "Autonomy by default, not supervision"],
  ["P5", "Local-first"],
  ["P6", "Executor-agnostic underneath"],
  ["P7", "Budget is a hard contract"],
  ["N1", "Not a chat copilot"],
  ["N2", "Not a babysitting dashboard"],
  ["N3", "Not a one-off prompt runner"],
  ["N4", "Not an executor"],
];

const live = snapshotCharterCodes(liveCharter);
const kitchen = snapshotCharterCodes(kitchenCharter);

describe("live charter gold pin", () => {
  test("maps every P1..P7 and N1..N4 code to its one-line text — and nothing else", () => {
    expect(live.size).toBe(LIVE_EXPECTED.length);
    for (const [code, text] of LIVE_EXPECTED) {
      expect(live.get(code)).toBe(text);
    }
    expect([...live.keys()].sort()).toEqual(LIVE_EXPECTED.map(([c]) => c).sort());
  });
});

describe("typed absence", () => {
  test("an unknown code resolves to undefined, not a string", () => {
    for (const code of ["P9", "P0", "PE1", "X1", "K1"]) {
      expect(live.get(code)).toBeUndefined();
      expect(live.has(code)).toBe(false);
    }
  });

  test("a retired code is absent while its neighbors still resolve", () => {
    // The live invariant shape with P3 retired (amendment rule: retiring is a feature).
    const retired = [
      "- **P1 — Author once, run forever.** Cost lives at authoring.",
      "- **P2 — The run is two gestures.** Pick + budget + go.",
      "- **P4 — Autonomy by default, not supervision.** Work proceeds against its gates.",
    ].join("\n");
    const snap = snapshotCharterCodes(retired);
    expect(snap.get("P3")).toBeUndefined();
    expect(snap.has("P3")).toBe(false);
    expect(snap.get("P2")).toBe("The run is two gestures");
    expect(snap.get("P4")).toBe("Autonomy by default, not supervision");
  });

  test("a codeless charter yields an honest empty map", () => {
    expect(snapshotCharterCodes("just prose, **bold without a code**, nothing to index").size).toBe(0);
    expect(snapshotCharterCodes("").size).toBe(0);
  });
});

describe("never an empty string", () => {
  test("a blank-titled definition mints no entry", () => {
    for (const malformed of ["**P8 — .**", "**P8 —  **", "**P8 — \t.**"]) {
      const snap = snapshotCharterCodes(malformed);
      expect(snap.has("P8")).toBe(false);
      expect(snap.get("P8")).toBeUndefined();
    }
  });

  test("every value in both real-charter snapshots is non-blank", () => {
    for (const snap of [live, kitchen]) {
      expect(snap.size).toBeGreaterThan(0);
      for (const [, text] of snap) {
        expect(text.trim()).not.toBe("");
      }
    }
  });
});

describe("definition-anchored, first wins", () => {
  test("a prose mention of a code creates no entry", () => {
    expect(snapshotCharterCodes("this epic advances P1 today, and respects N4 besides").size).toBe(0);
  });

  test("a prose mention before a definition does not shadow it", () => {
    const snap = snapshotCharterCodes("advances P1 before anything.\n\n- **P1 — Real title.** Body.");
    expect(snap.get("P1")).toBe("Real title");
    expect(snap.size).toBe(1);
  });

  test("a duplicate definition resolves first-wins, deterministically", () => {
    const snap = snapshotCharterCodes("- **P1 — First.** Body.\n- **P1 — Second.** Body.");
    expect(snap.get("P1")).toBe("First");
    expect(snap.size).toBe(1);
  });
});

describe("shape robustness", () => {
  test("a wrapped bold span resolves to one whitespace-collapsed line", () => {
    const snap = snapshotCharterCodes("- **P8 — A long\n  wrapped title.** Body prose.");
    expect(snap.get("P8")).toBe("A long wrapped title");
  });

  test("exactly one trailing period is stripped; interior periods survive", () => {
    const snap = snapshotCharterCodes("- **P8 — Ships v2.** Body.");
    expect(snap.get("P8")).toBe("Ships v2");
  });

  test("a definition without a trailing period resolves unchanged", () => {
    const snap = snapshotCharterCodes("- **P8 — No period here** Body.");
    expect(snap.get("P8")).toBe("No period here");
  });

  test("prefix generality: the kitchen charter yields exactly K1..K3", () => {
    expect([...kitchen.keys()].sort()).toEqual(["K1", "K2", "K3"]);
    expect(kitchen.get("K1")).toBe("The build stays green");
    expect(kitchen.get("K2")).toBe("Every slice is showable");
    expect(kitchen.get("K3")).toBe("Budget is a hard contract");
  });
});
