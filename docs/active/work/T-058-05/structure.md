# T-058-05 — Structure: files, sandbox shape, boundaries

This ticket is a **drive + capture**, not a code change. The "structure" is therefore (a) the one
committed file it writes, (b) the ephemeral sandbox tree the drive builds and discards, and (c) the
module boundaries the drive must not cross.

## Committed changes (the only files that change in the repo)

| File | Op | What |
| --- | --- | --- |
| `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` | **modify** | Fill the "Actual (live)" column from the real run; add the drive-log/verdict + re-run commands; reframe the TARGET banner to CAPTURED. The single product deliverable. |
| `docs/active/work/T-058-05/{research,design,structure,plan,progress,review}.md` | **create** | The RDSPI trail (this set). |

**No `src/` changes.** No new gestures, no renderer, no registry edits. If the drive surfaces a seam
bug (e.g. the charter-path mismatch warranting a `TEMPLATE_REGISTRY` wiring change), that is a
**follow-up ticket**, recorded in the verdict — not done here. This keeps the ticket honest: it
*measures* the shipped artifact; it does not change it to make the measurement pass.

## The ephemeral sandbox tree (created, used, discarded)

Built under `$TMPDIR/vend-seed-drive-<n>/` (outside the repo). Never committed.

```
vend-seed-drive-<n>/
├── CLAUDE.md / .lisa.toml        # from `lisa init` — makes it a lisa project (init precondition)
├── SEED.md                       # the seed's team-finder idea (copied; init no-clobber skips its stub)
├── charter.md                    # the seed's TUNED charter at ROOT (steer does NOT read here — see below)
├── shelf-note.md, README.md, …   # the seed's drive docs (copied)
├── src/ astro.config.mjs …       # the Astro app (copied; not needed for the vend casts)
├── docs/                         # CREATED by `vend init --template hackathon`:
│   ├── active/demand.md          #   empty board (honest-empty)
│   ├── active/pm/staged/         #   steer.md / survey-board.md land here when cast
│   ├── active/{epic,stories,tickets,work}/   # empty (so the snapshot is seed-only)
│   └── knowledge/charter.md      #   the init CHARTER_STUB — what steer ACTUALLY reads
├── .vend/                        # runtime state: runs.jsonl, work-graph.svg, transcripts/
└── drive-logs/                   # stdout/stderr of each backgrounded cast (our capture, not vend's)
```

The two-charter situation is explicit in the tree: the **tuned** charter is `./charter.md`; the one
**steer reads** is `docs/knowledge/charter.md` (the stub written by init). The drive does not
reconcile them (design Decision 3) — it records the gap.

## Ordering of the drive (the steps, in dependency order)

1. **Sandbox** — `mkdir` tmpdir; `cp -R` the seed dir (excluding `node_modules/.astro/.vend`).
2. **Lisa-ify** — `lisa init` in the sandbox (or `touch .lisa.toml`/`CLAUDE.md` if `lisa init` needs
   interactivity) so `runInit` accepts it.
3. **Init** — `vend init --template hackathon`; assert the create/skip tally (SEED.md skipped =
   no-clobber held; the base tree created).
4. **Doctor** — `vend doctor`; assert exit 0 (green). Gate: red ⇒ stop, record unfit-env, spend $0.
5. **SVG (empty)** — `vend svg`; confirm `.vend/work-graph.svg` written + renders honest-empty.
6. **Steer (METERED)** — `vend steer --budget 600000,150000` in background → poll → capture the
   receipt, `runs.jsonl`, and `docs/active/pm/staged/steer.md` (board + forks).
7. **SVG (populated)** — `vend svg` again; confirm the work-graph now reflects the staged board.
8. **Work (METERED)** — `vend work --budget 900000,250000 --no-intervened` in background → poll →
   capture the receipt (cleared count, per-cast cost, stop reason) + the new `runs.jsonl` records
   (forward-E1 `intervened:false`).
9. **Capture** — write the real numbers into the committed `EXPECTED-OUTCOME.md`; settle the verdict.
10. **Teardown** — leave the sandbox in place for the session (for re-inspection), note its path;
    nothing copies back except EXPECTED-OUTCOME.md content.

Steps 1–5 are **free**; the metered spend (6, 8) is gated behind a green 1–5.

## Module boundaries the drive must respect (read-only over them)

- **One-way authority.** `vend svg` writes only `.vend` (never `docs/active`); `steer`/`survey` stage
  under `docs/active/pm/staged/` (never the live board). The drive observes these outputs; it never
  hand-edits the staged board or the live board to improve the master.
- **Executor seam.** The drive uses the default `claude` executor (no `VEND_EXECUTOR` override). It
  does not stub or fake the executor — "metered, not a free proof" means the real `claude -p`.
- **Budget as contract (P7).** The drive funds explicit budgets and lets the casts stop themselves;
  it does not raise a budget mid-cast to force a clear.
- **Committed template immutability.** Nothing under `examples/templates/hackathon-seed/` except
  `EXPECTED-OUTCOME.md` is touched; verified by `git status examples/` at the end.

## Capture format inside EXPECTED-OUTCOME.md

The existing file already has the right skeleton. Edits, in place:

- Replace the top TARGET ⚠️ banner with a CAPTURED note (date `2026-06-21`, sandbox path, exact
  commands, the executor/host).
- Fill the table's "Actual (live)" cells: board items, forks framed, slices cleared, budget spent
  (ms,tokens), forward-E1 accrued.
- Replace the `_Notes from the live run…_` placeholder with: a verbatim fork sample, the staged
  board summary, the slice cleared (or the honest finding), and the SVG note.
- Append a short **Verdict** subsection: the A3 call (coherent / weak / not-runnable-here), the
  charter-path observation, and the re-run command block so the master is re-runnable.

## What is intentionally NOT structured here

- No test files (no code to test; the seed is outside vend's `tsconfig` `include: ["src"]`, the
  T-058-03/04 precedent).
- No changes to `src/init`, `src/play/steer.ts`, or `src/present` — observations about them are
  verdict notes pointing at follow-up tickets, not edits.
