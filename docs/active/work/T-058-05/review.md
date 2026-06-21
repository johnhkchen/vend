# T-058-05 — Review: gold-master live drive on the seed

Handoff for a human reviewer. This ticket ran the **first live metered drive** of the hackathon seed
end-to-end and captured the gold master. It is honest-on-outcome: the drive surfaced that the
*shipped* two-gesture flow does **not** yet produce a coherent board, isolated exactly why, and proved
the underlying engine is sound. **No `src/` code changed** — the deliverable is a captured artifact +
the RDSPI trail.

## What changed

| File | Change |
| --- | --- |
| `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` | **modified** — the TARGET stub is now the **captured gold master**: the A3 verdict, the real board/forks/slice numbers, the three findings, and a re-run block. The single product deliverable. |
| `docs/active/work/T-058-05/{research,design,structure,plan,progress,review}.md` | **created** — the RDSPI trail. |

`git status examples/` shows **only** `EXPECTED-OUTCOME.md` — the committed template was not mutated;
the drive ran in a throwaway tmpdir sandbox.

## The drive, and its outcome

Real `claude -p` casts (executor `claude`, model `claude-opus-4-8`), **$0.91 total**, in a sandbox
copy. Free preflight all green: `lisa init` → `vend init --template hackathon` (11 created / 7
skipped, no-clobber held, board honest-empty) → `vend doctor` (4/4 green) → `vend svg` (valid
honest-empty SVG).

**Headline (A3):** the shipped flow yields an **honest-empty steer** — no board, no forks. Root
cause, pinned in code: `assembleSteerInputs` (`src/play/steer.ts:109`) feeds steer the
`docs/knowledge/charter.md` **stub** + an empty board snapshot; `SEED.md` is never in steer's input
path. The seed's docs promise steer reads the seed; the implementation doesn't. The E-044
self-referential-demotion fix **held** (steer abstained honestly; it did not rank scaffolding as
junk).

**Machinery proven (diagnostic):** with the seed intent placed where steer reads it, steer staged a
**coherent 4-signal board (Keystone→Leaf, every signal grounded in `SEED.md`) + 2 genuine forks**, and
`vend work` minted a real grounded epic **E-001 team-finder-match-page** (propose-epic cleared, all
gates passed, **forward-E1 record** `intervened:false`). The decompose step then refused with a clean
**`missing-capability: codebase-memory-mcp`** andon (absent in a fresh sandbox).

## Acceptance criteria — honest status

- **AC1 — real live drive; doctor green; coherent board OR weak-board A3 finding recorded; work
  clears ≥1 slice + run-log + forward-E1.** Drive ran (sandbox; committed template untouched). Doctor
  green. The **weak-board A3 finding is recorded honestly** (shipped flow ⇒ empty steer) AND the
  coherent board is demonstrated under a labeled diagnostic. `vend work` cleared **1 cast**
  (propose-epic/E-001) with a run-log record + **forward-E1** records; the **full** slice
  (epic→stories→tickets) did **not** complete (decompose andon). **Partially met, honestly.** ⚠️✅
- **AC2 — `EXPECTED-OUTCOME.md` filled from the real run + a settled verdict.** Done — captured
  numbers, the A3 verdict, three findings, a re-run block. ✅
- **AC3 — the SVG board renders the seed's work-graph.** The renderer is confirmed end-to-end (valid
  SVG on the empty board; it loads the live graph and sees E-001). It shows 0 cards because the
  work-graph renders decomposed *slices* and none were decomposed (the andon). Visual path confirmed;
  nothing populated to draw. ⚠️✅

## Test coverage

- **No automated tests** — by design. There is no code to test; the deliverable is a captured
  artifact (the T-058-03/04 precedent: the seed is outside vend's `tsconfig include:["src"]`). The
  correct gates are the per-step CLI assertions (real exit codes / output / run-log), all recorded in
  `progress.md`.
- **Vend's own suite:** `bun run check:typecheck` clean; `bun test` **1313 pass / 0 fail** — unchanged
  from the pre-drive baseline (this ticket adds only markdown). ✅
- **Re-runnability** (the product-level test) is encoded in the EXPECTED-OUTCOME re-run block.

## Open concerns / flags for a human

1. **The shipped seed is not yet drivable end-to-end (the A3 result, the load-bearing flag).** Three
   small **seed/seam** fixes — recorded in the gold master — close the gap, each a follow-up ticket:
   - **(a) Input wiring:** overlay the tuned charter (incl. the seed idea) to
     `docs/knowledge/charter.md` in `TEMPLATE_REGISTRY` (`src/init/init-core.ts`), or make
     `steer`/`survey` read `SEED.md`. **Highest priority** — without it the two-gesture drive yields
     an empty steer.
   - **(b) Budget shape:** the cold-start chain prices at ~120 min on the time axis; a tight
     `--budget` time funds nothing (IA-8). The seed's drive script should fund the 2 h default or
     document the price.
   - **(c) MCP capability:** the clearing chain requires `codebase-memory-mcp`; a fresh seed lacks
     it. Wire a `.mcp.json` into the template, or make the chain degrade for non-vend projects.
2. **This ticket deliberately made no `src/` change.** It *measures* the shipped artifact. Whether to
   fix (a)/(b)/(c) here or in follow-ups is a scoping call for the human — the evidence is captured.
   My recommendation: separate tickets, since (a) and (c) touch `src/init` and the MCP wiring
   respectively and each deserves its own gate.
3. **Diagnostic honesty.** The coherent board was produced under a *modified* charter path, clearly
   labeled "diagnostic, not the shipped flow" in both `progress.md` and the gold master. It is **not**
   presented as the shipped outcome — that distinction is the whole point of the honest verdict.
4. **Sandbox left in place** at `/var/folders/8w/…/T/vend-seed-drive-dnex` for re-inspection this
   session; it is a tmpdir and not committed.

## Bottom line

The drive did its job as the make-or-break A3 test: it caught — before any user did — that the
shipped seed produces an empty steer, pinned the cause to input wiring (not the engine), proved the
articulation engine produces a genuinely coherent board + real forks + a grounded epic on a thin
non-vend seed, and captured all of it into a re-runnable gold master. The honest verdict, not a
papered-over green, is the deliverable.
