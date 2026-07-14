# Progress — T-001-01 scaffold-bun-project

Implementation log. Steps map to `plan.md`. All gates verified green on Bun 1.3.9.

## Completed

- [x] **Step 1 — `package.json`** — `type: module`, `private`, Bun engine hint,
      `check:test` / `check:typecheck` / `check` / `build` scripts, runtime dep
      `@boundaryml/baml@^0.222.0`, devDeps `typescript@^5.7.0` + `@types/bun`.
- [x] **Step 2 — `tsconfig.json`** — strict baseline per Design D3:
      `"strict": true`, `"noUncheckedIndexedAccess": true`, `noEmit`, Bun bundler
      resolution, `types: ["bun"]`, `skipLibCheck`. `include: ["src"]`.
- [x] **Step 3 — `.gitignore`** — `node_modules/`, `.vend/`, `baml_client/`,
      `*.tsbuildinfo`, `dist/`. All three AC-required entries present.
- [x] **Step 4 — source skeleton** — `src/smoke.test.ts` (1 trivial test) + five
      `.gitkeep` files in `src/{executor,budget,log,gate,play}/`. **No module code
      placed in the five dirs** (collision rule, Design D4) — confirmed by
      `git add -n src/` listing only `.gitkeep`s + `smoke.test.ts`.
- [x] **Step 5 — `bun install`** — exit 0. Resolved 8 packages:
      `@boundaryml/baml@0.222.0`, `typescript@5.9.3`, `@types/bun@1.3.14`. Wrote
      `bun.lock` (committed-to-be). `node_modules/.bin/tsc` resolves.
- [x] **Step 6 — `check:typecheck`** — `tsc --noEmit` exit 0, no errors.
- [x] **Step 7 — `check:test`** — `bun test` → `1 pass, 0 fail`, exit 0.
- [x] **Step 8 — umbrella + build** — `bun run check` exit 0; `bun run build`
      (typecheck alias) exit 0.
- [x] **Step 9 — git hygiene** — `git check-ignore` confirms `node_modules/`,
      `baml_client/`, `.vend/` all ignored. `bun.lock` untracked-pending-add (will
      be tracked). Five `.gitkeep`s + `smoke.test.ts` would be added.

## Deviations from plan

1. **Step 10 (commit) — deferred to lisa, not performed by this agent.** The plan
   left this conditional on the loop's commit convention. Inspection of
   `.lisa/hooks/on-stop.sh` / `on-clear.sh` shows they are **signal-only** (write
   `.lisa/signals/*` files); commits are handled by the lisa orchestrator, not a
   git hook. The orchestration instruction for this run is explicit — *"simply stop
   — Lisa handles the rest."* So I leave the working tree with the scaffold +
   artifacts in place and do **not** commit myself, avoiding any race with the
   orchestrator on the shared branch. The pre-existing `M docs/active/tickets/
   T-001-01.md` (lisa-managed phase field) was left untouched as instructed.

   *No content deviation* — every file matches Structure/Plan; this is purely a
   process choice about who runs `git commit`.

2. **`typescript` resolved to 5.9.3** (caret range `^5.7.0`) and **`@types/bun` to
   1.3.14** — expected caret behavior, pinned now in `bun.lock` for reproducibility.

## Verified end-state

```
package.json   tsconfig.json   .gitignore   bun.lock
src/smoke.test.ts
src/{executor,budget,log,gate,play}/.gitkeep
```
`bun run check` (typecheck + test) passes clean. Clean-clone reproducibility rests
on the committed `bun.lock`.

## Nothing outstanding for this ticket

No app logic, no lint tooling, no CI module — all correctly out of scope per
Design. Skeleton dirs are ready for T-001-02/03/04 to fill in parallel.
