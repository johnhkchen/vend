# T-029-02 — Plan: surfaces-and-card-as-lens

Ordered, verifiable steps to append DL-6…9 (the surfaces) + the card-as-lens decision to
`design-language.md` and complete the index. Doc-only; one logical commit. Each step is small enough to
verify against the Structure blueprint and the ACs.

## Testing strategy

- **No unit tests** — doc-only; no source touched. The DL doc has no test harness (mirrors
  `information-architecture.md`, which is also untested prose).
- **Verification = the gate + the AC checklist.** `bun run check:typecheck && bun run check:test` must
  stay green (non-regression proof that no source was touched). Then a manual pass over the three ACs.
- **Anti-drift self-check** is the real review: every mock's glyphs/indent must match the live emitter it
  cites (Research §3), and the consistency checklist (Structure) must pass.

## Steps

### Step 1 — Re-read the file's tail and confirm anchor points
- Read `design-language.md` lines ~95–115 (the DL-5 `Grounds in:` line through the Index) to confirm the
  exact insertion point (between DL-5 and `## Index`) and the precise reserved-tail string to replace.
- Verify the index placeholder reads `*(DL-6… the surfaces — … — T-029-02.)*` so the Edit matches uniquely.
- **Verify:** anchor strings located; no surprises vs Structure.

### Step 2 — Draft the surfaces section (intro + DL-6…9) in-place
- Insert `## The surfaces — composing the atoms` + intro + DL-6, DL-7, DL-8, DL-9 immediately before
  `## Index`, following the Structure shapes exactly. Use a single Edit that appends the block before the
  `## Index` heading (anchor on `\n## Index\n`).
- Each principle: **bold lead · rule · fenced ASCII mock · `Grounds in:`**, the DL-4/DL-5 format.
- Apply the consistency checklist while drafting: only the live glyph set, no boxed cards, amber
  annotated only on andon lines, every mock recognizably its live emitter.
- **Verify:** four principles present, each with a mock and a `Grounds in:`; section ≈ 90–110 lines.

### Step 3 — Complete the index
- Replace the reserved tail fragment with the four real entries (Structure §Index rewrite), appended to
  the existing `DL-1…DL-5` index line so it reads as one continuous nine-entry list.
- **Verify:** index lists DL-1 through DL-9; no leftover `T-029-02` placeholder.

### Step 4 — Run the gate
- `bun run check:typecheck && bun run check:test`.
- **Verify:** green (the 853-test suite from T-028-01/T-029-01; doc-only ⇒ unchanged). Record the count
  in `progress.md`. If anything is red, it is unrelated to this change (no source touched) — note it but
  do not let it block the doc, and confirm by `git status` showing only `.md` files changed.

### Step 5 — Self-consistency pass (the anti-drift review)
- Walk each mock against the live emitter it grounds in (open `renderMenu`, `formatStepSignal`,
  `renderReceipt`, `formatWalkAwayFindings`, `renderCard` side-by-side). Confirm glyphs, indent, and the
  "no boxed cards / amber-only-on-andon" rules hold.
- Confirm DL-9's doc-vs-TUI contrast is unambiguous and the binding clause ("change DL-9 first") is present.
- Confirm cross-consistency with DL-1…5 (no contradiction of the atoms; the card-as-lens decision the
  atoms layer deferred to this ticket is now stated).
- **Verify:** all three ACs satisfied (checklist below).

### Step 6 — Commit
- Stage `docs/knowledge/design-language.md` + the `docs/active/work/T-029-02/` artifacts.
- Commit: `feat(design-language): compose the surfaces — DL-6…9 + card-as-lens (T-029-02)`.
- Do **not** edit the ticket frontmatter (Lisa advances phases from artifacts).
- **Verify:** `git show --stat` lists only the doc + work artifacts; no source files.

## AC → step traceability

| Acceptance criterion | Satisfied by |
|---|---|
| DL principle per surface — Home, Counter (Confirm→Run→Settle), Ledger — clean-typographic key, small ASCII mock, atoms-consistent (type-led, amber only on the andon, no boxed cards) | Step 2 (DL-6, DL-7, DL-8) + Step 5 (consistency) |
| Card-as-lens-not-chrome captured as an **explicit** DL principle (doc lens; TUI renders no card chrome; cost as inline glyph at most) | Step 2 (DL-9) + Step 5 (doc-vs-TUI contrast + binding clause) |
| Charter capped + anti-stale (principle + index line per DL, IA-doc shape), self-consistent with T-029-01, grounded in live emitted surfaces; `bun run check:*` green (doc-only) | Step 2 (`Grounds in:` per DL) + Step 3 (index) + Step 4 (gate) |

## Risks & watch-items

- **Edit anchor non-unique** — if `\n## Index\n` or the tail fragment appears twice, the Edit fails
  loudly; Step 1 confirms uniqueness first. Mitigation: anchor on the longer reserved-tail string.
- **Mock drift from the live emitter** — the one real risk in a doc like this. Mitigation: Step 5's
  side-by-side pass; schematic-but-faithful (Design Decision 3) keeps mocks from freezing volatile
  numbers while staying recognizable.
- **Over-length** — surfaces could balloon past the cap. Mitigation: four atoms, three sub-mocks for the
  Counter only, principle-level prose; target ≤ ~110 added lines.
- **Re-introducing chrome by accident** — a mock that boxes the shelf would contradict DL-9 in the same
  file. Mitigation: the consistency checklist's "no boxed cards" line, checked per mock.
