// The pure core of the release packager (T-062-03) — own every release STRING and ARGV the
// pipeline depends on, with no I/O, no process, no BAML. All judgment lives here so the impure
// shell (package.ts), the workflow, and the smoke test agree on one spelling (no drift). Mirrors
// the src/release/compile-core.ts and src/ci/*-core.ts split.
//
// THE SSOT RULE (.github/release-target.env header): this module hard-codes NO tarball name. The
// asset name is the pin's `RELEASE_TARBALL`; the shell reads it BY KEY (compile-core's requireKey)
// and passes it in. What lives here is only format/shape that the pin does not own: the sums
// filename, the tar flag vector, the sha line format, and the tag↔version invariant.

/** The release's checksum file — the name a downloader runs `shasum -a 256 -c` against. */
export const SHA256SUMS = "sha256sums.txt";

/** The one pin key the packager consumes: the final tarball asset name (the SSOT, not re-declared). */
export const TARBALL_KEY = "RELEASE_TARBALL";

/**
 * Normalize a git tag / ref to a bare semver by stripping a SINGLE leading `v`. PURE.
 * Mirrors lisa's `${GITHUB_REF_NAME#v}`. `"v0.1.0" → "0.1.0"`, `"0.1.0" → "0.1.0"`,
 * `" v1.2.3 " → "1.2.3"` (surrounding whitespace trimmed first). Only one `v` is removed.
 */
export function tagToVersion(ref: string): string {
  const t = ref.trim();
  return t.startsWith("v") ? t.slice(1) : t;
}

/**
 * The release invariant (lisa's "tag matches Cargo.toml" guard): the published tag must name
 * the same version the binary embeds. PURE — throws a typed, message-bearing error naming BOTH
 * the tag and the version on mismatch, so a wrong tag fails the release loud rather than shipping
 * a binary whose `--version` disagrees with its release name.
 */
export function assertTagMatchesVersion(tag: string, version: string): void {
  const tagged = tagToVersion(tag);
  if (tagged !== version) {
    throw new Error(`release tag ${tag} (version ${tagged}) does not match package version ${version}`);
  }
}

/**
 * Assemble the `tar` argv that archives ONE member (the bare binary) at the archive root as an
 * xz-compressed tarball. PURE — the SINGLE owner of the tar flag spelling. The `-C cwd member`
 * form changes into `cwd` and archives just `member`, so the tarball contains `vend` at its root
 * (not `dist/vend`), which is what a Homebrew formula's `bin.install "vend"` expects to find.
 * Short flags only (`-c -J -f -C`) — accepted identically by bsdtar (macOS/runner) and GNU tar.
 */
export function tarArgv(opts: { readonly tarball: string; readonly cwd: string; readonly member: string }): string[] {
  return ["tar", "-c", "-J", "-f", opts.tarball, "-C", opts.cwd, opts.member];
}

/**
 * Format one checksum line in the EXACT shape `shasum -a 256 -c` (and coreutils `sha256sum -c`)
 * consume: `<64-hex-digest><two spaces><filename>`. PURE. The two-space separator is the contract
 * — a single space (or a `*` binary marker) changes how the verifier parses the line. No trailing
 * newline; the shell appends it when writing the file.
 */
export function sha256Line(hash: string, filename: string): string {
  return `${hash}  ${filename}`;
}

/**
 * The EXACT inverse of `sha256Line` (T-063-01): scan a `sha256sums.txt` body for the entry
 * naming `filename` and return its 64-lowercase-hex digest. PURE. Splits each line on the
 * two-space separator `sha256Line` writes, so the read and the write share ONE spelling and
 * cannot drift. The Homebrew formula's `sha256` is sourced through here — it is never typed
 * by hand. Throws a typed, message-bearing error if no line names `filename`, or the matched
 * digest is not 64 lowercase hex (a garbled sums file must fail loud, not ship a bad sha).
 */
export function parseSha256Sums(text: string, filename: string): string {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;
    const [hash, name] = line.split(/ {2}/, 2);
    if (name === filename) {
      if (hash !== undefined && /^[0-9a-f]{64}$/.test(hash)) return hash;
      throw new Error(`sha256sums.txt entry for ${filename} has a malformed digest: ${hash ?? "(none)"}`);
    }
  }
  throw new Error(`no sha256 for ${filename} in sha256sums.txt — was \`bun run package\` run?`);
}
