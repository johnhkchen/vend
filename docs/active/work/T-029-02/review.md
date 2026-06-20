# T-029-02 — Review: surfaces-and-card-as-lens

Handoff for a human reviewer. What changed, how it's verified, and what's open. The whole ticket is
**doc-only**: it continues `design-language.md` from the DL-1…5 atoms (T-029-01) into the DL-6…9
surfaces + the card-as-lens decision.

## What changed

**One knowledge doc, append-only + index completion** — commit `a892577`:

- `docs/knowledge/design-language.md` (**+119 / −2**): a new `## The surfaces — composing the atoms`
  section inserted between DL-5 and the Index, plus the index tail rewritten from the reserved
  `*(DL-6… T-029-02)*` placeholder to four real entries. Four new principles:
  - **DL-6 — Home leads with demand; supply serves beneath.** DL-1/IA-1 made visual: the ranked board
    leads (NOW + why), the shelf recedes as a *numbered list, not cards*, the provenance-split ledger
    summary line (E-028) at the foot. Names the honest gap: no single `renderHome` emitter today.
  - **DL-7 — The Counter is the Confirm → Run → Settle spine (IA-6).** One surface, three faithful
    sub-mocks. Confirm shows accept-the-default (adjust gesture left open — an IA thread); Run is the
    `formatStepSignal` production line; Settle is the `renderReceipt` `═` receipt with amber only on the
    andon step. The meter rule stays in DL-4, referenced not redrawn.
  - **DL-8 — The Ledger renders the andon rate as "gates working," never a red defect count (IA-10).**
    Faithful `formatWalkAwayFindings` mock — headline rate, `└` forward/attested split, the
    `⚠ over (gates working, not defects)` line annotated `⚠ is NOT red`.
  - **DL-9 — The card/mana model is a lens, not chrome.** Three clauses (lens lives in the doc; TUI
    renders no boxed cards; cost as an inline glyph at most) + a contrast mock (the framed `renderCard`
    stat block in the *doc* vs the flat `renderMenu` list in the *TUI*) + the binding clause: *no TUI
    epic re-introduces card chrome by default; change DL-9 first.*

**Five RDSPI work artifacts** under `docs/active/work/T-029-02/` (research, design, structure, plan,
progress, this review). No ticket frontmatter edited — Lisa advances phases from artifacts.

## Acceptance criteria — all met

| AC | Status | Evidence |
|---|---|---|
| DL principle per surface (Home, Counter Confirm→Run→Settle, Ledger), clean-typographic key, small ASCII mock, atoms-consistent (type-led, amber only on the andon, no boxed cards) | ✅ | DL-6/7/8 with mocks using only the live glyph set; amber annotated `← amber` only on andon lines; no boxed cards |
| Card-as-lens-not-chrome captured as an **explicit** DL principle (doc lens; TUI no card chrome; cost as inline glyph at most) | ✅ | DL-9 — its own numbered, citable principle with doc-vs-TUI contrast + binding clause |
| Capped + anti-stale (principle + index line per DL, IA-doc shape), self-consistent with T-029-01, grounded in live surfaces; `bun run check:*` green (doc-only) | ✅ | `Grounds in:` per DL; index completed DL-1…9; 853 pass / 0 fail; typecheck clean; only `.md` changed |

## Test coverage

- **No new tests** — correct for this ticket. The DL doc, like `information-architecture.md`, is
  untested prose; no source was touched, so there is nothing to unit-test.
- **Non-regression gate** — `bun run check:typecheck` clean; `bun run check:test` → **853 pass / 0 fail
  / 2073 expect() calls** (unchanged from T-029-01). `git status` confirms only doc + work artifacts.
- **The real review is the anti-drift pass** (progress.md Step 5): each mock walked side-by-side against
  its cited live emitter — `renderMenu`, `renderBoard`, `formatStepSignal`, `renderReceipt`,
  `formatWalkAwayFindings`, `renderCard`. All glyphs, indents, and the no-boxed-cards / amber-only rules
  hold.

## Open concerns & limitations

- **Mocks are reference, not specs — and can drift.** This is the structural risk in any grounded charter
  doc. Mitigated by `Grounds in:` pointers and schematic-but-faithful form (no frozen sample numbers),
  but a future change to `renderReceipt`/`renderMenu` could silently diverge from a mock. The doc's own
  "fix one, don't drift" rule is the contract; there is **no automated check** binding mock ↔ emitter —
  a possible future ticket (a doc-lint asserting the glyph vocabulary, say). Flagged, not built.
- **Named honest gaps, deliberately not closed here** (a TUI epic's job): no single `renderHome`
  composite (Home is CLI-composed from three emitters); no `Confirm` renderer (the budget-adjust gesture
  is an IA open thread); the **settle accent** has no live binding (DL-2). Each is named in-doc, not
  hidden — consistent with the IA/DL "name the gap" habit.
- **DL-9's doc-card depiction.** `renderCard` actually emits a ```‑fenced stat block, not box-drawing;
  the DL-9 mock represents it as an indented framed block to make the doc-vs-TUI contrast legible inside
  a fenced mock (nesting fences reads badly). Faithful in content (`<title> {mana}` / `<type> — <colors>
  (rarity)`), schematic in frame — worth a reviewer's glance to confirm the intent reads correctly.
- **`→` in the index entry** `DL-7 counter-confirm→run→settle` uses a literal `→`; harmless, matches the
  in-body usage, but a reviewer who prefers ASCII-only index slugs may want `-to-` instead.

## Critical issues needing human attention

**None.** Doc-only, gate green, all ACs met, source untouched, ticket frontmatter left for Lisa. The
charter now carries the full DL-1…9 set — atoms (T-029-01) + surfaces + card-as-lens (this ticket) —
ready for a future TUI epic to build against without re-litigating the look.
