import { describe, expect, test } from "bun:test";
import type { CardColor, CardRarity, CardType, EpicCard } from "../../baml_client/index.ts";
import {
  clear,
  nextEpicId,
  PE_GATE_NAMES,
  renderCard,
  stripNonGoalAdvances,
  type ProposeClearContext,
} from "./propose-core.ts";

// T-009-02: the OFFLINE pure-function test for the ProposeEpic core. Every BAML import is
// TYPE-ONLY (erased at runtime) and the enum members are supplied as string-literal casts —
// `b.parse` returns exactly these member strings ("Blue", "Permanent", "Rare"). So no native
// addon loads into this `bun test` process (the gates.ts / materialize.ts / note-core.ts
// discipline). The play's render/parse (which call BAML) are proven separately in
// ../baml/propose.test.ts via the subprocess bridge; here we prove the bits the engine plugs
// in: the three PE gates (pass + each stop), the id mint, and the card→markdown round-trip.

// A complete, clearing EpicCard — built directly (no model call); the shape `b.parse` yields.
const FULL_CARD: EpicCard = {
  id: "E-010",
  title: "ramp-the-shelf",
  kind: "Permanent" as CardType,
  advances: ["P1"],
  serves: "Make future plays cheaper to cast by scaffolding the shelf.",
  manaCost: "{2}{U}",
  color: ["Blue"] as CardColor[],
  type: "Permanent" as CardType,
  rarity: "Rare" as CardRarity,
  intent: "Stand up the shelf so authored plays are grab-and-go.",
  value: "Realizes author-once-run-forever by making the shelf the home of every play.",
  doneLooksLike: "A registered play is pickable and castable from the shelf in two gestures.",
  context: "Builds on the E-007 engine; prerequisite: the registry. Out: the auto-drainer.",
};

// A charter snippet carrying the live invariant/non-goal ids the bounds gate greps.
const CHARTER = "P1 author-once. P7 budget-hard. N1 not-a-copilot. N4 not-an-executor.";

const ctxWith = (charter: string, existingEpicIds: readonly string[]): ProposeClearContext => ({
  charter,
  existingEpicIds,
});

describe("clear — a passing card clears all three PE gates", () => {
  test("a full, in-bounds, disjoint card → clear, echoing every gate name", () => {
    const v = clear(FULL_CARD, ctxWith(CHARTER, ["E-009"]));
    expect(v.status).toBe("clear");
    if (v.status === "clear") expect(v.cleared).toEqual([...PE_GATE_NAMES]);
  });
});

describe("clear — value gate (the card must state value + name what it advances)", () => {
  test("a blank `serves` stops the line at value", () => {
    const v = clear({ ...FULL_CARD, serves: "   " }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("value");
  });

  test("an empty `advances` stops at value", () => {
    const v = clear({ ...FULL_CARD, advances: [] }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("value");
  });
});

describe("clear — bounds gate (advances must hold; no non-goal advanced)", () => {
  test("a non-goal-violating card (advances N4) → bounds STOP", () => {
    const v = clear({ ...FULL_CARD, advances: ["N4"] }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("bounds");
      expect(v.reason).toContain("non-goal");
    }
  });

  test("a dangling invariant ref (advances P9, absent from the charter) → bounds STOP", () => {
    const v = clear({ ...FULL_CARD, advances: ["P9"] }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("bounds");
  });

  test("a free-text advances entry (no grep-able id) passes bounds", () => {
    const v = clear({ ...FULL_CARD, advances: ["better clearing"] }, ctxWith(CHARTER, []));
    expect(v.status).toBe("clear");
  });
});

describe("stripNonGoalAdvances — drop mis-tagged non-goals before the propose gates run (field fix #1)", () => {
  test("a card advancing [P1, N4] keeps P1, loses N4 — then clears end to end", () => {
    const normalized = stripNonGoalAdvances({ ...FULL_CARD, advances: ["P1", "N4"] });
    expect(normalized.advances).toEqual(["P1"]);
    // the normalized card now clears the very gate the raw card would have halted at
    expect(clear(normalized, ctxWith(CHARTER, ["E-009"])).status).toBe("clear");
  });
  test("a card that named ONLY a non-goal collapses to [] and honestly trips the value gate", () => {
    const normalized = stripNonGoalAdvances({ ...FULL_CARD, advances: ["N2"] });
    expect(normalized.advances).toEqual([]);
    const v = clear(normalized, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("value"); // "advances nothing" — retry-able, not a hard bounds halt
  });
  test("a clean card is returned unchanged (same object — the .some() guard skips the copy)", () => {
    const card = { ...FULL_CARD, advances: ["P1", "P7"] };
    expect(stripNonGoalAdvances(card)).toBe(card);
  });
  test("PURE — never mutates the input card's advances", () => {
    const card = { ...FULL_CARD, advances: ["P1", "N4"] };
    stripNonGoalAdvances(card);
    expect(card.advances).toEqual(["P1", "N4"]);
  });
});

describe("clear — structural gate (valid frontmatter + id disjoint from the board)", () => {
  test("a colliding/duplicate id → structural STOP naming the id (the E-004 reuse)", () => {
    const v = clear(FULL_CARD, ctxWith(CHARTER, ["E-009", "E-010"]));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("structural");
      expect(v.unit).toBe("E-010");
      expect(v.reason).toContain("board");
    }
  });

  test("a malformed id (E-12) → structural STOP", () => {
    const v = clear({ ...FULL_CARD, id: "E-12" }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("structural");
  });

  test("kind ≠ type (the same axis disagreeing) → structural STOP", () => {
    const v = clear({ ...FULL_CARD, type: "Sorcery" as CardType }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") {
      expect(v.gate).toBe("structural");
      expect(v.reason).toContain("disagree");
    }
  });

  test("an empty `color` array → structural STOP", () => {
    const v = clear({ ...FULL_CARD, color: [] as CardColor[] }, ctxWith(CHARTER, []));
    expect(v.status).toBe("stop");
    if (v.status === "stop") expect(v.gate).toBe("structural");
  });
});

describe("nextEpicId — the next free E-0XX, padded", () => {
  test("an empty board mints E-001", () => {
    expect(nextEpicId([])).toBe("E-001");
  });
  test("one past the numeric max, zero-padded", () => {
    expect(nextEpicId(["E-001", "E-009"])).toBe("E-010");
    expect(nextEpicId(["E-001", "E-002", "E-099"])).toBe("E-100");
  });
  test("ignores non-epic ids (stories/tickets)", () => {
    expect(nextEpicId(["S-009-01", "T-009-02", "E-003"])).toBe("E-004");
  });
});

describe("renderCard — the markdown round-trips every card field", () => {
  const md = renderCard(FULL_CARD);

  test("frontmatter carries id, title, status:open, kind alias, advances, serves", () => {
    expect(md).toContain("id: E-010");
    expect(md).toContain("title: ramp-the-shelf");
    expect(md).toContain("status: open");
    expect(md).toContain("kind: permanent"); // member "Permanent" → lowercase alias
    expect(md).toContain("advances: [P1]");
    expect(md).toContain(FULL_CARD.serves);
  });

  test("the stat-block carries manaCost, color alias, type alias, rarity alias", () => {
    expect(md).toContain("{2}{U}");
    expect(md).toContain("blue"); // CardColor "Blue" → alias
    expect(md).toContain("permanent"); // type alias
    expect(md).toContain("rare"); // rarity alias
    expect(md).toContain("propose-epic"); // the play trailer
  });

  test("the body carries intent, value, doneLooksLike, context", () => {
    expect(md).toContain(FULL_CARD.intent);
    expect(md).toContain(FULL_CARD.value);
    expect(md).toContain(FULL_CARD.doneLooksLike);
    expect(md).toContain(FULL_CARD.context);
  });

  test("a multi-color card renders each discipline alias (Azorius WU)", () => {
    const azorius = renderCard({ ...FULL_CARD, color: ["White", "Blue"] as CardColor[] });
    expect(azorius).toContain("white");
    expect(azorius).toContain("blue");
  });

  test("an out-of-map enum member throws RangeError (enum/map drift guard)", () => {
    expect(() => renderCard({ ...FULL_CARD, rarity: "Legendary" as CardRarity })).toThrow(RangeError);
  });
});
