import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SWEEP_PROVENANCE_PATH,
  type EpicFrontmatterFlip,
  type SweepFlipSet,
  type SweepRefusal,
} from "./sweep-core.ts";
import {
  commitSweep,
  prepareSweep,
  renderEpicStatusFlip,
  renderSweepPlan,
  renderSweepRefusal,
  SweepApplyError,
} from "./sweep.ts";

const flip: EpicFrontmatterFlip = {
  epicId: "E-100",
  path: "docs/active/epic/E-100.md",
  field: "status",
  from: "open",
  to: "done",
  clearedTicketIds: ["T-100-01", "T-100-02"],
};

describe("renderEpicStatusFlip — narrow checked frontmatter transition", () => {
  test("changes only the top-level status line and preserves body lookalikes", () => {
    const source = [
      "---",
      "id: E-100",
      "title: fixture",
      "status: open # lifecycle",
      "advances: [P2]",
      "serves: fixture",
      "---",
      "",
      "body status: open",
      "status: prose",
      "",
    ].join("\n");

    expect(renderEpicStatusFlip(source, flip)).toBe(source.replace(
      "status: open # lifecycle",
      "status: done",
    ));
  });

  test("preserves CRLF bytes outside the changed scalar", () => {
    const source = [
      "---",
      "id: E-100",
      "title: fixture",
      "status: open",
      "advances: []",
      "serves: fixture",
      "---",
      "body",
      "",
    ].join("\r\n");
    const result = renderEpicStatusFlip(source, flip);
    expect(result).toContain("\r\nstatus: done\r\n");
    expect(result.replace("status: done", "status: open")).toBe(source);
  });

  test("refuses an identity mismatch", () => {
    const source = "---\nid: E-999\nstatus: open\n---\n";
    expect(() => renderEpicStatusFlip(source, flip)).toThrow(SweepApplyError);
    expect(() => renderEpicStatusFlip(source, flip)).toThrow(/expected id E-100/);
  });

  test("refuses a stale from-status", () => {
    const source = "---\nid: E-100\nstatus: active\n---\n";
    expect(() => renderEpicStatusFlip(source, flip)).toThrow(/expected status "open"/);
  });

  test("refuses missing and duplicate top-level status fields", () => {
    expect(() => renderEpicStatusFlip("---\nid: E-100\n---\n", flip)).toThrow(
      /observed undefined/,
    );
    expect(() => renderEpicStatusFlip(
      "---\nid: E-100\nstatus: open\nstatus: open\n---\n",
      flip,
    )).toThrow(/exactly one top-level status field/);
  });
});

const plan: SweepFlipSet = {
  kind: "flip-set",
  flips: [flip],
  provenancePath: null,
  pathspec: [flip.path],
  message: "sweep: close E-100\n\nE-100 cleared by T-100-01, T-100-02",
};

describe("sweep terminal rendering", () => {
  test("presents the exact file list and provenance message", () => {
    expect(renderSweepPlan(plan)).toBe(
      "sweep\n" +
      "files:\n" +
      "  docs/active/epic/E-100.md\n" +
      "message:\n" +
      "sweep: close E-100\n\n" +
      "E-100 cleared by T-100-01, T-100-02\n",
    );
  });

  test("presweep refusal names its code, every offender, and recovery action", () => {
    const refusal: SweepRefusal = {
      kind: "refusal",
      code: "presweep-offenders",
      offenders: ["docs/active/tickets/T-100-01.md", "src/x.ts"],
      reason: "Presweep could not prove that phase-done work is committed.",
      nextAction: "Commit or restore the offenders, then rerun `vend sweep`.",
    };
    expect(renderSweepRefusal(refusal)).toBe(
      "sweep refusal [presweep-offenders]: Presweep could not prove that phase-done work is committed.\n" +
      "offenders:\n" +
      "  docs/active/tickets/T-100-01.md\n" +
      "  src/x.ts\n" +
      "next: Commit or restore the offenders, then rerun `vend sweep`.\n",
    );
  });

  test("empty-board refusal makes no file/message claim", () => {
    const refusal: SweepRefusal = {
      kind: "refusal",
      code: "no-epics-ready",
      reason: "No all-done epic needs a status flip.",
      nextAction: "Wait for done work.",
    };
    const rendered = renderSweepRefusal(refusal);
    expect(rendered).toContain("[no-epics-ready]");
    expect(rendered).toContain("next: Wait for done work.");
    expect(rendered).not.toContain("files:");
    expect(rendered).not.toContain("message:");
  });
});

interface SweepCommitFixture {
  readonly root: string;
  readonly epicPath: string;
  readonly provenancePath: string;
  git(...args: string[]): string;
}

async function createSweepCommitFixture(): Promise<SweepCommitFixture> {
  const root = await mkdtemp(join(tmpdir(), "vend-sweep-provenance-"));
  const epicPath = join(root, "docs", "active", "epic", "E-100.md");
  const provenancePath = join(root, SWEEP_PROVENANCE_PATH);

  await Promise.all([
    mkdir(join(root, "docs", "active", "epic"), { recursive: true }),
    mkdir(join(root, "docs", "active", "stories"), { recursive: true }),
    mkdir(join(root, "docs", "active", "tickets"), { recursive: true }),
    mkdir(join(root, ".lisa"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(epicPath, [
      "---",
      "id: E-100",
      "title: cleared fixture",
      "status: open",
      "advances: [P3, P4]",
      "serves: fixture",
      "---",
      "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "stories", "S-100-01.md"), [
      "---",
      "id: S-100-01",
      "title: cleared story",
      "type: story",
      "status: open",
      "priority: high",
      "tickets: [T-100-01]",
      "---",
      "",
    ].join("\n")),
    writeFile(join(root, "docs", "active", "tickets", "T-100-01.md"), [
      "---",
      "id: T-100-01",
      "story: S-100-01",
      "title: cleared ticket",
      "type: task",
      "status: done",
      "priority: high",
      "phase: done",
      "depends_on: []",
      "---",
      "",
    ].join("\n")),
    writeFile(provenancePath, '{"ticket":"baseline"}\n'),
  ]);

  const git = (...args: string[]): string => {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    return result.stdout.toString().trim();
  };
  git("init", "-q");
  git("config", "user.email", "fixture@example.test");
  git("config", "user.name", "Vend Fixture");
  git("add", ".");
  git("commit", "-qm", "fixture baseline");

  return { root, epicPath, provenancePath, git };
}

describe("sweep provenance commit boundary (T-080-02-01)", () => {
  test("dirty tracked provenance is presented and lands with the epic flip in one commit", async () => {
    const fixture = await createSweepCommitFixture();
    try {
      await writeFile(
        fixture.provenancePath,
        `${await readFile(fixture.provenancePath, "utf8")}{"ticket":"T-100-01"}\n`,
      );

      const result = await prepareSweep({ root: fixture.root });
      expect(result.kind).toBe("flip-set");
      if (result.kind !== "flip-set") throw new Error(`unexpected ${result.code}`);

      expect(result.provenancePath).toBe(SWEEP_PROVENANCE_PATH);
      expect(result.pathspec).toEqual([
        "docs/active/epic/E-100.md",
        SWEEP_PROVENANCE_PATH,
      ]);
      expect(renderSweepPlan(result)).toContain(
        `files:\n  docs/active/epic/E-100.md\n  ${SWEEP_PROVENANCE_PATH}\n`,
      );

      const commit = await commitSweep(result, { root: fixture.root });

      expect(fixture.git("rev-parse", "HEAD")).toBe(commit);
      const stat = fixture.git("show", "--stat", "--oneline", "HEAD");
      expect(stat).toContain("docs/active/epic/E-100.md");
      expect(stat).toContain(SWEEP_PROVENANCE_PATH);
      expect(
        fixture.git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
          .split("\n")
          .sort(),
      ).toEqual([SWEEP_PROVENANCE_PATH, "docs/active/epic/E-100.md"].sort());
      expect(await readFile(fixture.epicPath, "utf8")).toContain("\nstatus: done\n");
      expect(fixture.git("status", "--porcelain")).toBe("");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  test("clean provenance keeps the prepared and presented pathspec cards-only", async () => {
    const fixture = await createSweepCommitFixture();
    try {
      const result = await prepareSweep({ root: fixture.root });
      expect(result.kind).toBe("flip-set");
      if (result.kind !== "flip-set") throw new Error(`unexpected ${result.code}`);

      expect(result.provenancePath).toBeNull();
      expect(result.pathspec).toEqual(["docs/active/epic/E-100.md"]);
      expect(renderSweepPlan(result)).not.toContain(SWEEP_PROVENANCE_PATH);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  test("commitSweep refuses a pathspec that does not equal the plan's declared paths", async () => {
    const fixture = await createSweepCommitFixture();
    try {
      const result = await prepareSweep({ root: fixture.root });
      expect(result.kind).toBe("flip-set");
      if (result.kind !== "flip-set") throw new Error(`unexpected ${result.code}`);
      const beforeHead = fixture.git("rev-parse", "HEAD");
      const beforeEpic = await readFile(fixture.epicPath, "utf8");
      const mismatched: SweepFlipSet = {
        ...result,
        pathspec: [...result.pathspec, SWEEP_PROVENANCE_PATH],
      };

      await expect(commitSweep(mismatched, { root: fixture.root })).rejects.toThrow(
        /pathspec must exactly equal the non-empty ordered declared plan paths/,
      );
      expect(fixture.git("rev-parse", "HEAD")).toBe(beforeHead);
      expect(await readFile(fixture.epicPath, "utf8")).toBe(beforeEpic);
      expect(fixture.git("status", "--porcelain")).toBe("");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
