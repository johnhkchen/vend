// `bun run formula` entry (T-063-01) — render the Homebrew formula `vend.rb` from the release
// facts: the pinned tarball name, the embedded VERSION, and the sha256 already computed into
// `dist/sha256sums.txt` by `bun run package`. The thin IMPURE shell: it resolves paths, reads the
// pin + the sums file, and writes the file — delegating ALL judgment (URL spelling, formula text,
// sha-line parsing) to the pure cores (formula-core.ts, release-core.ts). Mirrors package.ts:
// smoke-only, not unit-tested — its observable contract is covered by formula.smoke.test.ts.
//
// THE SSOT RULE (.github/release-target.env header): the tarball name is read BY KEY from the pin;
// the version is the one VERSION SSOT; the sha is PARSED from sha256sums.txt — never hand-typed.
// So the formula's `version`/`url`/`sha256` cannot drift from the asset the release actually ships.
//
// USAGE: bun run src/release/formula.ts [distDir] [--out <path>]
//   distDir   where dist/sha256sums.txt lives and vend.rb is written (default: <repo>/dist).
//   --out     explicit output path for the formula (default: <distDir>/vend.rb).
//
// EXIT CODES (cf. package.ts): 0 = wrote the formula; 2 = environment/precondition error (not a git
// repo / no pin / missing key / no sha256sums.txt / no sha line for the pinned tarball). There is no
// network and no tag↔version guard here — that guard already ran in package.ts upstream; the sums
// file's existence IS the precondition that the asset was packaged.

import { join } from "node:path";
import { parseReleaseTarget, PIN_PATH, requireKey } from "./compile-core.ts";
import { parseSha256Sums, SHA256SUMS, TARBALL_KEY } from "./release-core.ts";
import { releaseAssetUrl, renderFormula } from "./formula-core.ts";
import { VERSION } from "../version.ts";

if (import.meta.main) {
  // Split argv into the optional positional distDir and the optional --out (trivial inline parse;
  // two flags do not warrant a tested core — the package.ts idiom).
  const argv = process.argv.slice(2);
  let distArg: string | undefined;
  let outArg: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") {
      outArg = argv[++i];
    } else if (a !== undefined && !a.startsWith("-") && distArg === undefined) {
      distArg = a;
    }
  }

  // Resolve the repo root so the run is correct regardless of cwd (the package.ts idiom).
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`formula: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();
  const distDir = distArg ?? join(root, "dist");

  // Read + parse the SSOT pin; a missing file or the tarball key is a clean precondition refusal.
  const pinFile = Bun.file(join(root, PIN_PATH));
  if (!(await pinFile.exists())) {
    process.stderr.write(`formula: missing ${PIN_PATH} — the release target pin (T-062-01) is absent\n`);
    process.exit(2);
  }
  let tarball: string;
  try {
    tarball = requireKey(parseReleaseTarget(await pinFile.text()), TARBALL_KEY);
  } catch (e) {
    process.stderr.write(`formula: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  // The sha is READ from the sums file `bun run package` writes — never hand-typed. A missing file
  // or a missing line for the pinned tarball is a precondition error (package was not run first).
  const sumsPath = join(distDir, SHA256SUMS);
  if (!(await Bun.file(sumsPath).exists())) {
    process.stderr.write(`formula: no ${sumsPath} — run \`bun run package\` first\n`);
    process.exit(2);
  }
  let sha256: string;
  try {
    sha256 = parseSha256Sums(await Bun.file(sumsPath).text(), tarball);
  } catch (e) {
    process.stderr.write(`formula: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  // Render — every field sourced, none typed: version from VERSION, url from pin+version, sha parsed.
  const url = releaseAssetUrl({ version: VERSION, tarball });
  const text = renderFormula({ version: VERSION, url, sha256 });

  const outPath = outArg ?? join(distDir, "vend.rb");
  await Bun.write(outPath, text);
  process.stdout.write(`formula: ok — wrote ${outPath} (vend ${VERSION}, sha ${sha256.slice(0, 12)}…)\n`);
  process.exit(0);
}
