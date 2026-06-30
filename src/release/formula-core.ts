// The pure core of the Homebrew formula renderer (T-063-01) — own every STRING in `vend.rb`,
// with no I/O, no process, no BAML. All judgment (the formula template, the release-asset URL
// spelling) lives here so the impure shell (formula.ts) and the smoke test render IDENTICALLY:
// one owner of the formula text → no drift. Mirrors the src/release/{compile,release}-core.ts split.
//
// THE SSOT RULE (.github/release-target.env header): this module hard-codes NO tarball name and
// NO version. The shell reads the tarball BY KEY (compile-core's requireKey) and the version from
// version.ts, then passes them in. What lives here is only the formula's OWN fixed strings (class,
// desc, homepage, license, repo slug) and the shape of the generated Ruby.
//
// Collapsed to ONE platform (arm64-mac) per the epic scope — the release ships exactly one tarball
// and one sha, so the formula has one `if OS.mac? && Hardware::CPU.arm?` branch, not lisa's four.
// On any other platform Homebrew sets no url and refuses with "no available download" — the honest
// "arm64-mac only" behavior. More targets later are a renderer that loops, not a rewrite.

/** The Ruby class name — Homebrew derives it from the formula filename `vend.rb`. */
export const FORMULA_CLASS = "Vend";

/** One-line `desc` (Homebrew audit wants ≤ ~80 chars, no leading article, no trailing period). */
export const FORMULA_DESC = "Local-first runner for repeatable, gated AI-agent playbooks";

/** The project homepage / `homepage` field — the vend repo. */
export const HOMEPAGE = "https://github.com/johnhkchen/vend";

/** The `owner/repo` slug — the SINGLE owner of the releases-download host path. */
export const REPO_SLUG = "johnhkchen/vend";

/** SPDX license id — MIT, per the ticket and the repo's LICENSE. */
export const LICENSE_SPDX = "MIT";

/**
 * Assemble the GitHub release-asset URL for a given version + tarball. PURE — the SINGLE owner of
 * the URL spelling, mirroring lisa's `…/releases/download/v<version>/<tarball>` form. The `v`
 * prefix on the tag is the release convention (T-062-03's tag↔version guard normalizes it back).
 */
export function releaseAssetUrl(opts: { readonly version: string; readonly tarball: string }): string {
  return `https://github.com/${REPO_SLUG}/releases/download/v${opts.version}/${opts.tarball}`;
}

/**
 * Render the complete `vend.rb` Homebrew formula text. PURE — the single owner of the formula's
 * shape. Collapsed to the one arm64-mac branch (url + sha256). NO `livecheck` (per the ticket),
 * NO cargo-dist `BINARY_ALIASES` scaffolding (vend ships one binary named `vend`), and NO
 * `pkgshare` leftover-sweep (the tarball contains ONLY `vend` — proven by package.smoke.test.ts).
 * Adds a `test do` that asserts `vend --version` reports `version` — directly encoding the AC.
 */
export function renderFormula(opts: { readonly version: string; readonly url: string; readonly sha256: string }): string {
  return `class ${FORMULA_CLASS} < Formula
  desc "${FORMULA_DESC}"
  homepage "${HOMEPAGE}"
  version "${opts.version}"
  if OS.mac? && Hardware::CPU.arm?
    url "${opts.url}"
    sha256 "${opts.sha256}"
  end
  license "${LICENSE_SPDX}"

  def install
    bin.install "vend"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vend --version")
  end
end
`;
}
