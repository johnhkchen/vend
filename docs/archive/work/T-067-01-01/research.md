# T-067-01-01 — charter-code-snapshot-resolver — Research

Descriptive map of what exists, where, and how it connects. No solutions proposed here.

## The ticket in one line

Build the story's foundation: a new PURE resolver module that, fed charter text, yields a
code→one-line-text snapshot map — every `P1..P7` / `N1..N4` resolves to its carried one-liner,
an unknown/retired code resolves to a *typed absence* the caller must handle (never a silent
`""`). Pure unit tests (no fs, no BAML addon) pin it, including against the LIVE charter text.

## Story context (S-067-01, read first)

- Scope: this ticket is the resolver ONLY. materialize.ts's render pair + impure verb
  (T-067-01-02) and the bare-code write guard (T-067-01-03) are sequenced AFTER it — both
  "build on its settled code→one-liner contract". gates.ts's bounds gate and the BAML
  decompose prompt are explicitly untouched.
- Honest boundary: everything fixture-proven and FREE (no tokens). The live metered cast is a
  deferred, human-authorized close-out.
- Out of slice: amending the charter, backfilling old artifacts, read-side stripping in
  lisa/kitchen tooling.

## The charter — the input this resolver parses

`docs/knowledge/charter.md` (the default; `project-context.ts` line 18 pins
`CHARTER_PATH = "docs/knowledge/charter.md"` and `assembleInputs` reads it verbatim — "the
charter MUST be the real one"). Code definitions live in two bullet lists:

- Invariants: `- **P1 — Author once, run forever.** Cost lives at authoring; never push spec…`
  (P1..P7, lines 64–76). The bold span is `**P<n> — <title>.**` followed by body prose; the
  body may WRAP across lines, but every bold `**…**` span itself sits on a single line today.
- Non-goals: `- **N1 — Not a chat copilot.** The win is removing yourself…` (N1..N4, lines 80–86).

Codes also appear OUTSIDE definitions (`advances: [P…]` in prose, `P1`/`N4` examples in the
"How planning uses this charter" section is absent today but nothing forbids it) — so "any
occurrence of `P\d+`" is not the same set as "codes the charter *defines*".

Other charters exist: `examples/templates/kitchen-seed/charter.md` uses **K1..K3** codes in the
same `- **K1 — Title.** body` bullet shape (plus unnumbered bold non-goal bullets);
`examples/templates/hackathon-seed/charter.md` is a sibling. The epic's intent line says
"P/N/PE" codes, but `PE\d+` appears nowhere in the repo (grep-verified); the ticket AC scopes
the pin to P1..P7 + N1..N4.

## The existing code-matching precedent — gates.ts `matchIds`

`src/gate/gates.ts` line 123: private `matchIds(text, prefix: "P" | "N")` greps
`\b<prefix>\d+\b` out of the whole charter string into a `Set`. The bounds gate (line 283)
derives its valid set from it at call time — "alignment is recomputed, never stored". It
matches ANY occurrence, definition or not, and carries no text — codes only. It is NOT
exported, and the story says gates.ts is untouched, so the resolver cannot (and must not)
reuse it. The two serve different questions: bounds asks "is this code known?", the resolver
asks "what did this code SAY?".

## Purity house pattern — the exemplar is `src/play/id-guard.ts`

The purest module in the tree and the explicit model for a new pure-judgment module:

- No fs / clock / network / process / native addon; NOT EVEN a type-only BAML import (it takes
  plain strings). This ticket's AC demands the same ("no fs, no BAML addon") — and unlike
  gates.ts, the resolver needs no WorkPlan types at all, so it can match id-guard's zero-import
  standard.
- Total functions, typed absence as DATA: `findExistingByTitle` returns `string | null` for
  "no match"; `detectCollisions` returns `[]` for clear. House rule (gates.ts header,
  materialize.ts `alias`): EXPECTED absence/refusal is returned data; a programmer/wiring
  error THROWS (`RangeError` on enum drift).
- The "silent empty string" the AC forbids has a live counter-precedent to avoid: nothing in
  the tree currently resolves codes to text, so the failure mode is hypothetical but the AC
  makes it contractual.

## Where the consumers will sit (module home)

Both downstream consumers live in `src/play/`: `materialize.ts` (render pair gains a charter
parameter, T-067-01-02) and `decompose-epic.ts`'s effect (supplies `ctx.inputs.charter`, which
it already holds — `DecomposeInputs.charter`, assembled by `project-context.ts`). Pure
siblings there: `id-guard.ts`, `decompose-epic-core.ts`, `*-core.ts`. The gate layer
(`src/gate/`) is declared untouched by the story. Dependency direction to respect: play →
gate (decompose-epic-core value-imports `isStop` from gates.ts), never gate → play.

## Test terrain

- Pure-test discipline: `id-guard.test.ts`, `gates.test.ts`, `materialize.test.ts` are
  ordinary bun tests over pure functions; fabricated string/object fixtures; enum members as
  cast strings. `gates.test.ts` line 22 builds a small inline `CHARTER` fixture carrying
  P1..P7/N1..N4 — a precedent for fabricated charter fixtures.
- Feeding the LIVE charter with no fs: Bun resolves `import x from "….md" with
  { type: "text" }` natively, and `src/kitchen/seed-text-modules.d.ts` ALREADY declares the
  `*.md` wildcard module as `string` for tsc (kitchen-overlay.ts imports charters this way,
  including `examples/templates/kitchen-seed/charter.md`). So a test can text-import
  `docs/knowledge/charter.md` at module load — no `readFile`, no fs call in the test body.
  This is the only mechanism in the tree that satisfies "fed the live charter text" + "no fs"
  simultaneously; the alternative (copy the charter into a fixture string) drifts silently.
- `bun run check` (typecheck + lint + tests) is the repo's real gate (CLAUDE.md, project
  memory); `bun test <file>` runs one suite.

## Sibling-ticket boundaries (wave rationale: sequential, overlapping file)

- **T-067-01-01 (this)**: the new resolver module + its pure test. NOTHING else — no
  materialize.ts edit, no gates.ts edit, no runner edit.
- T-067-01-02: materialize.ts render pair + `materialize` verb + decompose runner threading.
  Its AC already fixes the rendered SHAPE: `'P4 — Autonomy by default, not supervision'`
  (code kept + carried text).
- T-067-01-03: the named-andon write guard (IdCollisionError-style typed refusal) + cast-level
  fixture proof.

## Constraints and assumptions surfaced

1. The one-liner's exact extent is under-specified across the source docs: story acceptance
   shows title-only (`P4 — Autonomy by default, not supervision`); the epic's done-looks-like
   shows title+gloss (`P3 — Gates are the contract: quality lives inside the work`). The
   charter's own structure (bold `**CODE — Title.**` + prose body) gives a natural seam.
   Design must pick one and say why.
2. "Unknown or retired code" is an EXPECTED input (retiring an invariant is a charter feature
   — amendment rule), so per house rule it must be returned data, not a throw. What TYPE the
   absence takes (union member, `null`, `undefined` from a Map) is a Design decision; the AC
   only demands it be typed and unskippable.
3. The resolver must key on the charter's DEFINITION pattern, not any `P\d+` occurrence —
   otherwise a prose mention (`advances: [P…]`-style examples) could shadow or duplicate a
   definition. matchIds' any-occurrence semantics is the wrong tool here; the two coexist.
4. Duplicate definitions of the same code in one charter (author error) have no current
   detector anywhere; whether the resolver detects, ignores, or last-wins is undecided.
5. The map must be cheap to build per cast (charters are ~1 page, capped by the amendment
   rule) — no caching pressure.
6. T-067-01-02's AC fixes the RENDERED format (`P4 — <text>`, code kept). Whether the
   resolver's VALUE carries the code prefix or just the text decides who owns that formatting
   — a contract-shape question for Design.
7. Generality: kitchen charters use K-codes. The ticket AC pins only P/N; whether the parser
   is prefix-generic (any `[A-Z]+\d+`) or P/N-only changes nothing for this AC but decides
   whether kitchen artifacts can ever carry snapshots without a resolver edit.
