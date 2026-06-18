import { describe, expect, test } from "bun:test";
import { formatBudget } from "./menu.ts";
import {
  type RawSignal,
  TIER_BUDGET,
  budgetForTier,
  deriveReadiness,
  isDoneStatus,
  parseDemandSignals,
  parseLisaInProgressEpics,
  signalsToActions,
  stateHash,
} from "./gather.ts";

// T-003-02 gather: fixture tests for the PURE surface (the impure gather/browseShelf/
// writeMenuCache are the untested shell — house pattern). Plain fixtures, `toEqual`
// for exact arrays, frozen-input purity, golden hashes. No fs/clock/spawn here.

// A demand.md fixture mirroring the real board's prose: a done keystone (dropped via
// its LEADING status word), two ready high epics whose Status cells mention "done" in
// prose about OTHER epics (must NOT be dropped), a no-epic kaizen row (skipped), a
// blocked standard, a tier-less pipe row, and the header + separator rows (skipped).
const DEMAND = `# Demand

## Signals

| Signal | Value | Budget (envelope) | Status |
|---|---|---|---|
| **Dispense slice** — the lever | **Keystone** (unblocks all) | multi-session | **done → E-001** (committed \`4a1d632\`) |
| **\`vend\` context-aware shelf** — the shelf | **High** (core feature) | ~1 feature block (≈2h) | **ready** — E-001 done. Spec staged → E-003. Composes after E-004. |
| **CI/CD structural backstop** (Dagger) | **High** (enabler) | ~1 feature block (≈2h) | **ready** — E-001 scaffold exists. Card: \`epic/E-002.md\`. |

Some prose paragraph that is not a table row at all.

## Kaizen signals

| Signal | Value | Budget | Status |
|---|---|---|---|
| **Bound dispense exploration** — cap turns | **Standard** (calibration) | small (~1h) | blocked — needs E-004 first |
| **Thread the real model id** — fidelity | **Standard** (data fidelity) | tiny (mins) | ready — pull anytime |
| just a prose line, no leading pipe | with a stray Standard word | x | E-999 |
`;

// A lisa status excerpt: E-001 fully done (its work spans T-001-* AND T-002-* — the
// prefix overlap that makes done-derivation unsound); E-003 in progress (one ticket
// in research); E-002 has no tickets (absent → not in-progress).
const LISA = `DAG: 16 tickets
Status: ...

Wave 0:
  T-001-01      done  open  scaffold-bun-project  blocks: T-001-02
  T-002-03      done  open  decompose-epic-runner  deps: T-001-02
  T-001-03      done  open  budget  deps: T-001-01

Wave 1:
  T-003-01      done  open  pure-menu-model  blocks: T-003-02
  T-003-02      research  open  gather-persist  deps: T-003-01
`;

describe("parseDemandSignals", () => {
  const signals = parseDemandSignals(DEMAND);

  test("keeps only bold-named, tiered table rows", () => {
    expect(signals.map((s) => s.name)).toEqual([
      "Dispense slice",
      "`vend` context-aware shelf",
      "CI/CD structural backstop",
      "Bound dispense exploration",
      "Thread the real model id",
    ]);
  });

  test("parses tiers from the Value cell", () => {
    expect(signals.map((s) => s.tier)).toEqual(["keystone", "high", "high", "standard", "standard"]);
  });

  test("extracts the staged epic id from the Status cell, or undefined", () => {
    expect(signals.map((s) => s.epicId)).toEqual(["E-001", "E-003", "E-002", undefined, undefined]);
  });

  test("skips header, separator, prose, and tier-less rows", () => {
    // 5 kept out of: title row, separator, 5 data rows across two tables, a tier-less
    // pipe row ("just a prose line…" has no bold name, no tier → skipped).
    expect(signals).toHaveLength(5);
  });

  test("empty input yields no signals (total)", () => {
    expect(parseDemandSignals("")).toEqual([]);
  });
});

describe("parseLisaInProgressEpics", () => {
  test("an epic is in-progress iff some ticket is not yet phase done", () => {
    // E-003 has a research ticket → in-progress. E-001/E-002 groups are all-done.
    expect(parseLisaInProgressEpics(LISA)).toEqual(["E-003"]);
  });
  test("does not match deps:/blocks: refs mid-row", () => {
    expect(parseLisaInProgressEpics("  T-001-01  done  open  x  blocks: T-009-99")).toEqual([]);
  });
  test("empty / unrecognized stdout → []", () => {
    expect(parseLisaInProgressEpics("")).toEqual([]);
    expect(parseLisaInProgressEpics("no tickets here")).toEqual([]);
  });
});

describe("deriveReadiness / isDoneStatus — leading status word", () => {
  test("a leading blocking word → blocked", () => {
    expect(deriveReadiness("blocked — needs E-004 first")).toBe("blocked");
  });
  test("'blocked' only in prose does not block", () => {
    expect(deriveReadiness("ready — was blocked, now unblocked")).toBe("ready");
  });
  test("otherwise ready", () => {
    expect(deriveReadiness("**ready** — Spec staged → E-003")).toBe("ready");
    expect(deriveReadiness("")).toBe("ready");
  });
  test("isDoneStatus reads the leading word, ignoring 'done' in prose", () => {
    expect(isDoneStatus("**done → E-001** (committed)")).toBe(true);
    expect(isDoneStatus("**ready** — E-001 done. Spec staged → E-003.")).toBe(false);
  });
});

describe("budgetForTier", () => {
  test("budget ∝ value, round-trips through formatBudget", () => {
    expect(formatBudget(budgetForTier("keystone"))).toBe("2h/80k");
    expect(formatBudget(budgetForTier("high"))).toBe("2h/50k");
    expect(formatBudget(budgetForTier("standard"))).toBe("1h/25k");
    expect(formatBudget(budgetForTier("leaf"))).toBe("15m/8k");
  });
  test("keystone is fatter than leaf on both axes", () => {
    expect(TIER_BUDGET.keystone.tokens).toBeGreaterThan(TIER_BUDGET.leaf.tokens);
    expect(TIER_BUDGET.keystone.timeMs).toBeGreaterThan(TIER_BUDGET.leaf.timeMs);
  });
});

describe("signalsToActions", () => {
  const signals = parseDemandSignals(DEMAND);
  const inProgress = parseLisaInProgressEpics(LISA); // ["E-003"]
  const actions = signalsToActions(signals, inProgress);

  test("drops done signals and no-epic signals; keeps staged-epic signals in board order", () => {
    // E-001 dropped (leading 'done'); the two no-epic kaizen rows dropped; the
    // tier-less pipe row never parsed. E-003 + E-002 kept, demand order preserved.
    expect(actions.map((a) => a.id)).toEqual(["E-003", "E-002"]);
  });

  test("an in-progress epic is overridden to blocked (re-vend would clobber)", () => {
    expect(actions.find((a) => a.id === "E-003")?.readiness).toBe("blocked");
    expect(actions.find((a) => a.id === "E-002")?.readiness).toBe("ready");
  });

  test("builds id, kebab title, tier, readiness, warranted budget", () => {
    expect(actions.find((a) => a.id === "E-002")).toEqual({
      id: "E-002",
      title: "ci-cd-structural-backstop",
      tier: "high",
      readiness: "ready",
      budget: { timeMs: 7_200_000, tokens: 50_000 },
    });
  });

  test("a blocked, epic-bearing signal keeps its blocked readiness", () => {
    const blocked: RawSignal = { name: "x", tier: "standard", statusText: "blocked", epicId: "E-042" };
    expect(signalsToActions([blocked], [])).toEqual([
      { id: "E-042", title: "x", tier: "standard", readiness: "blocked", budget: TIER_BUDGET.standard },
    ]);
  });

  test("pure — frozen inputs are not mutated, returns a fresh array", () => {
    const input = Object.freeze([
      Object.freeze({ name: "a", tier: "high", statusText: "ready", epicId: "E-010" }),
    ]) as readonly RawSignal[];
    const result = signalsToActions(input, Object.freeze([]) as readonly string[]);
    expect(result).toHaveLength(1);
    expect(result).not.toBe(input as unknown);
  });

  test("empty input → []", () => {
    expect(signalsToActions([], [])).toEqual([]);
  });
});

describe("stateHash", () => {
  test("deterministic — same input, same hash", () => {
    const a = stateHash({ demand: DEMAND, lisa: LISA, all: false });
    const b = stateHash({ demand: DEMAND, lisa: LISA, all: false });
    expect(a).toBe(b);
  });
  test("sensitive to the all mode", () => {
    expect(stateHash({ demand: DEMAND, lisa: LISA, all: false })).not.toBe(
      stateHash({ demand: DEMAND, lisa: LISA, all: true }),
    );
  });
  test("sensitive to a one-char demand change", () => {
    expect(stateHash({ demand: DEMAND, lisa: LISA, all: false })).not.toBe(
      stateHash({ demand: `${DEMAND} `, lisa: LISA, all: false }),
    );
  });
  test("is a fixed-width hex string", () => {
    expect(stateHash({ demand: "", lisa: "", all: false })).toMatch(/^[0-9a-f]{8}$/);
  });
});
