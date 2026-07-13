import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH,
  parseLisaLoopSettledMarker,
} from "./lisa-loop-settled-core.ts";
import { recordLisaLoopSettled } from "./lisa-loop-settled.ts";

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
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("ignored and malformed events write nothing", async () => {
    const root = await tempRoot();
    try {
      expect((await recordLisaLoopSettled({
        event: "attention",
        projectRoot: root,
        ticketsDone: undefined,
        durationSecs: undefined,
      })).kind).toBe("ignored");
      expect((await recordLisaLoopSettled({
        event: "complete",
        projectRoot: root,
        ticketsDone: "three",
        durationSecs: "90",
      })).kind).toBe("refused");
      expect(await readdir(root)).toEqual([]);
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
