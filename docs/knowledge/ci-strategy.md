# Vend — CI/CD with Dagger: how to plan and build it

*Captured steering for the CI/CD epic (E-002 on the pull board — `demand.md`).
Read alongside `tps.md` (the lens), `stack.md` (the how), and `go-and-see.md`
(the ground truth). This document tells you how the CI/CD layer is structured
and, more importantly, the few boundaries you must hold from the first commit —
because a Dagger module that isn't kept clean from day one calcifies into a mess
that can't be cleaned later.*

---

## The one-line frame

**CI is the inspection layer — and by our own TPS lens, inspection is the
weakest kind of check.** So CI's job here is deliberately *narrow*: be the
trustworthy, *independent* detector for the **structural / mechanical** defect
class only (compile, type, test, lint), so the play never has to self-certify
those. CI is not where quality is built in. Quality is built into the play
(jidoka). CI is the backstop that catches the spindle the play couldn't.

Do not let CI grow ambitions beyond this. Every time you're tempted to make CI
"smarter" about semantic correctness, stop — that belongs upstream in the play
as an andon gate, or in the human-amplifier for the well-formed-wrong class.

---

## Why Dagger, stated as a constraint you must honor

Dagger was chosen for one structural reason: **the same check must run in two
places without drifting** — as an *andon gate the play invokes mid-run*, and as
the *independent inspection CI invokes after a commit*. Pipelines-as-code that
run identically locally and in CI is what makes that possible.

This only works if you hold the central rule below. If you break it, Dagger
becomes overhead with no payoff.

> **THE CENTRAL RULE: Dagger invokes, it never defines.**
> Check *logic* lives in the app repo as `bun run check:*` scripts. The Dagger
> module is a thin trigger-and-report shell that runs a container and calls
> those scripts. The play invokes the *same* `bun run check:*` commands as andon
> gates. Neither Dagger nor the play owns the definition of "good" — the shared
> scripts do. If Dagger vanished tomorrow, every check would still run untouched.

When you find a real check's *logic* sitting inside a Dagger sub-class instead of
behind a `bun run check:*` script — that is the andon. Stop the line and move it
out.

---

## Two facts about Dagger that shape everything (verified, current)

**1. Bun support in Dagger is experimental; Node is the stable default.**
The project is Bun-driven, but the *CI orchestrator does not need to be Bun.*
Run the Dagger module on the **Node runtime** (stable) and let it *invoke Bun
inside containers* to run the actual checks. Do not conflate "the project uses
Bun" with "the orchestrator must be Bun" — that premise is itself a mess-maker.
Bun-as-runtime is a later opt-in once the pipeline is proven, not a day-one bet.

**2. TypeScript can't split the main module file — and this constraint is your
anti-mess architecture, handed to you.** You cannot split `index.ts` across
files. You *can* (and must) create sub-classes in their own files and return
them from the main object. So:

- `index.ts` is a **thin router** and nothing else.
- **One gate = one sub-class = one file.**

The god-object `index.ts` that accretes every check inline is the default Dagger
mess. The language constraint forces the good structure *if you adopt it
deliberately from commit one.* Do.

---

## The structure to build (day one)

```
/ci                       ← Dagger module — its OWN program, not the app
  dagger.json             ← engine version PINNED
  package.json            ← module's own deps; Node runtime
  src/
    index.ts              ← thin router: test(), lint(), typecheck(), consistency()
    test.ts               ← Test sub-class      → runs container → `bun run check:test`
    lint.ts               ← Lint sub-class      → `bun run check:lint`
    typecheck.ts          ← Typecheck sub-class → `bun run check:typecheck`
    consistency.ts        ← play cross-consistency gate (the doc-drift catcher)
/                         ← the app — Bun project
  package.json            ← check:* scripts live HERE (the real logic)
```

**The boundary that rots first, so guard it hardest:** the `/ci` module is a
*separate program* with its own `package.json` and dependencies. It depends on
nothing from the app's source, and the app depends on nothing from it. The
moment the Dagger module imports app code, orchestration is welded to
implementation and the mess is permanent. Keep `/ci` ignorant of the app except
through the `bun run check:*` command surface.

---

## How this maps to the three-class defect model

CI only owns the first row. Plan accordingly — do not let it reach into the
others.

| Defect class | Detector | Owner | CI's role |
|---|---|---|---|
| **Structural** (won't compile, type error, test fail, lint) | independent, at source | **CI + play** (same scripts) | **This is CI's whole job.** Be the independent backstop. |
| **Semantic-downstream** (under-specified, wrong granularity, drift) | independent but only late | the **play** (andon fast-stop) | Not CI's job. CI may *notice* a late symptom but the catch belongs upstream. |
| **Well-formed-wrong** (solved the wrong problem) | human judgment only | the **human-amplifier** | CI cannot catch this. Do not pretend it can. |

The `consistency.ts` gate is the one place CI reaches slightly past raw
mechanics: it catches **play/doc cross-inconsistency** (the docs admit
`vision`/`stack`/`tps`/`go-and-see` could silently contradict each other). Treat
this as structural — it's checking artifacts against each other by rule, not
judging whether an idea is *right*. Keep it rule-based; the moment it needs
judgment, it's not a CI gate.

---

## Trigger model — built for DAG agents on a shared branch

Commits arrive from **parallel Claude Code sessions committing increments to a
shared branch**, not from humans opening PRs. So:

- The unit of inspection is **the increment**, verified fast, *before the next
  agent's context is polluted by it.* Latency matters more than usual — a defect
  that passes inspection travels into the next agent's working context.
- **Keep the Dagger engine warm.** Cold-start on the TS SDK has historically been
  slow (tens of seconds); cold-starting per increment compounds badly across a
  fast-committing fleet. A warm engine plus Dagger's aggressive DAG/BuildKit
  caching means re-verifying a small increment only re-runs what actually
  changed — which is *why* Dagger fits the fast-increment model at all.

---

## Rules for you, the agent, specifically

1. **`dagger develop` is a reviewed version bump, never a casual step.** It
   regenerates the module against the current Dagger API and can silently change
   behavior across versions. Pin the engine version in `dagger.json`. Do **not**
   run `dagger develop` mid-task on your own initiative — it is a well-formed-wrong
   risk (it succeeds, looks fine, behaves differently). **Stop and ask.**
2. **Never inline check logic into a Dagger sub-class.** Logic goes in
   `bun run check:*` scripts in the app repo. Sub-classes only run a container
   and call those. (The Central Rule.)
3. **`index.ts` stays thin.** If it grows past routing, you're building the
   god-object. Extract to a sub-class file.
4. **`/ci` imports nothing from the app.** If you reach for app source inside the
   module, stop — the contract is the `bun run check:*` command surface only.
5. **CI proves structural correctness, not semantic.** If you're adding a gate
   that judges whether the *approach* was right, it doesn't belong here — route it
   to the play (andon) or the human-amplifier. Say so in your plan instead of
   building it into CI.
6. **When you elaborate the pipeline past what the current slice needs, that is
   the over-building reflex** (the one the dev kept catching this session). Stop.
   Ship the smaller real pipeline.

---

## First slice (don't build past it)

A single gate, end to end, proving the whole shape:

- `bun run check:test` exists in the app's `package.json` and actually runs the
  test suite.
- `/ci/src/test.ts` is a `Test` sub-class that spins a container and invokes that
  script.
- `/ci/src/index.ts` routes `test()` to it — and nothing else yet.
- Engine version pinned in `dagger.json`; module on the Node runtime.
- The *same* `bun run check:test` is what the play will invoke as an andon gate
  later — confirm the command works standalone first.

Everything else — `lint`, `typecheck`, `consistency`, parallel DAG composition,
keep-warm tuning — generalizes out of this one clean gate. Get one gate honest
before adding a second.

---

## Verify on the machine before committing the stack

Two things moved recently and are load-bearing; confirm rather than assume:

1. **Current Dagger engine cold-start on the Node runtime** — decides whether
   keep-warm is mandatory or merely nice for the per-increment trigger model.
2. **Whether Bun-as-runtime has stabilized** — but build Node-orchestrator-first
   regardless; treat Bun-runtime as a later opt-in, not a day-one dependency.

### Measured (2026-06-18)

- Dagger CLI **`v0.21.4`** verified operational end-to-end (Docker daemon up →
  engine provisioned → ran an `alpine` container → returned output). **Pin
  `v0.21.4`** in `/ci/dagger.json`.
- **Cold-start `connect` ≈ 18.4s.** That's heavy per-increment across a
  fast-committing fleet → **keep-warm is mandatory**, not merely nice. Build the
  trigger model around a warm engine from the start.
- An upgrade `v0.21.4 → v0.21.7` is available; treat as a *reviewed* bump, not a
  casual step (the `dagger develop` rule). Stay pinned until deliberately raised.
