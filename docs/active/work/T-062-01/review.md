# T-062-01 — Review

**Ticket:** spike — `confirm-first-platform-target` (E-061 / S-062)
**Outcome:** the cook/dev's platform is confirmed and the first `bun build --compile` target
is pinned as a single source of truth, recorded in the work dir, and referenced by a CI
config that self-verifies it matches the machine arch.

## What changed

**Created (owned by this ticket):**

| File | Role |
|------|------|
| `.github/release-target.env` | **SSOT pin** — six keys: `BUN_COMPILE_TARGET=bun-darwin-arm64`, `RELEASE_ASSET_TRIPLE=aarch64-apple-darwin`, `RELEASE_TARBALL_PREFIX=vend-cli`, `RELEASE_TARBALL=vend-cli-aarch64-apple-darwin.tar.xz`, `CI_RUNNER=macos-14`, `BUN_VERSION=1.3.9`. Downstream tickets read this by key. |
| `.github/workflows/release-target-check.yml` | **CI guard** — on push/PR/dispatch, `runs-on: macos-14`, loads the pin, asserts runner arch == pinned target and tarball-name consistency. Not the release pipeline. |
| `docs/active/work/T-062-01/target.md` | **Work-dir record** — measured machine facts, pinned values, provenance. |
| `docs/active/work/T-062-01/{research,design,structure,plan,progress,review}.md` | RDSPI process artifacts. |

**Modified:** none. No source, no `package.json`, no ticket frontmatter touched.

## Acceptance criterion — assessment

> The confirmed target triple is recorded in the epic work dir and referenced by the CI
> config; it matches the cook/dev's actual machine arch.

- **Recorded in the epic work dir** ✓ — `docs/active/work/T-062-01/target.md` plus the
  machine SSOT `.github/release-target.env`.
- **Referenced by the CI config** ✓ — `release-target-check.yml` loads
  `.github/release-target.env` (`cat … >> $GITHUB_ENV`); the reference line is verified
  present.
- **Matches the cook/dev's actual machine arch** ✓ — measured `uname -m=arm64` (Apple M5,
  Darwin); `bun build --compile --target=bun-darwin-arm64` probed exit-0 with a real Mach-O
  output; the guard re-derives the arch on every run so the match is enforced, not asserted
  once.

## Test coverage

This is a config/decision spike — no app code, so coverage is assertion-based, run locally:

| Check | Result |
|-------|--------|
| Pin internal consistency (`source`, tarball == prefix-triple.tar.xz) | ✓ |
| Target string valid (`bun build --compile --target=…` exit 0) | ✓ |
| Arch match (uname → bun triple == pin) | ✓ |
| Guard has teeth (mutated expected → fails) | ✓ dry-run |
| Workflow YAML well-formed | ✓ (ruby YAML parse) |
| Workflow references the pin | ✓ (grep) |
| Record ↔ pin parity (4 canonical values in both) | ✓ |

## Open concerns / limitations (for the human reviewer)

1. **No observed CI run.** The workflow is authored and locally dry-run on the real arm64
   host (equivalent to the `macos-14` runner); I have **not** pushed to watch GitHub Actions
   go green. The repo currently has no remote `.github/workflows`, so this is also the first
   workflow to land — worth a confirming push/PR run. Stated honestly, not claimed.
2. **Repo gate is not fully green — pre-existing.** `bun run check` shows 8 failing tests.
   The board-smoke failure was reproduced with all working-tree changes **stashed**
   (committed HEAD), proving it predates this work; cause is stories S-062..S-065 referencing
   not-yet-minted epics E-062..E-065. The rest are executor/MCP environment smokes
   (`andon: timed-out`, codebase-memory absent). None are reachable from this ticket's static
   files. **Not introduced here**; flagged so the reviewer isn't surprised.
3. **Bun engine mismatch.** Machine runs bun `1.3.8`; `package.json` engines floor is
   `1.3.9`. Pinned `BUN_VERSION=1.3.9` for CI. Carried to T-062-02 / the CI bun-version pin
   — not a target-decision blocker.
4. **Doppler unavailable** this session (keyring) — gate ran without it; acceptable for a
   config/doc change exercising no secret path.
5. **Concurrent-thread files.** `package.json`, `src/cli.ts`, `src/packaging.test.ts`,
   `docs/active/work/T-061-01/**` are modified by sibling Lisa threads on the shared branch
   and were deliberately left untouched; this ticket's commit includes only its own files.

## Handoff

T-062-02 (compile) and T-062-03 (release CI) should read `.github/release-target.env` by
key rather than re-deriving the triple. Adding platforms later is append-only and does not
invalidate this arm64-mac pin. The check workflow can remain as a standing arch/pin-drift
guard once the release jobs are added beside it.
