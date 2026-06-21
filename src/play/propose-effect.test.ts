import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CardColor, CardRarity, CardType, EpicCard } from "../../baml_client/index.ts";
import type { CastContext } from "../engine/play.ts";
import { classify } from "../engine/cast-core.ts";
import { clear, nextEpicId, PE_GATE_NAMES, type ProposeClearContext } from "./propose-core.ts";
import { EPIC_DIR, proposeEpicEffect, type ProposeEpicInputs } from "./propose-effect.ts";

// T-009-03: the OFFLINE demonstration of the ProposeEpic cast — the AC#3 proof that does not
// need a live model. Every BAML import is TYPE-ONLY (erased at runtime) and enum members are
// supplied as string-literal casts (`b.parse` returns exactly these member strings), so NO
// native addon loads into this `bun test` process (the propose-core.test.ts / note-core.test.ts
// discipline). We prove the two halves the cast plugs in beyond the already-pinned pure core:
//   (1) the impure effect mints the authoritative disjoint id and writes a valid E-0XX.md to a
//       real temp-dir board (the captureNoteEffect precedent), and
//   (2) the clear→classify wiring — a clear materializes (the effect would run); a gate STOP is
//       a gate-failed andon that writes nothing.

// A complete, clearing EpicCard — the shape `b.parse` yields (built directly, no model call).
// NOTE its id is E-999: the effect must IGNORE it and write the freshly MINTED id (design D2).
const FULL_CARD: EpicCard = {
  id: "E-999",
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

const CHARTER = "P1 author-once. P7 budget-hard. N1 not-a-copilot. N4 not-an-executor.";

const inputsWith = (existingEpicIds: readonly string[]): ProposeEpicInputs => ({
  signal: "a pulled demand one-liner",
  charter: CHARTER,
  project: "# Project snapshot",
  existingEpicIds,
});

const ctxFor = (root: string, existingEpicIds: readonly string[]): CastContext<ProposeEpicInputs> => ({
  inputs: inputsWith(existingEpicIds),
  projectRoot: root,
});

const clearCtx = (existingEpicIds: readonly string[]): ProposeClearContext => ({
  charter: CHARTER,
  existingEpicIds,
});

/** A throwaway projectRoot, optionally seeded with epic ids under docs/active/epic. */
async function seedRoot(epicIds: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-propose-"));
  if (epicIds.length > 0) {
    const dir = join(root, EPIC_DIR);
    await mkdir(dir, { recursive: true });
    await Promise.all(epicIds.map((id) => writeFile(join(dir, `${id}.md`), "---\nid: stub\n---\n", "utf8")));
  }
  return root;
}

describe("proposeEpicEffect — mints the authoritative disjoint id and writes a valid card", () => {
  test("a populated board (E-001…E-009) → writes the MINTED E-010.md, ignoring card.id", async () => {
    const board = ["E-001", "E-002", "E-003", "E-004", "E-005", "E-006", "E-007", "E-008", "E-009"];
    const root = await seedRoot(board);
    try {
      const res = await proposeEpicEffect(FULL_CARD, ctxFor(root, board));
      expect(res.ok).toBe(true);
      expect(res.outcome).toBeUndefined();

      const expected = join(root, EPIC_DIR, "E-010.md");
      expect(res.artifacts).toEqual([expected]);
      // T-011-01: the effect surfaces the minted path as `produced` — the handle the chain
      // primitive threads into the next play. The explicit downstream handle == artifacts[0].
      expect(res.produced).toBe(expected);
      expect(res.produced).toBe(res.artifacts?.[0]);

      const written = await readFile(expected, "utf8");
      // the MINTED id (E-010), NOT the model's card.id (E-999) — proves the re-mint (D2).
      expect(written).toContain("id: E-010");
      expect(written).not.toContain("E-999");
      // the card round-trips through the rendered markdown.
      expect(written).toContain("title: ramp-the-shelf");
      expect(written).toContain(FULL_CARD.serves);
      expect(written).toContain(FULL_CARD.intent);
      expect(written).toContain(FULL_CARD.value);
      expect(written).toContain("propose-epic"); // the play trailer
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an empty board (no epic dir yet) → mints E-001 and creates the dir", async () => {
    const root = await seedRoot([]);
    try {
      const res = await proposeEpicEffect(FULL_CARD, ctxFor(root, []));
      expect(res.ok).toBe(true);
      const expected = join(root, EPIC_DIR, "E-001.md");
      expect(res.artifacts).toEqual([expected]);
      const written = await readFile(expected, "utf8");
      expect(written).toContain("id: E-001");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("the minted id is always disjoint from the live board", async () => {
    const board = ["E-001", "E-009", "E-099"];
    const root = await seedRoot(board);
    try {
      const res = await proposeEpicEffect(FULL_CARD, ctxFor(root, board));
      expect(res.ok).toBe(true);
      expect(res.artifacts).toEqual([join(root, EPIC_DIR, "E-100.md")]);
      // nextEpicId and the effect agree on "the next free id".
      expect(nextEpicId(board)).toBe("E-100");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("clear → classify wiring — a clear materializes; a gate STOP writes nothing", () => {
  const inBudget = { status: "ok", spent: 100, ceiling: 16000, remaining: 15900 } as const;

  test("a cleared card → success + materialize (the effect would run), three passed gate rows", () => {
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: clear(FULL_CARD, clearCtx(["E-009"])) });
    expect(v.outcome).toBe("success");
    expect(v.materialize).toBe(true);
    expect(v.gateLog).toEqual([...PE_GATE_NAMES].map((gate) => ({ gate, passed: true })));
  });

  test("a bounds STOP (advances a non-goal) → gate-failed + no materialize (the andon)", () => {
    const stop = clear({ ...FULL_CARD, advances: ["N4"] }, clearCtx([]));
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
    expect(v.gateLog.some((r) => r.gate === "bounds" && !r.passed)).toBe(true);
  });

  test("a structural STOP (id collides with the board) → gate-failed + no materialize", () => {
    const stop = clear(FULL_CARD, clearCtx(["E-999"])); // FULL_CARD.id collides
    const v = classify({ timedOut: false, budgetOutcome: inBudget, gateVerdict: stop });
    expect(v.outcome).toBe("gate-failed");
    expect(v.materialize).toBe(false);
  });
});

// T-043-01 AC#3: the DETERMINISTIC, no-live-model proof of title-keyed idempotency. Driving the real
// effect end-to-end against a temp-dir board (its first run writes a real card via `renderCard`, so
// the on-disk `title:` is the genuine one), running TWICE with the same card mints ONCE — the second
// run adopts the first. This is precisely the E-041/E-042 incident (a retry of the doctor proposal):
// before this change the retry minted a fresh childless E-041 orphan; now it adopts and mints nothing.
describe("proposeEpicEffect — title-keyed idempotency (AC#3)", () => {
  /** Count the minted epic cards (`E-*.md`) on a board dir. */
  async function countEpicCards(dir: string): Promise<number> {
    const names = await readdir(dir);
    return names.filter((n) => /^E-\d+\.md$/.test(n)).length;
  }

  test("running the SAME card twice mints once — the second run adopts the first (no orphan)", async () => {
    const root = await seedRoot([]); // empty board → first run mints E-001
    const dir = join(root, EPIC_DIR);
    try {
      const first = await proposeEpicEffect(FULL_CARD, ctxFor(root, []));
      expect(first.ok).toBe(true);
      expect(first.produced).toBe(join(dir, "E-001.md"));
      expect(await countEpicCards(dir)).toBe(1);

      // the retry: the model re-mints card.id blind (still E-999), same TITLE — must ADOPT E-001.
      const second = await proposeEpicEffect(FULL_CARD, ctxFor(root, ["E-001"]));
      expect(second.ok).toBe(true);
      expect(second.outcome).toBeUndefined(); // a success, not a relabeled failure
      expect(second.produced).toBe(first.produced); // same card handed downstream
      expect(second.artifacts).toEqual([join(dir, "E-001.md")]);
      expect(second.detail).toContain("idempotent");
      expect(second.detail).toContain("E-001");
      // the proof: the board still holds exactly ONE card — no E-002 orphan was minted.
      expect(await countEpicCards(dir)).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("two DISTINCT-title cards still mint two epics (new-title path / back-compat intact)", async () => {
    const root = await seedRoot([]);
    const dir = join(root, EPIC_DIR);
    try {
      const a = await proposeEpicEffect(FULL_CARD, ctxFor(root, []));
      const b = await proposeEpicEffect({ ...FULL_CARD, title: "a-different-epic" }, ctxFor(root, ["E-001"]));
      expect(a.produced).toBe(join(dir, "E-001.md"));
      expect(b.produced).toBe(join(dir, "E-002.md"));
      expect(a.produced).not.toBe(b.produced);
      expect(await countEpicCards(dir)).toBe(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("adopts a same-title epic already on a POPULATED board, minting nothing", async () => {
    const root = await seedRoot([]);
    const dir = join(root, EPIC_DIR);
    try {
      // seed a populated board where E-040 already carries FULL_CARD's title.
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "E-039.md"), `---\nid: E-039\ntitle: some-other\n---\n`, "utf8");
      await writeFile(join(dir, "E-040.md"), `---\nid: E-040\ntitle: ${FULL_CARD.title}\n---\n`, "utf8");
      const res = await proposeEpicEffect(FULL_CARD, ctxFor(root, ["E-039", "E-040"]));
      expect(res.ok).toBe(true);
      expect(res.produced).toBe(join(dir, "E-040.md")); // adopted, not a fresh E-041
      expect(res.detail).toContain("E-040");
      expect(await countEpicCards(dir)).toBe(2); // no third card minted
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
