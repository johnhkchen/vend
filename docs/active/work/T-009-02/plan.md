# T-009-02 — Plan: implementation sequence

Ordered steps, each independently verifiable. The whole ticket is one atomic commit (two
new files, no live-board mutation), but the build order below keeps each unit testable as it
lands. Testing strategy follows the house rule: **pure functions, pure tests** — no fs, no
BAML addon (every BAML/engine import type-only).

## Step 1 — Scaffold `propose-core.ts`: header, imports, types, constants

- Module header comment (purity contract, three-gate value order, andon-on-first).
- Type-only imports: `EpicCard` (baml_client), `GateVerdict` (engine/play). Runtime import:
  `detectCollisions` (id-guard).
- `PE_GATE_NAMES`/`PEGateName`, `ProposeClearContext`.
- `COLOR_ALIAS`, `CARD_TYPE_ALIAS`, `RARITY_ALIAS`, `alias()`.
- `nonEmpty`, `matchIds`, `flowArray`, `EPIC_ID_RE`, `REQUIRED_CARD_FIELDS`, `Offense`.
- **Verify:** `bun run check:typecheck` compiles (no unused-import / type errors). No
  behavior yet.

## Step 2 — The three gates + `clear`

- `valueGate`: `serves`/`value`/`intent` non-empty; `advances` non-empty array, all
  non-blank.
- `boundsGate`: `matchIds(ctx.charter,"P"|"N")`; reject `advances` entry that is `N\d+`/live
  non-goal; reject `P\d+` not in charter; free-text passes.
- `structuralGate`: required-field presence loop; `color` non-empty array; `EPIC_ID_RE`;
  `kind === type`; `detectCollisions([card.id], ctx.existingEpicIds)`.
- `GATES` table + `clear(card, ctx): GateVerdict` (first Offense → STOP; none → CLEAR with
  all three names).
- **Verify:** typecheck green. (Tests land in Step 5.)

## Step 3 — `nextEpicId(existing)`

- Regex-scan `E-(\d+)`, numeric max, `+1`, `String(n).padStart(3,"0")` → `E-0XX`; empty
  board → `E-001`. PURE/TOTAL (ignores non-`E-` ids, tolerates `E-9` vs `E-009`).
- **Verify:** typecheck green.

## Step 4 — `renderCard(card)`

- Frontmatter: `id`, `title`, `status: open`, `kind: ${alias(CARD_TYPE_ALIAS, card.kind)}`,
  `advances: ${flowArray(card.advances)}`, `serves: >` folded.
- Stat-block region: `manaCost`, `color` (aliases joined `, `), `type` alias, `rarity`
  alias, and the `propose-epic` play trailer — the four fields frontmatter omits, so the
  output round-trips **every** card field.
- Body: the four E-009 section headings with `intent`/`value`/`doneLooksLike`/`context`.
- `[...].join("\n")`. PURE.
- **Verify:** typecheck green.

## Step 5 — `propose-core.test.ts` (the AC pins)

Model on `note-core.test.ts`. `FULL_CARD: EpicCard` fixture + `ctxWith(charter, ids)`.

Pins (map to AC#2):
1. **a passing card clears** — `clear(FULL_CARD, ctxWith("…P1…", []))` →
   `{status:"clear", cleared:["value","bounds","structural"]}`.
2. **non-goal-violating card → bounds STOP** — `advances:["N4"]` → `{status:"stop",
   gate:"bounds"}`, reason mentions non-goal.
3. **colliding/duplicate id → structural STOP** — `ctxWith("…P1…", [FULL_CARD.id])` →
   `{status:"stop", gate:"structural"}`, unit names the id (proves the `detectCollisions`
   reuse).
4. **rendered markdown round-trips the card fields** — `renderCard(FULL_CARD)` `toContain`s
   id, title, serves, each `advances`, manaCost, each color alias, type alias, rarity alias,
   intent, value, doneLooksLike, context; `status: open`; `kind:` lowercase alias.

Supplementary (raise confidence, not in the AC list but cheap):
- **value STOP** — blank `serves` / empty `advances` → `gate:"value"`.
- **structural — bad id shape** (`E-12`) and **kind≠type** → `gate:"structural"`.
- **nextEpicId** — `[]→"E-001"`; `["E-001","E-009"]→"E-010"`; ignores non-`E-` ids.
- **alias drift** — `renderCard` throws `RangeError` on an out-of-map member (guards the
  member→alias map against future enum additions). *(Constructing this needs an `as` cast on
  the fixture — keep it minimal.)*

- **Verify:** `bun test` green; the four AC pins present.

## Step 6 — Full gate + commit

- `bun run check` (= `baml:gen` + `check:typecheck` + `check:test`) all green.
- `bun run check:committed` clean (only the two source files + work artifacts are dirty;
  `baml_client/` is gitignored).
- Commit: `T-009-02: ProposeEpic pure core — PE gates + card renderer`. Stage
  `src/play/propose-core.ts`, `src/play/propose-core.test.ts`, and
  `docs/active/work/T-009-02/*`. Do **not** stage `baml_client/`.

## Testing strategy summary

- **Unit (this ticket):** every export is pure → ordinary `bun test`, no temp dirs, no
  addon. The four AC behaviors are pinned plus helper/edge coverage.
- **Not here:** no integration/live-cast test — the play isn't registered until T-009-03,
  which owns the impure effect (writing the card file) and the end-to-end cast. The pure
  core's contract (gate verdicts, rendered body, minted id) is fully exercised in isolation.

## Risks / watch-items

- **`detectCollisions` import path** — it's a runtime (value) import; confirm it doesn't
  transitively pull BAML. id-guard.ts has *no* BAML import at all (Research), so the test
  stays addon-free. ✔ by construction.
- **Enum member strings** — alias maps key on title-case members (`"Permanent"`); a typo
  silently mis-renders. The `alias()` `RangeError`-on-miss guards *missing* members; correct
  spelling is covered by the round-trip pin asserting the lowercase output.
- **`status` choice** — `open` for a freshly proposed card (Design D5). If T-009-03's effect
  or lisa expects `clearing`, that's a one-line change there; documented for the reviewer.
</content>
