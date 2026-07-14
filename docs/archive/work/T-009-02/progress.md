# T-009-02 — Progress

## Status: implementation complete, all checks green

## Done (per the plan)

- **Step 1 — scaffold** ✓ `src/play/propose-core.ts`: header (purity contract), type-only
  imports (`EpicCard`, `GateVerdict`) + the one runtime import (`detectCollisions`),
  `PE_GATE_NAMES`/`PEGateName`, `ProposeClearContext`, the three member→alias maps +
  `alias()`, and the helpers (`nonEmpty`, `matchIds`, `flowArray`, `EPIC_ID_RE`,
  `REQUIRED_CARD_FIELDS`, `Offense`).
- **Step 2 — gates + clear** ✓ `valueGate` / `boundsGate` / `structuralGate` and the ordered
  `GATES` table + `clear(card, ctx): GateVerdict` (andon on first failure; CLEAR echoes all
  three names).
- **Step 3 — `nextEpicId`** ✓ pure max+1, zero-padded; empty → `E-001`; ignores non-`E-` ids.
- **Step 4 — `renderCard`** ✓ frontmatter (id/title/status:open/kind alias/advances/serves)
  + stat-block (manaCost/color aliases/type alias/rarity alias + play trailer) + the four
  body sections. Round-trips every card field.
- **Step 5 — tests** ✓ `src/play/propose-core.test.ts`, 18 tests, all BAML imports type-only
  (enum members as string-literal casts), no addon, no fs. The four AC pins present plus
  value/bounds/structural edge coverage, `nextEpicId`, multi-color render, and the
  alias-drift `RangeError` guard.
- **Step 6 — gate** ✓ see results below.

## Verification

- `bun run baml:gen` — regenerated (EpicCard resolves). ✓
- `bun run check:typecheck` (`tsc --noEmit`) — clean. ✓
- `bun test src/play/propose-core.test.ts` — **18 pass / 0 fail**. ✓
- `bun test` (full suite) — **303 pass / 0 fail across 22 files**. ✓ (no regressions)

## AC coverage

- AC#1 — `clear(card, ctx) -> GateVerdict` running value→bounds→structural (structural
  reuses `detectCollisions` for disjointness); `renderCard(card) -> string`; plus
  `nextEpicId` for the "mints the next free id" half. ✓
- AC#2 — passing card clears; non-goal (`N4`) → bounds STOP; colliding id → structural STOP;
  rendered markdown round-trips the fields. All four pinned. ✓
- AC#3 — runtime imports: only `detectCollisions` (pure). `EpicCard`/enums and `GateVerdict`
  type-only. No engine/fs. `bun run check:*` green. ✓

## Deviations from the plan

- **Return type** — returns engine `GateVerdict` (not gates.ts `GateResult`), as Design D1
  decided: it is the same discriminated-union shape the AC cites but is directly registrable
  as `Play.gates` in T-009-03 (the `clearNote` precedent). No adapter needed downstream.
- **`unit` on value/bounds offenses** — uses `card.id || "<card>"` so a STOP always names a
  unit even when the id field itself is the blank one (mirrors gates.ts's `<plan>`/`<ticket>`
  fallback). No plan change, just a robustness detail.

## Notes for T-009-03 (the impure shell + registration)

- Build `ProposeClearContext` impurely: read the charter file + `listIdsIn(<epicDir>)` (the
  `project-context.ts` / materialize gather), then `gates: (out, ctx) => clear(out, builtCtx)`.
- The effect writes `${card.id}.md` (filename is the effect's concern) under
  `docs/active/epic/`, body = `renderCard(card)`. Mint with `nextEpicId(existingEpicIds)` if
  the effect distrusts the model's id; otherwise the structural gate already guarantees
  disjointness.
- `status: open` is the rendered frontmatter status for a freshly proposed card. If lisa /
  the effect expects `clearing`, that is a one-line change in `renderCard` — flagged for the
  reviewer.

## Open items

- None blocking. The `propose-epic` gates/render are fully unit-proven in isolation; the
  live cast is T-009-03.
