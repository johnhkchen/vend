# T-057-03 — Plan

_Ordered, independently-verifiable steps. Testing strategy and verification criteria. Small enough to
commit atomically._

## Testing strategy

- **Unit (the new coverage):** `cli.test.ts` pins `parseAnnotateArgs` through `parseArgs` — pure,
  fast, no fs/BAML. Covers the AC's parse + usage-banner clauses (8 cases, see structure.md).
- **Inherited (no new test):** the "stages a provenance-bearing signal and touches nothing on the
  board" clause is owned by `expand-effect.test.ts` (T-057-02 AC#1 effect test) and reached by the
  dispatch arm's composition over `castExpandFragment`. Not re-tested (would duplicate). Cited in
  review.md per Design D4.
- **Dispatch arm:** the thin untested shell (house pattern — `cli.test.ts` never imports the
  dispatch or BAML). Type-checked by `tsc --noEmit`.
- **Gate:** `bun run check` (tsc + full `bun test`) must be green; expect prior count + 1 new test
  file's cases (1287 → 1287 + N suite total). NOTE: the gate is `bun run check`, not `bun run lint`
  (there is no lint script — confirmed; the correct green gate is `bun run check`).

## Steps

### Step 1 — Parser + union + route + USAGE (the pure surface)

Edits 1–4 from structure.md, together (they are one cohesive pure change):
1. Add the `vend annotate …` USAGE line after the expand line.
2. Add the `annotate` member to `ParsedCommand`.
3. Add `if (argv[0] === "annotate") return parseAnnotateArgs(argv);` to `parseArgs`.
4. Add `parseAnnotateArgs` after `parseExpandArgs`.

**Verify:** `bunx tsc --noEmit` clean. (No behavior yet beyond parsing.)

### Step 2 — Parser tests

Add the `describe("parseArgs — annotate (T-057-03 …)")` block to `cli.test.ts` (8 cases from
structure.md).

**Verify:** `bun test src/cli.test.ts` — all annotate cases green, no regression in the file.
Maps to AC: cases 1–4 = "parses node id, feedback, and seat"; cases 5–6 = "rejects a missing
node-id/feedback with the usage error"; case 7 = bad-seat usage; case 8 = "the usage banner lists
`vend annotate`".

### Step 3 — Dispatch arm (the thin shell)

Add the `if (parsed.cmd === "annotate")` arm after the expand arm (edit 5). Lazy-imports
`castExpandFragment`/`expandFragmentPlay`, builds the `Annotation`, casts, prints the receipt,
exits.

**Verify:** `bunx tsc --noEmit` clean (the arm is type-checked: `parsed.nodeId/feedback/seat` exist
on the narrowed union member; `seat: Seat` satisfies `Annotation.seat: string`).

### Step 4 — Full gate + commit

**Verify:** `bun run check` green (tsc + full suite). Then ONE atomic commit:
`feat(annotate): vend annotate <node-id> "<feedback>" gesture casts an annotation-bearing expand (T-057-03)`.

## AC → step/test traceability

| AC clause | Where satisfied |
|---|---|
| parses node id, feedback, and seat | Step 2, cases 1–4 |
| rejects missing node-id/feedback with usage error (mirrors parseExpandArgs) | Step 2, cases 5–6 |
| (bad seat usage error) | Step 2, case 7 |
| usage banner lists `vend annotate` | Step 1 (USAGE line) + Step 2, case 8 |
| running end-to-end stages a provenance-bearing signal | Step 3 dispatch composes `castExpandFragment(annotation)` → effect, pinned by T-057-02 |
| touches nothing on the board | inherited one-way-authority effect, pinned by T-057-02 expand-effect.test.ts |

## Risks / mitigations

- **R: `--seat` value missing reads `undefined`** → membership check fails → seat usage error. This
  is the desired behavior (matches svg). No special handling needed.
- **R: feedback starting with `--`** (e.g. `annotate T-1 --foo`). `--foo` is not `--seat`, so it is
  collected as positional feedback. Acceptable — mirrors expand, which collects any non-`--budget`
  token as fragment. The honest-empty/value-link gates downstream judge content, not the parser.
- **R: count drift in the gate.** If a sibling ticket on the same branch added tests, the absolute
  count may differ; the criterion is "green + my N cases present," not a fixed number.

## Out of scope (explicit)

- Any live MCP comment FETCH (the E-057 follow-on) — this gesture takes feedback as plain CLI text.
- Any new effect/staging path — reuses T-057-02's annotation-capable cast whole.
- `--budget` on annotate — the dispatch uses the play's warranted envelope.
