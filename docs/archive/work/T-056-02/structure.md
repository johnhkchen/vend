# T-056-02 — Structure: blocked-flag-on-projection-link

The blueprint. Two files change; both are surgical. No files created or deleted.

## File 1 — `src/present/project.ts` (MODIFY)

### Change 1a — the IR type `ProjectionLink` (lines 59–63)

Add one field + a doc sentence. The field is required and readonly, matching the
immutability idiom of the surrounding output types.

```ts
export interface ProjectionLink {
  readonly from: string;
  readonly to: string;
  readonly kind: "depends_on";
  /** Status-derived decision weight: true when the `from` ticket is not done (its
   *  state key ≠ "done"). Pure-derived from the frozen graph — no new authority. */
  readonly blocked: boolean;
}
```

### Change 1b — the producer `buildLinks` (lines 185–195)

At the single push site, attach `blocked` computed from the loop ticket `t` (which IS
the `from` ticket). `stateKey` is already imported (line 35).

```ts
function buildLinks(tickets: readonly TicketNode[]): ProjectionLink[] {
  const ticketIds = new Set(tickets.map((t) => t.id));
  const links: ProjectionLink[] = [];
  for (const t of tickets) {
    const blocked = stateKey(t) !== "done"; // `from` is `t`; reuse the done-authority
    for (const dep of t.dependsOn) {
      if (ticketIds.has(dep)) links.push({ from: t.id, to: dep, kind: "depends_on", blocked });
    }
  }
  links.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return links;
}
```

Note: `blocked` is hoisted out of the inner `dep` loop because it depends only on `t`,
not on `dep` — every edge from the same `from` shares the same blocked value. Minor, but
it reads correctly (the flag is a property of the source ticket, not the edge target).

The doc-comment above `buildLinks` (lines 181–184) gets one sentence noting the new
field and its derivation, to keep the file's literate-comment discipline.

### Change 1c — the `projectGraph` doc comment (optional, lines 199–207)

No code change in `projectGraph` itself (it already calls `buildLinks(graph.tickets)`).
Optionally extend the leading comment to mention that links now carry decision weight.
Low priority; the `buildLinks` doc is the load-bearing one.

## File 2 — `src/present/project.test.ts` (MODIFY)

### Change 2a — update the existing link assertion (line 117)

The single emitted link's `from` is T-002-01 (status `open`) → `blocked: true`.

```ts
test("the one cross-story depends_on edge appears once, (from→to)-correct", () => {
  expect(p.links).toEqual([{ from: "T-002-01", to: "T-001-03", kind: "depends_on", blocked: true }]);
});
```

### Change 2b — add a focused AC describe block for the blocked flag

A new `describe("projectGraph — blocked flag (edges-as-payload; T-056-02)")` that proves
both polarities, the authority guard, and determinism on the new field. To get a
`blocked:false` link without disturbing existing tests, extend the fixture's done ticket
T-002-02 with a dependency on a done ticket — OR (cleaner, no fixture churn) build a
tiny local two-ticket graph inside the new block. **Chosen: a small local graph inside
the block**, so the shared `miniGraph()` and its existing assertions stay byte-for-byte
unchanged.

The local graph: ticket A (done, depends_on B) and ticket B (done) → link
`{from:A, blocked:false}`; plus ticket C (open, depends_on B) → link `{from:C,
blocked:true}`. One graph yields both polarities.

Assertions in the block:
1. **blocked:true** — a link whose `from` is not done carries `blocked: true`.
2. **blocked:false** — a link whose `from` is done carries `blocked: false`.
3. **authority guard** — `graph.tickets` is reference-unchanged after projection, and
   the graph stays frozen (the AC's "one-way-authority / authority-guard test passes").
4. **determinism** — two projections of the same graph are `toEqual` (byte-identical,
   no clock/random), the new field included.

This block, together with the updated line-117 assertion, fully discharges the AC.

## File 3 — `src/present/projection-svg.test.ts` (NO CHANGE REQUIRED)

`fakeProjection()` casts `as unknown as Projection`, so the new required field does not
break compilation. Leave it untouched this ticket (the renderer ignores `blocked` until
T-056-03). Touching it would widen the diff for no gain.

## Ordering

1. Edit `project.ts` type (1a) and producer (1b) together — they are one logical change.
2. Update the existing assertion (2a) so the suite reflects new truth.
3. Add the new AC block (2b).
4. Typecheck + run the full suite.

## Module boundaries preserved

- `ProjectionLink` stays the single owner of edge shape; `buildLinks` stays its single
  producer. No new module, no new export surface beyond the one field.
- `stateKey` remains the only authority on "done"; nothing re-derives it.
- Purity and one-way authority are structurally unchanged — the new field is computed
  from a read of the frozen graph and lives only on the fresh frozen result.
