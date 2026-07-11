# T-067-01-02 — materialize-carries-code-text-at-cut — Plan

Ordered steps. The required-parameter change makes the code changes one atomic compile unit,
so this lands as ONE commit; the steps below sequence the authoring and verification inside
it, red-green where the goldens allow.

## Step 1 — Pin the target with failing tests first (red)

In `src/play/materialize.test.ts`:

1. Add the `CHARTER` fixture (bold-shaped, P1/P3/P4/P6/N1 — structure.md text), plus
   `SNAPSHOT`/`EMPTY` built via a value import of `snapshotCharterCodes` (pure, zero-import —
   addon-safe in `bun test`; the comment at the import site says so).
2. Update every render call site to pass `SNAPSHOT` (goldens, targeted, edge tests) or
   `EMPTY` (only where the test pins untouched-body behavior).
3. Rewrite the ticket full-file golden's `_Advances:` line to
   `_Advances: P1 — Author once, run forever_`; update the golden's comment to name
   T-067-01-02 as the deliberate surface move.
4. Update `contractStory()`: `scope` ends `… — src/module plus the gate list (P3)`,
   `honestBoundary` cites `P4` inline; rewrite the contract golden bytes to the expanded
   forms. Leave the degraded golden's BYTES untouched (only its call gains `EMPTY`… actually
   `SNAPSHOT` — no sections exist, so bytes must survive either; use `SNAPSHOT` to pin that).
5. Update the value-triplet test: `advances: ["P1", "P3"]` now expects
   `_Advances: P1 — Author once, run forever; P3 — Gates are the contract_`.
6. Add `describe("code-carrying bodies (T-067-01-02)")` with the seven targeted tests from
   structure.md (multi-advance join, bare-miss degrade, purpose citation, `forward-E1`
   passthrough, already-glossed idempotency, empty-snapshot shape, story-section expansion).
7. Thread `CHARTER` as the third argument through both real-fs collision tests.

Verify: `bun test src/play/materialize.test.ts` fails to COMPILE (signature) — expected red.

## Step 2 — materialize.ts (green for the module)

1. Import `snapshotCharterCodes` + `CharterSnapshot` from `./charter-snapshot.ts`.
2. Add `PROSE_CODE` + `resolveCodesInProse` + `advancesLine` (private, placed with
   `alias`/`flowArray`; doc comments per structure.md — idempotency lookahead, snapshot-gated
   replacement, degrade-not-fabricate).
3. `renderTicketFile(t, snapshot)`: purpose/doneSignal through `resolveCodesInProse`,
   advances line via `advancesLine`. Frontmatter untouched.
4. `renderStoryFile(s, storyTickets, cutDate, snapshot)`: the five section render sites wrap
   values in `resolveCodesInProse`. DAG/footer untouched.
5. `materialize(plan, targets, charter)`: build `snapshot` once after the collision guard;
   thread into both loops. Update the module header (T-067-01-02 paragraph) and the verb's
   doc comment (charter parameter, guard-then-snapshot ordering, where T-067-01-03 slots).

Verify: `bun test src/play/materialize.test.ts` — all green, including untouched collision
semantics.

## Step 3 — Callers

1. `decompose-epic.ts` `decomposeEffect`: third argument `ctx.inputs.charter`; half-line
   comment update.
2. `chain-propose-decompose.test.ts:137`: third argument `CHARTER`.
3. `story-gate-cast.test.ts` `decomposeShapedPlay.effect`: `(plan, ctx)` and
   `materialize(plan, dirs, ctx.inputs.charter)`.

Verify: `bun test src/play/chain-propose-decompose.test.ts src/play/story-gate-cast.test.ts`.

## Step 4 — Full gate + live-shaped sanity

1. `bun run check` — baml:gen + tsc --noEmit + full suite + lint. The real gate (house rule);
   catches any call site the greps missed and any type seam (e.g. `readonly string[]` vs
   `string[]` on `advancesLine`).
2. Sanity sweep: `grep -rn "materialize(" src | grep -v "\.md"` — every call site carries
   three arguments; `grep -n "renderTicketFile\|renderStoryFile" src/play/*.ts` — no
   two-argument stragglers in comments' example code worth updating (comments in
   note-core.ts/propose-core.ts reference the pattern by name only — leave).

## Step 5 — Commit

One commit, message shaped like the sibling landings:

```
feat(play): materialize carries charter-code text at cut (T-067-01-02)

renderTicketFile/renderStoryFile take a CharterSnapshot and render every
cited code as `code — carried one-liner` (advances line semicolon-joined;
purpose/doneSignal and the five story sections resolved the same way,
snapshot-gated so non-charter tokens pass through, already-glossed codes
untouched). materialize gains the charter parameter and resolves once per
cut; decomposeEffect supplies the charter it already holds for ClearContext.
A miss degrades to the bare code — the T-067-01-03 guard's refusal input.
```

## Testing strategy summary

- **Unit (pure, golden):** the three byte goldens carry the AC verbatim — ticket advances
  expanded with code kept; story-body citations resolved; charter (as snapshot) a render
  parameter. Golden style is `toBe` on full bodies (house EXPECTED-OUTCOME).
- **Unit (pure, targeted):** the seven behavior pins, incl. the two safety properties
  (snapshot-gated replacement, gloss idempotency) and the degrade contract T-067-01-03
  builds on.
- **Integration (real fs):** existing collision fixtures, now threading a charter — proves
  the verb's ordering (guard before snapshot before write) didn't regress.
- **Cast-level:** story-gate-cast.test.ts keeps proving a refused cast never reaches the
  (now charter-carrying) materialize; chain test keeps proving the canned plan lands.
- **Not tested here (deliberate):** refusal on unresolvable cited codes (T-067-01-03's AC),
  live decompose cast (story honest boundary: deferred, human-authorized).

## Risks / watch-fors

1. **Golden drift beyond the intended lines** — the contract golden is byte-exact; the new
   citations in `scope`/`honestBoundary` must be reflected EXACTLY (em-dash spacing). If the
   diff shows any frontmatter or DAG byte moving, stop — that's a renderer bug, not a golden
   update.
2. **`PROSE_CODE` overreach** — the fixture prose tests (forward-E1, already-glossed) are
   the tripwire; if either fails, fix the regex, don't loosen the test.
3. **tsc strictness on `snapshot.get()`** — `string | undefined` must be narrowed in both
   helpers; no non-null assertions (house style).
4. **Sibling tests' empty snapshots** — their charters are non-bold on purpose; if an
   assertion there unexpectedly reds, the degrade path regressed.
