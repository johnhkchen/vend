import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CardColor,
  CardRarity,
  CardType,
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  EpicCard,
  WorkPlan,
} from "../../baml_client/index.ts";
import type { CastContext } from "../engine/play.ts";
import { CHARTER_PATH, assembleInputs } from "./project-context.ts";
import { materialize } from "./materialize.ts";
import { EPIC_DIR, proposeEpicEffect, type ProposeEpicInputs } from "./propose-effect.ts";

// T-011-02: the OFFLINE proof of the propose→decompose chain (AC#3) — signal → epic → tickets, with
// the threaded epic the EXACT one ProposeEpic minted. It does NOT need a live model and loads NO
// native addon: every BAML import is TYPE-ONLY (erased at runtime) and enum members are supplied as
// string-literal casts. We deliberately do NOT import ./chain-propose-decompose.ts (it value-imports
// both plays' `b`, the addon) — that module's glue is the pure `runChain` (proven in
// chain-core.test.ts) over the real, addon-free links proven HERE:
//   (1) ProposeEpic's effect produces the minted epic PATH (the chain's thread handle);
//   (2) feeding that exact path into DecomposeEpic's `assembleInputs` reads back the EXACT minted
//       epic (the thread is faithful);
//   (3) a cleared WorkPlan materializes into stories/tickets (epic → tickets);
//   (4) the run-log subject derivation maps the minted path → the minted epic id.
// The live signal-in/tickets-out cast is the human sweep verification (AC#4).

// A complete, clearing EpicCard — the shape `b.parse` yields (built directly, no model call). Its
// id is E-999 so the effect's re-mint (design D2) is observable: the written id is the MINTED one.
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

// A minimal cleared WorkPlan: 1 story + 1 ticket, ids disjoint from any seeded board, member
// strings = the enum members materialize's alias maps key on (Task/Open/High/Ready).
const CANNED_PLAN: WorkPlan = {
  stories: [
    {
      id: "S-900",
      title: "stand-up-the-shelf",
      type: "Task" as DraftType,
      status: "Open" as DraftStatus,
      priority: "High" as DraftPriority,
      tickets: ["T-900-01"],
    },
  ],
  tickets: [
    {
      id: "T-900-01",
      story: "S-900",
      title: "register-the-first-play",
      type: "Task" as DraftType,
      status: "Open" as DraftStatus,
      priority: "High" as DraftPriority,
      phase: "Ready" as DraftPhase,
      depends_on: [],
      purpose: "Register a play on the shelf so it is pickable.",
      advances: ["P1"],
      doneSignal: "A play resolves by name from the registry.",
    },
  ],
};

const ctxFor = (root: string, existingEpicIds: readonly string[]): CastContext<ProposeEpicInputs> => ({
  inputs: { signal: "a pulled demand one-liner", charter: CHARTER, project: "# snapshot", existingEpicIds },
  projectRoot: root,
});

/** A throwaway projectRoot seeded with a real charter (assembleInputs reads it) + optional epics. */
async function seedRoot(epicIds: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-chain-"));
  // assembleInputs reads docs/knowledge/charter.md — seed it or it throws ENOENT.
  await mkdir(join(root, "docs", "knowledge"), { recursive: true });
  await writeFile(join(root, CHARTER_PATH), CHARTER, "utf8");
  if (epicIds.length > 0) {
    const dir = join(root, EPIC_DIR);
    await mkdir(dir, { recursive: true });
    await Promise.all(epicIds.map((id) => writeFile(join(dir, `${id}.md`), "---\nid: stub\n---\n", "utf8")));
  }
  return root;
}

describe("propose→decompose chain (offline) — signal → epic → tickets, the exact threaded epic", () => {
  test("ProposeEpic's `produced` path threads into DecomposeEpic and reads back the EXACT epic", async () => {
    const board = ["E-001", "E-002", "E-003", "E-004", "E-005", "E-006", "E-007", "E-008", "E-009"];
    const root = await seedRoot(board);
    try {
      // Step 1 — ProposeEpic effect mints + writes the epic; `produced` is the chain's thread handle.
      const proposed = await proposeEpicEffect(FULL_CARD, ctxFor(root, board));
      expect(proposed.ok).toBe(true);
      const epicPath = join(root, EPIC_DIR, "E-010.md");
      expect(proposed.produced).toBe(epicPath); // the minted path, the next play's input

      const mintedOnDisk = await readFile(epicPath, "utf8");
      expect(mintedOnDisk).toContain("id: E-010"); // the re-minted authoritative id (not E-999)
      expect(mintedOnDisk).not.toContain("E-999");

      // The THREAD: feed step-1's exact `produced` into step-2's input assembly (the chain adapter
      // is `upstream → assembleInputs({ epicPath: upstream })`).
      const decomposeInputs = await assembleInputs({ epicPath: proposed.produced!, projectRoot: root });

      // "the threaded epic is the exact one ProposeEpic minted" — byte-for-byte the file just written.
      expect(decomposeInputs.epic).toBe(mintedOnDisk);
      expect(decomposeInputs.epic).toContain("id: E-010");
      expect(decomposeInputs.epic).toContain(FULL_CARD.serves);
      expect(decomposeInputs.epic).toContain(FULL_CARD.intent);
      // and the charter the bounds gate greps came through as the REAL one.
      expect(decomposeInputs.charter).toBe(CHARTER);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("epic → tickets: a cleared WorkPlan materializes stories + tickets to the board", async () => {
    const root = await seedRoot(["E-001"]);
    try {
      const res = await materialize(
        CANNED_PLAN,
        {
          storiesDir: join(root, "docs", "active", "stories"),
          ticketsDir: join(root, "docs", "active", "tickets"),
        },
        CHARTER,
      );
      expect(res.storyFiles).toEqual([join(root, "docs", "active", "stories", "S-900.md")]);
      expect(res.ticketFiles).toEqual([join(root, "docs", "active", "tickets", "T-900-01.md")]);

      const ticket = await readFile(res.ticketFiles[0]!, "utf8");
      expect(ticket).toContain("id: T-900-01");
      expect(ticket).toContain("story: S-900");
      expect(ticket).toContain("type: task"); // member → alias mapping applied
      expect(ticket).toContain("phase: ready");
      const story = await readFile(res.storyFiles[0]!, "utf8");
      expect(story).toContain("id: S-900");
      expect(story).toContain("tickets: [T-900-01]");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("the decompose run-log subject derives the minted epic id from the threaded path", () => {
    // Mirrors `epicSubjectFromPath` (NOT imported — its module loads the addon). The chain stamps
    // the decompose record with the minted id, not the proposal signal.
    const derive = (p: string): string => (p.split("/").pop() ?? p).replace(/\.md$/, "") || p;
    expect(derive("/tmp/x/docs/active/epic/E-010.md")).toBe("E-010");
    expect(derive("E-042.md")).toBe("E-042");
  });
});
