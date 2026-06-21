# PRD — Distribution & Onboarding (anchored on `vend init`)

> **Upstream PM planning artifact** (desk-only, per `README.md`). This PRD *elaborates* the
> recommended pull from `proposed-batch.md` (2026-06-20) so a human can decide and a clearing play
> can later mint epics. It is **not** a board pull and mints no epics itself — pull-discipline
> stays intact (PE-1/PE-6). Sources: `deployability-discovery.md`, `onboarding-examples-discovery.md`.

---

## 1. Summary

Today vend can only be run by the person who built it, and even a new project needs its folders
built by hand. This initiative makes vend **installable** (like `brew install`) and **learnable**
(copy a ready-made example and drive it), starting with **`vend init`** — one command that sets up a
vend+lisa project the way `lisa init` sets up a bare lisa one. The goal: turn vend from an
author-only tool into one a second person can install, understand, and use.

## 2. Contacts

| Name | Role | Comment |
|---|---|---|
| John Chen | Product owner / author / engineer | Sets the value function (charter); makes the deliberate pulls. |
| PM agent (this desk) | Upstream planning | Surveys state, ranks demand, writes this PRD. Proposes; never pulls. |
| lisa loop (Claude Code) | Executor | Clears pulled epics into work. (Ran E-037/E-038 in parallel this session.) |
| lisa (`johnhkchen/lisa`) | Upstream dependency + toolchain reference | vend depends on lisa; lisa does not depend on vend. Its `dist`/`justfile`/`doctor`/`init` are the pattern. |

## 3. Background

**Context.** Vend's core machinery is built and cleared: the dispense→engine→chain pipeline, the
gate frame, the measured-budget contract, the **articulation trilogy** (expand/survey/steer — turn
a rough idea into a ranked board), the trust instruments, the Home/shelf surface, and the executor +
authoring seams (E-035/E-036). The headline keystone — proving the autonomy loop — is **in motion**:
E-037 watched the budget run live, and E-038 just removed the timing bug that was blocking it.

**Why now.** Three things changed:
1. The spine is done, so the next real constraint is **adoption** — and a clearing house nobody can
   install or understand clears nobody's work.
2. The keystone's remaining need is **real cleared runs** (to earn trust). More runs require more
   people driving more projects — which requires vend to be installable and legible. So this work
   **feeds the keystone**, it doesn't compete with it.
3. The one hard technical unknown was settled this session: a quick spike proved a compiled vend
   binary runs its AI-authoring layer (BAML) **fully self-contained** — so shipping a single
   binary, like lisa does, is viable. Most of the remaining work is **adopting lisa's existing
   toolchain**, not inventing.

**What recently became possible.** The articulation trilogy shipping means a *fresh* project can
actually be driven from a seed; the executor/authoring seams shipping means the dependency surface
is small and knowable; the compile spike going green means delivery is a config job, not a research
project.

## 4. Objective

**Make vend usable and legible beyond its author** — installable on a fresh machine, scaffoldable on
a fresh project, and learnable by example.

**Why it matters.** It opens vend to a second user (the whole point of a *product*), and it compounds
the keystone: every new driveable project produces the cleared runs that earn the trust which ungates
autonomy. It directly advances the vision: **P5** (local-first delivery), **P2** (the two-gesture
transaction survives install — no config at the counter), and the **core feature** (clearing work for
*any* project, not just this repo).

**Key results (how we'll know it worked).** Honest, checkable bars — not invented numbers:
- **KR1 — Scaffold works.** `vend init` turns a fresh lisa project into a working vend+lisa project
  in one command, and the result passes **`vend doctor` clean**.
- **KR2 — Time-to-first-board.** A new user goes from a copied example + a one-line seed to a
  **driven, reviewable demand board in one short session**, without writing code or hand-authoring
  issues.
- **KR3 — Repeatable quality.** At least one example ships a **gold-mastered expected outcome** that
  can be re-driven and compared — the consistency promise made visible.
- **KR4 — Feeds the keystone (downstream).** The real runs these enable **accrue cleared forward-E1
  records toward the ≥10 bar** that fully ungates the macro-wallet.

## 5. Market segment(s)

Defined by the **job to be done**, not demographics:

- **The author standing up a new project.** Job: *"start a vend+lisa project without copying
  scaffolding by hand."* → served by `vend init`.
- **The hackathon pair (a builder + a PM/designer).** Job: *"turn a seed of an idea into a real
  project in one short session, instead of coding the whole time."* → served by the hackathon example.
- **The small-business builder.** Job: *"stand up a production site by picking only the integrations
  this business needs, not hand-wiring every platform."* → served by the small-business example +
  deploy presets.
- **The designer.** Job: *"change the UI directly in my own tool, without a developer playing
  telephone."* → served by the Figma example (an AI-built design system that passes muster in Figma).

**Constraints.** Local-first; depends on lisa + Claude Code being present; and a real **conceptual
learning curve** — the value only clicks once you grasp the *engineer-out-of-the-loop* shift, which
is exactly why examples (show, don't tell) are part of the initiative, not an afterthought.

## 6. Value proposition(s)

| Customer's problem (job) | What vend gives them | Pain avoided |
|---|---|---|
| "I can't even start a project without building folders by hand" | `vend init` scaffolds it in one command | Blank-page setup |
| "I don't understand what to *do* with this" | Driveable examples teach by being driven | Conceptual opacity / a confusing learning curve |
| "I can't install it" | Homebrew delivery (one binary, like lisa) | Build-from-source friction |
| "It fails with a cryptic error" | `vend doctor` checks deps and **refuses cleanly** with fix-it hints | Mid-run stack traces |
| "Changing the design means a dev relays my words" | Figma example: a real design-token system the designer edits directly | The telephone game |

**Where we win that others don't.** The **consistency guarantee** — gates make repeated runs
dependable, which is vend's whole reason to exist; the **two-gesture transaction** (pick + budget +
go) preserved even through install; and, at the top of the value curve, an **AI-built design system
that passes muster** as a real Figma token system — the purest demonstration of consistency there is.

## 7. Solution

### 7.1 UX / flow

The intended new-user path (the two-gesture promise survives install):

```
brew install johnhkchen/vend/vend     # or: clone + bun install (v1)
vend doctor                           # green? deps OK (lisa, claude, BAML bundled)
vend init --template hackathon        # scaffold a driveable vend+lisa project
$EDITOR SEED.md                       # the ONE thing the user writes: a one-line idea
vend steer        (or: vend survey)   # vend reads the seed → proposes a ranked board + the real forks
# review the board, answer a few forks
vend work --budget <...>              # clear the first slice, gated, against a budget
```

Empty-state rule (IA-3/IA-4): a fresh scaffold's board starts **honestly empty**; the first move is a
**Survey/Steer cast** off the seed — vend never seeds fake demand.

### 7.2 Key features

1. **`vend init`** *(v1 core — the recommended pull).* Complements `lisa init`. Scaffolds the
   clearing-house structures the bare lisa loop doesn't need: the demand board, the `pm/` desk,
   `epic/ stories/ tickets/ work/`, knowledge stubs, the cleared-demand archive, and `.vend/` state.
   **Idempotent**, layered onto an existing lisa project (detects `CLAUDE.md`/`.lisa.toml`). Seeds
   **structure + knowledge, never demand.**
2. **`vend doctor`** *(v1 — correctness gate).* An `envinfo`-backed preflight that verifies the real
   runtime deps — **lisa** and **claude** on PATH, the BAML client bundled and its addon loadable,
   and the executor-specific config (default Claude needs no API key; the open-model path needs its
   endpoint vars). A missing dep is a **clean gated refusal** with a fix-it hint, not a crash. Wired
   as a precondition before a cast (lisa's `check_required_deps`-before-`run_loop` pattern).
3. **`examples/` + `vend init --template <name>`** *(the onboarding engine).* A copy-to-drive
   template *is* a pre-`init`'d project + a seed + a tuned charter + a stocked shelf + a
   gold-mastered expected outcome. The flag is the seam between install and the examples.
4. **Homebrew delivery** *(later).* Real `package.json` (a `bin`, real version, drop `private`),
   `bun build --compile`, a Homebrew tap + shell installer + release CI — driven by **`dist`** and a
   **`justfile`**, mirroring lisa exactly.
5. **The three examples** *(later, rising bars):* **hackathon** (seed→board, speed bar),
   **small-business site** (pick-choose-integrate via deploy presets, production bar), **Figma↔React
   SPA** (the design-token system that passes muster, faithful-recreation bar).

### 7.3 Technology (the off-the-shelf bet — "don't roll our own")

- **`bun build --compile`** for the single self-contained binary. **Spike-proven green** this session:
  a ~108 MB binary ran a BAML render + parse from a directory with no `node_modules`/`baml_client`.
- **`dist` (formerly cargo-dist), JS mode** — the **same tool lisa already uses**; it drives
  `bun build --compile` and emits the Homebrew formula/tap, shell installer, and CI. One toolchain
  across both repos.
- **`justfile`** — the `just release` / `just check` ritual layer on top.
- **`envinfo`** — the cross-platform binary/version probing under `vend doctor`; only the ~3
  vend-specific checks are hand-rolled (the pattern expo-doctor/react-native-doctor use).
- **Figma MCP + Storybook** (example 3) — the design read and the verification gate; `vend` already
  supports per-play MCP declaration (E-032), so a play can declare `mcp: ["figma"]`.
- **Dependency direction:** vend → lisa, one-way. The formula declares lisa; doctor verifies it.

### 7.4 Assumptions (flag and validate before pulling)

- **A1.** `dist` JS-mode cross-compiles cleanly to all five targets from this Bun version. *(Spike
  proved the host target only.)*
- **A2.** A live `claude -p` dispense works on the **subscription alone**, with no `ANTHROPIC_API_KEY`.
  *(Source says yes; confirm on a real cast — overlaps the E-037/E-038 live work.)*
- **A3.** `vend steer`/`survey` produce a **genuinely useful board off a thin domain seed**, not just
  off this repo (which they were authored against). *The hackathon example is the test.*
- **A4.** The Figma example's generated design system **passes a real designer's muster** (proper
  variables, variants, bindings, theming) — the headline claim, and the highest-uncertainty item.
- **A5.** `vend init` is reliably **idempotent** across the states `lisa init` can leave a project in.

## 8. Release (relative timeframes, v1 → future)

**v1 — the foundation (the recommended pull).**
- `vend init` — the scaffold. *(KR1)*
- `vend doctor` — the correctness gate. Smallest, most-ready; immediately useful for debugging the
  vend+lisa combo.

**v1.1 — the value proof.**
- `examples/` scaffold + `vend init --template`, and the **hackathon example**. This is what turns the
  scaffold into a visible win *and* generates the cleared runs that feed the keystone (KR2, KR4).

**v2 — the install path.**
- Homebrew delivery via `dist` + `justfile`. Best once v1/v1.1 give it something coherent to ship.

**Future — the higher-bar examples.**
- Small-business site + the **deploy-preset shelf** (the meatiest genuinely-new capability).
- Figma↔React SPA: ship the **forward half first** (Figma→code, Storybook-gated), then the **two-way
  design-system loop** (X-3b) once its quality bar (A4) is spiked.

**Sequencing logic.** Foundation-first (everything stands on `vend init`); delivery once there's
something proven to deliver; the meatiest examples last. The deliberate first pull a human makes off
this PRD is **`vend init`**; the hackathon example is the immediate follow that proves it.
