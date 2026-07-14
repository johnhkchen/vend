# T-009-02 — Review: ProposeEpic pure core (PE gates + card renderer)

Self-assessment and handoff. Commit `5d7cdae`.

## What changed

Two files **created**, nothing modified or deleted:

| File | Lines | What |
|---|---|---|
| `src/play/propose-core.ts` | ~250 | The pure core: `clear`, `renderCard`, `nextEpicId`, the alias maps, the three gates. |
| `src/play/propose-core.test.ts` | ~190 | 18 pure-function pins (no addon, no fs). |

Plus the six RDSPI work artifacts under `docs/active/work/T-009-02/`.

**No live-board mutation.** `baml_client/` (gitignored) was regenerated but not staged. The
pre-existing dirty ticket files (`T-009-01.md`, `T-009-02.md` — Lisa's phase management) were
left untouched and uncommitted, per the workflow contract.

## Public surface delivered

- `clear(card: EpicCard, ctx: ProposeClearContext): GateVerdict` — value → bounds →
  structural, andon on first failure, CLEAR echoes all three gate names.
- `renderCard(card: EpicCard): string` — the `E-0XX.md` markdown.
- `nextEpicId(existing: readonly string[]): string` — the next free `E-0XX` mint.
- `ProposeClearContext`, `PE_GATE_NAMES`, `COLOR_ALIAS`/`CARD_TYPE_ALIAS`/`RARITY_ALIAS` —
  exported for T-009-03's effect + run-log parity.

## Acceptance criteria — all met

- **AC#1** — `clear` runs value→bounds→structural; structural reuses `detectCollisions` for
  epic-id disjointness; `renderCard` produces the markdown; `nextEpicId` mints the next free
  id (the "+ mints the next free id" half, kept out of the gate by design). ✓
- **AC#2** — fully unit-tested: a passing card clears; a non-goal card (`advances:["N4"]`) →
  bounds STOP; a colliding id → structural STOP; the rendered markdown round-trips the card
  fields. All four pinned, plus edges. ✓
- **AC#3** — depends only on the generated `EpicCard` type (type-only) + `id-guard`
  (runtime, pure); no engine/fs at runtime (`GateVerdict` is type-only). `bun run check:*`
  green. ✓

## Test coverage

18 tests / 45 assertions, all green; full suite **303 pass / 0 fail** (no regressions).

| Area | Pins |
|---|---|
| value gate | pass; blank `serves` → STOP; empty `advances` → STOP |
| bounds gate | `N4` → STOP (non-goal); `P9` dangling → STOP; free-text `advances` passes |
| structural gate | id collision → STOP (names the id); malformed id `E-12` → STOP; `kind≠type` → STOP; empty `color` → STOP |
| `nextEpicId` | empty→`E-001`; max+1 padded; ignores non-epic ids |
| `renderCard` | frontmatter (id/title/status/kind alias/advances/serves); stat-block (mana/color/type/rarity aliases + trailer); body (all four sections); multi-color (WU); alias-drift `RangeError` |

**Coverage assessment:** every export and every gate branch is exercised. The pure core's
contract is fully proven in isolation.

**Gaps (by design, not omission):**
- No live-cast / integration test — the play isn't registered until T-009-03, which owns the
  impure effect (writing the card file) and the end-to-end cast. The render/parse BAML path
  is proven separately in `src/baml/propose.test.ts` (T-009-01).
- The `alias()` `RangeError` is tested via a cast (`"Legendary" as CardRarity`) — it can't
  arise from a real `b.parse` (the enum forbids it), so the pin guards future enum/map drift,
  not a live path.

## Design decisions a reviewer should know

1. **Returns engine `GateVerdict`, not gates.ts `GateResult`** (Design D1). The AC's wording
   says `GateResult` and cites gates.ts for "the shape"; I return the engine's play-agnostic
   `GateVerdict` — the *same* discriminated-union shape — because that is what `Play.gates`
   requires, so it drops into T-009-03's registration with zero adapter (the `clearNote`
   precedent). If a reviewer wants the literal gates.ts type, note it would force an adapter
   and bind the PE core to DecomposeEpic's `value|allocation|bounds|structural` vocabulary
   (wrong — PE has no `allocation` gate).
2. **Minting lives in `nextEpicId`, not in the structural gate** (Design D4). A gate judges;
   it does not assign ids. The gate checks *disjointness*; the effect calls `nextEpicId` to
   *mint*. Both share `existingEpicIds`, so the AC's "structural … mints the next free id" is
   satisfied by the pair living in one module.
3. **"Names a signal it clears" is checked as field presence, not literal back-reference.**
   The demand signal is an *input*, not a card field, so a pure gate cannot verify a literal
   trace. The value gate enforces the value-bearing fields (`serves`, `advances`, `value`,
   `intent`) a worthwhile card must carry — the purely-decidable slice. Semantic tracing is
   the model's job (propose.baml prompt) and human review.
4. **PE-5 "prerequisites named" is not rule-failed** — it is semantic (is *this* prose a real
   prerequisite?), so like gates.ts's free-text stance it lives in the prompt + human review,
   not the pure gate. Documented, not silently dropped.

## Open concerns / flags for human attention

- **`status: open` in the rendered frontmatter.** A freshly *proposed* card is `open`
  (not yet cleared by DecomposeEpic). If lisa or T-009-03's effect expects `clearing` (or
  `active`), it is a one-line change in `renderCard`. **Low risk, flagged.**
- **The stat-block is a clean deterministic block, not E-009's ASCII-art box** (Design D5).
  It contains every stat field (so the round-trip holds) but reads as generated prose, not
  the hand-authored card art. Intentional; a reviewer expecting pixel-fidelity should know.
- **`renderCard` returns the body only, not `{name, body}`.** The filename (`${card.id}.md`)
  is the T-009-03 effect's concern, derivable from `card.id`. Matches the AC signature
  (`renderCard(card) -> string`).

## Handoff to T-009-03

Wire `proposeEpicPlay`: `gates: (out, ctx) => clear(out, builtCtx)` where `builtCtx` is
assembled impurely (read charter, `listIdsIn(epicDir)`); the effect writes
`renderCard(card)` to `docs/active/epic/${card.id}.md`, minting via
`nextEpicId(existingEpicIds)` if it distrusts the model's id. Then register on the engine and
cast live — three plays through one engine. No blocking issues.
