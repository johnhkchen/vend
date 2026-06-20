# T-029-02 — Structure: surfaces-and-card-as-lens

The blueprint for the edit. One file changes; the change is an **append + index completion**, not a
rewrite. This file specifies exactly where text lands, the internal shape of each new principle, and the
ordering, so Implement is mechanical.

## Files

| File | Change | Why |
|---|---|---|
| `docs/knowledge/design-language.md` | **modified** — append DL-6…9 section + rewrite the index tail | The single growing charter (the IA-doc shape); atoms exist, surfaces append |
| `docs/active/work/T-029-02/*.md` | RDSPI artifacts (this set) | Workflow record |

**No source files touched.** ⇒ `bun run check:typecheck` / `check:test` cannot regress (doc-only).

## Anchor points in the existing file

`design-language.md` today (T-029-01) ends:

```
## The two honest rules
  DL-4 … (meter)
  DL-5 … (andon)

## Index
DL-1 … · DL-2 … · DL-3 … · DL-4 … · DL-5 … · *(DL-6… the surfaces — … — T-029-02.)*
```

Two edit sites:
1. **Insert** a new `## The surfaces — composing the atoms` section **between** the `## The two honest
   rules` block (ends after DL-5's `Grounds in:`) and the `## Index` heading.
2. **Replace** the index's reserved tail — the `*(DL-6… … T-029-02.)*` fragment — with the four real
   `DL-6…9` index entries.

## The new section — internal shape

A one-paragraph section intro, then DL-6…9, each as a numbered principle in the established DL format:
**bold lead sentence · the rule · a fenced ASCII mock · a `Grounds in:` pointer.** Mirrors DL-4/DL-5
exactly (which sit under their own "The two honest rules" intro).

### Section intro (~4 lines)
"These four atoms **compose** DL-1…5 into the three surfaces a TUI epic reads — Home, the Counter, the
Ledger — plus the one decision that keeps the card model a *lens*. The mocks are **reference, not pixel
specs** (real glyphs, no boxed cards, amber annotated only on the andon); where a future TUI and a mock
disagree, **fix one — they are not allowed to drift.**"

### DL-6 — Home: demand leads, supply serves (~16 lines + mock)
- Lead: the home leads with the recommendation (DL-1/IA-1 made visual) — board ranked first, shelf
  receding beneath as the inventory that serves it; the ledger summary line gives trust at a glance.
- Mock (schematic-but-faithful): a ranked **board** block (NOW + why leading), a blank line, the
  **shelf** as a numbered list (`1. <id> <title>  [Tier] · 2h/50k · ready`, a `(+K hidden — vend --all)`
  footer), a blank line, the **ledger summary line** (`E1 walk-away 87% · └ forward 50% · attested 92%`).
  No boxes. Headline at column 0; shelf list is the receding inventory.
- Honest gap named: no single `renderHome` composite emitter — Home is composed from three live emitters.
- `Grounds in:` `renderMenu` / `formatBudget` (`src/shelf/menu.ts`); `renderBoard` (`survey-core.ts`);
  `formatWalkAwayFindings` (`walk-away.ts`). Cross-ref DL-8 for the full ledger readout.

### DL-7 — the Counter: Confirm → Run → Settle (~20 lines + 3 sub-mocks)
- Lead: the Counter is the three-beat spine (IA-6); each beat composes the atoms, the meter rule stated
  once in DL-4 and only *referenced* here.
- **Confirm** sub-mock: the funding gesture — one line naming the pull, the **budget pre-filled from
  tier** (`◇ 2.0M  ⏱ 2h  [accept ↵ / adjust]`), accept-the-default the common case. Note the adjust
  mechanism is an IA open thread — the mock stays silent on its shape.
- **Run** sub-mock: the production line (DL-3 + DL-4) — `▶ casting: <pull>` at column 0, the
  two-denomination meter indented 4 spaces beneath. Node-level, not the raw stream (IA-7).
- **Settle** sub-mock: the receipt (DL-1's one `═` rule) — header, per-cast list (`✓`/`⚠` + `◇`/`⏱`),
  the wallet line, the `stopped:` line **amber only when the stop is an andon** (`← amber` annotation).
- `Grounds in:` `formatStepSignal` / `renderReceipt` (`work-core.ts`); `formatWallet` (`wallet.ts`);
  `formatBudget` (`menu.ts`).

### DL-8 — the Ledger: the andon rate is "gates working," never a red defect count (~14 lines + mock)
- Lead: IA-10 made visual — the run history + walk-away/andon readout frames the andon rate as the
  gates doing their job; **no surface red-flags that number; `⚠` is never red** (DL-2/DL-5).
- Mock: faithful `formatWalkAwayFindings` — headline walk-away rate + trend, the `└` provenance
  sub-line (E-028 forward vs attested), the `andon rate: … vs … budget — ⚠ over (gates working, not
  defects)` line with a `⚠ is NOT red` annotation, outcome mix, cost-vs-envelope.
- `Grounds in:` `formatWalkAwayFindings` (`walk-away.ts`); `formatEnvelopeLabel` (`recalibrate.ts`).

### DL-9 — card-as-lens-not-chrome (~16 lines + mock)
- Lead: the MTG card/mana model is a **doc/spec lens**, not TUI chrome; the surfaces above render *no*
  boxed cards; cost as a compact inline glyph at most. State it so no TUI epic re-introduces card chrome.
- The three clauses (Design Decision 6): (1) the lens lives in `card-model.md` + the epic `.md` cards
  (`renderCard`'s stat block is *doc* chrome); (2) the TUI renders no boxed cards (already true —
  `renderMenu` is a list); (3) cost as an inline glyph (`{U}` / `2h/50k`) at most.
- Mock: **two columns of contrast** — left, the *doc* card (the fenced `<title> {2}{U}` stat block as
  it appears in an epic `.md`); right, the *TUI* shelf (the numbered list, no box). One glance shows the
  lens framed in the doc, the surface flat in the TUI.
- Binding clause: no TUI epic re-introduces card chrome by default; a surface that wants a card changes
  DL-9 first (anti-drift).
- `Grounds in:` `renderCard` (`propose-core.ts`, the lens in the doc) vs `renderMenu` / `renderReceipt`
  (the TUI, no cards); `card-model.md`.

### Index rewrite
Replace the reserved tail fragment with:
```
DL-6 home-demand-leads-supply-serves · DL-7 counter-confirm→run→settle ·
DL-8 ledger-gates-working-not-a-defect-count · DL-9 card-as-lens-not-chrome.
```
Appended to the existing `DL-1 … · DL-5 …` line so the index is one continuous list of nine.

## Ordering of changes

1. Insert the `## The surfaces — composing the atoms` section (intro + DL-6 → DL-9) before `## Index`.
2. Rewrite the index tail (remove the `*(DL-6… T-029-02)*` placeholder, add DL-6…9 entries).
3. Run `bun run check:typecheck && bun run check:test` — expect green (doc-only non-regression).

Steps 1–2 are one file; they commit together as a single doc commit. Step 3 is the gate, not a change.

## Internal-consistency checklist (the anti-drift contract)

- Every mock uses **only** the live glyph vocabulary (DL-3): `▶ ✓ ⚠ ◇ ⏱ └ ═ · {…}`. No new glyphs.
- **No box-drawing frame** anywhere except the receipt's single `═` header and the `└` leader.
- **Amber annotated only on andon lines** (`← amber`); nowhere else (DL-2's "amber and nothing else").
- **No boxed cards** in any TUI mock; the only fenced stat block is DL-9's *doc* card (explicitly the
  contrast).
- Each DL-6…9 ends with a `Grounds in:` pointer to a real, named live emitter (verified in Research §3).
- Honest gaps (no `renderHome`, no Confirm renderer, settle accent) are **named**, consistent with the
  DL-2/DL-4 "name the gap" habit — not hidden.
- The file stays **capped** — section ≈ 90–110 lines, principle-level, not a component spec.
