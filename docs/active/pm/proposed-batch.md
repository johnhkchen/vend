# PM — Proposed batch (Retrospective cycle, synthesized 2026-06-29)

> Output of the **2026-06-29 retrospective desk cycle** (`pm/retrospective-2026-06-29.md`). **Supersedes the visual-channel
> batch** (its pull, E-060, cleared + swept). Grounded in `.vend/runs.jsonl`, the recent `work/*/review.md`
> open-concerns, git, and this session's friction. Signals un-elaborated (PE-6), ranked by leverage.
> Promotion is a deliberate human pull.

## The strategic read

The E-055→E-060 arc **closed the Set-B round-trip in CODE** — render (E-059) + clear (E-060), on the visual
surface (E-055/56) and the channel proof (E-058). The retrospective found three things that reshape the
next pull:

1. **The round-trip is coded, not LIVE-verified (F1).** The closing E-059/E-060 live drives have no run-log
   evidence here and are human-deferred — so "it works live" is still pending. The cheapest, most honest
   next move is a **verification drive**, not more build.
2. **The kitchen dogfood is the next phase, and its prerequisites are now grounded demand.** No end-user
   install path (→ E-061) and no EmDash-drive capability (→ E-062) — the long-lived real-project dogfood
   (`pm/plan-kitchen-dogfood.md`) is what the next pulls serve.
3. **Long-lived + multi-device exposes the trust ledger (F3).** `.vend/runs.jsonl` is gitignored/per-device
   — the Set-A cadence can't accumulate across a transfer or a remote box.

**The focus:** the next pull buys down the **kitchen-dogfood prerequisites (Set B, now on a real project)**
while **closing the honesty gap (live-verify, Set A)**. Tactical fixes (F2 loop-commit) auto-drain.

## Ranked shortlist

### 1. Live-verify the Set-B round-trip — the honesty close (F1) — **High** ← do this first
**Signal:** run the deferred E-059/E-060 closing drives (or confirm they ran elsewhere): a real metered
`vend steer` (+ `work`) on the hackathon seed that proves the board renders + a slice clears, captures the
**positive** gold master, and accrues the first **cleared forward-E1** here. Converts "coded" → "live-proven."
- **Advances:** P4/P7 (Set A — real cleared evidence) + honest-on-outcome (closes the overstated sweep).
- **Budget:** one small human-authorized metered drive (~$0.3–0.9, the T-058-05 shape).
- **Note:** the kitchen MVP's first drive also supplies this — the hackathon seed is the cheaper close.

### 2. E-061 — vend Homebrew distribution + "make a workspace" (F5) — **Keystone** ✓ PULLED 2026-06-29 → board **E-061**
**Signal:** vend brew-installable mirroring lisa (compiled binary, tap, per-platform formula; package.json
cleanup) + the workspace seam (`vend init --template`). The **end-user install path** — a hard prerequisite
for the kitchen MVP and every future user.
- **Advances:** P5; the OMTM's install leg. De-risked (lisa mirror verified, `bun --compile` spike green).
- **Budget:** ~1–2 blocks. Spec: `pm/plan-kitchen-dogfood.md` (E-061). **Open input:** the cook/dev's
  OS/arch (first binary target).

### 3. E-062 — kitchen QuickStart seed on EmDash (F6) — **Keystone/High**
**Signal:** the EmDash+Astro vend-wired seed; the first drive **clears the menu-render slice** (decision b)
so the cook/dev's couple's menu renders. Precede with a **cheap A3-for-EmDash spike** (does steer rank a
coherent board for an EmDash project?).
- **Advances:** P2/P5; the kitchen MVP. Brief: `pm/brief-kitchen-emdash.md`. **Dep:** E-061 (install) +
  E-060 (fresh-seed drivability, done).
- **Budget:** ~1 block + the live drive. Risk: A3-for-EmDash (new stack) — spike first.

### 4. Portable forward-E1 trust ledger (F3) — **High**
**Signal:** make the Set-A cadence survive a device/box transfer — `runs.jsonl` is gitignored/per-device
today. A persistence/portability fix (a committed curated forward-E1 ledger, or a sync path) so the
long-lived dogfood's cleared records accumulate toward the ≥10 bar.
- **Advances:** P4/P7 (Set A measurement integrity). Surfaced by the fresh-device transfer + the remote-box
  operating model.
- **Budget:** small.

### 5. Loop commit-consistency (F2) — **Standard** (tactical — auto-drains)
**Signal:** lisa's commit step is a single point of failure — it dropped T-060-01-02's code + the E-060
board (untracked) while later tickets committed. Fix: commit serialization / commit-board-on-mint / a
post-loop uncommitted-work guard. *Listed for visibility; the loop auto-drains tactical correctness — not a
strategic pull.*

### 6. `vend retrospect` play (F8) — **Standard** (candidate)
**Signal:** vend reads its own `runs.jsonl` + `work/` + git to stage fixes automatically — makes this
retrospective a repeatable gesture (P3). A candidate, not a prerequisite.

### 7. Brew-availability acceptance gate — install proven on a clean arm64-mac (T-065-01 → CI) — **High** (sequences after E-061 go-live)
**Signal:** a dedicated GitHub Actions workflow on `macos-14` (the clean arm64 runner the loop already
adopted — **no `actions/checkout`**, so "no clone" is enforced for free) that runs the **real**
`brew install johnhkchen/vend/vend` → asserts `vend --version` is real semver → `vend init --template`
lays a workspace in a `mktemp -d` — purely from the published tap, no Doppler. Triggered
`workflow_dispatch` + a weekly `schedule`, so it's a **standing availability monitor**, not a one-time
transcript. Two tiers: (a) **pre-publish** — `brew audit --strict`/`style` + install from a local `file://`
tarball (also proves the BAML-bundled binary runs standalone, de-risking the compile unknown), lands with
E-061; (b) **post-publish** — the real-tap gate, after the first release. **Neither lisa nor vend has this
today** — it's a genuine gap, not a mirror.
- **Advances:** P5 + honest-on-outcome — turns E-061's "done looks like" into a re-runnable gold-master bar
  ([[expected-outcome-gold-master-pattern]]) instead of a human-deferred transcript (the F1 lesson, applied
  to the install path).
- **Depends on:** E-061 landed + the human go-live tail (tap repo `johnhkchen/homebrew-vend` created, first
  `v*` release published). Tier (a) can land with E-061; tier (b) sequences after the first publish.
- **Budget:** small (one workflow + a tiny assert script). Tactical-leaning, but it's the install path's
  *only* live proof — surface it, don't let it auto-drain silently.

### 8. `decompose` mints graph-invalid story IDs — **High** (blocks every future epic mint) ← do before E-062
**Signal:** the `decompose-epic` play emitted E-061's stories **flat** (`S-061…S-065`), but vend's model
resolves a story's epic by its first number block, so `S-062` → a non-existent `E-062`. The board failed
`bun run check` (GraphIntegrityError, 8 cascading fails) **while passing `lisa validate`** — and was red
from the mint until a manual renumber this session. Fix decompose to emit the nested `S-<epic>-<NN>` /
`T-<epic>-<NN>-<MM>` convention E-060 follows, **and** add the live-board graph-integrity smoke as a
decompose-play gate so the play can't materialize an invalid board.
- **Advances:** P3 / correctness — the clearing play's output must satisfy vend's own model.
- **Not auto-draining:** `lisa validate`'s blind spot means the loop won't self-correct it; **every** future
  mint (E-062 kitchen seed next) needs a manual renumber until this lands.

### 9. Run vend's own gate at mint, not just `lisa validate` — **Standard** (process guard)
**Signal:** the E-061 board was committed on the chain's `lisa validate ✓` **without** `bun run check`, so
it was graph-red from the mint and the loop built on it. Guard: the mint flow (`vend chain`) should run —
or prompt for — vend's own gate (at minimum a graph-integrity check) before a board counts as landed. The
net that would have caught #8 at mint instead of after the build.
- **Advances:** honest-on-outcome / verify-git — catch invalid boards before work compounds on them.

**Carried forward (lower now):** headless-operability hardening (F7 — notifications fixed; budget/andon
legible in diff/PR + SVG-as-remote-read remain); `EXPECTED-OUTCOME` → `src/probe` consistency wiring
(carried from E-058). **Auto-drained:** F2.

## Recommended next pull

**#2 (E-061 Homebrew) is now PULLED** — minted to the board on 2026-06-29 (`vend chain`, propose→decompose,
all gates green; 5 stories / 8 tickets), ready for lisa's loop. Remaining: **#1** the cheap honesty-close
verification drive (run when ready to spend the metered budget), then **#3 E-062 (the seed)** after a cheap
A3-for-EmDash spike. **#7 (the brew-availability gate)** sequences right behind E-061's human go-live tail
(create the tap, cut the first release) — its pre-publish tier can ride along with E-061. **#8 (decompose
graph-valid IDs) must land before the E-062 pull** — otherwise the kitchen-seed mint hits the same
graph-invalid renumber. The E-061 signal string below is retained for the trail. Signal strings for the build pulls:

```
vend chain "vend Homebrew distribution + make-a-workspace — make vend brew-installable mirroring lisa exactly (compiled per-platform binary via bun build --compile, a tap formula, package.json cleanup: drop private, real semver, add bin) and extend the vend init --template seam so a brew-installed vend lays down a workspace. The end-user install path — a hard prerequisite for the kitchen dogfood and every future user. Mirror johnhkchen/homebrew-lisa; ship the cook/dev's platform (arm64-mac) first. Spec: pm/plan-kitchen-dogfood.md (E-061)."
```
```
vend chain "Kitchen QuickStart seed on EmDash — a clone-and-drive EmDash+Astro vend-wired seed with a Dish content type and an intentionally-stubbed storefront menu, where vend's first drive CLEARS the menu-render slice (decision b) so the cook/dev's couple's menu renders. Precede with a cheap A3-for-EmDash spike. Depends on E-061 (install) + E-060 (fresh-seed drivability). Brief: pm/brief-kitchen-emdash.md (E-062)."
```

_Staged, not promoted (PE-1 / IA-5). A human pulls; the clearing play mints the real epics. The PM writes
only to `pm/`._
