# T-065-01 — Design

Decide how to satisfy the AC: a *recorded transcript* on a fresh arm64-mac proving the
install → version → workspace loop. Grounded in Research: every seam is `done`; the only
gap is the live tap, which is un-publishable from here.

## The core tension

The AC names `brew install johnhkchen/vend/vend`. That exact command needs a published
release + a live tap — three manual prerequisites this repo's code cannot create
(Research). [[honest-on-outcome-discipline]] forbids recording a transcript of a command
that did not run. So the design question is: **what is the most faithful, fully-real run
we CAN record, and how do we honestly mark the residual gap?**

## Options considered

### Option A — Hand-write the transcript as if the live install ran
Record the ideal `brew install johnhkchen/vend/vend` → … session as prose.
**Rejected, hard.** This is exactly the laundered evidence the discipline vetoes. The tap
404s; a transcript claiming success would be fiction. Non-starter.

### Option B — Publish the tap for real (create repo, token, push a v0.1.0 tag), then run brew
Genuinely closes the live loop.
**Rejected for THIS ticket.** (1) Creating `johnhkchen/homebrew-vend`, minting a
`HOMEBREW_TAP_TOKEN`, and cutting a real `v0.1.0` release are owner actions outside the
repo — an agent cannot and should not do them autonomously (irreversible, outward-facing,
publishes to the world). (2) They are already documented as human prerequisites by
T-063-01. This ticket should *verify the assembled artifacts and hand the human a green
"ready to publish" bar*, not perform the publish. Carried as the residual gap, not the work.

### Option C — One-off manual loop, paste the raw output, stop
Run the faithful local loop by hand (as Research already did), paste it, done.
**Rejected as the primary deliverable.** It proves the loop *once* but is not re-runnable;
the next release can't re-clear the bar without redoing it by hand. The project's own
[[expected-outcome-gold-master-pattern]] is precisely "capture a live drive as a
*re-runnable* consistency bar." A throwaway paste is below that bar.

### Option D — A re-runnable acceptance harness that drives the REAL artifacts on a clean machine, records the transcript, and names the gap (CHOSEN)
A small tested script — `src/release/acceptance.ts` — that, against an already-built
`dist/`:
1. **Verifies** the tarball's `shasum -a 256` == the sha in `sha256sums.txt` == the sha in
   `vend.rb` (the brew-verifies clause, on the real bytes — reusing `parseSha256Sums`).
2. **Installs like brew does**, minus the network: extract the tarball into a fresh temp
   prefix, place `vend` on a clean PATH (`install do: bin.install "vend"`, faithfully).
3. **Runs the binary on a clean machine**: a scrubbed env (no `DOPPLER_*`, no inherited
   repo coupling) and a no-checkout temp workdir.
   - `vend --version` → assert `== VERSION`.
   - `vend init --template minimal` in an empty dir → assert scaffolded, no `.git`.
   - a second run → assert the no-clobber converge.
4. **Records** a markdown transcript (real command output, clause-by-clause ✓/✗) to
   `--out`, and prints an explicit RESIDUAL-GAP section for the live tap with its three
   prerequisites and the measured 404s.
Exit `0` all-clear / `1` a clause failed / `2` precondition (no `dist/` — "run
`just release-local` first").

## Why D

- **Maximally honest.** Every recorded line is real output from the real 107 MB binary and
  the real tarball/formula the release ships. The ONE thing it can't do (resolve the live
  tap over the network) is named, not faked — with the measured 404s as proof of the gap.
- **Re-runnable bar.** Re-run after any release rebuild and it re-clears (or reds) the
  install→version→workspace loop — the gold-master pattern, not a one-off.
- **Mirrors the house idiom.** Same shape as `package.ts`/`formula.ts` (root → pin →
  read/verify → act; exit `0`/`2`), pure judgment in a `*-core.ts`, smoke test for the
  shell. Reuses `parseSha256Sums`, `requireKey`, `VERSION`, `SCAFFOLD_MANIFEST` — no
  re-derivation, no drift.
- **Real CI guard.** Wired as a step in `release.yml` after the formula renders, it
  exercises the loop on every tag against the freshly-built `dist/` — so the assembled
  chain is asserted in prod CI, not only by hand.
- **Respects the boundary.** It verifies; it does not publish. Option B's owner actions
  stay with the human, surfaced loudly.

## Faithfulness ledger — what D proves vs. what stays residual

| AC clause | D proves it on real artifacts | Residual |
|-----------|-------------------------------|----------|
| formula sha matches the asset | ✓ `shasum` == sums == `vend.rb` sha | — |
| binary installs from the tarball | ✓ extract + `bin.install "vend"` equivalent | the network *fetch* of the asset |
| `vend --version` real semver | ✓ real binary, scrubbed env, no checkout | — |
| `init --template` lays a workspace, empty dir | ✓ 17 created, real binary | — |
| no clone / no Doppler | ✓ scrubbed env, no `.git`, structural | — |
| `brew install johnhkchen/vend/vend` *resolves the tap* | ✗ (un-publishable here) | the live tap: repo + token + tag |

D collapses the gap to a single, well-understood, human-owned line (publish the tap) and
proves everything else on the bytes that line would serve.

## Decision

Implement **Option D**: `src/release/acceptance-core.ts` (pure verdicts + env scrub) +
`src/release/acceptance.ts` (the impure clean-machine harness, `--out` transcript) +
`acceptance.smoke.test.ts`; wire `bun run acceptance`, a `just acceptance` recipe, and a
`release.yml` verification step. Record the real transcript to
`docs/active/work/T-065-01/acceptance-transcript.md` and document the residual live-tap
gap as the human handoff. No tap is published by this ticket.
