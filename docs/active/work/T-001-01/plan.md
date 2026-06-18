# Plan — T-001-01 scaffold-bun-project

Ordered execution steps. Each is independently verifiable. The scaffold is an
indivisible unit (a half-scaffold installs/typechecks to nothing useful), so the
commit strategy is **one atomic scaffold commit** after all gates pass — not a
commit per file. Deviations recorded in `progress.md`.

## Testing strategy

- **Unit:** one trivial smoke test (`src/smoke.test.ts`) — its only job is to prove
  `bun test` discovers + runs + passes. No app logic exists to test (scaffold-only).
- **Type:** `tsc --noEmit` over `src/` is the structural gate; with only a smoke
  test + empty dirs it must pass trivially, proving the strict config is valid and
  `@types/bun` is wired.
- **Integration:** the real integration test is **clean-clone reproducibility** —
  `bun install` from scratch must succeed and resolve `tsc`. Verified by running
  the two `check:*` scripts end to end (they exercise install output).
- **No** lint test (deferred). **No** runtime/behavior test (no runtime code).

Verification criteria per AC, mapped:
| AC | Verified by |
|---|---|
| package.json type/runtime/baml dep | inspect file + `bun pm ls` shows baml |
| tsconfig strict + noUncheckedIndexedAccess | grep config + `tsc --noEmit` passes |
| src skeleton dirs present | `ls src/` shows 5 dirs (tracked via .gitkeep) |
| check:test runs bun test, passes | `bun run check:test` → 1 pass, exit 0 |
| check:typecheck runs tsc --noEmit clean | `bun run check:typecheck` → exit 0 |
| .gitignore + clean install | inspect .gitignore + `bun install` exit 0 |
| scaffold only, no app logic | review: no code in skeleton dirs |

## Steps

### Step 1 — write `package.json`
Create root `package.json` per Structure spec (scripts, deps, devDeps, type:module).
**Verify:** file parses (`bun pm` reads it without error after step 5).

### Step 2 — write `tsconfig.json`
Create per Design D3 exact object.
**Verify:** valid JSON; `strict` + `noUncheckedIndexedAccess` present.

### Step 3 — write `.gitignore`
Create per Structure (`node_modules/`, `.vend/`, `baml_client/`, `*.tsbuildinfo`,
`dist/`).
**Verify:** contains the three AC-required entries.

### Step 4 — create source skeleton
Write `src/smoke.test.ts` (one passing test) and the five `.gitkeep` files in
`src/executor|budget|log|gate|play/`.
**Verify:** `ls src/` shows 5 dirs + smoke.test.ts; no other source files.

### Step 5 — `bun install`
Run `bun install`. Generates `bun.lock` + `node_modules/`, resolves
`@boundaryml/baml`, `typescript`, `@types/bun`.
**Verify:** exit 0; `bun.lock` exists; `node_modules/.bin/tsc` resolves.
**Andon:** if baml@0.222.0 fails to install under Bun — STOP. (Already verified
working in E-001, so not expected; flag if it regresses.)

### Step 6 — run `check:typecheck`
`bun run check:typecheck`.
**Verify:** exit 0, no errors. **Andon:** any type error → fix config/test, do not
suppress with `// @ts-ignore`.

### Step 7 — run `check:test`
`bun run check:test`.
**Verify:** exit 0, reports `1 pass, 0 fail`.

### Step 8 — run umbrella + build aliases
`bun run check` and `bun run build`.
**Verify:** both exit 0 (confirms documented surface works).

### Step 9 — verify git hygiene
`git status` / `git status --ignored`.
**Verify:** `node_modules/`, `baml_client/` ignored; `bun.lock`, `package.json`,
`tsconfig.json`, `.gitignore`, `src/**` tracked/untracked-to-be-added. Five
skeleton dirs visible via their `.gitkeep`.

### Step 10 — commit (atomic scaffold)
`git add -A` the scaffold files; commit on `main` (current branch; lisa drives the
shared-branch model per rdspi-workflow §Concurrency — no feature branch needed for
the autonomous loop). Message: `T-001-01: scaffold Bun/TS project + check:* surface`.
**Note:** commit only if the loop convention commits per ticket. If lisa handles
commits via its hooks, leave the tree staged-clean and let the hook commit. Record
which path was taken in `progress.md`.

## Risk / rollback

- **Risk:** a sibling-collision if any code lands in the 5 dirs. *Mitigation:*
  `.gitkeep` only — enforced in Step 4, re-checked in Review.
- **Risk:** `tsc` version drift making typecheck non-reproducible. *Mitigation:*
  pinned devDependency + committed `bun.lock`.
- **Rollback:** scaffold is additive only (no edits/deletes to existing files), so
  `git checkout -- . && git clean -fd src package.json tsconfig.json .gitignore`
  fully reverts. Low blast radius.

## Out of scope (do not do, per Design/steering)

Lint tooling, CI/Dagger module, app entrypoint, TUI, bun:sqlite state, any module
code inside the skeleton dirs. Building any of these is the over-build reflex.
