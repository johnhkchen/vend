// The pure core of the release PUBLISHER (T-063-01 / E-061) — own every outward COMMAND the
// publish phase runs (the GitHub release + the homebrew-vend tap push), with no I/O, no process,
// no BAML. All judgment lives here so the impure shell (publish.ts), the workflow, and the smoke
// test agree on one spelling, and `--dry-run` prints EXACTLY what the real run executes. Mirrors
// the src/release/{compile,formula,release}-core.ts split.
//
// THE SSOT RULE (.github/release-target.env header): this module hard-codes NO tarball and NO
// version — the tarball is the pin's RELEASE_TARBALL (read BY KEY upstream) and the tag is
// GITHUB_REF_NAME; both are passed in. What lives here is only the command shape the pin does not
// own: the `gh release` argv, the tap slug + the in-clone git argvs, and the secret-masking.

import { SHA256SUMS } from "./release-core.ts";

/** The OWN Homebrew tap repo — `brew install johnhkchen/vend/vend` resolves `<owner>/homebrew-<name>`. */
export const TAP_SLUG = "johnhkchen/homebrew-vend";

/** Where the formula lives inside the tap (Homebrew reads `Formula/<name>.rb`). */
export const TAP_FORMULA_SUBPATH = "Formula/vend.rb";

/** The commit identity for the tap push — the Actions bot, matching lisa's own-tap pushes. */
export const BOT_NAME = "github-actions[bot]";
export const BOT_EMAIL = "github-actions[bot]@users.noreply.github.com";

/** Stand-in shown wherever the write token would appear, so a plan/log never leaks the secret. */
export const TOKEN_MASK = "***";

/**
 * The `gh release` argv. PURE — the SINGLE owner of the release command spelling, idempotent by
 * design: if the tag's release already EXISTS, upload the assets with `--clobber`; otherwise
 * create it with generated notes. The same two assets (tarball + sums) ship either way. Paths are
 * passed in by the shell (absolute), so this owns the verb/flags, not the filesystem layout.
 */
export function releaseArgv(opts: {
  readonly tag: string;
  readonly tarballPath: string;
  readonly sumsPath: string;
  readonly exists: boolean;
}): string[] {
  return opts.exists
    ? ["gh", "release", "upload", opts.tag, opts.tarballPath, opts.sumsPath, "--clobber"]
    : ["gh", "release", "create", opts.tag, "--title", opts.tag, "--generate-notes", opts.tarballPath, opts.sumsPath];
}

/**
 * The authenticated clone URL for the tap. PURE. The token is the `x-access-token` basic-auth user
 * (GitHub's documented PAT-over-HTTPS form). NEVER log this — use {@link TAP_CLONE_URL_MASKED} for
 * any display.
 */
export function tapCloneUrl(token: string): string {
  return `https://x-access-token:${token}@github.com/${TAP_SLUG}.git`;
}

/** The clone URL with the secret replaced by {@link TOKEN_MASK} — safe to print in a plan/log. */
export const TAP_CLONE_URL_MASKED = `https://x-access-token:${TOKEN_MASK}@github.com/${TAP_SLUG}.git`;

/** The tap commit subject — `vend <tag>`, mirroring the prior inline-bash step. */
export function tapCommitMessage(tag: string): string {
  return `vend ${tag}`;
}

/**
 * The ordered git argvs run INSIDE the freshly-cloned tap (after the formula is copied to
 * {@link TAP_FORMULA_SUBPATH}): set the bot identity, stage, commit, push. PURE — one owner of the
 * push spelling shared by the shell and the smoke test.
 */
export function tapInRepoArgvs(tag: string): string[][] {
  return [
    ["git", "config", "user.name", BOT_NAME],
    ["git", "config", "user.email", BOT_EMAIL],
    ["git", "add", TAP_FORMULA_SUBPATH],
    ["git", "commit", "-m", tapCommitMessage(tag)],
    ["git", "push"],
  ];
}

/**
 * Render the human-readable publish PLAN — exactly the outward actions the real run performs, with
 * the token masked. PURE + testable; this is what `--dry-run` prints so a reviewer can reason about
 * the publish without executing it. `releaseExists === null` (dry-run, unprobed) shows the
 * idempotent create-OR-upload behavior rather than committing to one branch.
 */
export function describePlan(opts: {
  readonly tag: string;
  readonly tarball: string;
  readonly releaseExists: boolean | null;
  readonly hasToken: boolean;
}): string[] {
  const tb = `dist/${opts.tarball}`;
  const sums = `dist/${SHA256SUMS}`;
  const out: string[] = [`publish plan for ${opts.tag}:`, ""];

  out.push("  [1] GitHub release (idempotent — create if absent, else upload --clobber):");
  if (opts.releaseExists === null) {
    out.push(`        absent  → ${releaseArgv({ tag: opts.tag, tarballPath: tb, sumsPath: sums, exists: false }).join(" ")}`);
    out.push(`        present → ${releaseArgv({ tag: opts.tag, tarballPath: tb, sumsPath: sums, exists: true }).join(" ")}`);
  } else {
    out.push(`        ${releaseArgv({ tag: opts.tag, tarballPath: tb, sumsPath: sums, exists: opts.releaseExists }).join(" ")}`);
  }

  out.push("", `  [2] Push ${TAP_FORMULA_SUBPATH} to ${TAP_SLUG}:`);
  const tokenNote = opts.hasToken ? "" : "   (⚠ HOMEBREW_TAP_TOKEN unset — a real run would fail here)";
  out.push(`        git clone ${TAP_CLONE_URL_MASKED} <tmp>${tokenNote}`);
  out.push(`        cp dist/vend.rb <tmp>/${TAP_FORMULA_SUBPATH}`);
  for (const argv of tapInRepoArgvs(opts.tag)) out.push(`        (in <tmp>) ${argv.join(" ")}`);
  return out;
}
