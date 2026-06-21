# T-056-02 — Review: blocked-flag-on-projection-link

## What changed

A two-file, surgical enrichment of the pure projection IR. Commit `8254fca`.

### `src/present/project.ts` (modified)
- `ProjectionLink` gained a required `readonly blocked: boolean` (+ doc comment). The IR
  now always carries dependency-decision weight.
- `buildLinks` computes `const blocked = stateKey(t) !== "done"` once per source ticket
  `t` (hoisted above the inner `dep` loop, since the flag is a property of the `from`
  ticket, not the edge target) and attaches it to each emitted link. `stateKey` was
  already imported; no new import, no new lookup — `from` is `t.id` by construction, so
  the loop variable is the `from` ticket.
- Doc comments on `ProjectionLink` and `buildLinks` updated to explain the derivation and
  its grounding in the no-new-authority discipline.

### `src/present/project.test.ts` (modified)
- Updated the existing single-link assertion (line 117) to expect `blocked: true`
  (T-002-01 is `open`).
- Added `describe("projectGraph — blocked flag (edges-as-payload; T-056-02)")` with a
  local `blockedGraph()` fixture giving both polarities and four tests (see coverage).

No files created or deleted. No renderer, preset, or model change.

## Test coverage vs. the AC

The AC is one sentence with four conjoined clauses. Each maps to a passing test:

| AC clause | Test |
|---|---|
| emits `blocked:true` for a link whose `from` is not done | "a link whose `from` is NOT done carries blocked:true" (C/open→B) + updated line-117 assertion (T-002-01/open) |
| `blocked:false` when `from` is done | "a link whose `from` IS done carries blocked:false" (A/done→B) |
| input graph returned reference-unchanged (one-way-authority / authority-guard) | "authority guard: …reference-unchanged and stays frozen" |
| projection byte-identical on repeat (no clock/random) | "determinism: same graph → byte-identical links…" |

Results: `project.test.ts` 17 pass / 0 fail (+4 new). Full suite **1278 pass / 0 fail**
across 81 files. `tsc --noEmit` clean. The repo's authority-guard and one-way-authority
suites are part of the green full run.

## Design notes a reviewer should know

- **Direction is deliberate.** `blocked` keys off the link's `from` ticket, exactly as
  the AC states. In the link model `from = t.id` (the ticket that authored `dependsOn`)
  and `to = dep` (its dependency). The epic narrates `from` as the "upstream" edge; there
  is a naming tension with the graph-theory reading where `to` is the prerequisite, but
  the AC fixes the observable behavior to `from`, and the tests assert that literal
  polarity. Flagged here so it is not "corrected" by mistake later. See design.md §"The
  semantic contract".
- **"Done" = `stateKey(t) === "done"`, not `t.status === "done"`.** `stateKey` treats a
  ticket as done if `status === "done"` OR `phase === "done"` — the same authority the
  rest of the present layer uses for grouping/color/chips. Hand-rolling the raw status
  check would disagree with the board for phase-done/status-open tickets (a real RDSPI
  state). The fixtures use `phase: "done"` to keep that path honest.
- **Required, not optional, field.** The IR always carries `blocked`, so downstream
  consumers (T-056-03's renderer, rubric, future tooling) need no presence check. The
  only typed construction sites are `as unknown as` casts (no break) and the one in-file
  assertion (updated) — verified in research before choosing required.

## Purity & one-way authority

Unchanged and re-verified. `blocked` is a pure function of node status (no clock/random);
nothing is written back to a node; the flag lives only on the fresh, deeply-frozen
`ProjectionLink`. Determinism and authority-guard tests stay green.

## Open concerns / follow-ons

- **None blocking.** The change is complete and the AC is fully discharged.
- **T-056-03 (sibling) consumes this.** `projectionToSvg` will read `blocked` to give
  edges visual weight (thicker/distinct stroke). That ticket owns the renderer change and
  its tests; `projection-svg.ts` currently ignores the new field (forward-compatible).
- **`critical` / on-critical-path flag deferred.** The epic allowed deferring the
  on-critical-path weight as a follow-on; this ticket scopes to `blocked` only, as
  decomposed. No partial/critical state was introduced.
- **`fakeProjection()` in projection-svg.test.ts** still omits `blocked` (it casts
  `as unknown as Projection`). Harmless today; T-056-03 may add it there when the renderer
  starts reading the field, for fixture honesty.

## Reviewer bottom line

Smallest-possible enrichment that satisfies the AC: one required IR field, computed at the
link's birth from the existing done-authority, with both polarities + authority +
determinism under test. Gates green. Ready for handoff.
