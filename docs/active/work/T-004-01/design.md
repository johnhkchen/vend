# Design — T-004-01 pure-id-collision-detector

One decision per open question from Research, each grounded in the codebase
reality, with rejected alternatives recorded.

## The decision in one line

A single pure function `detectCollisions(generated, existing)` that returns the
**deduped intersection in order of first appearance in `generated`**, computed
via a `Set` built from `existing`. No module dependencies, no addon, no fs.

## D1 — Signature & module shape

**Chosen:** exactly the AC signature, in a new `src/play/id-guard.ts`:

```ts
export function detectCollisions(
  generated: readonly string[],
  existing: readonly string[],
): string[]
```

`readonly string[]` in (callers pass arrays they own — non-mutation is part of
purity), plain `string[]` out (a fresh array the caller may keep). New file, not
a function bolted onto `gates.ts` or `project-context.ts`.

- *Rejected — add to `gates.ts`:* the gates judge an already-parsed `WorkPlan`
  and import baml types; the cross-board check needs neither, and T-004-02 wants
  to call it from the orchestrator between `classify` and `materialize`
  (obs 20351), not from inside `clear()`. A separate module keeps the gate suite
  focused on *in-plan* meaning and this on *cross-board* membership.
- *Rejected — add to `project-context.ts`:* that module is impure (reads fs).
  The detector must stay pure and testable as an ordinary function; co-locating
  it with the fs verbs invites an accidental import. AC#4 explicitly forbids a
  dependency on `materialize`/`project-context`.

## D2 — Algorithm: Set membership

**Chosen:** build `new Set(existing)` once, then filter `generated` by
membership. O(n + m), and it mirrors the established `idSetOf` precedent in
`gates.ts` (a `Set<string>` is the house idiom for id uniqueness).

- *Rejected — nested `existing.includes()` per generated id:* O(n·m) and reads as
  if duplicates were intended; the `Set` is both faster and the local idiom.
- *Rejected — `Set` intersection via spread math:* loses input order, which D4
  needs to pin deterministically.

## D3 — Dedup policy: report each colliding id at most once

**Chosen:** the returned array contains each offending id **once**, even if it
appears multiple times in `generated`. The output is the *set of ids that must
not be written* — a downstream andon (T-004-02) reports "these ids already exist";
listing `T-001-01` twice adds no information and would make the message noisier.

Implementation: a `seen` `Set` guards pushes, so a repeated colliding id is
emitted on its first occurrence only.

- *Rejected — preserve multiplicity:* a generated plan *should* already be
  internally unique (the allocation gate stops on in-plan duplicate ids before
  materialize is ever reached), so multiplicity here would only arise from
  malformed input; collapsing to a set is the honest, defensive choice and
  matches gate semantics.

## D4 — Order policy: first appearance in `generated`

**Chosen:** collisions are returned in the order their ids **first appear in
`generated`**. Deterministic (a stable input ⇒ stable output — the same property
`buildProjectSnapshot` sorts for), and it reads naturally: "walking the ids this
plan would mint, here are the ones that clash, in plan order."

- *Rejected — sort the output:* sorting is also deterministic but discards the
  caller's order and implies an ordering contract the caller didn't ask for.
  First-appearance is the minimal, most faithful policy and is just as easy to
  pin in a test.
- *Rejected — order by `existing`:* the offense is about what `generated`
  brings; `existing` is only a membership oracle, never iterated for output.

## D5 — Purity & error policy: total function, no throws

**Chosen:** the function is **total** — it never throws. Empty inputs are
ordinary (`[]` in ⇒ `[]` out). It performs no validation of element shape: ids
are opaque strings (Research: no `E-`/`S-`/`T-` parsing needed), so there is no
"malformed id" to throw on.

This *narrows* the house "programmer error throws" rule rather than breaking it:
the only programmer error reachable here would be a non-array argument, and TS's
`readonly string[]` parameter types already make that a compile-time error under
`strict`. There is no runtime degradation mode to distinguish from bad data, so —
like `gateRowsFor` and `formatMessage` in `decompose-epic-core.ts`, which are
pure and total — there is nothing to throw. Keeping it total makes T-004-02's
composition trivial: it can always call the detector and switch on the result.

- *Rejected — guard arg types at runtime (`assertArray`):* `gates.ts`/`budget.ts`
  throw because they receive `WorkPlan`/`Usage` objects whose array fields can be
  absent at the JS boundary (parsed model output). This function's inputs are
  typed `string[]` constructed by our own code (`plan.*.map(x => x.id)`,
  `listIds`), never raw model output — a runtime type guard would be dead code.

## D6 — Empty array vs. "clear" naming

**Chosen:** empty array **is** the clear signal (AC: "empty array = clear"). No
separate boolean or sentinel. The caller checks `.length === 0`. This matches the
gate idiom where "nothing tripped" is representable and avoids inventing a
result type for what is plainly a list of offending ids.

## What this design does NOT do (scope fence)

- No fs read of the board (T-004-02 / `project-context` owns that).
- No wiring into `runDecomposeEpic` (T-004-02).
- No andon message / run-log outcome (T-004-02's andon gate + run-log outcome).
- No `WorkPlan` import — the detector never sees a plan, only the ids extracted
  from one. This is the seam that keeps it the purest module in the tree.

## Grounding summary

Every choice traces to an observed fact: `Set` from `idSetOf` (gates.ts),
determinism from `buildProjectSnapshot`'s sort discipline, totality from
`gateRowsFor`/`formatMessage`, the plain-string seam from `listIds` already
emitting `string[]` and `plan.*.id` being strings. Nothing here rests on
assumption.
