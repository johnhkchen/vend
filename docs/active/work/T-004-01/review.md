# Review — T-004-01 pure-id-collision-detector

Handoff document. What changed, test coverage, open concerns. Enough to
understand the work without reading every diff.

## What changed

| File | Action | Lines | Summary |
|------|--------|-------|---------|
| `src/play/id-guard.ts` | created | ~40 (incl. ~19 header/doc) | Pure `detectCollisions(generated, existing) -> string[]`. |
| `src/play/id-guard.test.ts` | created | ~70 | 8 tests across 3 `describe` blocks. |
| `docs/active/work/T-004-01/*.md` | created | — | RDSPI artifacts (research → review). |

No existing source touched. `materialize.ts`, `project-context.ts`,
`decompose-epic.ts`, `gates.ts` are unchanged — the detector is purely additive
and decoupled, so T-004-02 composes it without this ticket having pre-committed
any wiring decisions. Committed as `0a4f53f`.

## The implementation

`detectCollisions` builds a `Set` from `existing` (membership oracle), walks
`generated` once, and pushes each id that is in the set and not yet seen. Result:
the deduped intersection, ordered by first appearance in `generated`. O(n + m),
total (never throws), no mutation, no fs/clock/network/addon — not even a
type-only BAML import. It is the purest module in the tree.

## Acceptance criteria — all met

- ✅ **`src/play/id-guard.ts` exports `detectCollisions(generated, existing) ->
  string[]`, PURE.** Signature matches the AC string exactly; no fs/network/addon
  import in the file.
- ✅ **Colliding fixture returns exactly the reused ids.** `toEqual(["T-004-01",
  "T-004-02"])` — exact, not `toContain`, so membership *and* order are pinned.
- ✅ **Disjoint fixture returns `[]`.** Plus two empty-input cases.
- ✅ **Order/dedup behavior pinned.** Dedicated tests: order follows `generated`
  (a deliberately reordered `existing` proves it has no influence); a repeated
  colliding id appears once; a repeated non-colliding id never appears.
- ✅ **`bun run check:test` and `check:typecheck` green.** Full suite **122 pass
  / 0 fail** (was 114; +8). `tsc --noEmit` clean.
- ✅ **No dependency on `materialize`/`project-context`.** Zero such imports;
  signature is plain `readonly string[]`.

## Test coverage

Every branch of the function is exercised:
- collision present (intersection non-empty),
- none present (disjoint → `[]`),
- empty `generated` and empty `existing` (totality / D6),
- the `seen`-guard dedup path (repeated colliding id → once),
- the order path (first-appearance vs `existing` order),
- non-mutation (frozen inputs unchanged after the call).

No coverage gaps for the delivered unit. The function is total and
side-effect-free, so all 10 assertions are exact `toEqual` on fixed arrays — no
flakiness surface (no clock, fs, or addon).

## Open concerns / limitations

- **Scope is the detector only — by design.** The actual *guard* (refusing to
  materialize, raising the andon, logging a collision outcome) is T-004-02. Until
  that lands, `runDecomposeEpic` still writes blindly (the obs-20349 clobber
  hazard is unmitigated in the live path). This ticket delivers the pure heart
  the guard will use; it does not itself close the hazard. This is the intended
  S-004-01 decomposition (T-004-01 detector → T-004-02 andon gate), not a gap.
- **No id-shape validation.** Ids are treated as opaque strings (collision =
  string equality). A malformed id (e.g. wrong namespace) is not a concern here;
  the upstream gates and `listIds` define the id namespace. Correct per Design D5.
- **Caller owns id extraction.** The detector trusts that `generated` already
  holds the ids a plan would mint. T-004-02 must extract both story and ticket
  ids (`plan.stories[].id` + `plan.tickets[].id`) — a partial extraction (e.g.
  tickets only) would miss story-id collisions. Flagged in `progress.md` notes.

## Critical issues needing human attention

None. The change is additive, green, and atomic. The only thing to track is the
serialized follow-on (T-004-02) that consumes this seam — already modeled in the
S-004-01 / E-004 decomposition and noted above.

## Handoff to T-004-02

Call: `detectCollisions([...plan.stories.map(s => s.id),
...plan.tickets.map(t => t.id)], existingIds)`, with `existingIds` from
`project-context`'s `listIds` over stories + tickets. Non-empty ⇒ andon (refuse
materialize, log outcome) between `classify` and `materialize` in
`runDecomposeEpic`. The returned array is deduped and plan-ordered — usable
verbatim in the human-facing andon message.
