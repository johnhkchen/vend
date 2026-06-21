# T-057-01 Plan — annotation-input-and-provenance-render-core

Ordered, independently-verifiable steps. One atomic commit (a type + one pure function + its test —
the smallest cohesive unit).

## Testing strategy

- **Unit only.** The whole ticket is a pure type + pure render — no fs, no model, no integration
  surface. The AC is satisfied by one `describe` block in `expand-effect.test.ts` (the named
  sibling), run under `bun test` with NO native addon loaded (every BAML import type-only).
- **Verification gate:** `bun run check` (= `baml:gen && check:typecheck && check:test`, per
  `package.json:19`) must be green. Typecheck proves the `Annotation`/`Signal` types line up; the
  test proves the render's AC clauses.
- No integration or manual test — there is no I/O to exercise. T-057-02 owns the staged-artifact
  integration test.

## AC → test-case mapping

The single AC decomposes into these assertions, all in the new `describe` block:

1. **Provenance line names the seat and node id** —
   `expect(out).toContain("designer")` and `expect(out).toContain("T-055-01")`, and the
   provenance line is present (`expect(out).toContain("Provenance:")`).
2. **Back-link references the annotated work item** —
   `expect(out).toContain("Back to the annotated work item")` and the link carries the node id
   (`expect(out).toContain("[\`T-055-01\`]")`), with a board-relative href
   (`expect(out).toContain("../../tickets/T-055-01.md")`).
3. **Quotes the priced signal** (the Signal param is used) —
   `expect(out).toContain(FULL_SIGNAL.what)`.
4. **Deterministic across repeat calls** —
   `expect(renderAnnotationProvenance(s, a)).toBe(renderAnnotationProvenance(s, a))`.
5. **`workItemHref` prefix mapping** (via the public render, no need to export the helper) — an
   `E-…` node → `../../epic/…`, an `S-…` node → `../../stories/…`, an unknown prefix → `#<id>`.
   Three small assertions reusing the render with different `nodeId`s.
6. **Purity is structural, asserted by construction** — the test imports the function with every
   BAML import type-only (the file's existing discipline); no runtime addon loads. (No explicit
   "imports no fs" assertion is possible/needed — it is a property of the source, reviewed in
   structure.md and visible in the diff.)

## Steps

### Step 1 — add the `Annotation` interface + `workItemHref` + `renderAnnotationProvenance`
`src/play/expand-effect.ts`, inserted after `renderStagedSignal` (line 102), before
`expandFragmentEffect`. Exact bodies in structure.md §1–3.
- **Verify:** `bun run check:typecheck` clean (the module compiles; `Signal` still type-only).

### Step 2 — add the test block
`src/play/expand-effect.test.ts`: extend the effect import to pull in `Annotation` (type) +
`renderAnnotationProvenance`; add the `describe` block with cases 1–5 above and a `FULL_ANNOTATION`
literal:
```ts
const FULL_ANNOTATION: Annotation = {
  text: "this card's blocked edge is hard to spot on the board",
  nodeId: "T-055-01",
  seat: "designer",
};
```
- **Verify:** `bun test src/play/expand-effect.test.ts` — all green, including the new block and the
  7 pre-existing tests (no regression).

### Step 3 — full gate
- **Verify:** `bun run check` green end-to-end (baml:gen + typecheck + full suite). The expected
  count is the prior suite total + the new cases, all passing.

### Step 4 — commit
One atomic commit:
```
feat(expand): typed Annotation + pure provenance/back-link render (T-057-01)
```
Body: notes the pure pieces only — `Annotation` type + `renderAnnotationProvenance`; `renderStagedSignal`
and the effect untouched (T-057-02's edge); one-way authority preserved (no write path added).

## Risk & rollback

- **Lowest-risk class of change**: adds an unexported helper, one exported pure function, one type,
  one test block. No existing symbol's behavior changes. Rollback = revert the single commit.
- **Only foreseeable snag**: an unused-binding lint on the `_text` destructure (structure.md §3
  note). Mitigation: omit `text` from the destructure entirely — only `nodeId`/`seat` are read.
- **Smart-quote/backtick care**: the trailer uses curly quotes “…” and backticked `nodeId`; the test
  asserts on substrings that avoid the quote chars where possible (match `Provenance:`,
  the bare id, and the href — not the full curly-quoted span) to stay robust.

## Out of scope (guardrails)

- No edit to `renderStagedSignal` / `expandFragmentEffect` (T-057-02).
- No `vend annotate` CLI (T-057-03).
- No write to disk or board; no new runtime import in `expand-effect.ts`.
