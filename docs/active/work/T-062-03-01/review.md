# T-062-03-01 — Review

The handoff: what changed, how it's covered, and what a human reviewer should know.

## What this delivers

Closes the **seed-intent → steer seam on the materialized kitchen seed** and **records the kitchen
gold-master board**. The materialized seed was missing the very thing the ticket is named for: after
T-062-02-01 the kitchen overlay shipped the Dish type + storefront + Cloudflare config but **no
`SEED.md`** and only the **generic** charter stub — so `vend steer` on the scaffolded workspace had
an empty snapshot and a generic value function, nothing to rank a menu-render board off. This ticket
adds the cook's `SEED.md` intent + a kitchen-tuned `docs/knowledge/charter.md` to the overlay
(mirroring `hackathon`), **proves deterministically** that the intent now reaches the steer snapshot,
and **records** the expected board (menu-render Keystone on top) as the gold-master bar — with the
live, non-deterministic ranking honestly **deferred** to the human-authorized metered cast
(T-062-03-03).

## Files changed

**Created**
- `examples/templates/kitchen-seed/SEED.md` — the cook's one-line menu intent; names the menu-render
  as the first slice; the two roles (cook/driver, diner). Intent prose, **zero demand rows**.
- `examples/templates/kitchen-seed/charter.md` — the kitchen-tuned value function ("a real, usable
  menu the couple will actually order from"): 5 criteria (menu-advancing first), K1–K3 gates,
  out-of-bounds defers (ordering/shopping/nutrition/polish). One page, zero demand.
- `src/kitchen/seed-steer-seam.test.ts` — the confirm test (3 blocks, 5 tests): the materialized seed
  carries the intent + tuned charter (drift-pinned), the intent reaches the steer snapshot, and the
  recorded board is gate-valid + menu-render-topped.
- `docs/active/work/T-062-03-01/expected-board.md` — the recorded gold-master **board** (positive-
  scaffold form): deterministic rows ✅, metered rows `⟪…⟫`, the ranked board + the genuine fork + a
  re-run block.
- `docs/active/work/T-062-03-01/steer-input.proof.txt` — no-spend proof from the **shipped**
  `assembleSteerInputs` (no `b.request` fired ⇒ $0.00) showing the `## Stated intent (SEED.md)`
  section + kitchen charter head.
- The RDSPI trail (`research.md` / `design.md` / `structure.md` / `plan.md` / `progress.md`).

**Modified**
- `src/kitchen/kitchen-overlay.ts` — two `with { type: "text" }` imports + two `KITCHEN_OVERLAY`
  entries: `SEED.md` (overlay-only) and `docs/knowledge/charter.md` (**overrides** the base
  `CHARTER_STUB` in-slot via `mergeManifests`). Header note + "WHAT THIS IS" updated.

**Not touched** (intentional): `init-core.ts` / `init-effect.ts` (the merge already supports
overlay-only + override entries); the engine, the CLI, the BAML. No public signature changed.

## How the acceptance criterion is met

> `vend steer` run against the scaffolded kitchen workspace yields a board whose highest-ranked
> slice is the menu-render slice; the board is recorded for the gold-master diff.

| Clause | Evidence |
| --- | --- |
| the seam reaches steer on the *materialized* seed | `seed-steer-seam.test.ts` blocks A+B: scaffold lays `SEED.md` + kitchen charter (byte-equal to source); `buildProjectSnapshot` (the pure core `assembleSteerInputs` composes) emits `## Stated intent (SEED.md)` + the menu-render phrase; charter ≠ generic stub. Corroborated by `steer-input.proof.txt` from the **shipped** assembler, $0.00. |
| highest-ranked slice = menu-render | `seed-steer-seam.test.ts` block C: the recorded `GOLD_MASTER_BOARD` `clear`s all three steer gates and `signals[0]` is the menu-render slice at **Keystone**. The `SEED.md`/charter make the menu render the obvious keystone for the live cast. |
| board recorded for the gold-master diff | `expected-board.md` — the diffable board bar (keystone line shared with the test via `KEYSTONE_MENU_RENDER`, anti-drift). |

**The one clause not run here:** the literal **live `vend steer` ranking**. `vend steer` has no
offline/dry-run path (`castSteer` always dispenses a real prompt — `src/executor/executor.ts`), the
ranking is non-deterministic, and the metered live drive is **explicitly T-062-03-03's**
human-authorized job (P7). So this ticket proves the *deterministic* half as fact and records the
board as the *target*, exactly mirroring the T-059-03 positive-scaffold precedent. **No live numbers
were invented** (`expected-board.md` keeps them as `⟪…⟫`).

## Test coverage

- **New (`seed-steer-seam.test.ts`):** 5 tests / 3 blocks — seam present + drift-pinned, intent
  reaches the snapshot (+ a negative control: `intent: undefined` ⇒ no section), board clears + tops
  with menu-render. Addon-free (reconstructs `assembleSteerInputs`' output via the pure
  `buildProjectSnapshot` + `clear`), so it runs in the gate.
- **Unchanged + still green:** `init-kitchen.test.ts` (the merged-manifest AC — `MERGED.length`
  auto-updated, no-clobber holds).
- **Gate:** `bun run check` → **exit 0**: baml:gen OK; `tsc --noEmit` clean; `bun test` **1476 pass /
  0 fail / 1 skip** across 98 files.

**Gaps (acknowledged):**
- The live board ranking is not gated (inherent — no offline steer; metered + non-deterministic).
  Mitigated by proving the input path deterministically and recording the target bar; T-062-03-03
  closes it.
- `SEED.md`/`charter.md` live under `examples/templates/kitchen-seed/` (outside `tsconfig
  include:[src]`), so they have no automated test *of their own*; their **scaffolded** copies are
  drift-pinned by the new test (byte-equality), which is the house substitute.

## Open concerns / flags for human attention

1. **Commits left to Lisa (not done by hand) — deliberate.** The working tree carries **uncommitted
   sibling-thread work**: `src/kitchen/kitchen-overlay.ts` (the file this ticket edits) is itself
   *untracked* — authored by the T-062-02-01 thread this ticket `depends_on` and not yet committed —
   alongside `dish-seed.ts`, `init-core.ts` mods, etc. A by-hand `git add` of the overlay would
   entangle that thread's unfinished work into this commit. Per rdspi-workflow.md §Concurrency
   (file-locked, serialized commits), the code + artifacts are left in the tree for Lisa. `bun run
   check` is green over the combined tree.
2. **Did the kitchen charter override surprise any invariant test?** No. The kitchen-overlay
   invariant/idempotency tests compute `MERGED` dynamically and iterate `SCAFFOLD_MANIFEST`; an
   override replaces in-slot and `SEED.md` is overlay-only (+1) — both handled, suite green.
3. **The expected board is a target, not a captured result.** Reviewers should read
   `expected-board.md` as the consistency *bar* ("comparable, not identical"), not a claim that the
   model produced it. The live capture + any delta is T-062-03-03 / T-062-04-01.
4. **No `GraphIntegrityError` regression.** The S-06x→E-06x graph failure noted in the (ID-reused,
   unrelated) `docs/active/work/T-062-03/review.md` did not reproduce — E-062 exists on the board, so
   the live-board graph tests pass.

## Risk assessment

Low. The change is additive and mirrors the shipped `hackathon` overlay one-for-one (same two file
kinds, same override mechanism, same E-059 wire). It touches no engine/CLI/BAML, breaks no public
signature, and honors the overlay doctrine (vend-owned paths, zero demand rows ⇒ one-way-to-lisa +
honest-empty hold). The only un-gateable step is the live ranking, which is minimal, deferred to the
authorized cast, and recorded honestly as a target.
