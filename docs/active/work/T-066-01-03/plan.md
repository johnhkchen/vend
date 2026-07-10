# T-066-01-03 — materialize-contract-body — Plan

Ordered steps, each independently verifiable; steps 1–3 are each atomic-committable, with the
expectation of landing as one or two commits at the end (house habit: a ticket-scoped feature
commit). `bun test src/play/materialize.test.ts` is the fast loop; `bun run check` is the gate.

## Step 0 — Baseline (no commit)

- `bun test src/play/materialize.test.ts` and `bun run check` green before touching anything, so
  any red later is mine. Record the pass count.
- Capture today's exact `renderTicketFile(ticket())` and `renderStoryFile(story())` output bytes
  (a throwaway script or REPL print) — raw material for the goldens in steps 1 and 3.

**Verify**: baseline green.

## Step 1 — Pin the frozen surface first (ticket byte-golden)

In `materialize.test.ts`, inside the existing `renderTicketFile` describe, add
`test("full-file golden — the byte-identical bar for T-066-01-03")`: `expect(body).toBe(...)`
with the step-0 captured bytes as an inline template literal (watch backtick/`${` escaping in the
literal; the body contains no backticks today, so this is plain).

**Verify**: suite green against the **unmodified** renderer — proving the golden encodes *today*,
not the post-change output. This is AC2 made executable before the risky edit exists.

## Step 2 — Rewrite the story renderer in `materialize.ts`

Per structure.md, in one edit:

1. Amend the module header comment (contract body + cutDate-as-parameter purity note).
2. Add the private `── story contract body ──` section: `STORY_SECTION_LABELS` (or the simpler
   local shape if one falls out — golden is the contract), `dagBlock(s, storyTickets)`.
3. Widen `renderStoryFile(s, storyTickets, cutDate)` and assemble the body chunks:
   pre-DAG bold sections (present-only) → `## DAG` + fenced block + optional wave-rationale
   paragraph → optional out-of-slice → `---` + footer with count and `cutDate`.
4. The `materialize` hunk: compute `cutDate` once (`new Date().toISOString().slice(0, 10)`),
   filter `storyTickets` per story, pass both.

**Verify**: `tsc` clean via `bun run build` (or the check's typecheck); the two pre-existing
story-frontmatter tests in this file now FAIL TO COMPILE at their call sites — expected, fixed in
step 3 (steps 2+3 land together in the commit; they are separate here so the diff is reviewed as
"renderer change" vs "test change").

## Step 3 — Update + extend the story tests

1. Mechanical: existing `renderStoryFile` call sites →
   `renderStoryFile(story({...}), [], "2026-07-10")`; assertions untouched.
2. New describe `renderStoryFile — contract body (T-066-01-03)`:
   - **contract golden**: fixture story with all five fields (short single-line values, distinct
     per field so a swapped label is visible) + three `TicketDraft`s:
     `T-009-01` (no deps), `T-009-02 ← T-009-01`, `T-009-03 ← T-009-01, T-009-02` (the
     two-parent join); `s.tickets` lists all three in order. `toBe` against the hand-authored
     golden literal (write it from the design's layout, then reconcile against actual output —
     any mismatch must be *explainable* before the golden is edited to match).
   - **degraded golden**: `story()` defaults + one ticket → frontmatter + DAG + footer only.
   - **edge fidelity**: `depends_on: ["T-008-77"]` (outside the story) appears verbatim after
     `←`; an `s.tickets` id with no matching draft renders as a bare-id line.
3. Sanity: confirm no OTHER file asserts on story bodies (research: none do) — rerun the two
   adjacent suites that feed contract-less stories through `materialize`
   (`chain-propose-decompose.test.ts`, `materialize.test.ts` collision describe) to prove D2's
   degrade keeps them green.

**Verify**: `bun test src/play/materialize.test.ts` fully green; then
`bun test src/play/chain-propose-decompose.test.ts` green.

## Step 4 — Eyeball the artifact (the look-and-feel bar)

Render the contract-golden fixture to a scratch file and read it next to the hand-authored
`docs/active/stories/S-066-01.md`: sections in the same order, DAG block legible, footer honest.
This is the "would a cold lisa worker get the contract from this file alone?" check — a judgment
pass no assertion covers. (Scratchpad only; nothing under `docs/active/stories/` is written.)

**Verify**: subjective pass; adjust wording/spacing only via the goldens if something reads wrong.

## Step 5 — Gate + commit

- `bun run check` (typecheck + lint + full tests) — the real gate.
- Commit the lot as `feat(decompose): materialize writes the story contract body (T-066-01-03)`
  — `materialize.ts` + `materialize.test.ts` only. (If step 1 was committed separately as
  `test(decompose): pin ticket render bytes...`, this commit is steps 2–4.)

**Verify**: check green; `git show --stat` touches exactly the two planned files.

## Testing strategy summary

| Layer | What | How |
|---|---|---|
| Frozen surface (AC2) | ticket render bytes | full-file `toBe` golden authored pre-change (step 1) |
| New surface (AC1) | contract body bytes | inline golden, all five sections + DAG + footer, fixed `cutDate` |
| Degrade (D2) | shell story shape | second golden: frontmatter + DAG + footer |
| Edge honesty (D3) | external dep, missing draft | targeted `toContain` assertions |
| Integration | `materialize` verb, real fs | existing collision + chain suites, unchanged, must stay green |
| Whole repo | everything else | `bun run check` |

Deliberately NOT tested: the live decompose cast (story's honest boundary — fixture-proven and
FREE only), `cutDate`'s wall-clock value inside `materialize` (impure verb stays untested, house
pattern; its logic is the tested render pair).

## Risks & fallbacks

- **Golden brittleness**: any future wording tweak breaks two goldens. Accepted — byte-exactness
  is the AC, and the goldens are the single place to update.
- **`s.tickets.length` vs rendered lines**: footer count uses `s.tickets.length` (unchanged
  semantics); a mismatch with `storyTickets.length` is *visible* in the file (count vs DAG lines)
  rather than hidden — consistent with derive-don't-duplicate.
- **Escaping in golden literals**: the body now contains backticks (footer) and `##` headings —
  in a TS template literal only backticks and `${` need escaping; one `\`` pair in the footer
  line. If it gets noisy, fall back to `String.raw` or an array-join golden. Never a fixture
  file (house pattern: inline).
- **Sibling-wave collision**: T-066-01-02 and -04 touch disjoint files by design; if an
  unexpected overlap appears (e.g. a gate test importing the renderer), stop and surface rather
  than merge-wrestle.
