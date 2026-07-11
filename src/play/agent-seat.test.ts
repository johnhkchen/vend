import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { findUnknownSeat, KNOWN_SEATS } from "./agent-seat.ts";
import { assembleInputs, buildProjectSnapshot, CHARTER_PATH } from "./project-context.ts";

// T-069-01-01: one addon-free proof for the canonical seat contract and the optional
// ContextSources → DecomposeInputs transport. project-context imports only Node APIs, so this
// test never loads BAML or its native addon.

describe("agent seat contract", () => {
  test("the single known-seat list accepts claude/codex and identifies gpt", () => {
    expect(KNOWN_SEATS).toEqual(["claude", "codex"]);
    expect(findUnknownSeat("gpt")).toBe("gpt");
    expect(findUnknownSeat("claude")).toBeNull();
    expect(findUnknownSeat("codex")).toBeNull();
  });
});

interface AssemblyFixture {
  readonly root: string;
  readonly epicPath: string;
  readonly epic: string;
  readonly charter: string;
}

async function assemblyFixture(): Promise<AssemblyFixture> {
  const root = await mkdtemp(join(tmpdir(), "vend-agent-seat-"));
  const epicPath = join(root, "E-069.md");
  const charterPath = join(root, CHARTER_PATH);
  const epic = "# Route work at mint\n";
  const charter = "# Test charter\n";
  await mkdir(dirname(charterPath), { recursive: true });
  await Promise.all([writeFile(epicPath, epic, "utf8"), writeFile(charterPath, charter, "utf8")]);
  return { root, epicPath, epic, charter };
}

describe("assembleInputs — optional agent seat", () => {
  test("a supplied codex seat is carried into DecomposeInputs", async () => {
    const fixture = await assemblyFixture();
    try {
      const inputs = await assembleInputs({
        epicPath: fixture.epicPath,
        projectRoot: fixture.root,
        agent: "codex",
      });

      expect(inputs.agent).toBe("codex");
      expect(Object.hasOwn(inputs, "agent")).toBeTrue();
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  test("an absent seat leaves the assembled object shape byte-identical", async () => {
    const fixture = await assemblyFixture();
    try {
      const inputs = await assembleInputs({ epicPath: fixture.epicPath, projectRoot: fixture.root });
      const project = buildProjectSnapshot({
        root: fixture.root,
        srcFiles: [],
        stories: [],
        tickets: [],
      });

      expect(inputs.agent).toBeUndefined();
      expect(Object.hasOwn(inputs, "agent")).toBeFalse();
      expect(inputs).toEqual({ epic: fixture.epic, charter: fixture.charter, project });
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
