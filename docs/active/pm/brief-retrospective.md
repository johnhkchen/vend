# Brief — Retrospective + capture fixes (the E-061 build spec)

> **Build-ready PM brief** for E-061, the deliberate retrospective that opens the kitchen-dogfood phase.
> Looks **back** on the E-055→E-060 arc (visual surface → channel proof → fresh-seed clear) and **forward**
> to what the kitchen dogfood (E-062/E-063, `pm/plan-kitchen-dogfood.md`) demands — capturing grounded
> fixes + gaps as ranked demand signals. Desk-only; the captured batch stages to `proposed-batch.md`,
> promotion stays a human pull. On pull this becomes **E-061**.

## One-line intent

A deliberate retrospective on the recent build arc that captures the **grounded fixes and forward gaps**
the auto-drain misses — turning lived friction (run-log, work artifacts, git, go-and-see) into a ranked,
pullable batch that founds the kitchen-dogfood phase.

## Why now

The arc E-055→E-060 shipped fast (the SVG surface, the non-dev channel proof, the fresh-seed clear), and
the kitchen-dogfood planning (E-062/E-063) just surfaced concrete prerequisites. The loop **auto-drains
tactical correctness fixes**, but the **bigger patterns and forward gaps** want a deliberate capture — and
several are already *evidenced*, not speculative. E-061 grounds the install / EmDash-drive / headless gaps
that E-062/E-063 depend on.

## What gets produced

### A. Backward capture — fixes/findings from the E-055→E-060 arc (grounded)

Read the real evidence: `.vend/runs.jsonl`, the `work/<ticket>/review.md` "open concerns" sections, git
history, accrued go-and-see friction. Already-evidenced items to fold in (not exhaustive):

- **Loop commit-consistency (FRESH — surfaced this session).** lisa's E-060 loop left work **incompletely
  committed**: T-060-01-02's implementation (run-log/cast reduced-grounding marker) + the E-060
  epic/story/ticket files + some `work/` review artifacts were **never committed**, while *later* tickets
  were. "Done" (phase) diverged from "committed" — a direct hit on the verify-git discipline. A real
  board-hygiene fix (loop commit serialization / board-file commit on mint).
- **Fresh-device operability gaps (this session).** The transferred repo couldn't notify (dead Doppler
  token → no `LISA_NTFY_TOPIC` → silent `on-notify`), and casts failed under Doppler — fixed, but the
  *pattern* (secrets/keyring don't survive transfer) is a capture for the install story.
- The E-058/059/060 review-artifact "open concerns" — the three A3 findings (#1/#2/#3, now addressed by
  E-059/E-060) plus any residual (e.g. `EXPECTED-OUTCOME` → `src/probe` consistency wiring still un-done).

### B. Forward capture — gaps the kitchen dogfood surfaces (grounded by the plan)

- **No end-user install path** → founds **E-063** (brew + make-a-workspace).
- **vend can't yet drive an EmDash / Astro-6 project** → founds **E-062** (the seed; the A3-for-EmDash risk).
- **Headless operability when the human is remote from the dir** — notifications-as-status, the SVG board
  as the glanceable read, budget/andon legible in a diff/PR review.

### C. The output — a ranked, pullable batch

A small ranked batch staged to `proposed-batch.md` (PE-6 un-elaborated signals). The loop auto-drains the
tactical ones (e.g. the commit-hygiene fix); the strategic ones (install, EmDash-drive) become epic pulls.
Honest-empty if the gradient is flat (IA-4).

### D. (Candidate, not prerequisite) a `vend retrospect` play

The juicy dogfood: vend reading its own `runs.jsonl` + `work/` + git history to **stage fixes
automatically** (advances P3/measurement). Surface it as a candidate the retro *produces* — don't block the
phase on building it.

## How it's run

A **desk retrospective cycle** — raise the process-gate with a retro focus, read the evidence, synthesize
the batch, lower the gate. Free/deterministic (no metered cast); the deliverable is the retrospective
artifact + the staged batch. (If pulled as a lisa epic instead, the deliverable is identical: the retro
doc + the captured signals.)

## Acceptance criteria

1. A grounded retrospective on E-055→E-060 is produced — citing real evidence (`.vend/runs.jsonl`, `work/`
   review artifacts, git history, go-and-see friction), not assumptions.
2. Backward fixes captured as ranked signals — **including the loop commit-consistency finding**.
3. Forward gaps for the kitchen dogfood captured + explicitly linked to **E-062 / E-063**.
4. The batch is staged to `proposed-batch.md` (desk); strategic-only (tactical auto-drained); honest-empty
   if flat; promotion stays a human pull.
5. The `vend retrospect` play is recorded as a candidate (not built).

## Dependencies & risks

- **Reads** the run-log + work artifacts + git (all present).
- **Board cleanup first.** The E-060 incompletely-committed state should be resolved so the retro looks
  back on a **clean, committed** board (and so E-059/E-060 can be honestly swept). The retro *names* this
  finding; the cleanup *acts* on it — do the cleanup before/at the start of this pull.
- **Risk — scope creep.** Keep it to the recent arc + the kitchen-forward gaps; not a full-history audit.

## Scope split (v1 vs later)

- **v1 (this pull):** the desk retrospective + the captured/staged batch.
- **Later:** the `vend retrospect` play (automate the capture); wiring `EXPECTED-OUTCOME` → `src/probe`.

## Verify on the machine (go-and-see)

1. Read the actual `.vend/runs.jsonl` + the E-058/059/060 `work/*/review.md` "open concerns" — are the
   captured fixes real?
2. Confirm the E-060 commit-state finding against `git status` / `git log` (reproducible right now).
3. Re-confirm the kitchen-forward gaps against `pm/plan-kitchen-dogfood.md` + `pm/brief-kitchen-emdash.md`.
