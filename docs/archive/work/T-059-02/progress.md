# T-059-02 — Progress

Tracking the Implement phase against `plan.md`. All steps complete; gate green.

## Steps

- [x] **Step 1 — generate byte-exact `HACKATHON_CHARTER`.** Wrote a one-off script that
  read `examples/templates/hackathon-seed/charter.md`, escaped `` ` `` → `` \` `` and `${`
  → `\${` (no `${` present, escaped defensively), and emitted the template literal. The
  script then re-imported the module and confirmed `charter.contents === seed` (byte-equal,
  logged `true`). Script deleted after use — no transcription by hand.
- [x] **Step 2 — edit `src/init/init-core.ts`.** Inserted the `HACKATHON_CHARTER` constant
  (with JSDoc) immediately before `SCAFFOLD_MANIFEST`; added
  `{ kind:"file", path:"docs/knowledge/charter.md", contents: HACKATHON_CHARTER }` to
  `TEMPLATE_REGISTRY.hackathon` (after the SEED.md entry). Tightened the now-stale
  `TEMPLATE_REGISTRY` JSDoc forward-reference (it had said the tuned charter was
  "T-058-02/03" deferred; it landed here). Module stays PURE — the constant is a plain
  string, no fs/addon added.
- [x] **Step 3 — pure pins in `init-core.test.ts`.** Added
  `describe("hackathon overlay — the tuned charter override (T-059-02)")` with 5 tests:
  overlay entry present & distinct from the base stub & carries the right markers;
  `mergeManifests` lets the tuned charter win in the base slot (+ length grows by exactly 1);
  `planTemplate` creates it with tuned contents; honest-empty (`countDemandRows === 0`); the
  base manifest still ships the generic stub (bare-init regression guard). No new import — the
  base charter is reached via `SCAFFOLD_MANIFEST.find`, the overlay via `resolveTemplate`.
- [x] **Step 4 — effect pins + drift guard in `init-effect.test.ts`.** Added `resolveTemplate`
  to the import; new `describe("runInit — tuned charter overlay (T-059-02)")` with 6 tests:
  a definedness guard for the module-level consts; `--template hackathon` writes the tuned
  charter (not the stub); bare `runInit` still writes the generic stub there (E-040 parity);
  idempotent re-run (charter among skips); no-clobber on a user-edited charter; and the drift
  guard (`HACKATHON_CHARTER` byte-equal to the authored seed file).
- [x] **Step 5 — full gate.** `bun run check` green.

## Deviations from plan

- **One small addition not in the plan:** a `tunedCharter`/`stubCharter` *definedness* test
  in the effect block. The module-level `resolveTemplate(...)?.find(...)?.contents` consts are
  typed `string | undefined`; `tsc --noEmit` rejected `.toBe(undefined-maybe)` overloads. Fixed
  with a definedness test + non-null assertions (`!`) at the use sites — the consts are proven
  present by the new test, so the assertions are safe, not blind. This is a typecheck-driven
  refinement, not a design change. (A linter pass applied the same non-null assertions.)

No other deviations. The merge/effect/BAML machinery was reused untouched, exactly as designed.

## Gate result

`bun run check`:
- `baml:gen` — regenerated, **zero diff** (no BAML touched).
- `tsc --noEmit` — clean.
- `bun test` — **1327 pass / 0 fail** (3772 assertions), up from the 1316 T-059-01 baseline
  (+11 new pins: 5 pure + 6 effect).

Change set: exactly 3 files (`init-core.ts`, `init-core.test.ts`, `init-effect.test.ts`),
+233/−7. No effect-code, merge, BAML, or example-file change.

## Not done here (by design)

- **Not committed.** Per the session's "Lisa handles the rest" instruction, the change sits
  in the working tree for Lisa to commit and advance the phase.
- **No live model run.** End-to-end metered proof of a fresh-seed steer producing a board
  graded against the tuned charter is T-059-03's live re-drive.
