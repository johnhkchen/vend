# T-059-02 — Structure

The file-level blueprint. Two source files changed (one constant + one registry entry, plus
tests); no files created or deleted; no effect/merge/BAML change. Shape only, not code.

## Change set at a glance

| File | Kind | Change |
| --- | --- | --- |
| `src/init/init-core.ts` | modify | add `HACKATHON_CHARTER` const; add a charter entry to `TEMPLATE_REGISTRY.hackathon` |
| `src/init/init-core.test.ts` | modify | pin the overlay-as-data: charter entry present, tuned content, override wins, honest-empty |
| `src/init/init-effect.test.ts` | modify | pin the effect: charter written/overridden/no-clobber + drift guard vs the seed file |

No change to `init-effect.ts` (the override rides the existing writer), `mergeManifests`,
`planTemplate`, `project-context.ts`, `steer.ts`, BAML, or any example file.

## `src/init/init-core.ts` — the two edits

### Edit 1 — define `HACKATHON_CHARTER` (new constant)

Placement: in the "Seed content" region, immediately after `HACKATHON_SEED_STUB`
(line ~134), before `SCAFFOLD_MANIFEST`. A `const HACKATHON_CHARTER = \`…\`` template
literal byte-equal to `examples/templates/hackathon-seed/charter.md`, backticks escaped.

JSDoc states its contract, mirroring `HACKATHON_SEED_STUB`'s comment style:
> The hackathon template's TUNED CHARTER — the demonstrable-slice value function (the 5
> criteria + gates H1–H3) `vend steer`/`work`/`decompose` grade the seed against. Overlaid
> at `docs/knowledge/charter.md` (where `CHARTER_PATH` reads), OVERRIDING the generic
> `CHARTER_STUB` via `mergeManifests` before disk. Byte-equal to the authored source
> `examples/templates/hackathon-seed/charter.md` (a drift test pins the equality). Knowledge,
> ZERO demand (honest-empty IA-3/IA-4); a vend-owned path (one-way-to-lisa).

### Edit 2 — extend `TEMPLATE_REGISTRY.hackathon`

```
hackathon: [
  { kind: "file", path: "SEED.md", contents: HACKATHON_SEED_STUB },
  { kind: "file", path: "docs/knowledge/charter.md", contents: HACKATHON_CHARTER },
],
```

Order within the overlay is immaterial to correctness (`mergeManifests` overrides by path,
and `docs/knowledge/charter.md` already exists in the base so it stays in the base's slot —
it does NOT append). SEED.md stays first to keep the diff minimal and the T-058-01 entry
visually stable. The registry's type (`Readonly<Record<string, readonly ScaffoldEntry[]>>`)
and its JSDoc need no change — the comment already says "the rich content (the tuned charter
override…) is T-058-02/03"; that follow-up is now THIS ticket, so the JSDoc's forward-
reference can be tightened (optional, non-load-bearing) to note the charter override landed.

**Module boundary unchanged:** still PURE — `HACKATHON_CHARTER` is a plain string; no fs,
no addon. `init-core.ts`'s central rule holds.

## `src/init/init-core.test.ts` — pure pins (new `describe` block)

Add after the existing `TEMPLATE_REGISTRY` describe (line ~249). Imports already cover
`TEMPLATE_REGISTRY`, `mergeManifests`, `planTemplate`, `resolveTemplate`, `SCAFFOLD_MANIFEST`,
`countDemandRows` — no new import needed (the constant is asserted via the registry, not
imported directly, keeping `HACKATHON_CHARTER` un-exported).

New `describe("hackathon overlay — the tuned charter override (T-059-02)")`:

- **charter entry present & not the stub** — `resolveTemplate("hackathon")` contains a
  `docs/knowledge/charter.md` file entry; its contents `!==` the base `CHARTER_STUB` and
  include a tuned-charter marker substring (e.g. `"demonstrable runnable slice"` and
  `"Demo-advancing"`) so the assertion is about *the right content*, not just "non-stub".
- **override wins via mergeManifests** — `mergeManifests(SCAFFOLD_MANIFEST,
  resolveTemplate("hackathon")!)` has, at the `docs/knowledge/charter.md` path, the tuned
  charter (equal to the overlay entry's contents), NOT `CHARTER_STUB`; and the merged length
  grows by exactly 1 (only SEED.md is overlay-only — the charter overrides in place).
- **planTemplate carries it** — `planTemplate([], SCAFFOLD_MANIFEST, overlay)` `creates` the
  `docs/knowledge/charter.md` entry with the tuned contents.
- **honest-empty (explicit, beyond the existing loop)** — `countDemandRows` of the charter
  entry is 0. (The existing registry loop at line 230 already covers this; an explicit pin
  makes the intent legible.)
- **base still ships the generic stub** — the base `SCAFFOLD_MANIFEST` entry at
  `docs/knowledge/charter.md` is still `CHARTER_STUB` (bare `vend init` unchanged — a
  regression guard at the data layer).

## `src/init/init-effect.test.ts` — temp-dir effect pins (extend the T-058-01 block)

Add into / beside the existing `describe("runInit — template overlay (T-058-01)")` block
(line 225). Imports already cover `readFile`, `runInit`, `resolveTemplate`?? — note
`resolveTemplate` is NOT yet imported here; **add `resolveTemplate` to the
`./init-core.ts` import** (line 5) for the drift guard.

New tests:

- **writes the tuned charter to `docs/knowledge/charter.md`** — after `runInit(root,
  "hackathon")`, `readFile(join(root, "docs/knowledge/charter.md"))` equals the tuned
  charter (the overlay entry's contents) and is NOT `CHARTER_STUB`; reported in
  `result.created`.
- **bare runInit writes the generic stub there** — `runInit(root)` (no template) →
  `docs/knowledge/charter.md` equals the base `CHARTER_STUB`. Pins the byte-identical-to-
  E-040 contract at the effect layer.
- **idempotent** — second `runInit(root, "hackathon")` → charter among `skipped`, content
  unchanged.
- **no-clobber on an edited charter** — pre-write a user charter, `runInit(root,
  "hackathon")`, assert the user's bytes survive (mirrors the SEED.md no-clobber test at
  line 263).
- **drift guard (D2)** — `readFile("examples/templates/hackathon-seed/charter.md")` equals
  the `docs/knowledge/charter.md` entry in `resolveTemplate("hackathon")`. The single test
  that keeps the inlined constant honest against its authored source.

## Ordering of changes (matters for a clean incremental commit)

1. `init-core.ts` — add `HACKATHON_CHARTER` + registry entry (the behavior).
2. `init-core.test.ts` — pure pins (proves the data/merge).
3. `init-effect.test.ts` — effect pins + drift guard (proves the write + sync).
4. `bun run check` — gate green.

Steps 1–3 are one logical change (data + its tests) and commit together; step 4 is the gate.

## Interfaces & invariants held (the blueprint's contract)

- **Public surface unchanged.** No new export (`HACKATHON_CHARTER` stays module-private, like
  `CHARTER_STUB`; tests reach it through `resolveTemplate`/`TEMPLATE_REGISTRY`). `runInit`,
  `applyInitScaffold`, `mergeManifests`, `planTemplate` signatures unchanged.
- **PURE/IMPURE split intact.** Pure data in `init-core`; the only fs touch is in the
  effect *test* (drift guard), never in `init-core`.
- **Honest-empty + one-way-to-lisa** swept by the existing registry loops AND an explicit
  charter pin.
- **No-clobber** is the existing `wx` writer — pinned, not re-implemented.
