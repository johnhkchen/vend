# T-065-01 — Research

`fresh-machine-end-to-end-acceptance` (task, story S-065, epic E-061). Validate the
epic's "done looks like" as ONE live run on a fresh arm64-mac, closing the
install → version → workspace loop end to end. Descriptive only — what exists, where,
how it connects.

## The acceptance criterion, decomposed

> A recorded transcript on a fresh arm64-mac with no vend checkout shows:
> `brew install johnhkchen/vend/vend` succeeds, `vend --version` is real semver, and
> `vend init --template <name>` lays a workspace in an empty dir — all without a clone
> and without Doppler, using only the user's `claude login`.

Six observable clauses, each owned by an already-`done` upstream ticket:

| Clause | Owner | Status of the seam |
|--------|-------|--------------------|
| `brew install johnhkchen/vend/vend` selects/verifies/installs | T-063-01 (`vend.rb`) | formula rendered; live tap **un-published** |
| binary installs from the verified tarball | T-062-02/03 (compile/package) | `dist/` artifacts present |
| `vend --version` → real semver (`0.1.0`) | T-061-01/02 | embedded, compiled-binary-proven |
| `vend init --template <name>` lays a workspace in an empty dir | T-064-01 | `minimal` standalone template |
| no clone | T-064-01 | gate-bypass, structural |
| no Doppler | T-064-01 | no env reads, structural |

This ticket **owns no new product surface** — every behavioral seam already shipped and
is `done`. Its job is to *exercise the assembled chain on a clean machine and record the
result* as a re-runnable consistency bar (the [[expected-outcome-gold-master-pattern]]).

## What exists, where

### The release artifact chain (all under `src/release/`)
- `compile.ts` → `dist/vend` (107 MB single-file Mach-O, `bun build --compile`,
  target from the pin). Tested: `compile.smoke.test.ts`.
- `package.ts` → `dist/vend-cli-aarch64-apple-darwin.tar.xz` + `dist/sha256sums.txt`
  (a `shasum -c`-verifiable line via `sha256Line`). Tested: `package.smoke.test.ts`.
- `formula.ts` → `dist/vend.rb`; `version`/`url`/`sha256` sourced from the SSOTs,
  never hand-typed. Tested: `formula.smoke.test.ts`.
- `release-core.ts` — pure: `sha256Line` (writer) ⊥ `parseSha256Sums` (reader, the exact
  inverse), `TARBALL_KEY`, `SHA256SUMS`.
- `compile-core.ts` — pure: `parseReleaseTarget`, `requireKey`, `PIN_PATH`.
- The shells share ONE idiom: `git rev-parse --show-toplevel` → read pin by key →
  read/parse files → act; exit `0` ok / `2` precondition.

### The SSOT pin
`.github/release-target.env` — `RELEASE_TARBALL=vend-cli-aarch64-apple-darwin.tar.xz`,
`BUN_COMPILE_TARGET=bun-darwin-arm64`, `CI_RUNNER=macos-14`, `BUN_VERSION=1.3.9`. Read
by key by every release shell; the human record is `T-062-01/target.md`.

### The version seam
`src/version.ts` — `export const VERSION = pkg.version` (`import pkg from "../package.json"`,
inlined by `--compile`). `package.json`: `version 0.1.0`, no `private`, `bin.vend`.
Surfaced as `vend --version` (parsed in `cli.ts:172`, global flag, short-circuits).

### The init seam
`src/init/init-core.ts` — `SCAFFOLD_MANIFEST` (17 entries: `docs/active/**`, `.vend/**`,
`docs/knowledge/{charter,vision}.md`, …), `TEMPLATE_REGISTRY.minimal = []` (empty overlay),
`STANDALONE_TEMPLATES = {minimal}`, `isStandaloneTemplate`. `init-effect.ts:runInit`
resolves template → gates only when `!standalone && !isLisaProject` → applies. `cli.ts`
dispatch maps `scaffolded` / `not-lisa` / `unknown-template`; `--template` parsed at
`cli.ts:241`.

### The release CI
`.github/workflows/release.yml` — on `v*` tag (macos-14): load pin → assert runner → bun
→ install → compile → package → `gh release create` → render formula → push `Formula/vend.rb`
to `johnhkchen/homebrew-vend`. The two un-gateable lines (`gh release create`, tap push)
are single faithful blocks.

## Measured environment facts (this machine, 2026-06-29)
- `dist/` already carries: `vend` (107 MB), the tarball (26 MB), `sha256sums.txt`, `vend.rb`.
- `brew --version` → Homebrew 6.0.5; this is an arm64-mac (Apple M5) — the pinned target.
- A by-hand faithful local loop on the REAL artifacts (recorded for the transcript) shows:
  - formula sha `737deeca…026c` == `shasum -a 256` of the tarball — **MATCH**.
  - extract tarball → `vend` on a clean PATH → `vend --version` (scrubbed env, no-checkout
    dir) → `0.1.0`.
  - `vend init --template minimal` (Doppler scrubbed, empty dir) → "17 created, 0 skipped";
    no `.git`; second run → "0 created, 17 skipped" (no-clobber converge).

## The one un-localizable gap (measured, honest)
The live `brew install johnhkchen/vend/vend` resolution cannot run from here, because the
release was never published:
- `git ls-remote …/homebrew-vend.git` → **Repository not found**.
- the formula's `url` (`…/releases/download/v0.1.0/…tar.xz`) → **HTTP 404**.
- no `v0.1.0` tag exists locally.

These are exactly the three manual prerequisites T-063-01's review flagged as BLOCKING for
a live install: (1) the `homebrew-vend` repo must exist, (2) a `HOMEBREW_TAP_TOKEN` secret,
(3) a pushed `v0.1.0` tag to fire `release.yml`. None are creatable from this repo's code.

## Constraints & assumptions carried into Design
- **No fabrication.** [[honest-on-outcome-discipline]] forbids recording a transcript of a
  `brew install` that did not run. Whatever is recorded must be a real, reproducible run.
- **No new product surface.** Every seam is `done`; this ticket adds *verification*, not
  features. The engine ⊥ play rule and the release-shell idioms must be mirrored, not bent.
- **The 107 MB binary is too slow to rebuild in `bun test`** — the harness must run against
  an already-built `dist/`, opportunistically in `bun test` and unconditionally in CI
  (where the release job has just built `dist/`).
- **Pre-existing gate failures** (8, live-board graph integrity: S-062..S-065 reference
  E-062..E-065 that don't exist) are board-data state, untouched by this ticket — flagged
  by T-063-01/T-064-01 already.
