# T-058-05 — Design: how to run the gold-master drive

The decisions for running a *real, metered, honest* drive of the seed and capturing the gold master.
Grounded in the research: the gestures are all shipped, doctor is green here, and the A3 crux is
whether `steer` yields a coherent team-finder board when its explicit charter input is the init stub
and the real intent must be discovered agentically.

## Decision 1 — Where the drive runs: a tmpdir sandbox seeded by copy

**Chosen:** copy `examples/templates/hackathon-seed/` to a throwaway dir **outside the repo**
(`$TMPDIR/vend-seed-drive-…`), run the whole drive there, and copy back **only** the captured
`EXPECTED-OUTCOME.md`.

- *Rejected — drive in place under `examples/…`:* would create `.vend/`, `docs/active/pm/staged/`,
  `runs.jsonl`, a populated board, etc., inside the committed template. The ticket forbids mutating
  the committed template; `.gitignore` ignores `.vend/` but not the staged board / scaffold tree.
- *Rejected — a git worktree:* heavier, and the sandbox must look like a *fresh user copy* (a bare
  lisa project the user `vend init`s), not a checkout of the vend repo with vend's own
  `docs/active/**` board present (that would pollute steer's project snapshot with vend's real
  tickets — the opposite of a thin non-vend seed). A clean copy of just the seed dir is the honest
  reproduction of the documented user flow.

The sandbox must be made a **lisa project** (`lisa init`, or touch the markers) because `runInit`
refuses a non-lisa root (init-core.ts `isLisaProject`). The drive's step 1 names `lisa init (if
needed)`.

## Decision 2 — Keep the seed copy clean of vend's own board

When copying the seed, **exclude** any `node_modules`, `.astro`, `.vend`, and crucially do **not**
carry vend's `docs/` tree. The seed dir has no `docs/` of its own, so a plain copy of
`examples/templates/hackathon-seed/` is already clean — confirmed by the research file listing (it
has `SEED.md`, `charter.md`, `shelf-note.md`, `README.md`, the Astro app; no `docs/active/**`). This
matters: steer's `buildProjectSnapshot` lists `docs/active/stories|tickets`; we want those **empty**
so the board comes off the seed, not off stray tickets.

## Decision 3 — The charter-path mismatch: observe, do not "fix"

Research established that `steer` reads `docs/knowledge/charter.md` (the init **stub**), while the
seed's tuned `charter.md` is at the sandbox **root**. Two options:

- **(A · chosen) Run the drive as the shipped flow dictates and record what happens.** Do NOT
  pre-copy the tuned charter into `docs/knowledge/charter.md`. The shipped seed + shipped init is
  exactly what a real user gets; if that yields a weak board, that **is** the A3 finding (the seam
  needs the tuned charter wired into the overlay registry, or steer needs to read the root charter).
  This is the honest-on-outcome mandate. The drive is a *test of the shipped artifact*, not a staged
  demo.
- **(B · rejected) Place the tuned charter at `docs/knowledge/charter.md` before steering** so the
  board looks good. This would manufacture a passing gold master that the shipped `vend init
  --template hackathon` cannot reproduce — a non-re-runnable, dishonest master. Rejected outright.

The captured EXPECTED-OUTCOME records both the outcome **and** this seam observation, so a follow-up
ticket (wire the tuned charter/seed into `TEMPLATE_REGISTRY`, or point steer at the root charter) has
the evidence it needs.

## Decision 4 — Budgets: fund modest, explicit envelopes (P7, bounded spend)

- `vend steer --budget 600000,150000` (10 min / 150k tokens) — well under the 400k/40m default
  ceiling, enough for one whole-project read+rank of a *small* seed, and inside a single background
  run we can poll. A steer cast that needs more than 150k tokens on a one-file seed is itself a
  finding.
- `vend work --budget 900000,250000 --no-intervened` (15 min / 250k tokens) — enough to price + cast
  the propose→decompose chain on **≥1** top signal and accrue a forward-E1 record, far under the
  2M/2h default. `--no-intervened` is the honest live self-report for a true walk-away (we do not
  step in mid-sweep); it threads the forward-E1 bit into each chain cast (work.ts:221).

Budgets are **ceilings**, so actual spend is whatever the casts burn — captured as the real "budget
spent" row. Funding small both bounds cost and makes the master re-runnable on a tight envelope.

## Decision 5 — Run long casts in the background, poll to completion

A steer/work cast can exceed a foreground 600 s tool timeout. Run each metered gesture with
`run_in_background` writing stdout+stderr to a log in the sandbox, then poll the log / exit status.
This avoids a false "timeout" that isn't the cast's own budget timeout, and lets us capture the real
receipt (`renderReceipt`: cleared / per-cast cost / remaining / stop reason) and the staged
`steer.md`.

## Decision 6 — Free, deterministic preflight first; gate the metered spend on it

Order the drive so the **zero-model** steps run and are asserted **before** any metered cast:

1. copy → lisa-ify → `vend init --template hackathon` → assert created/skip tally.
2. `vend doctor` → assert **green** (exit 0). If doctor is red, STOP — record the unfit-env finding;
   spend nothing (mirrors `castWork`'s door-preflight).
3. `vend svg` on the **empty** board → confirm it renders honest-empty (the designer's view exists
   pre-drive); this also exercises T-058-04's `/board` read path indirectly.

Only after 1–3 pass do we fund steer/work. This is the cheapest honest failure surface — most ways
the drive can be "not runnable here" (missing dep, init refusal, broken doctor) cost **$0** to find.

## Decision 7 — If nested `claude -p` cannot run here, that is a recorded finding, not a failure

The one genuine unknown (research): whether a nested `claude -p` authenticates and runs inside this
sandbox (no `ANTHROPIC_API_KEY`; relies on the CLI's logged-in creds). The design treats a
steer/work cast that errors at the executor boundary (auth/rate/spawn) as a **first-class recorded
outcome** in EXPECTED-OUTCOME ("live drive attempted; executor unavailable in this environment —
gold master deferred to a human-run drive"), keeping honest-on-outcome. The free preflight (Decision
6) still lands as real, captured evidence.

## Decision 8 — What goes into the gold master

Fill EXPECTED-OUTCOME.md's "Actual (live)" column from the real run: board-item count (from staged
`steer.md`), forks framed (count + a verbatim sample), slices cleared (from the `work` receipt +
`runs.jsonl`), budget spent (real ms/tokens from the receipt), forward-E1 accrued (yes/no, from the
record). Add a short **drive-log / verdict** section: the A3 verdict (coherent vs weak), the
charter-path observation, and the exact commands so the master is **re-runnable**. Keep the loud
"this is now CAPTURED, not a target" reframing of the banner.

## Verification strategy (what "done" means)

- AC1: a real drive ran in a sandbox (committed template untouched, verified by `git status` on
  `examples/`), doctor green, steer staged a board+forks **or** the weak-board/executor finding is
  recorded honestly; work cleared ≥1 slice with a `runs.jsonl` + forward-E1 record (or the recorded
  finding).
- AC2: `EXPECTED-OUTCOME.md` filled from the real run + a settled verdict.
- AC3: the SVG board renders the work-graph (confirmed against the empty board pre-drive, and the
  populated board post-steer if the cast lands).
- Vend's own gate (`bun run check`) stays green — this ticket touches only docs/markdown, so the
  suite is inert to it (the T-058-03 precedent).
