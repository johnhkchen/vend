# T-057-01 Research — annotation-input-and-provenance-render-core

Descriptive map of the territory. No solutions here — just what exists, where, and how it connects.

## The ticket, restated

Two PURE artifacts, no I/O, no CLI (those are T-057-02 / T-057-03):

1. A typed **Annotation** — feedback text + annotated work-item/node id + author seat.
2. A **pure render** of a provenance trailer + back-link, so a staged signal can name its
   non-dev source. Captured once, at annotation, as data.

The single AC is a pure unit test (sibling of `expand-effect.test.ts`) asserting that the render,
given a `Signal` + `{seat, nodeId}`, returns markdown containing **(a)** a provenance line naming the
seat and node id and **(b)** a back-link referencing the annotated work item; the function imports
**no BAML and no fs**, and is **deterministic across repeat calls**.

## The reuse target — `src/play/expand-effect.ts`

This is the module the ticket cites (`:80`/`:82`) and the natural home for the new pure pieces.

- Header (lines 1–25) declares the module **ADDON-FREE but IMPURE**: it imports `mkdir`/`writeFile`
  from `node:fs/promises` (line 27) for the one staging verb, but imports **NO BAML** — the
  `Signal` import (line 29) is TYPE-ONLY (erased under `verbatimModuleSyntax`). So `bun test` may
  import this module freely; no native addon ever loads through it.
- `STAGING_DIR = "docs/active/pm/staged"` (line 36) — where a cleared signal lands, **never** the
  board. The one-way-authority invariant E-057 inherits and must not weaken.
- `ExpandFragmentInputs` (lines 44–48) — `{ fragment, charter, project }`. The slim sibling of
  `ProposeEpicInputs`; a Signal mints no id.
- `slugify(what)` (lines 62–70) — PURE filename-stem helper, copied-not-imported idiom, capped at
  `MAX_SLUG_LEN = 60`. Precedent for "a pure helper living beside the fs verb".
- **`renderStagedSignal(signal)` (lines 82–102)** — the PURE render to extend. Returns the staged
  markdown: a `# <what>` heading, the `demand.md` table header + one `renderSignalRow(signal)` row,
  a `## Pull this` block quoting the `vend chain "<what> — <why>"` gesture, and — the key line —
  an **origin trailer** (line 99):
  `_Staged by Vend's \`expand-fragment\` play — not promoted; pull to clear._`
  This trailer (cited as `:80`) is exactly the pattern the provenance trailer parallels: one
  italic underscore line naming the signal's source/status. The provenance trailer is its sibling,
  naming the *human* source (seat X on node Y) rather than the *play* source.
- `expandFragmentEffect(signal, ctx)` (lines 116–125) — the impure verb: `mkdir -p` + `writeFile`
  to `<slug>.md`, reports an `EffectResult`. **T-057-02's** territory (threading provenance through
  the effect), explicitly NOT this ticket.

## The purest sibling — `src/play/expand-core.ts`

The alternative home, surveyed for the Design phase. `expand-core.ts` has **NO runtime import at
all** (lines 1–22) — the purest core in the codebase: type-only `Signal`/`GateVerdict` imports, the
three gates, and `renderSignalRow(signal)` (lines 211–215), which `renderStagedSignal` calls to emit
one `demand.md` row. Relevant because it is the strictest reading of "imports no fs" — but it is NOT
the trailer's neighborhood; the origin trailer the ticket says to extend lives in `expand-effect.ts`.

## The Signal shape — `baml_client/types.ts`

`Signal` (lines 146–155): `{ what, why, tier: SignalTier, budget, advances: string[], grounding,
readiness }`. `SignalTier` is the enum `Keystone|High|Standard|Leaf` (lines 102–107). This is the
type the render's first parameter will carry. The render needs no new BAML — `Signal` is imported
type-only today and stays that way.

## What a node id looks like — `src/present/`

The `nodeId` an annotation references is a board work-item id. `ProjectionLink` (`project.ts`
:59–67) carries `from`/`to` that are node ids; `paper.ts:89` shows ids like `T-021-06` (and the
`sanitizeId` Mermaid-safe form `T_021_06`). Across the board the id forms are `E-###` (epic, under
`docs/active/epic/`), `S-###` (story, `docs/active/stories/`), `T-###-##` (ticket,
`docs/active/tickets/`). A back-link that wants to be *navigable* maps the id prefix to its board
directory; a back-link that only needs to *reference* the item can carry the bare id. Both are pure.

## The test idiom — `src/play/expand-effect.test.ts`

The sibling the AC names. Patterns to mirror:

- Every BAML import is TYPE-ONLY; enum fields are string-literal casts (`"Keystone" as SignalTier`)
  so NO native addon loads (lines 17–37). `FULL_SIGNAL` is a hand-built complete Signal.
- Pure-helper tests live in a `describe("slugify + renderStagedSignal — pure helpers", …)` block
  (lines 143–166) — exact-string assertions, `startsWith`/`toContain`. The new provenance test slots
  in as a peer block.
- Determinism is asserted by calling twice and comparing, the house idiom for "no clock/no random".

## Constraints & assumptions surfaced

- **No BAML, no fs in the render.** The function must be a pure string builder. fs is imported by the
  *module* (`expand-effect.ts`) but the render function itself touches none — exactly as
  `renderStagedSignal`/`slugify` already do. (Design will weigh `expand-core.ts` vs `expand-effect.ts`.)
- **One-way authority holds.** This ticket writes nothing — it only defines a type and a pure
  function. No path touches `demand.md` or the board. The invariant is trivially preserved.
- **Scope discipline.** Do NOT modify `renderStagedSignal` or `expandFragmentEffect` — threading the
  provenance into the staged artifact is T-057-02. T-057-01 adds the *pure building blocks* only, so
  the two tickets stay on their dependency edge (T-057-02 `depends_on: [T-057-01]`).
- **Determinism.** Pure string interpolation; no `Date`, no `Math.random`. Repeat calls equal.
- **Copied-not-imported idiom.** If a tiny helper (e.g. id-prefix → board dir) is needed, it lives
  local to the module per the gates.ts no-shared-util rule, like `slugify` did.
