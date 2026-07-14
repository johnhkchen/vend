# T-063-01 — Design

Decide HOW `vend.rb` is authored, verified, and published. Grounded in the research:
the binary/tarball/sha/release already ship (T-062-02/03); only the Homebrew formula —
the link that points `brew install` at the verified asset — is missing, and it must land
in a separate tap repo (`johnhkchen/homebrew-vend`).

## The core tension

lisa.rb carries **static, hand-pasted** shas, generated and pushed by cargo-dist. vend has
**no** cargo-dist; its sha is computed at release time into `dist/sha256sums.txt`. So the
design question splits in two:

1. **How is the formula text produced** — hand-written static file, or generated from the
   release facts (version, url, sha)?
2. **How does it reach the tap** — committed by hand, or published by the release CI?

## Option A — Hand-write a static vend.rb, commit it, push by hand

Mirror lisa literally: a committed `Formula/vend.rb` with the version + sha pasted in.

- **Pro:** simplest; exactly lisa's artifact shape; nothing to test.
- **Con:** the sha must be hand-copied from `dist/sha256sums.txt` every release → the
  canonical drift risk this codebase designs against (T-062-03's whole point was *no*
  hand-copied shas). A wrong paste ships a formula whose `sha256` rejects the real asset —
  a silent, install-time-only failure. Also violates the house pattern (no core, no test,
  no SSOT-by-key). **Rejected** — it re-introduces the exact drift the pipeline removed.

## Option B — Generate vend.rb from the release facts; publish from CI (chosen)

A **pure renderer** turns `{version, url, sha256}` into the formula string; a **thin shell**
reads those facts from the SSOT pin + `version.ts` + `dist/sha256sums.txt` and writes
`dist/vend.rb`; the **release CI** generates it after `gh release create` and pushes it to
the tap. This is precisely how T-062-02/03 are built, extended one link.

- **Pro:** the sha is **read, never typed** — it comes from the same `sha256sums.txt` the
  smoke test proves re-verifies, so the formula's sha and the asset's bytes cannot drift.
  Matches the house pattern exactly (core + shell + smoke + script + recipe + drift guard).
  The version comes from the one `VERSION` SSOT; the url is assembled from the pinned
  tarball name → no literal can fall out of sync.
- **Con:** more moving parts than a static file; the CI publish step needs a cross-repo
  token. Worth it — it makes the formula a *derived artifact*, not a hand-maintained one.
- **Chosen.**

## Option C — Generate, but commit the rendered vend.rb into the vend repo

Like B, but check the generated `vend.rb` into `vend` (not just `dist/`) as the SSOT and
sync it to the tap.

- **Con:** a committed generated file goes stale the instant `VERSION` or the sha changes
  and nothing regenerates it; the tap is the real SSOT for a formula anyway (that's where
  `brew` reads it). Committing it invites a stale, wrong-sha file in two places.
  **Rejected** — `dist/vend.rb` is a build output (dist is gitignored), regenerated each
  release; the tap holds the published copy.

## Decision: Option B

A pure `formula-core.ts` renderer + impure `formula.ts` shell + `formula.smoke.test.ts`,
wired into `package.json`/`justfile`/`release.yml`, with the sha read from
`dist/sha256sums.txt`.

### What the formula looks like (collapsed to the pinned platform)

```ruby
class Vend < Formula
  desc "Local-first runner for repeatable, gated AI-agent playbooks"
  homepage "https://github.com/johnhkchen/vend"
  version "0.1.0"
  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/johnhkchen/vend/releases/download/v0.1.0/vend-cli-aarch64-apple-darwin.tar.xz"
    sha256 "<the sha read from dist/sha256sums.txt>"
  end
  license "MIT"

  def install
    bin.install "vend"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/vend --version")
  end
end
```

**Why one `if OS.mac? && Hardware::CPU.arm?` branch, not lisa's four:** the pin ships
exactly one tarball. On any other platform no `url`/`sha256` is set, so Homebrew refuses
with "no available download" — the honest "arm64-mac only" behavior. Adding platforms
later is a pin append + a renderer that loops over variants — out of scope (mirrors how
T-062-01 scoped the matrix out).

**Deviations from lisa.rb, with rationale:**
- **No `BINARY_ALIASES`/`target_triple`/`install_binary_aliases!`** — that is cargo-dist
  symlink-alias scaffolding, empty even for lisa. vend ships one binary named `vend`; the
  scaffolding would be dead Ruby. Dropped.
- **Add a `test do` block** (lisa has none). The AC explicitly names "`vend --version`
  then reports the real semver"; a `test do` asserting `version` against
  `vend --version` output encodes that AC into the formula itself and is Homebrew
  audit-recommended. A strict improvement.
- **Drop the `pkgshare` leftover-sweep** — the vend tarball contains *only* `vend` (proven
  by `package.smoke.test.ts`: `tar -tf` → `vend`). There are no leftover files to sweep,
  so lisa's `doc_files`/`leftover_contents` dance is dead code here. `bin.install "vend"`
  is the whole install.

### Where each fact comes from (no literal duplicated)

| Formula field | Source | Mechanism |
|---------------|--------|-----------|
| `version` | `src/version.ts` `VERSION` | imported by the shell |
| tag in url (`v0.1.0`) | `VERSION` | `"v" + VERSION` in the renderer |
| tarball in url | pin `RELEASE_TARBALL` | `requireKey` |
| `url` | repo slug + tag + tarball | `releaseAssetUrl()` in the core |
| `sha256` | `dist/sha256sums.txt` | parsed by `parseSha256Sums()` |
| `homepage`, `desc`, `license`, class name | formula-core constants | the core owns the spelling |

### Where the sha-parser lives

`release-core.ts` already owns the **forward** sha-line format (`sha256Line` → exactly two
spaces). The **inverse** — parse a digest back out of `sha256sums.txt` for a given filename
— belongs with the same owner so the read and write agree on one spelling. So
`parseSha256Sums(text, filename)` is added to `release-core.ts` (not `formula-core.ts`),
unit-tested beside `sha256Line`. T-063-01 depends on T-062-03 (sequential, not concurrent),
so touching that file carries no DAG conflict.

### How it reaches the tap (the un-gateable final step)

The release CI, **after** `gh release create`, runs `bun run formula` then a faithful
publish block: clone `johnhkchen/homebrew-vend` with a write-scoped token
(`HOMEBREW_TAP_TOKEN`), copy `dist/vend.rb` to `Formula/vend.rb`, commit `vend
<tag>`, push. This mirrors cargo-dist's homebrew publish and lisa's own-tap pattern. Like
T-062-03's `gh release create`, this is the single line that can't run in `bun test`; the
formula *content* it pushes is fully tested upstream.

### Testing strategy (detailed in plan.md)

- **Unit (`formula-core.test.ts`):** `releaseAssetUrl` format; rendered formula contains
  the right class/desc/homepage/version/url/sha/license, has `bin.install "vend"`, has a
  `test do`, and has **no `livecheck`**; only the arm64-mac branch is present.
- **Unit (`release-core.test.ts`):** `parseSha256Sums` returns the digest for a name and
  throws on a missing/garbled line — the round-trip with `sha256Line`.
- **Smoke (`formula.smoke.test.ts`):** run the REAL `formula.ts` against a temp fixture
  `sha256sums.txt`, assert the written `dist/vend.rb` content, and **`ruby -c`** it for
  valid Ruby syntax (ruby is available here). Hermetic, no network.
- **Drift guard:** the live pin still yields the expected tarball/url (reuses the
  T-062-03 guard's spirit).
