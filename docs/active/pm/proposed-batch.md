# PM — Proposed batch (distribution & onboarding cycle, synthesized 2026-06-20)

> Synthesized by the orchestrator (full session context) from this session's deployability +
> onboarding discovery (`deployability-discovery.md`, `onboarding-examples-discovery.md`),
> ranked against the six live frontiers in `demand.md` (post-E-037). Signals **un-elaborated**
> (PE-6), ranked by **leverage, not effort**. Promotion is a deliberate human pull.

## The strategic read

The headline keystone — **Frontier 1, prove the autonomy loop** — is **already in motion**: E-037
watched the macro-wallet live (clean P4/P7 receipt) and **E-038 is in flight** clearing the
per-cast time-censor that blocked it. What Frontier 1 needs next is **not a fresh pull** — it's
**cleared runs** (forward-E1 at 4/10, censored; the ≥10 bar is a *cadence*, accrued by usage).

That reframes where new leverage lives. The binding constraint on the keystone's cadence — and on
**everything beyond the author** — is the same thing: **real usage, which requires vend to be
installable and legible.** Today vend ships nothing and is conceptually opaque to a newcomer (the
value only clicks once you've felt the engineer-out-of-the-loop shift). This session surfaced the
**distribution & onboarding** frontier the board was silent on, de-risked its one hard unknown (the
`bun build --compile` + BAML spike is **green**), and found that most of it is *adopting lisa's
existing toolchain*. It's high-leverage on its own **and** it feeds the keystone: more driveable
projects → more cleared runs → forward-E1 accrues → the wallet ungates. Same virtuous loop the
articulation cycle ran, one layer out. **That's the spine of this batch.**

## Ranked shortlist

### 1. `vend init` — the clearing-house scaffold — **Keystone**  ← recommended pull
**Signal:** complement `lisa init` — scaffold the demand board, `pm/` desk, epic/stories/tickets/
work, knowledge stubs, archive, `.vend/` that the vend+lisa combo needs and the bare lisa loop
doesn't. Idempotent on an existing lisa project; seeds **structure + knowledge, never demand** (the
board starts honestly empty, IA-4; first move is a Survey cast, IA-3).
- **Advances:** P5 (local-first usable on *any* project, not just the hand-built dogfood repo); the
  foundation the entire distribution+onboarding frontier reuses.
- **Budget:** ~1 block; a scaffold play, no new external deps.
- **Readiness/deps:** ready; vend→lisa dependency direction settled this session.
- **Rationale:** foundation-first (R3) — X-0/X-1/X-2/X-3 all stand on it, and it's what makes vend
  reach a second user at all. Not trust-gated → ships now.

### 2. Hackathon driveable example — the experiential onramp — **High**
**Signal:** `examples/templates/hackathon-seed/` — copy it, drive a *seed of an idea* into a real
board + first cleared slice in one short session, paired with a PM/designer. "Watch yourself leave
the loop."
- **Advances:** the core feature (seed → allocatable board) on a fresh domain; P5 (non-dev pairing,
  Frontier 4); **accrues cleared forward-E1** (feeds the in-motion keystone).
- **Budget:** ~1 block; exercises the **already-shipped** articulation trilogy (expand/survey/steer).
- **Readiness/deps:** wants #1 (`vend init --template`); lowest new infra of the three examples.
- **Rationale:** the most leverage-dense single pull — validates shipped capability, teaches the
  value, *and* generates the runs the keystone's cadence needs. The proof that #1 matters.

### 3. `vend doctor` — install-correctness preflight — **High** (enabler)
**Signal:** an `envinfo`-backed preflight that verifies the combo's real deps (lisa + claude on
PATH, `baml_client` bundled, BAML addon loads, `VEND_EXECUTOR` branch) and refuses cleanly with
fix-it hints; wired as a **cast precondition gate** (lisa's `check_required_deps`-before-`run_loop`).
- **Advances:** P3 (a missing dep is a gated *refusal*, not a crash — IA-9); P5; de-risks delivery.
- **Budget:** small — `envinfo` + ~3 bespoke checks + the pure-core/shell split.
- **Readiness/deps:** ready; smallest first stone; independently useful for debugging the combo now.
- **Rationale:** don't-roll-your-own (envinfo); the correctness contract under every install.

### 4. Homebrew delivery via `dist` (JS mode) + `justfile` — **High**
**Signal:** `brew install johnhkchen/vend/vend` — real `package.json` (`bin`/semver/drop `private`),
`bun build --compile` across targets, tap + shell installer + release CI, mirroring lisa's toolchain.
- **Advances:** P5 (the literal local-first delivery).
- **Budget:** ~1–2 blocks; **spike-proven** (compiled binary runs BAML render+parse self-contained).
- **Readiness/deps:** `dist` is the same tool lisa already uses; composes with #1/#3.
- **Rationale:** the delivery capstone — best pulled once #1/#3 give it something coherent to ship.

### 5. Multi-node DAG (Frontier 3) — the v1 architectural centerpiece — **High/Keystone**
**Signal:** plays composing into a real typed graph (fan-out, join, conditional) beyond the linear
propose→decompose chain — "typed, graph-structured agent orchestration" made real.
- **Advances:** the core architecture; Frontier 2 (open-model runner) wants it underneath.
- **Budget:** several blocks (heavy).
- **Rationale:** the standing capability keystone — but *premature now* vs. proving/adopting what's
  built. The next big architectural pull once adoption justifies the commitment.

### 6. Thread the structured stop-reason onto the run record (Frontier 6) — **Standard** · **Ready ~1h**
**Signal:** STOP plays fold honest-empty into `budget-exhausted` (stdout-only), so the probe +
`vend audit` can't split them; thread the stop-reason so it's countable.
- **Advances:** clean consistency/trust measurement — directly sharpens Frontier 1's forward-E1
  honesty (E-037's whole lesson was censored-vs-cleared confusion).
- **Budget:** ~1h; highest readiness on the board.
- **Rationale:** a cheap hygiene win that makes the keystone's accrual *legible*.

**Carried forward (staged, lower now):** Frontier 1 cadence (in motion via E-038 — accrue by usage,
which #1/#2 accelerate); Frontier 2 agentic open-model runner (wants #5); Frontier 4 Linear renderer
+ annotation→demand (X-3's two-way loop reuses the latter); Frontier 5 walk-away UX (design pull
first); **X-2** small-biz + deploy-preset shelf (meatiest example, after the foundation); **X-3**
figma↔SPA design-system-that-passes-muster (best demo, highest setup, wants Frontier-4 primitives).

## Recommended next pull

**#1, `vend init`.** The keystone (Frontier 1) is already in motion (E-038) and now needs *cleared
runs*, not a new pull — so the highest-leverage new effort is the frontier that compounds it:
**distribution & onboarding**, whose foundation is `vend init`. It makes vend usable beyond the
author, every example and `brew install` path stands on it, it complements `lisa init` exactly as
intended, and it's not trust-gated. Ship the scaffold; **#2 (hackathon)** is the immediate follow
that turns it into a value demo *and* a forward-E1 accruer — the pair is the cycle's real intent.
