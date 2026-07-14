# T-029-01 — Plan: visual-atoms

Ordered, independently-verifiable steps to produce `docs/knowledge/design-language.md` (atoms:
DL-1…DL-5). Doc-only — one commit is sufficient and atomic; the "tests" are the AC checklist plus
the green gate (by non-regression).

## Testing strategy

There is no code under test — the verification is **acceptance-criteria conformance** + **gate
green**, not unit tests:

- **Unit / integration:** none added (no source). `bun run check:test` must still pass unchanged
  (853 tests today) — the doc cannot regress it because no `src/**` is touched.
- **Typecheck:** `bun run check:typecheck` unaffected (no `.ts` change).
- **AC verification:** a manual checklist (below), each item traceable to a section of the doc and to
  a live surface it grounds in. This is the real acceptance gate for a charter doc.
- **Grounding check:** every `Grounds in:` pointer names a function that exists in `src/` today
  (verified during Research: `amber`, `formatWallet`, `formatStepSignal`, `renderReceipt`,
  `renderStaleBoard`, `formatWalkAwayFindings`). If any pointer is stale, the doc is wrong, not the code.

## Steps

### Step 1 — Write the preamble
Open `design-language.md` with the IA-doc-shaped preamble: what it is / must not become (capped,
slow, anti-stale); the human-set clean-typographic direction (cite E-029, 2026-06-20); the anti-drift
clause ("where a future surface and this file disagree, fix one"); lens-scoping (cards a doc lens, the
explicit decision deferred to T-029-02 — do not contradict); "grounds in the surfaces we already
emit," naming the cited functions.
*Verify:* preamble states purpose + anti-drift + direction-is-fixed; no surface mock present.

### Step 2 — DL-1 (governing principle)
Clean-typographic restraint: type/whitespace carry it, chrome is the exception, color is meaning.
Parallel to IA-1. Name `═` as the one sanctioned rule; restraint = legibility, not austerity.
`Grounds in:` the whole emitted surface + the single-color discipline.
*Verify:* AC#1 — DL-1 present and governing.

### Step 3 — DL-2 (palette / tone meanings)
The 5-tone meaning→binding table (amber-reserved / default / dim / settle accent / never-red), no
hex. Name the two honest gaps in-table (dim-via-indent today; settle accent unbound). `Grounds in:`
`amber()`, `formatWallet`/`renderReceipt`.
*Verify:* AC#1 — palette with amber-reserved + never-red + the five tones; no hex spec.

### Step 4 — DL-3 (type hierarchy)
The terminal's levers (case/weight/dim/indent/whitespace/glyph) and the lead-vs-recede rule.
`Grounds in:` `formatStepSignal` (indent), `formatWalkAwayFindings` (`└`).
*Verify:* AC#1 — type hierarchy via terminal levers, recommendation-leads/shelf-recedes (IA-1 tie).

### Step 5 — DL-4 (the meter, IA-8)
The two-denomination honesty: `◇` detect-after burn vs `⏱` hard-wall countdown, never one bar;
distinct glyph today, countdown-vs-fill the target; name the gap. `Grounds in:` `formatWallet`.
*Verify:* AC#2 — the two-denomination meter drawn so it can't conflate ◇ and ⏱ (IA-8).

### Step 6 — DL-5 (the andon, IA-9)
Amber, calm voice, four payloads (which gate · what survived · why · next pull), non-red/non-chrome
typographic treatment; andon-rate-is-not-defect-rate (IA-10). `Grounds in:` `renderStaleBoard`,
`renderReceipt`.
*Verify:* AC#2 — amber andon with its four payloads + calm voice + non-red/non-chrome treatment.

### Step 7 — Partial index + grounding line
Close with the IA-style one-line index for DL-1…DL-5, with an explicit `(DL-6… surfaces — T-029-02)`
seam so the append target is unambiguous. Confirm a `Grounds in:` line on every principle (AC#3).
*Verify:* AC#3 — short index line per principle; grounded in live surfaces, not invented.

### Step 8 — Gate + commit
Run `bun run check:typecheck` and `bun run check:test` to confirm non-regression (doc-only). Commit
the new doc + the work artifacts. Branch is `main`; per the convention, this RDSPI run commits on the
working branch as the prior tickets did (the sweep commits land on `main` in this repo's history).
*Verify:* gate green; `git status` clean for the doc.

## Risks & watch-items

- **Scope creep into T-029-02.** The biggest risk is drifting into surface mocks (Home/Counter/
  Ledger). Mitigation: Steps 2–6 are atoms only; the index explicitly defers DL-6+. If a mock feels
  necessary to explain an atom, that is a signal the atom is under-stated — fix the prose, don't add
  the mock.
- **Stale grounding pointer.** A `Grounds in:` naming a renamed function would rot the doc. Mitigated
  by Research having verified all six function names against current `src/`.
- **Over-claiming the live look.** The meter and dim/settle gaps are real; the doc must name them
  (DL-2 table, DL-4 target-vs-today) rather than imply the code already draws the ideal. This is the
  same honesty discipline E-026/E-028 enforced on the audit numbers.
- **Length creep.** Cap ~115 lines. If it grows, density is failing — tighten, don't expand.

## Done = AC satisfied

- [ ] `design-language.md` exists: DL-1 + palette + type hierarchy — principle-level, capped, IA-shape.
- [ ] The two honest rules captured as DL-4 (meter, IA-8) and DL-5 (andon, IA-9).
- [ ] Grounded in the live surfaces; an index line per principle; `bun run check:*` green (doc-only).
