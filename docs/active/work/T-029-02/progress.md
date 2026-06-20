# T-029-02 — Progress: surfaces-and-card-as-lens

## Status: implement complete, gate green

Followed the plan with **zero deviations**. The work was the append-only doc edit the Structure/Plan
blueprinted.

## Steps executed

- **Step 1 — anchor confirmed.** Re-read `design-language.md` lines 103–114; the insertion point
  (between DL-5's `Grounds in:` and the `---` / `## Index`) and the reserved-tail placeholder
  (`*(DL-6… … T-029-02.)*`) matched Structure exactly. Anchor unique.
- **Step 2 — surfaces section drafted in-place.** Inserted `## The surfaces — composing the atoms` +
  intro + **DL-6 (Home)**, **DL-7 (Counter — Confirm→Run→Settle, three sub-mocks)**, **DL-8 (Ledger)**,
  **DL-9 (card-as-lens-not-chrome)**. Each: bold lead · rule · fenced ASCII mock · `Grounds in:` —
  the DL-4/DL-5 format. ~95 added lines, within the cap.
- **Step 3 — index completed.** Replaced the reserved tail with DL-6…9 entries, appended to the
  DL-1…5 line; the index is now one continuous nine-entry list, no `T-029-02` placeholder left.
- **Step 4 — gate.** `bun run check:typecheck` clean; `bun run check:test` → **853 pass / 0 fail**
  (unchanged from T-029-01/T-028-01). `git status` shows only `.md` files — doc-only non-regression
  confirmed.
- **Step 5 — self-consistency pass.** Walked each mock against its live emitter:
  - DL-6 shelf list ↔ `renderMenu` (numbered, `[Tier] · 2h/50k · ready`, `(+K hidden)` footer) ✓;
    board lead ↔ `renderBoard`; ledger line ↔ `formatWalkAwayFindings` split.
  - DL-7 Run ↔ `formatStepSignal` (`▶` col 0, meter indented); Settle ↔ `renderReceipt` (`═` header,
    `✓`/`⚠`, amber only on the andon step line, `stopped:` plain for board-cleared) ✓.
  - DL-8 ↔ `formatWalkAwayFindings` (headline + `└` provenance split + `⚠ over (gates working, not
    defects)` + outcome mix + cost-vs-envelope); `⚠ is NOT red` annotated ✓.
  - DL-9 ↔ `renderCard` (the framed stat block in the *doc*) vs `renderMenu` (flat TUI list) ✓.
  - Glyph set limited to `▶ ✓ ⚠ ◇ ⏱ └ ═ · {…}` (DL-3); no boxed cards in any TUI mock; amber annotated
    only on andon lines; honest gaps named (no `renderHome`, Confirm adjust open, settle accent) ✓.
- **Step 6 — commit.** Staged `docs/knowledge/design-language.md` + `docs/active/work/T-029-02/`.
  Ticket frontmatter left untouched (Lisa advances phases from artifacts).

## Deviations

None. The four-atom set (DL-6…9), the schematic-but-faithful mock form, and the doc-vs-TUI card
contrast all landed as designed.

## Verification

- `bun run check:typecheck` — clean.
- `bun run check:test` — 853 pass / 0 fail / 2073 expect() calls.
- `git status` — only `design-language.md` + work artifacts changed; no source files.
