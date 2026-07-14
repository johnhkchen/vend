# T-059-02 — Review

Handoff for a human reviewer. The coupled-charter half of E-059: `vend init --template
hackathon` now overlays the *tuned* demonstrable-slice charter at `docs/knowledge/charter.md`
— the path `vend steer`/`work`/`decompose` read — so a fresh seed is graded against the
hackathon value function, not the generic `CHARTER_STUB`. With T-059-01 (intent → snapshot)
already done, both halves of the make-or-break wire are now in place; T-059-03 re-drives live.

## What changed (3 files, all additive)

| File | Change |
| --- | --- |
| `src/init/init-core.ts` | new module-private `HACKATHON_CHARTER` const (byte-equal to the seed charter); a `docs/knowledge/charter.md` entry added to `TEMPLATE_REGISTRY.hackathon`; the registry JSDoc's stale "T-058-02/03 deferred" note tightened |
| `src/init/init-core.test.ts` | +5 pure pins: overlay charter present & non-stub & right markers; `mergeManifests` override wins (+1 length); `planTemplate` carries it; honest-empty; base still ships the stub |
| `src/init/init-effect.test.ts` | `resolveTemplate` added to import; +6 effect pins: tuned charter written / bare writes stub / idempotent / no-clobber / drift guard / consts-defined |

No files created or deleted. No change to `init-effect.ts`, `mergeManifests`/`planTemplate`,
`project-context.ts`, `steer.ts`, BAML, or any example file. `+233/−7`.

## How it works

The override is **data, not logic**. `mergeManifests(SCAFFOLD_MANIFEST, overlay)` already
overrides a same-path base entry *in the base's slot before the disk is consulted* — its
documented purpose. Adding `{ path:"docs/knowledge/charter.md", contents: HACKATHON_CHARTER }`
to the hackathon overlay makes the tuned charter win over `CHARTER_STUB` there; the existing
`runInit → applyInitScaffold(root, mergeManifests(...))` writer materializes it through the
identical write-if-absent / `wx` / no-clobber path SEED.md already uses. So no effect or merge
code changed — only the registry it consumes.

`HACKATHON_CHARTER` is inlined as a string literal because `init-core.ts` is PURE by hard
rule (no fs/addon). It was generated mechanically from the authored source
`examples/templates/hackathon-seed/charter.md` (escape `` ` ``/`${`, confirm byte-equality),
not hand-typed.

## Test coverage

`bun run check` green: `baml:gen` zero diff, `tsc --noEmit` clean, **1327 pass / 0 fail**
(+11 over the 1316 baseline).

- **Pure (data-layer):** the overlay carries the tuned charter, distinct from the base stub,
  with the demonstrable-slice markers (`"demonstrable runnable slice"`, `"Demo-advancing"`);
  `mergeManifests` puts it at the base's charter slot and grows the manifest by exactly 1
  (override-in-place, not append); `planTemplate` creates it; `countDemandRows === 0`
  (honest-empty); the base `SCAFFOLD_MANIFEST` slot is still the generic stub (bare-init
  regression). The existing registry honest-empty + one-way-to-lisa loops sweep the new
  entry for free.
- **Effect (temp-dir):** `runInit(root, "hackathon")` writes the tuned charter to
  `docs/knowledge/charter.md` (and reports it created); bare `runInit(root)` still writes the
  generic stub there (the bare-init-byte-identical-to-E-040 contract, pinned at the effect
  layer); a second template run skips it unchanged (idempotent); a **user-edited charter is
  left byte-identical** (no-clobber — the key safety, since steer grades against whatever sits
  there); and a **drift guard** asserts `HACKATHON_CHARTER` is byte-equal to its authored
  source file.

**Coverage gaps (by design):** `init-effect.ts` itself is unchanged, so no new effect logic
needs proving — the new effect tests confirm the *existing* writer extends correctly to the
charter, they don't re-derive it. No live-model end-to-end (that is T-059-03).

## Acceptance criteria — status

- [x] `--template hackathon` writes the tuned charter to `docs/knowledge/charter.md`,
  overriding the stub via `mergeManifests`; idempotent, no-clobber, never overwrites an
  edited charter. — effect tests.
- [x] steer's assembled charter on a fresh seed is the hackathon value function — the overlay
  writes it at `CHARTER_PATH`; steer reads that path unchanged. (Unit/temp-dir level; the live
  metered confirmation is T-059-03.)
- [x] Bare `vend init` byte-identical to E-040 (base `CHARTER_STUB` untouched; "bare writes the
  stub" + "bare runInit unchanged" tests); non-lisa root still refuses (existing gate tests).
- [x] Honest-empty held; pure overlay/merge unit-tested; effect tested against a temp-dir root;
  no live model.
- [x] `bun run check:*` green.

## Open concerns / notes for the reviewer

1. **Not committed.** Per "Lisa handles the rest," the 3 files + this artifact set sit in the
   working tree for Lisa to commit and advance the phase. Suggested message in `plan.md`.
2. **Two copies of the charter, drift-guarded.** The shipped `HACKATHON_CHARTER` and the
   authored `examples/templates/hackathon-seed/charter.md` are the same bytes by necessity
   (pure module can't read the example at runtime). The drift-guard test keeps them in sync —
   editing one without the other turns red. Known, accepted coupling, not a defect. If the
   example file is ever relocated/removed, that test fails loudly (the overlay would be
   orphaned) — the correct signal.
3. **`HACKATHON_CHARTER` is module-private** (like `CHARTER_STUB`). Tests reach it via
   `resolveTemplate("hackathon")` / `TEMPLATE_REGISTRY`, so the public surface is unchanged.
4. **End-to-end proof deferred to T-059-03 (LIVE).** This ticket proves the wire at the unit +
   temp-dir level (the overlay writes the tuned charter where steer reads it). That a *real
   metered* steer on the fresh seed now stages a board graded against the demonstrable-slice
   value function — and re-captures `EXPECTED-OUTCOME.md` as a positive gold master — is the
   live re-drive. No code here blocks that.
5. **Unrelated working-tree changes are not mine.** `docs/active/pm/staged/steer.md`,
   `docs/active/tickets/T-059-0{1,2}.md`, and the `src/play/*` edits showing as modified are
   from concurrent Lisa/T-059-01 activity, not this ticket. My change set is exactly the 3
   `src/init/*` files + `docs/active/work/T-059-02/`. My tests write only to temp dirs (and
   read the example charter read-only for the drift guard).

## Verdict

Complete and gate-green. The lightest honest touch the ticket asked for — one constant + one
registry entry, riding the already-proven merge/no-clobber machinery — with the override,
honest-empty, bare-init parity, no-clobber, and constant↔source drift all pinned. Ready for
Lisa to commit and advance.
