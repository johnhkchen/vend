import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReleaseTarget, requireKey } from "./compile-core.ts";
import { SHA256SUMS, sha256Line, TARBALL_KEY } from "./release-core.ts";
import { TAP_SLUG, TOKEN_MASK } from "./publish-core.ts";
import { VERSION } from "../version.ts";

// T-063-01 / T-065-01 publish phase (epic E-061) — the AC's verifiable substance, OBSERVED via the
// REAL publish.ts under --dry-run. The live publish (gh release + cross-repo push + network) cannot
// run in `bun test`, exactly as T-062-03's `gh release create` cannot — so we drive the dry-run,
// whose plan IS the real run's command sequence (publish-core owns the spelling). We assert the plan
// is emitted, the SECRET never appears, and the preconditions refuse cleanly. The tarball name is
// read from the pin so the fixture can't drift; the tag is `v<VERSION>` so a future bump won't red it.

const root = join(import.meta.dir, "..", ".."); // repo root — publish.ts is run from here
const TARBALL = requireKey(parseReleaseTarget(await Bun.file(join(root, ".github/release-target.env")).text()), TARBALL_KEY);
const SECRET = "tap-token-DO-NOT-LEAK";

/** A dist/ fixture standing in for compile→package→formula output; `omit` drops one artifact. */
async function fixtureDist(omit?: "tarball" | "sums" | "formula"): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "vend-publish-"));
  if (omit !== "tarball") await writeFile(join(d, TARBALL), "fake-tarball-bytes");
  if (omit !== "sums") await writeFile(join(d, SHA256SUMS), sha256Line("d".repeat(64), TARBALL) + "\n");
  if (omit !== "formula") await writeFile(join(d, "vend.rb"), "class Vend < Formula\nend\n");
  return d;
}

function runDryRun(distDir: string, env: Record<string, string> = {}) {
  const r = Bun.spawnSync(["bun", "run", "src/release/publish.ts", distDir, "--dry-run"], {
    cwd: root,
    env: { ...process.env, GITHUB_REF_NAME: `v${VERSION}`, HOMEBREW_TAP_TOKEN: SECRET, ...env },
  });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

describe("publish.ts --dry-run — the plan IS the real run, hermetically (T-063-01)", () => {
  test("all artifacts present → exit 0, prints both idempotent release branches + the tap push", async () => {
    const d = await fixtureDist();
    try {
      const { code, out } = runDryRun(d);
      expect(code).toBe(0);
      expect(out).toContain(`gh release create v${VERSION}`);
      expect(out).toContain(`gh release upload v${VERSION}`); // idempotent branch shown
      expect(out).toContain(TAP_SLUG);
      expect(out).toContain("git push");
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });

  test("the tap token NEVER appears in the output — only the mask", async () => {
    const d = await fixtureDist();
    try {
      const { out } = runDryRun(d);
      expect(out).not.toContain(SECRET);
      expect(out).toContain(TOKEN_MASK);
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });
});

describe("publish.ts — preconditions refuse cleanly (exit 2), no outward action (T-063-01)", () => {
  test("a missing packaged tarball is a precondition error naming the build steps", async () => {
    const d = await fixtureDist("tarball");
    try {
      const { code, err } = runDryRun(d);
      expect(code).toBe(2);
      expect(err).toMatch(/tarball/);
      expect(err).toContain("compile");
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });

  test("a tag that disagrees with VERSION fails the publish (exit 2)", async () => {
    const d = await fixtureDist();
    try {
      const { code, err } = runDryRun(d, { GITHUB_REF_NAME: "v99.99.99" });
      expect(code).toBe(2);
      expect(err).toMatch(/does not match/);
    } finally {
      await rm(d, { recursive: true, force: true });
    }
  });
});
