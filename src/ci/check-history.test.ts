import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, resolveRange, sweepCommits } from "./check-history.ts";
import { boundRange } from "./history-core.ts";

// T-034-02 check:history sweep (E-034). The INTEGRATION proof — the git-and-worktree half that
// history-core.test.ts (T-034-01) deliberately doesn't touch. Mirrors head-build-core.test.ts's
// synthetic-repo harness: a throwaway repo with several commits, one deliberately red, swept through
// `sweepCommits` with `install: null` and a pure-Bun `check` so it stays offline and sub-second. The
// pure verdict/bound logic (`classifyHistory`, `boundRange`) is already covered upstream; here we
// prove the sweep builds each commit-ish in isolation and flattens its outcome to the right
// CommitResult, that resolveRange orders newest-first, and that bounding caps loudly.

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

/** Resolve a commit-ish to its full sha in the fixture repo. */
function sha(root: string, rev: string): string {
  const r = Bun.spawnSync(["git", "-C", root, "rev-parse", rev]);
  return r.stdout.toString().trim();
}

/**
 * Build a throwaway repo whose `check` script runs a pure-Bun test file (`bun test t.test.ts`). The
 * CALLER stages the contents of `t.test.ts` per commit, so a commit can be made GREEN (a passing
 * assertion) or RED (a throwing/failing assertion) — the per-commit signal the audit must surface.
 * No deps, so `install: null` keeps every run offline and sub-second.
 */
async function makeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-histtest-"));
  repos.push(root);
  git(root, "init", "-q");
  git(root, "config", "user.email", "t@example.com");
  git(root, "config", "user.name", "Test");
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ scripts: { check: "bun test t.test.ts" } }),
  );
  return root;
}

/** Write the test body and commit it under `subject`. `pass` picks a green or red assertion. */
async function commitState(root: string, subject: string, pass: boolean): Promise<void> {
  // The subject is embedded as a marker comment so consecutive commits have distinct content
  // (git refuses an empty commit), even when two adjacent commits are both green.
  const assertion = pass ? "expect(1).toBe(1)" : "expect(1).toBe(2)";
  const body = `// ${subject}\nimport { test, expect } from "bun:test";\ntest("t", () => ${assertion});\n`;
  await writeFile(join(root, "t.test.ts"), body);
  git(root, "add", "-A");
  git(root, "commit", "-qm", subject);
}

const OFFLINE = { install: null, check: ["bun", "run", "check"] } as const;

describe("sweepCommits — synthetic multi-commit repo", () => {
  test("AC#3: a red commit in range is flagged, with its subject and a failure summary", async () => {
    const root = await makeRepo();
    await commitState(root, "green base", true);
    await commitState(root, "red: breaks the test", false);

    const shas = [sha(root, "HEAD"), sha(root, "HEAD~1")]; // newest-first, like rev-list
    const results = await sweepCommits({ root, shas, ...OFFLINE });

    expect(results).toHaveLength(2);
    const red = results.find((r) => r.subject === "red: breaks the test")!;
    const greenBase = results.find((r) => r.subject === "green base")!;
    expect(red.green).toBe(false);
    expect(red.summary && red.summary.length).toBeGreaterThan(0);
    expect(greenBase.green).toBe(true);
    expect(greenBase.summary).toBeUndefined();
  });

  test("AC#3: an all-green range produces no reds (classifyHistory would report clean)", async () => {
    const root = await makeRepo();
    await commitState(root, "green one", true);
    await commitState(root, "green two", true);

    const shas = [sha(root, "HEAD"), sha(root, "HEAD~1")];
    const results = await sweepCommits({ root, shas, ...OFFLINE });

    expect(results.every((r) => r.green)).toBe(true);
    expect(results.map((r) => r.subject).sort()).toEqual(["green one", "green two"]);
  });

  test("builds each commit-ish in isolation — leaves no worktree behind", async () => {
    const root = await makeRepo();
    await commitState(root, "green base", true);
    await commitState(root, "red", false);

    await sweepCommits({ root, shas: [sha(root, "HEAD"), sha(root, "HEAD~1")], ...OFFLINE });

    const list = Bun.spawnSync(["git", "-C", root, "worktree", "list"]).stdout.toString();
    expect(list).not.toContain("vend-head-");
    expect(list.trim().split("\n")).toHaveLength(1);
  });
});

describe("parseArgs", () => {
  test("no args → no range, no max (boundRange uses its defaults)", () => {
    expect(parseArgs([])).toEqual({ range: undefined, max: undefined });
  });

  test("a bare range token is captured", () => {
    expect(parseArgs(["main..HEAD"])).toEqual({ range: "main..HEAD", max: undefined });
  });

  test("--max <n> and --max=<n> both parse; range still captured alongside", () => {
    expect(parseArgs(["HEAD", "--max", "5"])).toEqual({ range: "HEAD", max: 5 });
    expect(parseArgs(["--max=3", "abc..def"])).toEqual({ range: "abc..def", max: 3 });
  });

  test("a non-numeric --max is ignored (falls back to the default bound)", () => {
    expect(parseArgs(["--max", "oops"])).toEqual({ range: undefined, max: undefined });
  });
});

describe("resolveRange + boundRange", () => {
  test("resolveRange returns shas newest-first for the default HEAD token", async () => {
    const root = await makeRepo();
    await commitState(root, "first", true);
    await commitState(root, "second", true);
    await commitState(root, "third", true);

    const resolved = resolveRange(root); // default → HEAD
    expect("shas" in resolved).toBe(true);
    if ("shas" in resolved) {
      expect(resolved.shas).toHaveLength(3);
      expect(resolved.shas[0]).toBe(sha(root, "HEAD")); // newest first
      expect(resolved.shas[2]).toBe(sha(root, "HEAD~2"));
    }
  });

  test("resolveRange reports an error (not a throw) for a non-repo path", () => {
    const resolved = resolveRange("/definitely/not/a/repo/path");
    expect("error" in resolved).toBe(true);
  });

  test("boundRange caps the resolved list loudly when it exceeds max", async () => {
    const root = await makeRepo();
    await commitState(root, "a", true);
    await commitState(root, "b", true);
    await commitState(root, "c", true);

    const resolved = resolveRange(root);
    if (!("shas" in resolved)) throw new Error("expected shas");
    const bound = boundRange(resolved.shas, { max: 2, widenHint: "check:history <older>..<newer>" });
    expect(bound.covered).toHaveLength(2);
    expect(bound.droppedCount).toBe(1);
    expect(bound.note).toContain("covered 2 of 3");
  });
});
