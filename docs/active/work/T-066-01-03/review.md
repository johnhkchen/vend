# T-066-01-03 — materialize-contract-body — Review

Handoff self-assessment. Code landed in commit `3150c51`
(`feat(decompose): materialize writes the story contract body (T-066-01-03)`), on `main`,
`bun run check` green (1524 pass / 1 pre-existing skip / 0 fail, 103 files; +4 tests over the
pre-ticket baseline).

## What changed

**Files modified (2, +201/−6):**

- `src/play/materialize.ts`
  - `renderStoryFile` widened to `(s, storyTickets, cutDate)` and its body rewritten: the five
    contract sections render from the parsed story (**Scope / Story acceptance / Honest
    boundary** above the DAG, **Out of this slice** below; `Wave rationale:` as a paragraph
    inside the `## DAG` section, under the block it explains — the hand-authored `S-066-01.md`
    layout), then a `---` rule and the old provenance line demoted to an italic footer that now
    also says *when*: `_Materialized by Vend's `decompose-epic` play — N ticket(s),
    YYYY-MM-DD._`
  - New private `dagBlock()`: a fenced block, one line per story ticket in `s.tickets`
    (execution) order — `id  title`, plus `  ← deps` from `depends_on` rendered **verbatim**
    (derived projection; the edges stay the single source, external `--after` edges included).
    An id with no matching draft degrades to a bare-id line.
  - New private `PRE_DAG_SECTIONS` table with a `satisfies readonly (readonly [keyof StoryDraft,
    string])[]` pin — a schema field rename fails `tsc` here before any test runs.
  - `materialize` (the impure verb) reads the clock **once** per run and filters each story's
    tickets from the plan; the render pair stays PURE (clock-as-parameter, the work-core
    pattern), which is what makes the goldens byte-exact.
  - Untouched: `renderTicketFile`, alias maps, `IdCollisionError` guard, mkdir/write order,
    public `materialize` signature — so **zero caller files changed** (`decompose-epic.ts`
    compiles and behaves identically around the effect).
- `src/play/materialize.test.ts`
  - Ticket full-file golden, authored from the **pre-change** renderer and green before the
    source edit — AC2 ("byte-identical to today") as an executable pin, not an inference.
  - New describe `renderStoryFile — contract body (T-066-01-03)`: contract golden (all five
    sections, three tickets including a two-parent join, byte-exact `toBe`); degraded golden
    (contract-less story → frontmatter + DAG + footer only); edge-fidelity test (external dep
    verbatim, missing draft → bare id).
  - Two existing call sites updated mechanically; every assertion in them unchanged.

## Acceptance criteria — both met

- **AC1** — golden-file test: contract-shaped parse → story file with all five sections, a DAG
  block consistent with the tickets' `depends_on` edges (join edge `← T-009-01, T-009-02`
  included), and the provenance footer — byte-exact.
- **AC2** — ticket materialization byte-identical: the ticket code path is untouched by the
  diff, and the pre-change-captured golden still passes.

## Design decisions a reviewer should ratify

1. **Absent contract field ⇒ section absent** (never a placeholder, never a throw). The
   completeness gate (T-066-01-02, sibling ticket in this wave) owns refusing shells *before
   the effect*; the writer fabricating text would launder a shell, and throwing would both
   duplicate the gate and break the legitimate contract-less paths
   (`chain-propose-decompose.test.ts` feeds one today). The degraded golden makes this shape
   deliberate and visible.
2. **DAG as adjacency lines, not the exemplar's `├─` tree** — a general story graph (diamonds,
   multiple roots, `--after` edges out of the plan) has no faithful tree drawing; `id  title
   ← deps` is a 1:1 projection of `depends_on` a reader can check against ticket frontmatter.
3. **`cutDate` = day precision (`YYYY-MM-DD`)**, supplied by `materialize`, one clock read per
   run — all stories in one cast carry the same date; purity of the render pair preserved.
4. **Footer keeps the old sentence + count** (`N ticket(s)` from `s.tickets.length`) so the
   demotion is legible against the 30+ historical shell stories, which are NOT backfilled
   (explicitly out of the story's slice).

## Test coverage assessment

- **Strong**: both goldens are byte-exact; the frozen surface (tickets) is pinned from
  pre-change bytes; edge cases with a test each (external edge, missing draft); the two suites
  that push contract-less plans through the real-fs `materialize` verb stay green unmodified.
- **Gap (accepted, house pattern)**: `materialize` itself remains untested for the new wiring
  (the `cutDate` clock read and the `storyTickets` filter) — the impure verb is deliberately
  untested here exactly as `appendRunLog`/`dispense` are; its judgment is the tested render
  pair, and the chain-level test does exercise it end-to-end against a real temp fs.
- **Gap (story-level, not this ticket's)**: no cast-level proof that a *gated* decompose run
  writes contract files — that composition lands when T-066-01-02's gate merges (its AC2 is the
  cast-level test), and the live metered cast is the epic's deferred, human-authorized close.

## Open concerns

1. **Golden brittleness is the contract**: any future wording tweak to the story body breaks
   two goldens by design. The failure message points at the single place to update.
2. **Footer count vs DAG lines**: the count uses `s.tickets.length` (unchanged semantics). If a
   plan ever lists a ticket id with no draft, the DAG shows a bare id while the count still
   counts it — visible in the file rather than hidden, consistent with derive-don't-duplicate,
   but a reviewer might prefer counting rendered drafts instead.
3. **`storyTickets` filter is O(stories × tickets)** via `Array.includes` — negligible at real
   board sizes (≤ dozens); noted only so nobody mistakes it for an oversight.
4. **Parallel-wave interaction**: T-066-01-02 (gate) and -04 (workflow doc) touch disjoint
   files as promised; no overlap materialized. If the gate ticket's cast-level test wants a
   contract-shaped fixture, `contractStory()`/`contractTickets()` in `materialize.test.ts` are
   copy-ready.

## Nothing critical outstanding

No TODOs in code, no skipped steps, no red. The settled surface downstream consumers see:
`renderStoryFile(s: StoryDraft, storyTickets: readonly TicketDraft[], cutDate: string)` (pure),
`materialize(plan, targets)` unchanged.
