# T-056-02 — Plan: blocked-flag-on-projection-link

Ordered, independently-verifiable steps. The whole change is one atomic commit's worth
of work; steps are sequenced so the typechecker and test runner gate each transition.

## Step 1 — Enrich the IR type and producer (src/present/project.ts)

- Add `readonly blocked: boolean` to `ProjectionLink` with a doc sentence (Change 1a).
- In `buildLinks`, hoist `const blocked = stateKey(t) !== "done";` above the inner
  `dep` loop and include `blocked` in each pushed link (Change 1b).
- Extend the `buildLinks` doc comment with one sentence on the derivation.

**Verify:** `bun run build` (typecheck) — `project.ts` compiles; no consumer of
`ProjectionLink` breaks at the type level (confirmed in research: only `as unknown as`
casts and structural `.links` reads exist downstream). Expect the *test* file to fail
typecheck/assert until Step 2, which is fine within this step boundary.

## Step 2 — Update the existing assertion (src/present/project.test.ts:117)

- Add `blocked: true` to the expected link literal (T-002-01 is `open`).

**Verify:** `bun test src/present/project.test.ts` — the links describe block passes;
no other existing assertion changed (we did not touch `miniGraph`).

## Step 3 — Add the focused AC describe block (src/present/project.test.ts)

Add `describe("projectGraph — blocked flag (edges-as-payload; T-056-02)")` with a small
local graph yielding both polarities:

- Tickets: B (done, phase done), A (done, phase done, depends_on B), C (open, depends_on
  B). Built via `buildGraph` with a wrapping story/epic, the file's existing `epic`/
  `story`/`ticket` raw-helpers.
- Test 1 — blocked:true: the link from C (`open`) has `blocked: true`.
- Test 2 — blocked:false: the link from A (`done`) has `blocked: false`.
- Test 3 — authority guard: capture `graph.tickets` ref, project, assert
  `graph.tickets` is the same ref and `Object.isFrozen(graph)` is true.
- Test 4 — determinism: `expect(projectGraph(g, spec)).toEqual(projectGraph(g, spec))`.

Use `DESIGNER_PRESET` (already imported) as the spec; grouping is irrelevant to links.
Honor `noUncheckedIndexedAccess` with `!` where indexing arrays (e.g. finding the link
by `from`), matching the file's existing style.

**Verify:** `bun test src/present/project.test.ts` — all blocks green, including the new
four tests.

## Step 4 — Full-suite + lint gate

- `bun test` — the entire suite stays green (regression guard; `projection-svg`,
  `svg-file`, `rubric` consumers unaffected as predicted).
- `bun run lint` — format/lint clean.
- Spot-confirm the authority-guard and one-way-authority suites still pass (they exercise
  the read-only invariant the new field must not violate).

**Verify:** suite count goes up by exactly the new tests added (4), with zero failures.

## Testing strategy

- **Unit (this ticket's whole surface):** `project.test.ts` is a pure-function test over
  a fabricated frozen graph — no fs, no clock. The new block adds direct coverage of both
  `blocked` polarities, the authority guard, and determinism, which together ARE the AC.
- **No integration test needed:** the change is confined to the pure IR. The renderer's
  consumption of `blocked` is T-056-03 and will carry its own tests.
- **Regression:** the existing `links` assertion update (Step 2) ensures the suite tracks
  the new IR truth rather than silently passing on a stale shape.

## Verification criteria (maps to the AC)

The AC has four conjoined clauses; each maps to a test:

| AC clause | Covered by |
|---|---|
| `blocked:true` when `from` not done | Step 3 Test 1 (+ Step 2 updated assertion) |
| `blocked:false` when `from` done | Step 3 Test 2 |
| input graph returned reference-unchanged (authority-guard) | Step 3 Test 3 |
| projection byte-identical on repeat (no clock/random) | Step 3 Test 4 |

## Risks & mitigations

- **R1 — direction misread.** Keying `blocked` off `to` instead of `from` would invert
  the flag. Mitigation: the AC and Design pin it to `from`; `from` IS the loop ticket
  `t`, and the test asserts the literal polarity (C/open→true, A/done→false).
- **R2 — wrong "done" test.** Using `t.status === "done"` would miss phase-done tickets.
  Mitigation: reuse `stateKey(t) === "done"`; Step 3 fixtures use phase `done` to keep
  the helper honest.
- **R3 — required field breaks a downstream literal.** Mitigation: research enumerated
  all construction sites; only `as-unknown` casts and the one in-file assertion exist.
  Step 1's typecheck confirms.

## Commit

Single commit after Step 4 is green:
`feat(present): blocked flag on ProjectionLink — status-derived edge decision weight (T-056-02)`
