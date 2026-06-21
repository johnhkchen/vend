# T-056-02 — Design: blocked-flag-on-projection-link

## Decision summary

Add a **required** `readonly blocked: boolean` field to `ProjectionLink`, computed in
`buildLinks` as `blocked = stateKey(t) !== "done"` where `t` is the `from` ticket (the
loop variable already in scope). No new imports, no new lookup, no renderer change.

## The semantic contract (and the direction question)

The AC fixes the observable behavior precisely:

> projectGraph … emits `blocked:true` for a link whose `from` is not done and
> `blocked:false` when it is done.

So `blocked` is a pure function of the **`from`** ticket's done-state. In the link
model, `from = t.id` (the ticket that authored the `dependsOn`) and `to = dep` (the
dependency). The epic narrates `from` as the "upstream" edge whose unfinished state
makes the edge heavy. There is a naming tension with the graph-theory reading (where the
dependency `to` is "upstream"), but the AC is the contract and is internally consistent
with the epic's own language. **The implementation keys `blocked` off `from`, exactly as
the AC states.** The test asserts that literal behavior, so any other choice fails the
gate. This is recorded so a future reader knows the direction was deliberate, not a slip.

## Options considered

### O1 — Required field, computed from the in-scope `t` (CHOSEN)

In `buildLinks`, at the push site, `t` is the `from` ticket. Compute
`blocked: stateKey(t) !== "done"` inline.

```ts
for (const dep of t.dependsOn) {
  if (ticketIds.has(dep))
    links.push({ from: t.id, to: dep, kind: "depends_on", blocked: stateKey(t) !== "done" });
}
```

- **Pro:** minimal diff; zero new data structures; `stateKey` already imported; reuses
  the single done-authority; the `from` ticket is *definitionally* `t`, so no risk of a
  map keying the wrong node. Deterministic and pure by construction.
- **Pro:** the field is always present on the IR — every consumer (T-056-03's renderer,
  rubric, future tooling) can rely on it without a presence check.
- **Con:** the literal computation sits inside the hot inner loop; negligible — it's a
  string compare per edge, and link counts are small.

### O2 — Optional field (`blocked?: boolean`)

Emit `blocked` only when true, omit when false.

- **Rejected:** an IR that sometimes carries the field forces every consumer into
  `link.blocked ?? false` and makes `toEqual` assertions ambiguous. The epic frames this
  as *the projection IR carrying decision weight* — a first-class, always-present field
  expresses that better. Optionality buys nothing here.

### O3 — Compute via a status map keyed by `from`

Build `Map<id, TicketNode>` (or `Map<id, boolean>` of done-ness) from `tickets`, then
look up `from` when pushing.

- **Rejected:** redundant. `from` is `t.id` by construction; the map would re-fetch the
  node we already hold as the loop variable. More code, more allocation, identical result.
  Reserve a map only if a future flag needs the `to` ticket's status (e.g. an
  on-critical-path follow-on) — and even then, `ticketIds` could become `Map`.

### O4 — Compute in `projectGraph` (post-process the links)

Let `buildLinks` stay bare, then map over the returned links in `projectGraph` to attach
`blocked`.

- **Rejected:** the ticket says "computed purely inside projectGraph/**buildLinks**". A
  second pass would need to re-resolve each `from` to a node — reintroducing the very map
  O3 avoids. Computing where the link is born is strictly simpler and keeps `buildLinks`
  the single owner of link shape.

## Why "done" = `stateKey(t) === "done"` and not `t.status === "done"`

`stateKey` (translate.ts:175) treats a ticket as done if `status === "done"` **or**
`phase === "done"`. The present layer (grouping, color, chips) already routes all
done-ness through `stateKey`. Using the raw `status` field would disagree with the board
for tickets that are phase-done but status-open (a real state in this repo's RDSPI flow).
Reusing `stateKey` keeps the blocked flag consistent with how every other surface reads
"done" — the composition-not-reinvention house rule.

## Type-level impact (required field)

Making `blocked` required could break any literal typed as `ProjectionLink`/`Projection`.
Research confirmed the only such construction sites are:

- `projection-svg.test.ts:70` `fakeProjection()` — cast `as unknown as Projection`, so no
  type error. Left as-is (it does not assert on `blocked`; the renderer ignores it this
  ticket). Optionally we add `blocked: false` for honesty, but it is not required to
  compile.
- `project.test.ts:117` — a `toEqual` value assertion, updated to expect `blocked`.

Everything else reads `.links` structurally (`from`/`to`/`length`) and is unaffected.

## Determinism & authority (unchanged, re-verified)

- **Pure:** `stateKey` is pure; no clock/random introduced. Same graph → identical links
  including `blocked`. The existing determinism test (project.test.ts:148) still holds and
  now also covers the new field via `toEqual`.
- **One-way authority:** nothing writes to a node; `blocked` lives only on the fresh,
  frozen `ProjectionLink`. The reference-unchanged + authority-guard gates stay green.

## What this ticket explicitly does NOT do

- No renderer change (`projectionToSvg` stroke weight is T-056-03).
- No preset/default change (`DESIGNER_PRESET` groupBy flip is T-056-01).
- No `critical`/on-critical-path flag (epic deferred it as a possible follow-on).
- No new grouping axis, no palette change.
