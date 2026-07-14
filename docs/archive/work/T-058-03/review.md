# T-058-03 — Review

Handoff document. What changed, how it was verified, and what a human reviewer needs to know.

## Summary

Layered the **vend drive wiring** into `examples/templates/hackathon-seed/` — the five
markdown files that turn the T-058-02 Astro + React + Cloudflare scaffold into a copy-and-
drive vend project, centered on the designer's *visual* path. No source code changed; this is
a documentation/content ticket. Committed at **757560e**.

## Files created (5 seed files + 6 work artifacts)

Under `examples/templates/hackathon-seed/`:

| File | What it is |
| --- | --- |
| `README.md` | The hero — a designer-legible drive script. Leads with **What you'll see** (an ASCII work-graph board: READY/IN-PROGRESS/BLOCKED/DONE columns + a red blocked edge, framed as the picture `vend svg` draws), then the 7-line annotated drive, a gesture table, sibling links, and honest boundaries. |
| `SEED.md` | The one authored input — a filled team-finder idea (a page for *this* Astro app), the `✏️ Replace this with your idea.` line, the pair (driver: dev / partner: designer), and an intent-not-demand note. |
| `charter.md` | A hackathon-tuned value function mirroring vend's charter spine: clearing-move framing, 5 tuned criteria (Demo-advancing / Grounded / Session-sized / In-bounds / Showable), the one-line value (*a demonstrable runnable slice over polish*), 3 light-but-real gates (H1–H3), out-of-bounds, one-page amendment rule. |
| `shelf-note.md` | Which play first, in drive order: `vend shelf` as the live menu; survey-vs-steer (steer first on a fresh seed); `work` with the 2h/2M default; `svg --seat designer`; the doctor→steer→work→svg recap. |
| `EXPECTED-OUTCOME.md` | A **target** stub (loud TARGET banner): "a good drive yields" + a `FILLED BY T-058-05` table (board items / forks / slices / budget / forward-E1) + the why. T-058-05 captures the live numbers. |

Under `docs/active/work/T-058-03/`: `research.md`, `design.md`, `structure.md`, `plan.md`,
`progress.md`, and this `review.md` (the RDSPI trail).

No files modified or deleted. `README-STACK.md` (T-058-02) already deferred the drive script
to this `README.md`, so no edit was needed there.

## Acceptance criteria — status

- ✅ **Seed carries README/SEED/charter/shelf-note/EXPECTED-OUTCOME.** All five present, each
  matching its brief'd role.
- ✅ **README drive is designer-legible, SVG board is the centerpiece, gestures match the
  shipped CLI.** The board sketch leads the file under "What you'll see"; every gesture string
  (`init --template hackathon`, `doctor`, `steer`, `survey`, `work`, `svg`, `shelf`) was
  cross-checked against `src/cli.ts` USAGE, and budgets use the exact `<ms>,<tokens>` shape.
- ✅ **Honest-empty held; self-contained under `examples/`; gate unaffected.** `grep` confirms
  no `E-/S-/T-` board items seeded (only forward-pointer refs to the T-058-05 spec in
  EXPECTED-OUTCOME.md). `bun run check` green at **1295 pass / 0 fail** both before and after —
  identical, proving the markdown additions are inert (`tsconfig` `include: ["src"]`, no test
  files in `examples/`).

## Verification

- **Gate:** `bun run check` (baml:gen + typecheck + test) green before (1295/0) and after
  (1295/0). Precommit hook also green on commit.
- **Honest-empty:** `grep -rEn '\b[EST]-[0-9]{3}'` over the five files → only spec
  forward-refs, no seeded demand.
- **Gesture spelling:** every `vend …` string in the five files matched against the cli.ts
  USAGE banner.

## Test coverage

No new unit tests — there is no code to test. The correct gate for a content/scaffold ticket
is "vend's build is unaffected" (verified, gate green and unchanged) plus the content/
honest-empty audit (verified). This mirrors the T-058-02 precedent. **Gap, by design:** the
*behavioral* proof — that `vend steer`/`work` actually produce a coherent board off this thin
seed — is the A3 make-or-break and belongs to the metered **T-058-05** live drive, not here.

## Open concerns / flags for a human

1. **`vend init --template` is documented but not yet shipped.** It's the T-058-01 seam
   (still `open`, running concurrently — T-058-03 depends only on T-058-02). The README states
   it plainly as the canonical entry (it *is* the spec T-058-01 implements) and frames it
   honestly as "the wiring seam" without claiming it runs today. **If T-058-01 lands a
   different spelling/flag, sync the two `init --template` lines in README.md and the one in
   shelf-note.md.** Low risk, one-token fix. (Note: the working tree shows T-058-01 has started
   modifying `src/init/init-core.ts` — left untouched by this commit.)
2. **Gesture-drift over time.** The README hard-codes gesture strings; if USAGE changes before
   T-058-05, they go stale. Mitigated by sourcing from cli.ts at write time; worth a re-check
   at the start of the T-058-05 drive.
3. **The ASCII board is illustrative, not real data.** Chosen over a committed `.svg` precisely
   to hold honest-empty (a populated board file would be seeded demand). T-058-04 wires the
   *real* live SVG beside the app; T-058-05 captures a real board into EXPECTED-OUTCOME.md.

## Scope discipline

Committed only the five seed files + the work dir. Left untouched: the pre-existing modified
ticket frontmatter (`process-gate.md`, `T-058-0x.md`) and the concurrent T-058-01 work
(`src/init/init-core.ts`, `docs/active/work/T-058-01/`). Per the workflow, ticket phase/status
fields were not edited — Lisa advances them from these artifacts.
