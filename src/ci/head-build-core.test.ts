import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCommittedHead } from "./check-head.ts";
import { buildStepFailed, classifyBuildOutcome } from "./head-build-core.ts";

// T-010-01 check:head core (E-010). Two layers:
//  (1) the PURE classifier — an ordinary pure-function test (the committed-core / press-core
//      discipline): no git, no process, exact exit codes + message substrings.
//  (2) the INTEGRATION proof — buildCommittedHead driven against a SYNTHETIC repo whose broken
//      HEAD reproduces E-007's defect class (a committed file importing a module that was NOT
//      committed alongside it). Runs offline (`install: null`, synthetic `check` is pure Bun), so
//      the whole file stays sub-second and never touches the network.

// ── (1) the pure classifier ────────────────────────────────────────────────────────────────────
describe("classifyBuildOutcome", () => {
  test("all steps passed → exit 0, ok, builds message", () => {
    const v = classifyBuildOutcome({ failedStep: null, detail: "" });
    expect(v.exitCode).toBe(0);
    expect(v.ok).toBe(true);
    expect(v.message).toContain("ok — committed HEAD builds");
  });

  test("build step failed → exit 1 ANDON, message names the E-007 class + detail", () => {
    const v = classifyBuildOutcome({ failedStep: "build", detail: "Cannot find module './dep.ts'" });
    expect(v.exitCode).toBe(1);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("does not build");
    expect(v.message).toContain("E-007");
    expect(v.message).toContain("Cannot find module './dep.ts'");
  });

  test("preflight failed → exit 2 environment error (couldn't check), not a broken HEAD", () => {
    const v = classifyBuildOutcome({ failedStep: "preflight", detail: "not a git repository" });
    expect(v.exitCode).toBe(2);
    expect(v.ok).toBe(false);
    expect(v.message).toContain("could not check HEAD");
    expect(v.message).toContain("preflight");
  });

  test("worktree add failed → exit 2 environment error", () => {
    const v = classifyBuildOutcome({ failedStep: "worktree", detail: "worktree add failed" });
    expect(v.exitCode).toBe(2);
    expect(v.message).toContain("worktree");
  });
});

describe("buildStepFailed", () => {
  test("zero passes, non-zero fails", () => {
    expect(buildStepFailed(0)).toBe(false);
    expect(buildStepFailed(1)).toBe(true);
    expect(buildStepFailed(2)).toBe(true);
  });
});

// ── (2) the synthetic-HEAD integration proof ─────────────────────────────────────────────────────
const repos: string[] = [];
afterEach(async () => {
  while (repos.length) await rm(repos.pop()!, { recursive: true, force: true });
});

/** Spawn git in `cwd`, asserting success — keeps the fixture builders terse. */
function git(cwd: string, ...args: string[]): void {
  const r = Bun.spawnSync(["git", "-C", cwd, ...args]);
  if (r.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString()}`);
  }
}

/**
 * Build a throwaway repo whose `check` script (`bun run app.ts`) imports `./dep.ts`. The CALLER
 * chooses which files get committed — committing app.ts WITHOUT dep.ts is the E-007 move (a
 * committed file importing a missing committed module), while dep.ts still lingers uncommitted in
 * the working tree (so an in-place check would pass, masking the broken HEAD).
 */
async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-headtest-"));
  repos.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "Test");
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { check: "bun run app.ts" } }));
  await writeFile(join(root, "app.ts"), `import "./dep.ts";\nconsole.log("ok");\n`);
  await writeFile(join(root, "dep.ts"), `export const dep = 1;\n`);
  return root;
}

describe("buildCommittedHead — synthetic HEAD (E-007 class)", () => {
  test("AC#3: broken HEAD (app.ts committed without dep.ts) → build fails, classified exit 1", async () => {
    const root = await makeRepo();
    // commit package.json + app.ts but NOT dep.ts — the partial commit. dep.ts stays uncommitted.
    git(root, "add", "package.json", "app.ts");
    git(root, "commit", "-qm", "partial: app without its dep");

    const outcome = await buildCommittedHead({ root, install: null });
    expect(outcome.failedStep).toBe("build");
    expect(classifyBuildOutcome(outcome).exitCode).toBe(1);
  });

  test("AC#3: clean HEAD (all files committed) → build passes, classified exit 0", async () => {
    const root = await makeRepo();
    git(root, "add", "-A");
    git(root, "commit", "-qm", "complete: app with its dep");

    const outcome = await buildCommittedHead({ root, install: null });
    expect(outcome.failedStep).toBeNull();
    expect(classifyBuildOutcome(outcome).exitCode).toBe(0);
  });

  test("AC#1: the worktree is removed in every path — no leak after a run", async () => {
    const root = await makeRepo();
    git(root, "add", "-A");
    git(root, "commit", "-qm", "complete");

    await buildCommittedHead({ root, install: null });

    // `git worktree list` shows only the main tree; no temp `vend-head-*` worktree survives.
    const list = Bun.spawnSync(["git", "-C", root, "worktree", "list"]).stdout.toString();
    expect(list).not.toContain("vend-head-");
    expect(list.trim().split("\n")).toHaveLength(1);
  });

  test("AC#1: a failing build still leaves no worktree behind", async () => {
    const root = await makeRepo();
    git(root, "add", "package.json", "app.ts");
    git(root, "commit", "-qm", "partial");

    const outcome = await buildCommittedHead({ root, install: null });
    expect(outcome.failedStep).toBe("build");
    const list = Bun.spawnSync(["git", "-C", root, "worktree", "list"]).stdout.toString();
    expect(list).not.toContain("vend-head-");
  });

  test("preflight: a non-repo path → environment error (exit 2), nothing built", async () => {
    const notRepo = await mkdtemp(join(tmpdir(), "vend-notrepo-"));
    repos.push(notRepo);
    const outcome = await buildCommittedHead({ root: notRepo, install: null });
    expect(outcome.failedStep).toBe("preflight");
    expect(classifyBuildOutcome(outcome).exitCode).toBe(2);
    // no temp parent leaked (preflight returns before mkdtemp)
    expect(existsSync(notRepo)).toBe(true); // the caller's dir is untouched
  });
});
