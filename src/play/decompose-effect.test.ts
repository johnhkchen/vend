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
    expect(validatedRoot).toBe(root);

    const ticket = await readFile(join(root, "docs", "active", "tickets", "T-901-01-01.md"), "utf8");
    expect(ticket).toContain("priority: high\nagent: codex\nphase: ready");
    expect(ticket.match(/^agent: codex$/gm)).toHaveLength(1);
    const story = await readFile(join(root, "docs", "active", "stories", "S-901-01.md"), "utf8");
    expect(story).not.toContain("\nagent:");

    const bareSources = contextSourcesForRun({ epicPath, projectRoot: root });
    expect(Object.hasOwn(bareSources, "agent")).toBeFalse();
  });

  test("unknown seat is relabeled to unknown-seat before any file or directory is written", async () => {
    const { root, epicPath } = await tempProject();
    const inputs = await assembleInputs(contextSourcesForRun({
      epicPath,
      projectRoot: root,
      agent: "gpt",
    }));

    let validationCalls = 0;
    const result = await decomposeEffect(PLAN, { inputs, projectRoot: root }, async () => {
      validationCalls += 1;
      return { ok: true, output: "" };
    });

    expect(result.ok).toBeFalse();
    expect(result.outcome).toBe("unknown-seat");
    expect(result.detail).toContain('unknown agent seat "gpt"');
    expect(validationCalls).toBe(0);
    expect(await readdir(join(root, "docs", "active", "stories")).catch(() => null)).toBeNull();
    expect(await readdir(join(root, "docs", "active", "tickets")).catch(() => null)).toBeNull();
  });
});
