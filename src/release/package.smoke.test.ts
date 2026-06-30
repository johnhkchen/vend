import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// T-062-03 release-ci-tarball-sha (story S-062, epic E-061) — the AC's verifiable substance,
// OBSERVED:
//
//   > A tagged run produces a GitHub release whose asset is the arm64-mac tarball plus a sha256
//   > that re-verifies against the downloaded tarball.
//
// The "GitHub release" half is structural (the workflow YAML) and cannot run in `bun test`. The
// TESTABLE substance is the package → sha256 → re-verify round-trip, and the tag↔version guard —
// both discharged here by running the REAL packaging shell (package.ts) against a fixture binary in
// a temp dir, then re-verifying with the consumer's own tool, `shasum -a 256 -c`.
//
// No compile and no network: we are testing PACKAGING, not compiling (the real compile is proven by
// compile.smoke.test.ts). A few KB of bytes stand in for dist/vend — the tar+sha+verify chain is
// byte-identical regardless of the member's contents.

const root = join(import.meta.dir, "..", ".."); // repo root — package.ts is run from here
const TARBALL = "vend-cli-aarch64-apple-darwin.tar.xz"; // the pinned asset name (drift-guarded in release-core.test.ts)
const SHA256SUMS = "sha256sums.txt";

// Clear GITHUB_REF_NAME so a CI run (where it is the branch/tag, e.g. "main") does not trip the
// tag↔version guard on the no-tag runs below. The explicit-tag test passes --tag, which overrides.
const NO_TAG_ENV = { ...process.env, GITHUB_REF_NAME: "" };

let distDir: string;

beforeAll(async () => {
  distDir = await mkdtemp(join(tmpdir(), "vend-package-"));
  // Fixture binary: stands in for the compiled dist/vend. Distinct bytes so a tamper is detectable.
  await writeFile(join(distDir, "vend"), Buffer.from("#!/fixture\n" + "x".repeat(4096)));

  const r = Bun.spawnSync(["bun", "run", "src/release/package.ts", distDir], { cwd: root, env: NO_TAG_ENV });
  if (r.exitCode !== 0) {
    throw new Error(`package.ts failed (exit ${r.exitCode}): ${r.stderr.toString()}\n${r.stdout.toString()}`);
  }
}, 30_000);

afterAll(async () => {
  await rm(distDir, { recursive: true, force: true });
});

describe("release packaging — tarball + sha256 that re-verifies (T-062-03)", () => {
  test("writes the pinned-name tarball, non-empty", async () => {
    const tarball = Bun.file(join(distDir, TARBALL));
    expect(await tarball.exists()).toBe(true);
    expect(tarball.size).toBeGreaterThan(0);
  });

  test("the tarball contains exactly the bare `vend` binary at its root", () => {
    // `tar -tf` lists members; the asset must hold `vend` (not `dist/vend`) so a formula's
    // `bin.install "vend"` finds it.
    const list = Bun.spawnSync(["tar", "-tf", join(distDir, TARBALL)]);
    expect(list.exitCode).toBe(0);
    expect(list.stdout.toString().trim()).toBe("vend");
  });

  test("sha256sums.txt has the `<64-hex>␣␣<tarball>` format", async () => {
    const sums = (await Bun.file(join(distDir, SHA256SUMS)).text()).trim();
    expect(sums).toMatch(new RegExp(`^[0-9a-f]{64} {2}${TARBALL.replace(/\./g, "\\.")}$`));
  });

  test("the sha256 RE-VERIFIES against the tarball via `shasum -a 256 -c` (the AC)", () => {
    const verify = Bun.spawnSync(["shasum", "-a", "256", "-c", SHA256SUMS], { cwd: distDir });
    expect(verify.exitCode).toBe(0);
    expect(verify.stdout.toString()).toContain(`${TARBALL}: OK`);
  });

  test("a tampered tarball FAILS re-verification — the sum is bound to the exact bytes", async () => {
    const tarballPath = join(distDir, TARBALL);
    const original = await Bun.file(tarballPath).bytes();
    try {
      await writeFile(tarballPath, Buffer.concat([Buffer.from(original), Buffer.from([0x00])])); // append a byte
      const verify = Bun.spawnSync(["shasum", "-a", "256", "-c", SHA256SUMS], { cwd: distDir });
      expect(verify.exitCode).not.toBe(0);
      expect(verify.stdout.toString() + verify.stderr.toString()).toMatch(/FAILED|did NOT match/i);
    } finally {
      await writeFile(tarballPath, Buffer.from(original)); // restore for any later reads
    }
  });
});

describe("release packaging — guards (T-062-03)", () => {
  test("a mismatched --tag fails (exit 1) naming the embedded version", async () => {
    // VERSION is 0.1.0; v9.9.9 must not package. Needs the fixture binary present, so reuse distDir.
    const r = Bun.spawnSync(["bun", "run", "src/release/package.ts", distDir, "--tag", "v9.9.9"], { cwd: root, env: NO_TAG_ENV });
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toString()).toContain("9.9.9");
  });

  test("a missing compiled binary is a precondition error (exit 2)", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "vend-package-empty-"));
    try {
      const r = Bun.spawnSync(["bun", "run", "src/release/package.ts", emptyDir], { cwd: root, env: NO_TAG_ENV });
      expect(r.exitCode).toBe(2);
      expect(r.stderr.toString()).toContain("bun run compile");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
