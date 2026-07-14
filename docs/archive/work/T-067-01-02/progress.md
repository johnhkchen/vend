# T-067-01-02 — materialize-carries-code-text-at-cut — Progress

## Completed

- **Step 1 — tests first**: materialize.test.ts gained the fabricated bold-shaped `CHARTER`
  fixture (P1/P3/P4/P6/N1) with `SNAPSHOT`/`EMPTY` built through the real resolver (value
  import of `snapshotCharterCodes` — pure, zero-import, addon-safe); every render call site
  threads a snapshot; the ticket full-file golden's `_Advances:` line now carries the
  one-liner; the contract fixture's `scope`/`honestBoundary` gained citations and the contract
  golden pins their resolved forms; the value-triplet expectation moved to the semicolon-
  joined expanded pair; a new `describe("code-carrying bodies (T-067-01-02)")` adds eight
  targeted tests (multi-advance join, bare-miss degrade, purpose citation, doneSignal
  citation, forward-E1/A3 passthrough, already-glossed idempotency, empty-snapshot
  pre-change-bytes golden, story-section spot-check); both real-fs collision tests pass
  `CHARTER` as the third argument. Red confirmed at the compile level (signature change).
- **Step 2 — materialize.ts**: imports `snapshotCharterCodes` + `CharterSnapshot`; new
  private `PROSE_CODE` / `resolveCodesInProse` / `advancesLine` (snapshot-gated, `(?! —)`
  idempotency lookahead, miss → bare code); `renderTicketFile(t, snapshot)` routes
  purpose/doneSignal through the prose resolver and the advances line through `advancesLine`;
  `renderStoryFile(…, cutDate, snapshot)` resolves the five section render sites (DAG block +
  footer untouched); `materialize(plan, targets, charter)` builds the snapshot once, after
  the collision guard, beside the single clock read. Module header + doc comments updated.
- **Step 3 — callers**: decompose-epic.ts `decomposeEffect` passes `ctx.inputs.charter` (the
  same string `gates` feeds `ClearContext`); chain-propose-decompose.test.ts:137 passes its
  existing `CHARTER` fixture; story-gate-cast.test.ts's fixture effect takes `(plan, ctx)`
  and passes `ctx.inputs.charter` — mirroring the real effect's shape.
- **Step 4 — verification**: `bun test src/play/materialize.test.ts` 21/21;
  sibling suites (chain-propose-decompose, story-gate-cast, chain-funding-band-e2e) 12/12;
  `bun run check` (baml:gen + tsc + lint + full suite) **1554 pass, 1 skip (pre-existing),
  0 fail** across 105 files. Sanity grep: every `materialize(` call site carries three
  arguments; no two-argument render stragglers.
- **Step 5 — commit**: `f55cae0` — one commit, five files, +217/−42.

## Remains

Nothing. All plan steps executed; review.md is the remaining phase artifact.

## Deviations from plan

1. **Eight targeted tests instead of seven** — added a dedicated `doneSignal` citation test
   (the plan folded doneSignal into "purpose citation"; a separate pin was one line and
   covers the third prose field explicitly).
2. **Degraded-golden call uses SNAPSHOT (as planned in step 1.4's correction)** — the
   shell-story golden bytes are unchanged with a REAL snapshot in hand, which pins "no
   sections ⇒ no expansion surface" more honestly than passing EMPTY would.
3. **The empty-snapshot test doubles as the pre-change golden** — the old T-066-01-03-era
   full-file literal moved into it verbatim rather than being deleted, so the repo keeps a
   byte pin on the degrade path (plan step 6 had only a `toContain`).

## Verification evidence

- New/updated goldens: ticket full-file (`_Advances: P1 — Author once, run forever_`),
  story contract (`(P3 — Gates are the contract)` in Scope, `(P4 — Autonomy by default,
  not supervision)` in Honest boundary), degraded shell (bytes unchanged), empty-snapshot
  pre-change bytes (old golden, verbatim).
- Safety properties pinned: `forward-E1`/`A3` untouched; `P4 — the author's own gloss
  stands` not re-glossed; `P9` miss renders bare (the T-067-01-03 guard's input).
- Frontmatter: byte-identical in every golden (lisa validity untouched).
