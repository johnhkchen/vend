import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256Line } from "./release-core.ts";
import { releaseAssetUrl } from "./formula-core.ts";
import { VERSION } from "../version.ts";

// T-063-01 vend-rb-own-tap-formula (story S-063, epic E-061) — the AC's verifiable substance,
// OBSERVED:
//
//   > `brew install johnhkchen/vend/vend` on a fresh arm64-mac installs the binary, the formula's
//   > sha matches the release asset, and `vend --version` then reports the real semver.
//
// The live `brew install` half (tag + published release + tap + network) cannot run in `bun test`,
// exactly as T-062-03's `gh release create` cannot. The TESTABLE substance is: the REAL formula
// shell renders a syntactically-valid `vend.rb` whose sha is the one in `sha256sums.txt` (read,
// never typed) and whose version is the embedded VERSION. We run the real formula.ts against a
// fixture sums file in a temp dir, assert the emitted formula, and `ruby -c` it for valid syntax.
//
// The fixture's sums line is built with the REAL `sha256Line`, so the test↔production sums format
// cannot drift; the asserted version is the live VERSION import, so a future bump won't red this.

const root = join(import.meta.dir, "..", ".."); // repo root — formula.ts is run from here
const TARBALL = "vend-cli-aarch64-apple-darwin.tar.xz"; // the pinned asset name (drift-guarded in release-core.test.ts)
const FIXTURE_SHA = "c".repeat(64);

let distDir: string;
let formula: string;

beforeAll(async () => {
  distDir = await mkdtemp(join(tmpdir(), "vend-formula-"));
  // Stand in for what `bun run package` writes: a sha256sums.txt naming the pinned tarball. Built
  // via the real sha256Line so the fixture can't drift from the writer's format.
  await writeFile(join(distDir, "sha256sums.txt"), sha256Line(FIXTURE_SHA, TARBALL) + "\n");

  const r = Bun.spawnSync(["bun", "run", "src/release/formula.ts", distDir], { cwd: root });
  if (r.exitCode !== 0) {
    throw new Error(`formula.ts failed (exit ${r.exitCode}): ${r.stderr.toString()}\n${r.stdout.toString()}`);
  }
  formula = await Bun.file(join(distDir, "vend.rb")).text();
}, 30_000);

afterAll(async () => {
  await rm(distDir, { recursive: true, force: true });
});

describe("formula render — a valid vend.rb whose sha is read from sha256sums.txt (T-063-01)", () => {
  test("writes a non-empty dist/vend.rb", () => {
    expect(formula.length).toBeGreaterThan(0);
  });

  test("the sha256 is the one from sha256sums.txt — read, never hand-typed", () => {
    expect(formula).toContain(`sha256 "${FIXTURE_SHA}"`);
  });

  test("version + url + license track the SSOTs (VERSION + the pinned tarball)", () => {
    expect(formula).toContain(`version "${VERSION}"`);
    expect(formula).toContain(`url "${releaseAssetUrl({ version: VERSION, tarball: TARBALL })}"`);
    expect(formula).toContain(`license "MIT"`);
    expect(formula).toContain(`bin.install "vend"`);
  });

  test("no livecheck (per the ticket), and a `test do` asserting vend --version (the AC)", () => {
    expect(formula).not.toContain("livecheck");
    expect(formula).toContain("test do");
    expect(formula).toContain("vend --version");
  });

  test("the emitted formula is syntactically valid Ruby (`ruby -c`)", () => {
    const check = Bun.spawnSync(["ruby", "-c", join(distDir, "vend.rb")]);
    expect(check.exitCode).toBe(0);
    expect(check.stdout.toString()).toContain("Syntax OK");
  });
});

describe("formula render — precondition (T-063-01)", () => {
  test("a missing sha256sums.txt is a precondition error (exit 2) naming `bun run package`", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "vend-formula-empty-"));
    try {
      const r = Bun.spawnSync(["bun", "run", "src/release/formula.ts", emptyDir], { cwd: root });
      expect(r.exitCode).toBe(2);
      expect(r.stderr.toString()).toContain("bun run package");
    } finally {
      await rm(emptyDir, { recursive: true, force: true });
    }
  });
});
