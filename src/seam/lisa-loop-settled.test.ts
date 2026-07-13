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
  test("records a valid complete event only at the Vend marker path", async () => {
    const root = await tempRoot();
    try {
      const result = await recordLisaLoopSettled({
        event: "complete",
        projectRoot: root,
        ticketsDone: "3",
        durationSecs: "90",
      });

      expect(result.kind).toBe("recorded");
      if (result.kind !== "recorded") throw new Error("valid event was not recorded");
      expect(result.path).toBe(DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH);
      const bytes = await readFile(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH), "utf8");
      expect(parseLisaLoopSettledMarker(bytes)).toEqual({
        kind: "valid",
        marker: {
          v: 1,
          kind: "lisa-loop-settled",
          project: basename(root),
          ticketsDone: 3,
          durationSecs: 90,
        },
      });
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
  test("complete records the marker even when no ntfy topic is configured", async () => {
    const root = await tempRoot();
    const repositoryRoot = join(import.meta.dir, "..", "..");
    try {
      const hookDir = join(root, ".lisa", "hooks");
      await mkdir(hookDir, { recursive: true });
      const hook = join(hookDir, "on-notify");
      await writeFile(hook, await readFile(join(repositoryRoot, ".lisa", "hooks", "on-notify"), "utf8"));
      await chmod(hook, 0o755);
      await symlink(join(repositoryRoot, "src"), join(root, "src"), "dir");

      const proc = Bun.spawn({
        cmd: [hook, "complete"],
        cwd: root,
        env: {
          ...process.env,
          LISA_EVENT: "complete",
          LISA_PROJECT: root,
          LISA_TICKETS_DONE: "5",
          LISA_DURATION_SECS: "120",
          LISA_NTFY_TOPIC: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      });

      expect(await proc.exited).toBe(0);
      const parsed = parseLisaLoopSettledMarker(
        await readFile(join(root, DEFAULT_LISA_LOOP_SETTLED_MARKER_PATH), "utf8"),
      );
      expect(parsed.kind).toBe("valid");
      if (parsed.kind !== "valid") throw new Error("hook marker unexpectedly malformed");
      expect(parsed.marker.ticketsDone).toBe(5);
      expect(parsed.marker.durationSecs).toBe(120);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
