# T-064-01 — Progress

> Execution log for Option C (standalone-template gate bypass + an empty `minimal`
> placeholder). Plan steps tracked; deviations noted.

## Status: implementation complete, all T-064-01 tests green

| Step | What | State |
|------|------|-------|
| 1 | `init-core.ts`: `minimal: []` in `TEMPLATE_REGISTRY`; `STANDALONE_TEMPLATES` set + `isStandaloneTemplate()`; header note | ✅ done |
| 2 | `init-core.test.ts`: update `availableTemplates()` expectation; add the standalone/minimal pure block | ✅ done — `bun test src/init/init-core.test.ts` 38 pass |
| 3 | `init-effect.ts`: import `isStandaloneTemplate`; rewrite `runInit` (resolve-then-gate + standalone bypass); doc-comments | ✅ done |
| 4 | `init-effect.test.ts`: update `unknown-template.available`; add the T-064-01 standalone describe block | ✅ done |
| 5 | Full gate | ⚠️ init/cli green; 8 PRE-EXISTING board-smoke failures unrelated to this ticket (see below) |

## What was implemented

### `src/init/init-core.ts`
- `TEMPLATE_REGISTRY.minimal = []` — the empty placeholder overlay (the base scaffold is
  the whole workspace). Documented inline.
- `STANDALONE_TEMPLATES: ReadonlySet<string> = new Set(["minimal"])` and
  `isStandaloneTemplate(name)` — the gate-bypass policy, kept beside the registry so its
  value shape (and the invariant tests iterating it) are untouched.
- Extended the "ONE-WAY TO LISA" header: the bypass relaxes only the gate; no lisa-owned
  file is ever written.

### `src/init/init-effect.ts`
- `runInit` rewritten: resolve the template first (unknown ⇒ `unknown-template`), compute
  `standalone`, gate only when `!standalone && !isLisaProject`, then apply the (possibly
  merged) manifest. `mergeManifests(base, [])` ⇒ base unchanged for `minimal`.
- Doc-comment + header updated with the E-061 standalone clause and the resolve-then-gate
  ordering note.

### Tests
- `init-core.test.ts`: `availableTemplates()` → `["hackathon", "minimal"]`; new
  `STANDALONE_TEMPLATES / minimal (T-064-01)` block — empty-overlay resolve, membership,
  the standalone⊆registry invariant, and `planTemplate([],base,[]) == planInit([],base)`.
- `init-effect.test.ts`: `unknown-template.available` → `["hackathon", "minimal"]`; new
  `runInit — standalone template, no clone / no Doppler (T-064-01)` block — empty-dir
  scaffold (AC clause 1), no-clobber converge (clause 2), no-Doppler env scrub + no-`.git`
  repo guard (clauses 3+4), and the gate-still-holds regression (bare + `hackathon` →
  `not-lisa`).

## Deviations from plan

- **Test import fix-ups** (not in the plan as steps): added `isLisaProject` + `readdir`
  to `init-effect.test.ts` imports, and `STANDALONE_TEMPLATES` + `isStandaloneTemplate`
  to `init-core.test.ts` imports. Caught and fixed during the test runs.
- **No git commits made.** The plan listed commit boundaries (A/B/C), but the session
  instruction is to produce artifacts and stop for Lisa; per the repo's "commit only when
  asked" discipline, the working tree is left staged-by-edits, uncommitted. The change is
  cohesive enough to land as one commit when the normal flow picks it up.

## Verification snapshot

- `bun run check:typecheck` — clean.
- `bun test src/init/` — **65 pass, 0 fail**.
- `bun test src/init/ src/cli.test.ts` — **167 pass, 0 fail**.
- Full `bun test` — 1371 pass, **8 fail**, ALL in live-board smoke
  (`graph/load`, `present/svg-file`, `present/*` projection, one-way-authority). Verified
  PRE-EXISTING by stashing the `src/init/` changes and re-running: the same board tests
  fail without this ticket's code. They read the in-flight `docs/active/**` board (the
  E-061 tickets/work dirs mid-edit), not anything T-064-01 touched.

## Open items → carried to Review

- The reorder (template-before-gate) changes one untested combo (non-lisa + unknown
  template: `not-lisa` → `unknown-template`). Intentional; documented in code + design.
- The 8 pre-existing board-smoke failures are out of scope but flagged for the human.
