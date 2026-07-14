# T-059-02 — Design

**Decision in one line:** add a single `HACKATHON_CHARTER` string constant + one
`{ kind:"file", path:"docs/knowledge/charter.md" }` entry to `TEMPLATE_REGISTRY.hackathon`,
and guard the inlined constant against the example seed file with a drift test. No effect,
merge, or BAML change. Grounded in Research: `mergeManifests` already makes the overlay win.

## The decision space

The merge machinery is settled (`mergeManifests` overrides a same-path base entry before
disk — Research). So the override itself is mechanical. The real decisions are three:

- **D1 — where the charter content lives** (inline constant vs. read-from-file).
- **D2 — how to prevent drift** between the shipped constant and the example seed file.
- **D3 — what to test, and at which layer** (pure overlay vs. fs effect).

## D1 — Where does the tuned charter content live?

### Option A (CHOSEN) — inline `HACKATHON_CHARTER` string constant in `init-core.ts`

A template literal beside `CHARTER_STUB` / `HACKATHON_SEED_STUB`, byte-equal to
`examples/templates/hackathon-seed/charter.md`, backticks escaped as `` \` ``.

- **For:** `init-core.ts` is PURE by hard rule (header lines 12–14: "The first `node:fs`
  import in this package belongs to T-040-02, never here"). All existing seed content is
  inline (`CHARTER_STUB`, `EMPTY_BOARD`, every stub). The overlay is just DATA — exactly
  the shape `mergeManifests` consumes. The CLI/effect path is unchanged. The whole AC is met
  with one constant + one array entry.
- **Against:** creates a second copy of the charter → drift risk (handled by D2).

### Option B (REJECTED) — read the seed file at init time

Have the effect `readFile("examples/templates/hackathon-seed/charter.md")` and inject it.

- **Rejected:** the example dir is a *fixture/sample*, not a runtime asset shipped with the
  installed CLI — it may not exist relative to a user's `cwd` at all. It would force the
  PURE `init-core` overlay to depend on fs, breaking the file's central rule, and make the
  registry non-static (a template's contents would no longer be a plain value). The honest-
  empty/one-way registry loop tests assume static `ScaffoldEntry` contents.

### Option C (REJECTED) — point `CHARTER_PATH` at the seed root file instead

Make steer read `examples/.../charter.md` directly, skipping the overlay.

- **Rejected:** breaks the local-first contract — a user's project has no `examples/`
  subtree; the charter must live at the canonical `docs/knowledge/charter.md` the bounds
  gate and decompose already read. The ticket is explicit: write it "where steer reads it".

## D2 — Preventing drift between the constant and the example file

The one new risk Research surfaced: `HACKATHON_CHARTER` (shipped) and
`examples/templates/hackathon-seed/charter.md` (the authored source) can silently diverge.

### Option A (CHOSEN) — a drift-guard test in the fs-capable effect test

In `init-effect.test.ts` (already imports `node:fs/promises`), read the seed file and assert
it equals the `HACKATHON_CHARTER` overlay entry's contents:

```ts
const seedCharter = await readFile("examples/templates/hackathon-seed/charter.md", "utf8");
const overlayCharter = resolveTemplate("hackathon")!.find(e => e.path === "docs/knowledge/charter.md");
expect(overlayCharter!.contents).toBe(seedCharter);
```

- **For:** turns drift from a silent risk into a red test. The seed file stays the single
  authored source of truth; the constant is a verified mirror. Lives in the layer that
  already touches fs (the pure `init-core.test.ts` must stay fs-free). Cheap, exact.
- **Against:** couples a unit test to a repo-relative path (`examples/…`). Mitigated: the
  test runs from the repo root (bun test cwd); if the example is ever removed the test fails
  loudly, which is the correct signal (the overlay would be orphaned).

### Option B (REJECTED) — no guard, rely on review discipline

- **Rejected:** the two copies are 73 lines apart in the tree; a future edit to one will not
  prompt the other. Honest-on-outcome (the value function the charter itself encodes) wants
  the invariant enforced, not hoped for.

### Implementation note — generating the literal mechanically

To make the *initial* inline byte-exact (not hand-retyped), the constant is produced by
escaping the file's bytes (`` ` `` → `` \` ``, `${` → `\${`) once during Implement, then the
D2 guard proves equality. This removes transcription error from the equation.

## D3 — Test layer split (mirrors the house pure/impure discipline)

Two existing test files, two roles (Research confirmed both already cover the SEED overlay):

- **`init-core.test.ts` (PURE)** — pins the overlay as DATA: `TEMPLATE_REGISTRY.hackathon`
  now contains a `docs/knowledge/charter.md` entry whose contents are the tuned charter
  (not the stub) and carry zero demand rows; `mergeManifests(SCAFFOLD_MANIFEST, overlay)`
  yields the tuned charter at the base's `docs/knowledge/charter.md` slot (override won over
  `CHARTER_STUB`); `planTemplate` carries it. The existing registry honest-empty/one-way
  loops (lines 230, 241) already sweep the new entry for free.
- **`init-effect.test.ts` (IMPURE, temp-dir)** — pins the EFFECT: `runInit(root,
  "hackathon")` writes the tuned charter to `docs/knowledge/charter.md` (not the stub);
  idempotent re-run → charter among skips; a user-edited charter is left byte-identical
  (no-clobber); the drift guard (D2). Bare `runInit` still writes the generic stub there.

This split is the established `init-core` (pure) vs `init-effect` (temp-dir) discipline —
no new test file, no new pattern.

## What this design deliberately does NOT touch

- **No `mergeManifests` / `planTemplate` / effect change.** Override is data-driven; the
  override mechanism already exists and is tested. Touching it would be gold-plating.
- **No BAML, no `assembleSteerInputs` change.** Steer already reads `CHARTER_PATH`; once the
  overlay writes the tuned charter there, steer reads it with zero steer-side change. The
  T-059-01 wire (intent → snapshot) is the complementary half, already done.
- **No SEED.md change.** It stays in the overlay (T-058-01 contract); this ticket only ADDS
  the charter entry alongside it.
- **No live model run.** End-to-end metered proof is T-059-03's live re-drive; this ticket
  proves the wire at the unit + temp-dir level.

## Acceptance-criteria → design trace

| AC | Mechanism in this design |
| --- | --- |
| `--template hackathon` writes tuned charter to `docs/knowledge/charter.md`, overriding stub via `mergeManifests`; idempotent, no-clobber | D1-A entry + existing `mergeManifests`/`wx` path; D3 effect tests |
| steer's assembled charter on a fresh seed is the hackathon value function | overlay writes tuned charter at `CHARTER_PATH`; steer reads it unchanged |
| Bare `vend init` byte-identical to E-040; non-lisa root refuses | overlay only via `--template`; base `CHARTER_STUB` untouched; existing gate tests |
| Honest-empty held; pure overlay/merge unit-tested; effect temp-dir tested; no live model | D3 split + existing registry honest-empty loop; D2 drift guard; no model call |
| `bun run check:*` green | DATA-only change; no BAML; typecheck + full suite |
