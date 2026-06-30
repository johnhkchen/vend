import { describe, expect, test } from "bun:test";
import {
  BOT_EMAIL,
  BOT_NAME,
  describePlan,
  releaseArgv,
  TAP_CLONE_URL_MASKED,
  TAP_FORMULA_SUBPATH,
  TAP_SLUG,
  tapCloneUrl,
  tapCommitMessage,
  tapInRepoArgvs,
  TOKEN_MASK,
} from "./publish-core.ts";

// Unit cover for the publish command spellings (T-063-01 / E-061). The pure core owns every
// outward argv so the shell, the workflow, and --dry-run cannot drift — and so the secret is
// masked in one place. The live publish (gh release + cross-repo push) is exercised only at a real
// tag push, exactly as compile/package/formula's network halves are; here we pin the SPELLING.

describe("releaseArgv — idempotent gh release spelling", () => {
  test("absent → create with generated notes + both assets", () => {
    expect(
      releaseArgv({ tag: "v0.1.0", tarballPath: "dist/a.tar.xz", sumsPath: "dist/sha256sums.txt", exists: false }),
    ).toEqual([
      "gh", "release", "create", "v0.1.0", "--title", "v0.1.0", "--generate-notes", "dist/a.tar.xz", "dist/sha256sums.txt",
    ]);
  });

  test("present → upload --clobber (never a second create on a re-fire)", () => {
    expect(
      releaseArgv({ tag: "v0.1.0", tarballPath: "dist/a.tar.xz", sumsPath: "dist/sha256sums.txt", exists: true }),
    ).toEqual(["gh", "release", "upload", "v0.1.0", "dist/a.tar.xz", "dist/sha256sums.txt", "--clobber"]);
  });
});

describe("tap push — clone url, masking, and the in-repo argvs", () => {
  test("clone url embeds the token; the masked form hides it", () => {
    expect(tapCloneUrl("SECRET")).toBe(`https://x-access-token:SECRET@github.com/${TAP_SLUG}.git`);
    expect(TAP_CLONE_URL_MASKED).toContain(TOKEN_MASK);
    expect(TAP_CLONE_URL_MASKED).not.toContain("SECRET");
  });

  test("in-repo argvs: bot identity, stage, commit msg, push — in order", () => {
    expect(tapInRepoArgvs("v0.1.0")).toEqual([
      ["git", "config", "user.name", BOT_NAME],
      ["git", "config", "user.email", BOT_EMAIL],
      ["git", "add", TAP_FORMULA_SUBPATH],
      ["git", "commit", "-m", "vend v0.1.0"],
      ["git", "push"],
    ]);
    expect(tapCommitMessage("v9.9.9")).toBe("vend v9.9.9");
  });
});

describe("describePlan — the --dry-run plan", () => {
  const plan = describePlan({
    tag: "v0.1.0",
    tarball: "vend-cli-aarch64-apple-darwin.tar.xz",
    releaseExists: null,
    hasToken: true,
  }).join("\n");

  test("shows BOTH idempotent branches when existence is unprobed (dry-run)", () => {
    expect(plan).toContain("gh release create v0.1.0");
    expect(plan).toContain("gh release upload v0.1.0");
  });

  test("names the tap + the formula path, and NEVER leaks the token", () => {
    expect(plan).toContain(TAP_SLUG);
    expect(plan).toContain(TAP_FORMULA_SUBPATH);
    expect(plan).toContain(TOKEN_MASK);
  });

  test("warns when the tap token is absent", () => {
    const noTok = describePlan({ tag: "v0.1.0", tarball: "a.tar.xz", releaseExists: null, hasToken: false }).join("\n");
    expect(noTok).toMatch(/HOMEBREW_TAP_TOKEN/);
  });

  test("commits to one branch when existence is known", () => {
    const present = describePlan({ tag: "v0.1.0", tarball: "a.tar.xz", releaseExists: true, hasToken: true }).join("\n");
    expect(present).toContain("gh release upload v0.1.0");
    expect(present).not.toContain("gh release create v0.1.0");
  });
});
