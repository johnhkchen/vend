import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH,
  DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
  parseLisaLoopSettledMarker,
} from "./lisa-loop-settled-core.ts";
import { recordLisaLoopSettled } from "./lisa-loop-settled.ts";

const FIRST_FAILURE_AT = new Date("2026-07-13T20:00:00.000Z");
const SECOND_FAILURE_AT = new Date("2026-07-13T20:01:00.000Z");

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "vend-loop-settled-"));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function readFailureLines(root: string): Promise<Array<{ timestamp: string; reason: string }>> {
  const contents = await readFile(join(root, DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH), "utf8");
  return contents.trimEnd().split("\n").map((line) => JSON.parse(line));
}

describe("recordLisaLoopSettled — Vend-owned filesystem crossing", () => {
  test("records an untracked-duration complete event only at the Vend marker path", async () => {
    const root = await tempRoot();
    try {
      const result = await recordLisaLoopSettled({
        event: "complete",
        projectRoot: root,
        ticketsDone: "3",
        durationSecs: undefined,
      });

      expect(result.kind).toBe("recorded");
      if (result.kind !== "recorded") throw new Error("valid event was not recorded");
      expect(result.path).toBe(DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH);
      const bytes = await readFile(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH), "utf8");
      const parsed = parseLisaLoopSettledMarker(bytes);
      expect(parsed).toEqual({
        kind: "valid",
        marker: {
          v: 1,
          kind: "lisa-loop-settled",
          project: basename(root),
          ticketsDone: 3,
        },
      });
      if (parsed.kind !== "valid") throw new Error("untracked marker unexpectedly malformed");
      expect(Object.hasOwn(parsed.marker, "durationSecs")).toBe(false);
      expect(await readdir(root)).toEqual([".vend"]);
      expect(await pathExists(join(root, ".lisa"))).toBe(false);
      expect(await pathExists(join(root, DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("an ignored event writes neither marker nor failure trace", async () => {
    const root = await tempRoot();
    try {
      expect((await recordLisaLoopSettled({
        event: "attention",
        projectRoot: root,
        ticketsDone: undefined,
        durationSecs: undefined,
      })).kind).toBe("ignored");
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("relative-project and nonnumeric-ticket refusals append exactly one trace line each", async () => {
    const root = await tempRoot();
    try {
      const relativeProject = await recordLisaLoopSettled({
        event: "complete",
        projectRoot: "vend",
        ticketsDone: "3",
        durationSecs: "90",
      }, { root, now: () => FIRST_FAILURE_AT });
      expect(relativeProject).toEqual({
        kind: "refused",
        reason: "LISA_PROJECT must be an absolute project root",
      });
      if (relativeProject.kind !== "refused") throw new Error("relative project was not refused");
      expect(await readFailureLines(root)).toEqual([{
        timestamp: FIRST_FAILURE_AT.toISOString(),
        reason: relativeProject.reason,
      }]);

      const nonnumericTickets = await recordLisaLoopSettled({
        event: "complete",
        projectRoot: root,
        ticketsDone: "three",
        durationSecs: "90",
      }, { root: join(root, "unused-fallback"), now: () => SECOND_FAILURE_AT });
      expect(nonnumericTickets).toEqual({
        kind: "refused",
        reason: "LISA_TICKETS_DONE must be a non-negative safe integer",
      });
      if (nonnumericTickets.kind !== "refused") throw new Error("nonnumeric tickets were not refused");
      expect(await readFailureLines(root)).toEqual([
        {
          timestamp: FIRST_FAILURE_AT.toISOString(),
          reason: relativeProject.reason,
        },
        {
          timestamp: SECOND_FAILURE_AT.toISOString(),
          reason: nonnumericTickets.reason,
        },
      ]);
      expect(await pathExists(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a forced marker-write failure appends one trace line and resolves without throwing", async () => {
    const root = await tempRoot();
    const markerPath = join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH);
    try {
      await mkdir(markerPath, { recursive: true });

      const result = await recordLisaLoopSettled({
        event: "complete",
        projectRoot: root,
        ticketsDone: "3",
        durationSecs: undefined,
      }, { now: () => FIRST_FAILURE_AT });

      expect(result.kind).toBe("failed");
      if (result.kind !== "failed") throw new Error("forced marker failure was not contained");
      expect(result.reason).toStartWith("marker write failed: ");
      expect(await readFailureLines(root)).toEqual([{
        timestamp: FIRST_FAILURE_AT.toISOString(),
        reason: result.reason,
      }]);
      expect((await readdir(join(root, ".vend"))).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("the local failure trace is ignored by Git", () => {
    const repositoryRoot = join(import.meta.dir, "..", "..");
    const result = Bun.spawnSync(
      ["git", "check-ignore", DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH],
      { cwd: repositoryRoot },
    );

    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(result.stdout.toString().trim()).toBe(DEFAULT_LISA_LOOP_SETTLED_FAILURE_LOG_PATH);
  });

  test("the standalone recorder contains refusal as exit status instead of an uncaught throw", async () => {
    const root = await tempRoot();
    const repositoryRoot = join(import.meta.dir, "..", "..");
    try {
      const proc = Bun.spawn({
        cmd: [process.execPath, join(repositoryRoot, "src", "seam", "lisa-loop-settled.ts")],
        cwd: root,
        env: {
          ...process.env,
          LISA_EVENT: "complete",
          LISA_PROJECT: "vend",
          LISA_TICKETS_DONE: "3",
          LISA_DURATION_SECS: undefined,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toBe(
        "lisa loop-settled marker refused: LISA_PROJECT must be an absolute project root\n",
      );
      const lines = await readFailureLines(root);
      expect(lines).toHaveLength(1);
      expect(lines[0]?.reason).toBe("LISA_PROJECT must be an absolute project root");
      expect(new Date(lines[0]!.timestamp).toISOString()).toBe(lines[0]!.timestamp);
      expect(await pathExists(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("a later completion atomically replaces the one pending marker", async () => {
    const root = await tempRoot();
    try {
      await recordLisaLoopSettled({ event: "complete", projectRoot: root, ticketsDone: "1", durationSecs: "10" });
      await recordLisaLoopSettled({ event: "complete", projectRoot: root, ticketsDone: "4", durationSecs: "55" });

      const markerDir = join(root, ".vend");
      expect(await readdir(markerDir)).toEqual(["loop-settled.json"]);
      const parsed = parseLisaLoopSettledMarker(await readFile(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH), "utf8"));
      expect(parsed.kind).toBe("valid");
      if (parsed.kind !== "valid") throw new Error("replacement marker unexpectedly malformed");
      expect(parsed.marker.ticketsDone).toBe(4);
      expect(parsed.marker.durationSecs).toBe(55);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("project-owned on-notify crossing", () => {
  test("complete records, fires one verdict, and consumes provenance without an ntfy topic", async () => {
    const root = await tempRoot();
    const repositoryRoot = join(import.meta.dir, "..", "..");
    try {
      const hookDir = join(root, ".lisa", "hooks");
      await Promise.all([
        mkdir(hookDir, { recursive: true }),
        mkdir(join(root, "docs", "active", "epic"), { recursive: true }),
        mkdir(join(root, "docs", "active", "stories"), { recursive: true }),
        mkdir(join(root, "docs", "active", "tickets"), { recursive: true }),
      ]);
      const hook = join(hookDir, "on-notify");
      await Promise.all([
        writeFile(hook, await readFile(join(repositoryRoot, ".lisa", "hooks", "on-notify"), "utf8")),
        writeFile(join(root, "docs", "active", "epic", "E-900.md"), [
          "---", "id: E-900", "title: hook-fixture", "status: open", "advances: [P4]",
          "serves: fixture", "---", "",
        ].join("\n")),
        writeFile(join(root, "docs", "active", "stories", "S-900-01.md"), [
          "---", "id: S-900-01", "title: hook-story", "type: story", "status: open",
          "priority: high", "tickets: [T-900-01]", "---", "",
        ].join("\n")),
        writeFile(join(root, "docs", "active", "tickets", "T-900-01.md"), [
          "---", "id: T-900-01", "story: S-900-01", "title: hook-ticket", "type: task",
          "status: done", "priority: high", "phase: done", "depends_on: []", "---", "",
        ].join("\n")),
        writeFile(
          join(root, "package.json"),
          '{"name":"hook-fixture","private":true,"scripts":{"check":"bun run fixture-check.ts"}}\n',
        ),
        writeFile(join(root, "fixture-check.ts"), 'console.log("9 pass");\n'),
      ]);
      await chmod(hook, 0o755);
      await symlink(join(repositoryRoot, "src"), join(root, "src"), "dir");

      const git = (...args: string[]) => {
        const result = Bun.spawnSync(["git", ...args], { cwd: root });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
      };
      git("init", "-q");
      git("config", "user.email", "fixture@example.test");
      git("config", "user.name", "Vend Fixture");
      git("add", ".");
      git("commit", "-qm", "fixture baseline");

      const proc = Bun.spawn({
        cmd: [hook, "complete"],
        cwd: root,
        env: {
          ...process.env,
          LISA_EVENT: "complete",
          LISA_PROJECT: root,
          LISA_TICKETS_DONE: "5",
          LISA_DURATION_SECS: undefined,
          LISA_NTFY_TOPIC: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(exitCode).toBe(0);
      expect(stderr).toBe("");
      expect(stdout.split("\n")).toContain(`loop: ${basename(root)} — 5 tickets done`);
      expect(stdout).not.toContain("undefineds");
      expect(stdout).not.toMatch(/^loop: .* in [0-9]+s$/m);
      expect(stdout.match(/^loop: /gm)).toHaveLength(1);
      expect(await pathExists(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH))).toBe(false);

      const repeated = Bun.spawn({
        cmd: [process.execPath, join(root, "src", "cli.ts"), "settle"],
        cwd: root,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [repeatedStdout, repeatedStderr, repeatedExitCode] = await Promise.all([
        new Response(repeated.stdout).text(),
        new Response(repeated.stderr).text(),
        repeated.exited,
      ]);
      expect(repeatedExitCode).toBe(0);
      expect(repeatedStderr).toBe("");
      expect(repeatedStdout).toContain("delta: none since last settle");
      expect(repeatedStdout).toContain("loop: none pending");
      expect(repeatedStdout).not.toContain(`loop: ${basename(root)} —`);
      expect(await pathExists(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH))).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
