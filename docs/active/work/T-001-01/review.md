# Review — T-001-01 scaffold-bun-project

Handoff for a human reviewer. What changed, how it was verified, what to watch.

## Summary

Stood up the Bun/TypeScript project Vend builds on, plus the `bun run check:*`
command surface that the play (andon gates) and E-002 (Dagger CI) both bind to.
Scaffold only — no app logic. This ticket is the root of the S-001 DAG; T-001-02/
03/04 build on it in parallel next.

## Files created (all additive — nothing modified or deleted)

| File | Purpose |
|---|---|
| `package.json` | `type:module`, Bun runtime/pm, `check:*`+`build` scripts, `@boundaryml/baml@^0.222.0` runtime dep, `typescript`+`@types/bun` devDeps |
| `tsconfig.json` | strict TS (`strict`, `noUncheckedIndexedAccess`), Bun bundler baseline, `noEmit` |
| `.gitignore` | `node_modules/`, `.vend/`, `baml_client/`, `*.tsbuildinfo`, `dist/` |
| `bun.lock` | pinned dependency graph (committed for reproducible installs) |
| `src/smoke.test.ts` | one trivial passing test feeding `check:test` |
| `src/{executor,budget,log,gate,play}/.gitkeep` | five empty skeleton dirs |

The pre-existing `M docs/active/tickets/T-001-01.md` (lisa-managed `phase` field)
was intentionally **not** touched.

## Acceptance criteria — all met

- [x] `package.json` `type:module`, Bun runtime+pm, `@boundaryml/baml@^0.222.0`
      runtime dep. *(Installed 0.222.0 exactly — verified in E-001 too.)*
- [x] `tsconfig.json` `"strict": true` + `"noUncheckedIndexedAccess": true`.
- [x] `src/` skeleton dirs present: `executor/ budget/ log/ gate/ play/`.
- [x] `bun run check:test` runs `bun test`, passes (1 pass / 0 fail).
- [x] `bun run check:typecheck` runs `tsc --noEmit` clean (exit 0).
- [x] `.gitignore` covers `node_modules/`, build output, `.vend/`; `bun install`
      succeeds (exit 0, 8 packages, lockfile written).
- [x] Scaffold only — no app logic (skeleton dirs hold only `.gitkeep`).

## Test coverage

- **What's covered:** the structural gates themselves — `check:typecheck` (strict
  config valid, `@types/bun` wired) and `check:test` (runner discovers + runs).
  Clean-clone reproducibility rests on the committed `bun.lock`.
- **Gaps (all expected for a scaffold):** no behavioral/unit tests — there is no
  runtime code to test. The single smoke test asserts `1+1===2`; it proves the
  test harness works, nothing about the product. First real coverage arrives with
  T-001-02/03/04. This is not a gap to fix here.

## Decisions a reviewer should sanity-check

1. **Added an umbrella `check` and a `build` alias** beyond the two AC-mandated
   `check:*` scripts. `check` = typecheck && test (one entry point for play/CI).
   `build` is currently a `tsc --noEmit` **alias** — there is no entrypoint to
   bundle yet, so "bundle" is deferred to a later epic. CLAUDE.md documents
   `bun run build` as "typecheck + bundle"; today it is typecheck-only. **Flag:**
   confirm this stop-gap is acceptable vs. omitting `build` entirely. (Chosen so
   the documented command exists and passes rather than 404s.)
2. **`check:lint` deliberately NOT added.** `stack.md` lists Biome as "to confirm
   at scaffold time" and the ticket defers lint/format to E-002. Adding it now
   would be the over-build reflex `ci-strategy.md` rule 6 warns against. E-002 owns
   the lint gate.
3. **Five skeleton dirs hold only `.gitkeep` — by design, not laziness.** Putting
   any module code in `executor/`/`budget/`/`log/` would collide with T-001-02/03/
   04, which own those dirs and run in parallel (a missing-edge defect per
   `rdspi-workflow.md` §Concurrency). Verified `git add -n src/` lists only
   `.gitkeep`s + the smoke test.
4. **`tsconfig` has `skipLibCheck: true`.** Standard pragmatism — keeps the
   structural gate fast and immune to third-party `.d.ts` noise (e.g. baml). Does
   not weaken checking of our own `src`.

## Open concerns / TODO for downstream (not this ticket)

- **`build` will need a real bundle step** once there is an entrypoint (TUI / CLI).
  Tracked implicitly by the alias note above.
- **`@types/bun` pinned via `latest`** in `package.json` (resolved 1.3.14 in
  `bun.lock`). Fine now; a later tightening to a caret range is low-priority.
- **E-002 (Dagger CI)** must invoke these exact `check:test` / `check:typecheck`
  strings — they are the public contract of this ticket. Renaming is a breaking
  change for two consumers.

## Commit status — NEEDS REVIEWER/ORCHESTRATOR ACTION

This agent did **not** run `git commit`. The lisa hooks are signal-only; the
orchestrator owns commits on the shared branch, and the run instruction was
"simply stop — Lisa handles the rest." The working tree is clean-and-staged-ready:
all scaffold files + work artifacts are on disk, untracked/modified, awaiting the
orchestrator's commit. If commits are expected per-agent in this setup, the
scaffold can be committed as one atomic unit (additive only — zero rollback risk).

## Risk assessment: LOW

Additive-only change, all gates green, scaffold isolated from sibling work. The
one judgment call needing eyes is the `build`-as-typecheck-alias stop-gap (#1).
