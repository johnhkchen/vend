import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  DraftPhase,
  DraftPriority,
  DraftStatus,
  DraftType,
  WorkPlan,
} from "../../baml_client/index.ts";
import { decomposeEffect } from "./decompose-effect.ts";
import { assembleInputs, contextSourcesForRun } from "./project-context.ts";

// T-069-01-04 acceptance: drive the REAL addon-free decompose effect through the direct-run
// source adapter. Generated BAML imports stay type-only so the native sync client never enters
// this Bun test process.

const tmps: string[] = [];
afterEach(async () => {
  await Promise.all(tmps.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempProject(): Promise<{ root: string; epicPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "vend-decompose-agent-"));
  tmps.push(root);
  const epicPath = join(root, "epic.md");
  await mkdir(join(root, "docs", "knowledge"), { recursive: true });
  await writeFile(epicPath, "---\nid: E-901\ntitle: routed-mint\n---\n", "utf8");
  await writeFile(
    join(root, "docs", "knowledge", "charter.md"),
    "- **P4 — Autonomy by default, not supervision.** Work proceeds against gates.\n",
    "utf8",
  );
  return { root, epicPath };
}

const PLAN: WorkPlan = {
  stories: [{
    id: "S-901-01",
    title: "route-the-mint",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    tickets: ["T-901-01-01"],
    scope: "Route one board-writing gesture to its selected executor seat (P4).",
    storyAcceptance: "Every materialized ticket carries the selected seat.",
    honestBoundary: "Fixture-proven and token-free; live routing remains deferred.",
    waveRationale: "One ticket owns the complete effect link.",
    outOfSlice: "CLI parsing and Lisa dispatch behavior.",
  }],
  tickets: [{
    id: "T-901-01-01",
    story: "S-901-01",
    title: "stamp-selected-seat",
    type: "Task" as DraftType,
    status: "Open" as DraftStatus,
    priority: "High" as DraftPriority,
    phase: "Ready" as DraftPhase,
    depends_on: [],
    purpose: "Stamp routing metadata without a supervised hand edit (P4).",
    advances: ["P4"],
    doneSignal: "The ticket frontmatter contains the selected agent seat.",
  }],
};

const INLINE_DEGRADE_PLAN: WorkPlan = {
  ...PLAN,
  tickets: PLAN.tickets.map((ticket) => ({
    ...ticket,
    purpose: "Stamp routing metadata while honoring N4 — Not an executor.",
  })),
};

describe("decomposeEffect — agent routing seat", () => {
  test("RunOptions-shaped agent codex reaches inputs and every materialized ticket", async () => {
    const { root, epicPath } = await tempProject();
    const sources = contextSourcesForRun({ epicPath, projectRoot: root, agent: "codex" });
    expect(sources.agent).toBe("codex");
    expect(Object.hasOwn(sources, "agent")).toBeTrue();

    const inputs = await assembleInputs(sources);
    expect(inputs.agent).toBe("codex");
    expect(Object.hasOwn(inputs, "agent")).toBeTrue();

    let validatedRoot: string | undefined;
    const result = await decomposeEffect(PLAN, { inputs, projectRoot: root }, async (projectRoot) => {
      validatedRoot = projectRoot;
      return { ok: true, output: "" };
    });

    expect(result.ok).toBeTrue();
    expect(result.outcome).toBeUndefined();
    expect(result.seatDefaulted).toBeUndefined();
    expect(validatedRoot).toBe(root);

    const ticket = await readFile(join(root, "docs", "active", "tickets", "T-901-01-01.md"), "utf8");
    expect(ticket).toContain("priority: high\nagent: codex\nphase: ready");
    expect(ticket.match(/^agent: codex$/gm)).toHaveLength(1);
    const story = await readFile(join(root, "docs", "active", "stories", "S-901-01.md"), "utf8");
    expect(story).not.toContain("\nagent:");

    const bareSources = contextSourcesForRun({ epicPath, projectRoot: root });
    expect(Object.hasOwn(bareSources, "agent")).toBeFalse();
  });

  test("unknown seat materializes the full default-byte board and reports the disposition", async () => {
    const { root, epicPath } = await tempProject();
    const inputs = await assembleInputs(contextSourcesForRun({
      epicPath,
      projectRoot: root,
      agent: "kodex",
    }));

    let validationCalls = 0;
    const result = await decomposeEffect(PLAN, { inputs, projectRoot: root }, async () => {
      validationCalls += 1;
      return { ok: true, output: "" };
    });

    expect(result.ok).toBeTrue();
    expect(result.outcome).toBeUndefined();
    expect(result.seatDefaulted).toEqual({
      requested: "kodex",
      applied: "claude",
      reason: "unknown-seat",
    });
    expect(validationCalls).toBe(1);
    expect(result.artifacts).toHaveLength(2);
    expect(await readdir(join(root, "docs", "active", "stories"))).toEqual(["S-901-01.md"]);
    expect(await readdir(join(root, "docs", "active", "tickets"))).toEqual(["T-901-01-01.md"]);

    const degradedStory = await readFile(join(root, "docs", "active", "stories", "S-901-01.md"), "utf8");
    const degradedTicket = await readFile(join(root, "docs", "active", "tickets", "T-901-01-01.md"), "utf8");
    expect(degradedTicket).not.toContain("\nagent:");

    const baseline = await tempProject();
    const baselineInputs = await assembleInputs(contextSourcesForRun({
      epicPath: baseline.epicPath,
      projectRoot: baseline.root,
    }));
    const baselineResult = await decomposeEffect(
      PLAN,
      { inputs: baselineInputs, projectRoot: baseline.root },
      async () => ({ ok: true, output: "" }),
    );
    expect(baselineResult.seatDefaulted).toBeUndefined();
    expect(degradedStory).toBe(
      await readFile(join(baseline.root, "docs", "active", "stories", "S-901-01.md"), "utf8"),
    );
    expect(degradedTicket).toBe(
      await readFile(join(baseline.root, "docs", "active", "tickets", "T-901-01-01.md"), "utf8"),
    );
  });

  test("unresolved inline charter prose materializes and is forwarded as a concrete effect degradation", async () => {
    const { root, epicPath } = await tempProject();
    const inputs = await assembleInputs(contextSourcesForRun({ epicPath, projectRoot: root }));
    let validationCalls = 0;

    const result = await decomposeEffect(
      INLINE_DEGRADE_PLAN,
      { inputs, projectRoot: root },
      async () => {
        validationCalls += 1;
        return { ok: true, output: "" };
      },
    );

    expect(result.ok).toBeTrue();
    expect(result.outcome).toBeUndefined();
    expect(result.degrades).toEqual([
      { code: "N4", location: "T-901-01-01.md#purpose", action: "annotate" },
    ]);
    expect(result.artifacts).toHaveLength(2);
    expect(validationCalls).toBe(1);

    const ticket = await readFile(
      join(root, "docs", "active", "tickets", "T-901-01-01.md"),
      "utf8",
    );
    expect(ticket).toContain(
      "Stamp routing metadata while honoring [unresolved charter cite] Not an executor.",
    );
    expect(ticket).not.toContain("N4");
  });
});
