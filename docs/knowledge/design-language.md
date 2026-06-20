# Vend — Design Language

The durable anchor for **what Vend looks like** — the concrete visual surface the eventual TUI
implements. Like `information-architecture.md`, this is small by design and slow by design:
principle-level, capped, anti-stale. Where `information-architecture.md` settled *what the user sees
and how they move*, this settles *what it looks like*, so a TUI epic builds a decided look instead of
re-litigating it. Where a future surface and this file disagree, **fix one — they are not allowed to
drift.**

The direction is **set by the human (2026-06-20, E-029): clean typographic.** Terminal-native
restraint — type hierarchy, weight/case, indent, and whitespace carry the information; chrome (boxes,
rules) is the exception; **color is meaning, not decoration.** This file is **not** an audit and
**not** a re-opening of that direction; it captures it as **DL-1…DL-N**, the visual complement to the
IA spine.

The MTG **card/mana model stays a lens** — it lives in `card-model.md` and the specs (and the epic
cards), not as TUI chrome; the TUI does not render boxed cards. (The explicit *card-as-lens-not-
chrome* decision is stated with the surfaces in T-029-02; this atoms layer only must not contradict
it.) These atoms **ground in the surfaces Vend already emits** — `formatWallet`, `formatStepSignal`,
`renderReceipt`, `renderStaleBoard` (`src/play/work-core.ts`, `src/budget/wallet.ts`),
`formatWalkAwayFindings` (`src/ledger/walk-away.ts`) — so the charter formalizes the **live** look,
not an imagined one. Each principle ends with a `Grounds in:` pointer naming the surface it must
agree with, so "fix one, don't drift" has a referent.

---

## The governing principle

**DL-1 — Clean-typographic restraint.** Type hierarchy and whitespace carry the information; **chrome
(boxes, rules) is the exception, not the frame; color is meaning, not decoration.** This is the
visual parallel to IA-1's recommendation-first decision — it sets the visual hierarchy everywhere
below it: the recommendation leads, detail recedes, and the surface earns attention by what it *says*,
not by what it draws around it. The whole emitted surface uses exactly **one** rule — the receipt's
`═` header — and exactly **one** saturated color — amber, for the andon. Restraint here is not
austerity: it is the legibility a walk-away tool needs. You glance, you trust, you leave; ornament
would cost you the glance. *Grounds in:* the emitted surface as a whole; the single-color discipline
(`amber()` is the only ANSI color helper in `src/`).

---

## The palette — color is meaning, not decoration

**DL-2 — Each tone means one thing.** The palette is a vocabulary of *meanings*, not a hex spec. Five
tones, and what each is *for* (with its current terminal binding — the live anchor, not a frozen RGB):

| Tone | Means | Terminal binding (today) |
|---|---|---|
| **amber** | the andon — **and nothing else** (the single reserved saturated color) | `\x1b[33m`, gated, headline only |
| **default foreground** | content + in-flight work | the terminal default (no SGR) |
| **dim / muted** | metadata, envelopes, secondary readings | today **indent + word order** (no ANSI-2 applied yet) |
| **settle accent** | a clean finish — a quiet positive close | **intent only — no live binding yet** (a clean stop renders plain) |
| **red** | — never. A stop is a *successful refusal*, not an error (IA-9) | **forbidden** (asserted in `amber()`'s own comment) |

Amber is reserved: it appears *everywhere the andon appears and nowhere else*, so its presence always
means "a gate held the line." Two gaps are named, not hidden: **dim** is currently approximated by
indentation rather than a dim attribute, and the **settle accent** is an intent the current surface
does not yet render. A richer surface (the TUI) closes both — and when it does, this table is the
contract it closes them *against*. *Grounds in:* `amber()` (work-core.ts); the default+indent usage
in `formatWallet` / `renderReceipt`.

---

## The type hierarchy

**DL-3 — Hierarchy comes from the terminal's few levers, used deliberately.** A terminal has almost
no type to spend, so the hierarchy is built from a deliberate handful of levers: **case · weight
(bold) · dim · indent · whitespace · glyph.** The rule, inherited from IA-1: the *recommendation
leads* and the *shelf/detail recedes*. Leading elements sit at column 0 with a glyph and weight
(`▶ casting`, `✓ done`, `⚠`); subordinate detail recedes by indent (the meter is indented beneath its
production-line label) and by a box-drawing leader (`└` carries a sub-reading *beneath* its headline).
**Whitespace is the divider** — blank lines separate the receipt's blocks; a rule (`═`) is the
exception, used once. Nothing is framed that indentation and a blank line can separate. *Grounds in:*
`formatStepSignal` (the 4-space meter indent under the label), `formatWalkAwayFindings` (the `└`
sub-reading under the headline rate).

---

## The two honest rules

These two atoms are **load-bearing**, not decoration: they encode the constraints the surface is not
allowed to lie about.

**DL-4 — The meter must not lie about its two denominations (IA-8).** The budget has two
denominations that behave *differently*, so they must be *drawn* differently — never two identical
bars. **`◇` tokens** are a **detect-after burn**: a cast's actual burn can overshoot what remained
(the cast already ran; the andon catches it afterward — proven live at 108.9k/60k), so `◇` reads as a
burn-vs-envelope that can trip the andon *late*. **`⏱` wall-clock** is a **hard wall**: an overrun
halts mid-flight, so `⏱` reads as a *countdown to a hard stop*. Today the two are kept honest by
**distinct glyphs and distinct units** (the minimum-honest form — `◇ 120k/2.0M · 1.9M left   ⏱ 12m/2h
· 1h48m left`, one formatter, never collapsed to a single bar). The **target** a TUI implements is two
distinct *shapes* — a fill for `◇`, a countdown for `⏱` — not just two glyphs on one shape. That gap
is named so the doc and the code can be reconciled, never silently diverge. *Grounds in:*
`formatWallet` (the single source of two-denomination truth).

**DL-5 — The andon is a successful refusal, set apart without red and without chrome (IA-9).** When a
gate stops the line, the surface must make the user feel *the tool just earned its keep* — not that
something broke. So the andon is rendered **amber, never red**, in a **calm, protective voice** ("a
successful stop, not a crash"; "spending would clear superseded work"), and it carries its **four
payloads**: *which gate fired · what survived (nothing partial) · why, in the user's terms · the next
pull* (it hands you the move). It sets itself apart by **typographic means** — amber on the headline
only, the metadata receding by indent, whitespace as the divider — **not** by red and **not** by a
box. An andon rate is not a defect rate (IA-10): no surface red-flags that number. This is DL-1
applied to the most design-laden moment — restraint *is* the reassurance. *Grounds in:*
`renderStaleBoard` (the live andon already carrying all four payloads), `renderReceipt` (the andon
step + stop lines).

---

## The surfaces — composing the atoms

These four atoms **compose** DL-1…5 into the three surfaces a TUI epic reads to know what to build —
**Home, the Counter, the Ledger** — plus the one decision that keeps the card model a *lens*. The mocks
are **reference, not pixel specs**: real glyphs, no boxed cards, amber annotated `← amber` only on the
andon (the doc is plain text). Each surface is a *composition* of emitters Vend already prints, so the
charter formalizes the live look; where a future TUI and a mock disagree, **fix one — they are not
allowed to drift.** Each principle ends with a `Grounds in:` pointer naming the surface it must agree
with.

**DL-6 — Home leads with demand; supply serves beneath.** This is DL-1 applied to the whole screen and
the visual parallel to IA-1: the top is *the one thing worth doing now, and why* (the pull board, ranked
by leverage), the **shelf receding beneath** as the inventory that serves the recommendation, and a
**ledger summary line** giving trust at a glance (provenance-split since E-028 — forward vs attested).
The board leads at column 0; the shelf is a **numbered list, never a grid of cards** (DL-9); the ledger
line recedes to the foot. Whitespace divides the three regions — no boxes, no rules.

```
NOW  ▶ scaffold the Bun/TypeScript project   [Keystone] · why: unblocks every other pull
     · split the audit by provenance          [Standard] · why: the walk-away stat over-claims

shelf
  1. survey   read the project → propose a board   [Keystone] · 2h/50k  · ready
  2. work     clear the board's top pull           [Standard] · 2h/2.0M · ready
  (+3 hidden — vend --all)

ledger   E1 walk-away 87% (13/15)   └ forward 50% · attested 92%      (full readout: DL-8)
```

The honest gap, named not hidden: there is **no single `renderHome` composite emitter today** — Home is
the CLI composing `renderMenu` + `renderBoard` + the audit summary line; this mock formalizes the
*composition*, and a TUI closes the gap against it. *Grounds in:* `renderMenu` / `formatBudget`
(`src/shelf/menu.ts`), `renderBoard` (`src/play/survey-core.ts`), `formatWalkAwayFindings`
(`src/ledger/walk-away.ts`).

**DL-7 — The Counter is the Confirm → Run → Settle spine (IA-6).** One surface, three beats:
point-of-sale → assembly line → receipt. Each beat *composes* the atoms — the meter rule lives in DL-4
and is only referenced here, never redrawn. **Confirm** is the funding gesture: the budget is pre-filled
from the board's leverage tier, so *accept-the-default* is the common case (the adjust gesture's shape is
an IA open thread — the mock stays silent on it). **Run** is the production line (DL-3 + DL-4): the
running pull at column 0, the two-denomination meter indented beneath — node-level, never the raw
executor stream (IA-7). **Settle** is the receipt: the one `═` rule (DL-1), the per-cast list, the wallet
line, and a `stopped:` line that goes **amber only when the stop is an andon** (DL-5).

```
Confirm   ▶ clear: scaffold the Bun/TypeScript project   [Keystone]
            budget  ◇ 2.0M   ⏱ 2h        (pre-filled from tier — accept ↵ / adjust)

Run       ▶ casting: scaffold the Bun/TypeScript project
            ◇ 120k/2.0M · 1.9M left   ⏱ 12m/2h · 1h48m left

Settle    ═ vend work — receipt ═

          cast 3, cleared 2:
            ✓ <pull>   ◇ 45k   ⏱ 6m
            ⚠ <pull>   andon: gate-failed   ◇ 30k   ⏱ 4m          ← amber
            ✓ <pull>   ◇ 52k   ⏱ 7m

          wallet: ◇ 127k/2.0M · 1.9M left   ⏱ 17m/2h · 1h43m left
          stopped: board cleared — nothing left worth clearing
```

*Grounds in:* `formatStepSignal` / `renderReceipt` (`src/play/work-core.ts`), `formatWallet`
(`src/budget/wallet.ts`), `formatBudget` (`src/shelf/menu.ts`).

**DL-8 — The Ledger renders the andon rate as "gates working," never a red defect count (IA-10).** Run
history + the walk-away/andon readout. The load-bearing visual rule is IA-10 made concrete: an andon
rate is the *gates doing their job* rate, so **no surface red-flags that number — `⚠` is the andon glyph
(amber family), never red** (DL-2/DL-5). The headline walk-away rate leads; the `└` provenance sub-line
recedes beneath it (E-028 forward vs attested); the andon line carries its own "gates working, not
defects" framing in words, not color.

```
E1 — walk-away trust · all plays · 15 runs [standard]
  walk-away rate: 87% (13/15 ran untouched) · trend 80% → 93% (target → 100%)
    └ forward (live): 50% (1/2) · attested back-fill: 92% (12/13)
  andon rate: 13% vs 10% budget — ⚠ over (gates working, not defects)      ← ⚠ is NOT red
  outcome mix: 13 success · 1 censored · 1 gate-failed · 0 id-collision
  cost vs envelope: tokens ×0.82 · time ×0.74 (median, 12 successful runs)
```

*Grounds in:* `formatWalkAwayFindings` (`src/ledger/walk-away.ts`), `formatEnvelopeLabel`
(`src/ledger/recalibrate.ts`).

**DL-9 — The card/mana model is a lens, not chrome.** The MTG card model gives *budget*, the
*single-use-vs-reusable* axis, and the play taxonomy a precise shape — but it is a **doc/spec lens**, not
TUI furniture. Three clauses, stated so no TUI epic re-introduces card chrome by default:
1. **The lens lives in the doc** — `card-model.md` and the proposed epic `.md` files. `renderCard`'s
   framed stat block is *doc* chrome: a reading aid for authors, never a widget.
2. **The TUI surfaces render no boxed cards** — Home / Counter / Ledger above are lists, rows, one `═`
   rule, indentation. This is **already true in code** (the shelf `renderMenu` is a numbered list, not a
   card grid); DL-9 only names the existing split so it is not lost.
3. **Cost may appear as a compact inline glyph at most** — the `2h/2.0M` envelope, or a mana glyph like
   `{U}` — never a framed card.

```
the LENS — in the doc (card-model.md, the epic .md renderCard writes):

    Scaffold the Bun/TypeScript project   {2}{U}
    Epic — Blue   (rarity: keystone)
    ↑ a framed stat block — a reading aid for authors, NOT a TUI widget

the SURFACE — in the TUI, the same play renders FLAT, no card, no box:

    2. work   clear the board's top pull   [Standard] · 2h/2.0M · ready
    ↑ cost is the inline envelope (2h/2.0M), or at most a glyph {U}; never a framed card
```

The binding clause (anti-drift): **no TUI epic re-introduces card chrome by default; a surface that
wants a card changes DL-9 first.** *Grounds in:* `renderCard` (`src/play/propose-core.ts`, the lens in
the doc) vs `renderMenu` / `renderReceipt` (the TUI, no cards); `card-model.md`.

---

## Index

DL-1 clean-typographic-restraint · DL-2 palette-tone-meanings (amber-reserved · never-red) ·
DL-3 type-hierarchy-from-the-terminal's-levers · DL-4 meter-cannot-lie-about-two-denominations ·
DL-5 andon-is-a-successful-refusal · DL-6 home-demand-leads-supply-serves ·
DL-7 counter-confirm→run→settle · DL-8 ledger-gates-working-not-a-defect-count ·
DL-9 card-as-lens-not-chrome.
