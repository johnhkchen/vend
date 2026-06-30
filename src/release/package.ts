// `bun run package` entry (T-062-03) — package the compiled binary into the release asset:
// tar it (xz) under the pinned name, sha256 it, and write the `shasum -c`-consumable sums file.
// The thin IMPURE shell: it resolves paths, reads the pin, shells out to `tar`, hashes bytes, and
// exits the process — delegating ALL judgment (tag↔version, tar argv, sha line format) to the pure
// cores (release-core.ts, compile-core.ts). Mirrors compile.ts: smoke-only, not unit-tested — its
// observable contract is covered by package.smoke.test.ts.
//
// THE SSOT RULE (.github/release-target.env header): the tarball name is read BY KEY from the pin;
// this script hard-codes NO asset name. It pairs with compile.ts — `bun run compile` produces
// dist/vend, then this packages it.
//
// USAGE: bun run src/release/package.ts [distDir] [--tag <vX.Y.Z>]
//   distDir   where dist/vend lives and the tarball+sums are written (default: <repo>/dist).
//   --tag     the release tag to verify against the embedded VERSION (also read from GITHUB_REF_NAME).
//
// EXIT CODES (cf. compile.ts): 0 = packaged; 1 = the operation failed (tar failed, or the tag does
// not match the embedded version — a release-correctness failure); 2 = environment/precondition
// error (not a git repo / no pin / missing key / no compiled binary).

import { basename, join } from "node:path";
import { DEFAULT_OUTFILE, parseReleaseTarget, PIN_PATH, requireKey } from "./compile-core.ts";
import { assertTagMatchesVersion, SHA256SUMS, sha256Line, tarArgv, TARBALL_KEY } from "./release-core.ts";
import { VERSION } from "../version.ts";

if (import.meta.main) {
  // Split argv into the optional positional distDir and the optional --tag (trivial inline parse;
  // anything fancier would belong in a tested core, but two flags do not warrant it).
  const argv = process.argv.slice(2);
  let distArg: string | undefined;
  let tag = process.env.GITHUB_REF_NAME ?? undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tag") {
      tag = argv[++i];
    } else if (a !== undefined && !a.startsWith("-") && distArg === undefined) {
      distArg = a;
    }
  }

  // Resolve the repo root so the run is correct regardless of cwd (the compile.ts idiom). A non-repo
  // cwd is an environment error only when we need the default dist/pin under it.
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`package: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();
  const distDir = distArg ?? join(root, "dist");

  // Read + parse the SSOT pin; a missing file or the tarball key is a clean precondition refusal.
  const pinFile = Bun.file(join(root, PIN_PATH));
  if (!(await pinFile.exists())) {
    process.stderr.write(`package: missing ${PIN_PATH} — the release target pin (T-062-01) is absent\n`);
    process.exit(2);
  }
  let tarball: string;
  try {
    tarball = requireKey(parseReleaseTarget(await pinFile.text()), TARBALL_KEY);
  } catch (e) {
    process.stderr.write(`package: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  // Tag↔version guard (only when a tag is supplied): a mismatched tag is a release-correctness
  // failure, not a precondition — exit 1. Local packaging without a tag is allowed (guard skipped).
  if (tag !== undefined && tag !== "") {
    try {
      assertTagMatchesVersion(tag, VERSION);
    } catch (e) {
      process.stderr.write(`package: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(1);
    }
  }

  // Require the compiled binary (compile.ts's DEFAULT_OUTFILE basename) inside distDir.
  const member = basename(DEFAULT_OUTFILE); // "vend"
  const binary = join(distDir, member);
  if (!(await Bun.file(binary).exists())) {
    process.stderr.write(`package: no compiled binary at ${binary} — run \`bun run compile\` first\n`);
    process.exit(2);
  }

  // Tar the bare binary at the archive root. Inherit stderr so tar's own diagnostics stream through.
  const tarballPath = join(distDir, tarball);
  process.stdout.write(`package: archiving ${member} → ${tarball} …\n`);
  const tar = Bun.spawnSync(tarArgv({ tarball: tarballPath, cwd: distDir, member }), { stderr: "inherit" });
  if (tar.exitCode !== 0) {
    process.stderr.write(`package: \`tar\` failed (exit ${tar.exitCode})\n`);
    process.exit(1);
  }

  // sha256 over the EXACT tarball bytes (in-process — no external tool needed to PRODUCE the sum;
  // the consumer re-verifies with `shasum -a 256 -c`, which the smoke test exercises).
  const bytes = await Bun.file(tarballPath).bytes();
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const sumsPath = join(distDir, SHA256SUMS);
  await Bun.write(sumsPath, sha256Line(hash, tarball) + "\n");

  const sizeMb = (Bun.file(tarballPath).size / (1024 * 1024)).toFixed(1);
  process.stdout.write(`package: ok — ${tarball} (${sizeMb} MB)\n`);
  process.stdout.write(`package: sha256 ${hash}  (${SHA256SUMS})\n`);
  process.exit(0);
}
