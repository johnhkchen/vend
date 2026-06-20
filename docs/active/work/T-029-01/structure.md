# T-029-01 — Structure: visual-atoms

The blueprint for the file this ticket produces. Doc-only: exactly **one file created**, no source
modified, no source deleted.

## Files

| Path | Change | Notes |
|---|---|---|
| `docs/knowledge/design-language.md` | **created** | Preamble + DL-1…DL-5 + partial index. Extended by T-029-02 (DL-6…). |
| `docs/active/work/T-029-01/*.md` | created | RDSPI artifacts (this set). Not shipped knowledge. |

No `src/**` touched ⇒ `bun run check:typecheck` and `check:test` are unaffected (green by
non-regression). `check:committed` / `check:head` are git-state gates, satisfied by committing the
new doc.

## `design-language.md` — section blueprint

The file mirrors `information-architecture.md`'s structure exactly (preamble → governing decision →
grouped principles → index). For this ticket the file ends after DL-5 with a **partial index**;
T-029-02 appends the surfaces sections and completes it.

```
# Vend — Design Language                                    [H1 title]

<preamble>                                                  ~14 lines
  - what it is / what it must not become (capped, slow, anti-stale)
  - the human-set direction: clean-typographic (cite E-029)
  - the anti-drift clause (verbatim spirit of the IA doc)
  - lens-scoping: cards stay a doc/spec lens, not chrome (defer the
    explicit decision to T-029-02; here just don't contradict it)
  - "grounds in the surfaces we already emit" + the cited functions

---

## The governing principle                                 [section]
**DL-1 — Clean-typographic restraint.** …                  ~12 lines
  Grounds in: the whole emitted surface; the single `amber()` helper.

---

## The palette — color is meaning, not decoration          [section]
**DL-2 — The palette / tone meanings.** …                  ~16 lines
  A meaning→binding table (5 tones), no hex.
  Grounds in: `amber()` (work-core.ts); formatWallet/renderReceipt
  default+dim usage.

---

## The type hierarchy                                       [section]
**DL-3 — Hierarchy from the terminal's levers.** …         ~14 lines
  case / weight / dim / indent / whitespace / glyph.
  Grounds in: formatStepSignal (indent), formatWalkAwayFindings (└).

---

## The two honest rules                                     [section]
**DL-4 — The meter must not lie about its two denominations.** … ~14 lines
  ◇ detect-after burn vs ⏱ hard-wall countdown; never one bar.
  Grounds in: formatWallet (IA-8).
**DL-5 — The andon is a successful refusal.** …            ~16 lines
  amber · calm voice · four payloads · non-red/non-chrome.
  Grounds in: renderStaleBoard / renderReceipt (IA-9).

---

## Index                                                    [section]
DL-1 clean-typographic-restraint · DL-2 palette-tone-meanings ·
DL-3 type-hierarchy-from-levers · DL-4 meter-cannot-lie ·
DL-5 andon-is-successful-refusal · (DL-6… surfaces — T-029-02)
```

Target length ≈ 95–115 lines (the IA doc is ~274 for 17 principles + heavy Ledger prose; five
atoms + preamble lands around the IA doc's first third — capped, as required).

## Per-principle internal shape (the contract each atom honors)

Every DL principle is: **bold lead sentence** (the invariant, stated as a decision) → 2–4 sentences
of rationale tied to an IA principle → a final **`Grounds in:`** line naming the live function(s) it
formalizes. This `Grounds in:` line is the structural innovation over the IA doc — it makes "fix one,
don't drift" checkable, because each atom points at the surface it must agree with.

### DL-1 — clean-typographic restraint (governing)
- Lead: type hierarchy + whitespace carry the information; chrome (boxes, rules) is the exception;
  color is meaning, not decoration. The parallel to IA-1's governing decision.
- Rationale: restraint is the legibility a walk-away tool needs (glance, trust, leave) — not
  austerity. Names the one rule in the whole surface (`═` receipt header) as *the* sanctioned chrome.
- Grounds in: the emitted surface as a whole; the single-color discipline (`amber()` only).

### DL-2 — palette / tone meanings (the 5-tone table)
| Tone | Means | Terminal binding (current) |
|---|---|---|
| amber | the andon — and nothing else (the one reserved saturated color) | `\x1b[33m`, gated, headline only |
| default fg | content + in-flight | the terminal default (no SGR) |
| dim / muted | metadata, envelopes, secondary readings | today: **indent + word order** (no ANSI-2 yet) |
| settle accent | a clean finish (a quiet positive close) | **intent — no live binding yet** (clean stop is plain) |
| red | — never. a stop is a refusal, not an error | **forbidden** (asserted in `amber()`'s comment) |
- The two honest gaps (dim-via-indent, settle-accent-unbound) are named in-table, not hidden.

### DL-3 — type hierarchy from the terminal's levers
- The levers: **case · weight (bold) · dim · indent · whitespace · glyph.** Rule: the recommendation
  leads (column 0, glyph + weight), the shelf/detail recedes (indent + dim). Whitespace divides; a
  rule (`═`) is the exception, not the divider.
- Grounds in: `formatStepSignal` (4-space meter indent), `formatWalkAwayFindings` (`└` sub-reading).

### DL-4 — the two-denomination meter (IA-8)
- Invariant: `◇` (tokens, a **detect-after burn** — can overshoot, the andon catches it late) and
  `⏱` (wall-clock, a **hard-wall countdown** — halts mid-flight) are drawn so they can never be
  conflated; never two identical bars. Today: distinct glyph + units (minimum-honest); target: a
  *countdown* vs a *fill* — different shapes. The gap is named (anti-drift).
- Grounds in: `formatWallet`.

### DL-5 — the amber andon (IA-9)
- Invariant: a gate-stop is a successful refusal. Rendered **amber, never red**; calm/protective
  voice; carries its **four payloads** (which gate · what survived · why, in the user's terms · the
  next pull). Set apart by typographic means — amber on the headline, metadata receding by indent,
  whitespace as the divider — **not** by red and **not** by a box. An andon rate is not a defect rate
  (IA-10) — no surface red-flags it.
- Grounds in: `renderStaleBoard` (carries all four payloads live), `renderReceipt` (andon step/stop).

## Ordering & dependencies

1. Write the preamble (sets the contract the atoms inherit).
2. DL-1 (governing) — everything below specializes it.
3. DL-2 → DL-3 (palette then hierarchy — the static tokens).
4. DL-4 → DL-5 (the two honest rules — the dynamic, load-bearing tokens).
5. Partial index.

No edit to existing files, so no cross-file ordering risk. T-029-02 appends after the index marker —
this ticket leaves the index line explicitly noting `(DL-6… surfaces — T-029-02)` so the seam is
visible and the append target unambiguous.

## What this ticket does NOT produce (T-029-02's surface)

Home/Counter/Ledger/production-line ASCII mocks; the explicit *card-as-lens-not-chrome* decision
paragraph; DL-6…; the completed index. Touching those here would create the missing-dependency-edge
collision the RDSPI concurrency rule warns about.
