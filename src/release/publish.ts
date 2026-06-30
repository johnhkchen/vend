// `bun run release:publish` entry (T-063-01 / E-061) — the PUBLISH phase: create-or-update the
// GitHub release with the packaged assets, then push the rendered formula to the homebrew-vend tap.
// The thin IMPURE shell — it resolves paths, checks preconditions, probes release existence, and
// EITHER executes the outward commands OR, under `--dry-run`, prints the plan and touches nothing.
// ALL command spelling lives in the pure core (publish-core.ts), so the dry-run plan IS the real
// run. Replaces the two inline-bash steps the release workflow used to carry (the untested seam).
//
// Run AFTER compile → package → formula → acceptance (all three artifacts present in dist/). The
// reorder is deliberate: nothing outward happens until the local build + acceptance are green.
//
// USAGE: bun run src/release/publish.ts [distDir] [--dry-run]
//   distDir     where the packaged tarball / sha256sums.txt / vend.rb live (default: <repo>/dist).
//   --dry-run   print the publish plan (token masked) and exit 0 — no gh, no network, no mutation.
//
// ENV: GITHUB_REF_NAME    — the release tag (defaults to `v<VERSION>` under --dry-run).
//      GH_TOKEN           — auth for `gh release` (the workflow's github.token).
//      HOMEBREW_TAP_TOKEN — PAT with write to the tap (required for a real tap push).
//
// EXIT: 0 = published (or dry-run ok); 2 = precondition error (not a git repo / no pin or key /
//       missing dist artifact / tag↔version mismatch / — real run only — no HOMEBREW_TAP_TOKEN);
//       1 = an outward command (gh release / git) failed.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReleaseTarget, PIN_PATH, requireKey } from "./compile-core.ts";
import { assertTagMatchesVersion, SHA256SUMS, TARBALL_KEY } from "./release-core.ts";
import { describePlan, releaseArgv, TAP_FORMULA_SUBPATH, TAP_SLUG, tapCloneUrl, tapInRepoArgvs } from "./publish-core.ts";
import { VERSION } from "../version.ts";

if (import.meta.main) {
  // Trivial inline parse (the package.ts/formula.ts idiom): one positional distDir + the --dry-run flag.
  const argv = process.argv.slice(2);
  let distArg: string | undefined;
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a !== undefined && !a.startsWith("-") && distArg === undefined) distArg = a;
  }

  // Resolve the repo root so the run is correct regardless of cwd (the formula.ts idiom).
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`publish: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();
  const distDir = distArg ?? join(root, "dist");

  // The tag: GITHUB_REF_NAME in CI; under --dry-run default to v<VERSION> so it runs with no env.
  const tag = process.env.GITHUB_REF_NAME ?? (dryRun ? `v${VERSION}` : "");
  if (tag === "") {
    process.stderr.write("publish: GITHUB_REF_NAME is not set — the release tag is unknown\n");
    process.exit(2);
  }
  try {
    // The same tag↔version invariant package.ts enforces — re-checked here so publish never ships a
    // release/formula whose name disagrees with the binary's --version.
    assertTagMatchesVersion(tag, VERSION);
  } catch (e) {
    process.stderr.write(`publish: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  // Pin → the tarball asset name (read BY KEY; never hard-coded).
  const pinFile = Bun.file(join(root, PIN_PATH));
  if (!(await pinFile.exists())) {
    process.stderr.write(`publish: missing ${PIN_PATH} — the release target pin is absent\n`);
    process.exit(2);
  }
  let tarball: string;
  try {
    tarball = requireKey(parseReleaseTarget(await pinFile.text()), TARBALL_KEY);
  } catch (e) {
    process.stderr.write(`publish: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  // Preconditions: the three artifacts the prior steps produced must all be present.
  const tarballPath = join(distDir, tarball);
  const sumsPath = join(distDir, SHA256SUMS);
  const formulaPath = join(distDir, "vend.rb");
  for (const [label, p] of [["tarball", tarballPath], ["sha256sums", sumsPath], ["formula", formulaPath]] as const) {
    if (!(await Bun.file(p).exists())) {
      process.stderr.write(`publish: missing ${label} ${p} — run compile → package → formula first\n`);
      process.exit(2);
    }
  }

  const token = process.env.HOMEBREW_TAP_TOKEN ?? "";

  if (dryRun) {
    // Hermetic: no gh, no network. Print the plan (token masked) and mutate nothing.
    for (const line of describePlan({ tag, tarball, releaseExists: null, hasToken: token !== "" })) {
      process.stdout.write(line + "\n");
    }
    process.stdout.write("\npublish: dry-run ok — nothing published.\n");
    process.exit(0);
  }

  // ── Real run ─────────────────────────────────────────────────────────────────────────────────
  // The tap push needs a PAT with write to another repo; the default github.token cannot do it.
  if (token === "") {
    process.stderr.write(`publish: HOMEBREW_TAP_TOKEN is not set — cannot push to ${TAP_SLUG}\n`);
    process.exit(2);
  }

  // [1] GitHub release — idempotent: probe existence, then create or upload --clobber.
  const exists = Bun.spawnSync(["gh", "release", "view", tag], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
  const rel = Bun.spawnSync(releaseArgv({ tag, tarballPath, sumsPath, exists }), { stdout: "inherit", stderr: "inherit" });
  if (rel.exitCode !== 0) {
    process.stderr.write(`publish: gh release ${exists ? "upload" : "create"} failed (exit ${rel.exitCode})\n`);
    process.exit(1);
  }

  // [2] Tap push — clone into a temp dir, copy the rendered formula, commit, push.
  const tapDir = mkdtempSync(join(tmpdir(), "vend-tap-"));
  const clone = Bun.spawnSync(["git", "clone", tapCloneUrl(token), tapDir], { stdout: "inherit", stderr: "inherit" });
  if (clone.exitCode !== 0) {
    process.stderr.write(`publish: git clone of ${TAP_SLUG} failed (exit ${clone.exitCode})\n`);
    process.exit(1);
  }
  await Bun.write(join(tapDir, TAP_FORMULA_SUBPATH), Bun.file(formulaPath));
  for (const a of tapInRepoArgvs(tag)) {
    const r = Bun.spawnSync(a, { cwd: tapDir, stdout: "inherit", stderr: "inherit" });
    if (r.exitCode !== 0) {
      // `git commit` exits non-zero when the formula is byte-identical to what's already in the tap
      // (a re-fire of the same release) — that's a no-op, not a failure: nothing to commit or push.
      if (a[1] === "commit") {
        process.stdout.write(`publish: ${TAP_FORMULA_SUBPATH} unchanged — nothing to commit; tap already current.\n`);
        process.exit(0);
      }
      process.stderr.write(`publish: ${a.join(" ")} failed (exit ${r.exitCode})\n`);
      process.exit(1);
    }
  }
  process.stdout.write(`publish: ok — ${tag} released and ${TAP_FORMULA_SUBPATH} pushed to ${TAP_SLUG}.\n`);
  process.exit(0);
}
