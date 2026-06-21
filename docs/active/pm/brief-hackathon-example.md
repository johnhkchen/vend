# Brief — Hackathon driveable example (the recommended pull, prepped)

> **Build-ready PM brief** for `proposed-batch.md` #1 (Frontier 7 continuation cycle). Elaborates
> X-1 from `onboarding-examples-discovery.md` + `PRD-distribution-onboarding.md` into a buildable
> spec, grounded in the just-shipped `vend init` (E-040). Desk-only artifact; the actual
> `examples/` tree is built by the clearing play on pull (the PM writes only to `pm/`).

## One-line intent

A copy-and-drive template that turns a **one-line seed of an idea** into a real demand board + a
first cleared slice in **one short session** — the experiential proof that you *design* the loop
instead of sitting in it. Pairs a builder with a PM/designer.

## What gets built (two pieces)

### A. `vend init --template <name>` — a thin extension of E-040 (signal X-0)

`vend init` today writes the base `SCAFFOLD_MANIFEST` (write-if-absent, never clobber, refuses if
not a lisa project, board starts empty). The extension:

- Add an optional `--template <name>` arg to the CLI (`parseArgs` → `{ cmd: "init", template?: string }`).
- After the base scaffold applies, **overlay the named template's files** from a bundled template
  set, reusing the *same* converge planner (write-if-absent, never clobber, reported as DATA).
- Unknown template name → a clean refusal with the list of available templates (mirror the
  `not-lisa` refusal shape — DATA + fix-it hint + non-zero exit).
- Keep the **honest-empty invariant**: the overlay adds structure + a tuned charter + a `SEED.md`,
  **never demand**. The board still starts empty; the first move is a cast (IA-3/IA-4).

*House pattern:* pure core decides the overlay plan (`planTemplate(existing, base, overlay)`), the
effect writes. Same pure-core/effect split as `init-core.ts`/`init-effect.ts`.

### B. `examples/templates/hackathon-seed/` — the template content

```
examples/templates/hackathon-seed/
  README.md            # the two-gesture "drive" script (copy → init → seed → steer → work)
  SEED.md              # the ONE thing the user edits — a one-line idea + the pair (builder + PM/designer)
  charter.md           # a charter TUNED to hackathon values (the value function the demo is judged on)
  shelf-note.md        # which plays to reach for first (survey/steer → board; work → clear)
  EXPECTED-OUTCOME.md  # the gold-mastered "good drive" — what a successful session yields
```

- **`SEED.md`** — a filled example seed (e.g. *"A web app that helps solo hackathon-goers find a team
  by skill + idea overlap"* + "Driver: a dev; Partner: a designer"), with a one-line "replace this
  with your idea" instruction. The seed is the *only* input the user authors.
- **`charter.md`** — a hackathon-tuned value function: **speed and a demonstrable slice over polish**;
  *valuable* = advances a runnable demo; right-sized to a session; gates kept light but real. It
  teaches the *general* clearing move while being honestly domain-specific.
- **`shelf-note.md`** — points the pair at the shipped articulation trilogy: `vend steer` (or
  `survey`) to read the seed → propose a ranked board + the real forks; then `vend work` to clear the
  first slice against a budget.
- **`EXPECTED-OUTCOME.md`** — the golden master: a coherent ranked board off the seed, a handful of
  genuine forks, and ≥1 cleared slice — the re-runnable bar (the product-level consistency probe).

## The drive (the user's path)

```
cp -r examples/templates/hackathon-seed my-hack && cd my-hack
lisa init                    # (if not already a lisa project)
vend init --template hackathon
vend doctor                  # green?  deps OK (lisa, claude, BAML)
$EDITOR SEED.md              # write your one-line idea
vend steer                   # → ranked board + the real forks, off your seed
# answer a few forks, review the board
vend work --budget <...>     # clear the first slice, gated
```

## Acceptance criteria

1. `vend init --template hackathon` scaffolds the base + overlay, idempotently (re-run → zero
   clobber), and refuses cleanly on an unknown template or a non-lisa root.
2. The scaffolded project passes **`vend doctor` clean**.
3. Driving the shipped seed through `vend steer` yields a **coherent ranked board + genuine forks**
   (not junk, not self-referential — see risks).
4. `vend work` clears **≥1 slice**, producing a real run-log record.
5. The drive is **comparable to `EXPECTED-OUTCOME.md`** (the gold master) — re-runnable for
   consistency.
6. The cleared run **accrues a genuine forward-E1 record** (feeds the Frontier 1 cadence — the
   built-in second payoff).

## Dependencies & risks

- **Dep — `vend init --template` (A).** Thin extension of E-040; do it first (it's also X-0, the
  seam every example reuses).
- **Risk — steer on a fresh seed (assumption A3).** `vend steer`/`survey` were authored against the
  vend repo; this example is the **first real test** that they produce a useful board off a *thin
  domain seed*. The **steer self-referential-demotion** signal (surfaced by E-037/E-039, loop may
  auto-pull) directly de-risks AC#3 — without it, steer may rank the template's own scaffolding as a
  target. Sequence that fix before/with this example.
- **Risk — charter tuning.** Too generic and the demo is flat; too specific and it stops teaching the
  general move. Calibrate on the first real drive.

## Scope split (v1 vs later)

- **v1 (this pull):** the `--template` extension + the single `hackathon-seed` template + one
  gold-mastered drive. The minimal end-to-end proof.
- **Later:** more seeds; wiring `EXPECTED-OUTCOME.md` into the `src/probe` consistency layer as a
  CI-gated product regression; the small-business (X-2) and figma (X-3) templates reusing the same
  `--template` seam.

## Verify on the machine before/at build (go-and-see)

1. Does `vend steer` off the shipped `SEED.md` actually produce a coherent board? (The make-or-break
   demo moment — A3.)
2. Does `vend init --template` compose with the base manifest without clobber across re-runs?
3. Does a copied template survive `vend doctor` clean from a fresh clone?
