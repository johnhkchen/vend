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

## Index

DL-1 clean-typographic-restraint · DL-2 palette-tone-meanings (amber-reserved · never-red) ·
DL-3 type-hierarchy-from-the-terminal's-levers · DL-4 meter-cannot-lie-about-two-denominations ·
DL-5 andon-is-a-successful-refusal · *(DL-6… the surfaces — Home / Counter / Ledger / production-line
mocks + the card-as-lens decision — T-029-02.)*
