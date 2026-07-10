# T-066-01-03 — materialize-contract-body — Progress

All plan steps complete. Landed in commit `3150c51`
(`feat(decompose): materialize writes the story contract body (T-066-01-03)`), on `main`.

## Step log

- **Step 0 — Baseline** ✅ `materialize.test.ts`: 9 pass / 0 fail before any edit. Captured the
  exact current `renderTicketFile(ticket())` and `renderStoryFile(story())` bytes via a
  scratchpad script (`capture.ts`) — raw material for the goldens.
- **Step 1 — Ticket byte-golden first** ✅ Added the full-file `toBe` golden to the
  `renderTicketFile` describe and ran it green against the **unmodified** renderer
  (10 pass / 0 fail) — AC2 made executable before the risky edit existed.
- **Step 2 — Renderer rewrite** ✅ `materialize.ts`: header comment amended (contract body +
  cutDate purity note); new private `PRE_DAG_SECTIONS` table (`satisfies` pin on
  `keyof StoryDraft`) and `dagBlock()` helper; `renderStoryFile(s, storyTickets, cutDate)`
  widened and body assembled as blank-line-joined chunks; `materialize` hunk computes `cutDate`
  once per run and filters `storyTickets` per story. Ticket renderer, alias maps, guard, fs
  order: untouched.
- **Step 3 — Tests** ✅ Two existing story call sites updated mechanically (`[], "2026-07-10"`),
  assertions unchanged. New describe `renderStoryFile — contract body (T-066-01-03)`: contract
  golden (all five sections, three tickets incl. a two-parent join, `toBe` byte-exact), degraded
  golden (contract-less `story()` → frontmatter + DAG + footer only), edge-fidelity test
  (external `← T-008-77` verbatim; missing draft → bare-id line). `materialize.test.ts` +
  `chain-propose-decompose.test.ts`: 16 pass / 0 fail.
- **Step 4 — Eyeball** ✅ Rendered the contract fixture to the scratchpad and read it against
  the hand-authored `S-066-01.md`: same section order, legible DAG, honest dated footer. No
  wording/spacing adjustments needed.
- **Step 5 — Gate + commit** ✅ `bun run check` green: **1524 pass / 1 pre-existing skip /
  0 fail** across 103 files (baseline was 1520 — the +4 are this ticket's tests). Committed
  `3150c51`, exactly `src/play/materialize.ts` + `src/play/materialize.test.ts`
  (+201/−6).

## Deviations from the plan

- None of substance. The one anticipated flex was taken: `STORY_SECTION_LABELS` landed as the
  simpler `PRE_DAG_SECTIONS` (three pre-DAG rows only), the shape structure.md explicitly
  allowed — `waveRationale`/`outOfSlice` placement is owned by the render function, and the
  golden, not the table, is the contract.
- Steps 1–5 landed as a single commit rather than step 1 separately — plan named this as the
  expected outcome ("one or two commits").

## Acceptance criteria status

- **AC1 (contract golden)** ✅ byte-exact golden with all five sections, DAG consistent with
  `depends_on` (incl. two-parent join), provenance footer.
- **AC2 (ticket bytes identical)** ✅ pinned by a golden authored from the pre-change renderer
  and still green post-change; ticket code path untouched by the diff.
