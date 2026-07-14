# T-063-01 — Review

**Ticket:** `vend-rb-own-tap-formula` (task, story S-063, epic E-061). The handoff: what
changed, how it's covered, and what a human reviewer must know.

## What this delivers

The **last link** in E-061's distribution chain: a generated Homebrew formula `vend.rb`
that points `brew install johnhkchen/vend/vend` at the verified release tarball T-062-03
already publishes. The formula is a **derived artifact** — its `version`, `url`, and
`sha256` are sourced from the SSOTs (`VERSION`, the pinned tarball name, and the computed
`sha256sums.txt`), never hand-typed — so it cannot drift from the asset the release ships.
The release CI renders it on every tag and pushes it to the own tap, mirroring lisa's
own-tap pattern, collapsed to one platform (arm64-mac) per the epic scope.

## Files changed

**Created**
- `src/release/formula-core.ts` — PURE formula renderer (no I/O/process/BAML). Owns:
  `renderFormula` (the full `vend.rb` text), `releaseAssetUrl` (the GitHub release-download
  URL spelling), and the formula's fixed strings (`FORMULA_CLASS`, `FORMULA_DESC`,
  `HOMEPAGE`, `REPO_SLUG`, `LICENSE_SPDX`). Hard-codes **no** tarball/version — passed in.
- `src/release/formula-core.test.ts` — 3 unit tests (17 assertions): url shape, every
  required field present, and the collapsed single-branch / no-livecheck / no-scaffolding
  invariants.
- `src/release/formula.ts` — impure shell (mirrors `package.ts`): repo-root resolve → pin
  `requireKey(RELEASE_TARBALL)` → `VERSION` → read+parse `dist/sha256sums.txt` → render →
  write `dist/vend.rb`. Exit 0 (ok) / 2 (precondition). `import.meta.main`-guarded; `--out`.
- `src/release/formula.smoke.test.ts` — 6 integration tests incl. the `ruby -c` syntax
  check and the missing-sums precondition.

**Modified**
- `src/release/release-core.ts` — added `parseSha256Sums(text, filename)`, the exact
  inverse of the existing `sha256Line` (same owner of the two-space format). +2 unit tests.
- `package.json` — `"formula": "bun run src/release/formula.ts"`.
- `justfile` — `formula:` recipe + `release-local: compile package formula`.
- `.github/workflows/release.yml` — two steps after `gh release create`: render the
  formula, then publish `Formula/vend.rb` to `johnhkchen/homebrew-vend`.

**Not touched** (intentional): `.github/release-target.env` (SSOT, read-only — already
carried every key the url/tarball need); `src/release/compile*.ts`, `package*.ts`,
`version.ts` (reused as-is).

## How the acceptance criterion is met

> `brew install johnhkchen/vend/vend` on a fresh arm64-mac installs the binary, the
> formula's sha matches the release asset, and `vend --version` then reports the real semver.

| Clause | Evidence |
|--------|----------|
| selects the arm64-mac asset | one `if OS.mac? && Hardware::CPU.arm?` branch with `url` from `releaseAssetUrl`; unit-asserted; `ruby -c` valid. Other platforms get no url → Homebrew's honest "no available download". |
| **sha matches the release asset** | **Proven on the real 103 MB binary:** `compile` → `package` → `formula` produced a `vend.rb` whose `sha256` (`737deeca3480…`) is **byte-identical** to `dist/sha256sums.txt`. The sha is *read* from the same file `package.smoke.test.ts` proves re-verifies via `shasum -c` — no hand-copy. |
| `vend --version` reports the real semver | formula `version` == `VERSION` (asserted against the live import); `./dist/vend --version` → `0.1.0` confirmed live; the formula's `test do` re-asserts it at `brew test` time. |
| reaches the tap so `brew install …/vend/vend` resolves | `release.yml` renders + pushes `Formula/vend.rb` to `johnhkchen/homebrew-vend`. |

## Test coverage

- **Unit (formula-core):** url format; all required fields; single-branch / no-livecheck /
  no-`BINARY_ALIASES` / no-`pkgshare` invariants. Milliseconds.
- **Unit (release-core):** `parseSha256Sums` round-trip with `sha256Line`, pick-by-name,
  throws on absent name + malformed digest.
- **Integration (formula.smoke):** real shell vs. fixture sums (built with the real
  `sha256Line` so the format can't drift); content + `ruby -c` syntax; missing-sums exit 2.
  Hermetic — no network, no compile.
- **By-hand E2E:** compile → package → formula on the actual binary; sha MATCH; `ruby -c`
  OK; `--version` 0.1.0 (recorded in `progress.md`).
- **Totals:** 16/16 new+changed tests green; `tsc --noEmit` clean.

## Open concerns / what needs human attention

1. **Manual release-time prerequisites (BLOCKING for a live `brew install`).** Two things
   this ticket *cannot* create from the repo and that must exist before a tag actually
   publishes a working tap:
   - The **`johnhkchen/homebrew-vend` repo** must exist (empty is fine; the CI creates
     `Formula/`).
   - A **`HOMEBREW_TAP_TOKEN`** repository secret on `johnhkchen/vend` — a PAT (or
     fine-grained token) with **write** access to `homebrew-vend`. The default
     `github.token` cannot push to another repo, so without this the publish step fails.

   Until both exist, the rendered formula is correct but un-published. Flag for the human.
2. **The full `brew install` AC is not exercisable in `bun test`** (needs the tag, the
   published release, the live tap, network) — the same boundary as T-062-03's
   `gh release create`. The tap-publish line is a single faithful block; everything that
   determines the formula's *content* is tested, and the real sha-match was proven by hand.
3. **`brew style` ≠ `brew audit`.** Running `brew style` on the bare file flags 4 generic
   Ruby/Sorbet rubocop rules (Sorbet sigils, frozen-string-literal, top-level class doc) —
   **none of which apply to Homebrew formulae** (lisa.rb has none; `brew audit` in a tap
   skips them). `ruby -c` is the correct hermetic syntax check. No action — adding the
   sigils would make it a non-formula.
4. **Gate has 8 pre-existing failures unrelated to this ticket.** The live-board
   graph-integrity tests fail because stories S-062..S-065 reference epics E-062..E-065 that
   don't exist (only E-061 exists). This is board-data state; T-063-01 touches no
   story/epic/ticket/graph file. Every `src/release/**` test passes. Worth a separate
   board-hygiene fix, out of scope here.

## Deliberate deviations from lisa.rb (all documented in design.md)
- **One platform branch**, not four — the pin ships one tarball.
- **No cargo-dist `BINARY_ALIASES`/`target_triple`/`install_binary_aliases!`** — dead Ruby
  here (one binary named `vend`).
- **No `pkgshare` leftover-sweep** — the tarball contains only `vend`.
- **Added a `test do`** (lisa has none) — encodes the AC's `vend --version` clause into the
  formula; Homebrew-audit-recommended. A strict improvement.
