# Research — T-001-01 scaffold-bun-project

Descriptive map of the ground this ticket stands on. No solutions here — only
what exists, where, and the constraints that bind the scaffold.

## What exists today

The repo is **docs-only**. `git ls-files` shows no `package.json`, no `src/`, no
`tsconfig.json`, no lockfile. The tracked tree is:

- `CLAUDE.md`, `LICENSE`
- `.lisa.toml`, `.lisa/` (hooks: `on-clear.sh`, `on-heartbeat.sh`, `on-idle.sh`,
  `on-stop.sh`, `.gitignore`) — the lisa orchestration substrate, not app code.
- `docs/knowledge/` — the canonical steering corpus: `vision.md`, `charter.md`,
  `stack.md`, `ci-strategy.md`, `tps.md`, `go-and-see.md`, `rdspi-workflow.md`,
  `playbook-decompose-epic.md`.
- `docs/active/` — `demand.md` (pull board), `epic/E-001.md`, `epic/TEMPLATE.md`,
  `stories/S-001.md`, `stories/S-002.md`, and eight tickets `T-001-0x` / `T-002-0x`.

Untracked: `.lisa-layout.kdl` (zellij layout, lisa-owned). No `docs/active/work/`
content yet — this ticket creates the first `work/T-001-01/` subdirectory.

This ticket is **T-001-01**, the root of the DAG. `S-001.md` is explicit: "scaffold
gates everything"; T-001-02/03/04 run in parallel *after* it, on separate modules
with no shared files. So the scaffold I produce is the substrate three sibling
agents immediately build on concurrently.

## Toolchain reality (verified on this machine)

- **Bun 1.3.9** is installed and is `bun --version`-confirmed. It is runtime,
  package manager, and test runner in one (`stack.md` §conventions).
- Node 22.22 also present, but the app targets Bun. (`ci-strategy.md` keeps the
  *Dagger orchestrator* on Node; that is E-002's concern, not this scaffold's.)
- **BAML `@boundaryml/baml@0.222.0`** is already verified to render+parse under
  Bun 1.3.9 (E-001 andon cleared — observations 20121-20125). The ticket pins this
  exact version as a runtime dependency.

## Constraints the scaffold must honor (sourced, not invented)

1. **`bun run check:*` is the load-bearing command surface.** `ci-strategy.md`'s
   Central Rule: "Dagger invokes, it never defines." Check *logic* lives in the
   app's `package.json` as `check:*` scripts. The play invokes the *same* scripts
   as andon gates; CI (E-002) invokes them independently. Getting the names and
   behavior right now is load-bearing — two downstream consumers bind to them.
   - The ticket requires `check:test` (→ `bun test`) and `check:typecheck`
     (→ `tsc --noEmit`). `ci-strategy.md`'s first slice only needs `check:test`;
     `check:typecheck`/`check:lint` "generalize out of this one clean gate."

2. **Strict TypeScript.** `stack.md` and the ticket AC both require
   `"strict": true` and `"noUncheckedIndexedAccess": true` in `tsconfig.json`.

3. **`type: module`.** ESM-only; the project is `"type": "module"`.

4. **Source skeleton dirs.** Ticket AC names exactly: `executor/ budget/ log/
   gate/ play/`. This is a *subset/rename* of `stack.md`'s provisional layout
   (which lists `playbook/ engine/ executor/ gate/ budget/ shelf/ tui/ state/`).
   The ticket's five dirs are the ones E-001's dispense slice actually touches:
   - `executor/` ← T-001-02 (claude -p seam)
   - `budget/`   ← T-001-03 (budget control)
   - `log/`      ← T-001-04 (run log)
   - `gate/`     ← andon gate evaluation (S-002 plays)
   - `play/`     ← the DecomposeEpic play (S-002)
   The broader `stack.md` layout is provisional and epic-formalized later; the
   ticket's five dirs are authoritative for *this* scaffold.

5. **`tsc` must be available.** Bun runs TS natively but does not type-*check*.
   `check:typecheck` shells to `tsc --noEmit`, so `typescript` must be a
   devDependency (Bun does not ship `tsc`).

6. **`.gitignore`** must cover `node_modules/`, build output, and `.vend/` (the
   local-state dir implied by `state/` / `bun:sqlite` in stack.md). Clean-clone
   `bun install` must succeed.

7. **Scaffold only — no app logic.** Ticket AC final line. Lint/format (Biome)
   deferred to E-002/CI per `stack.md` (it is "to be confirmed at scaffold time"
   and the ticket explicitly defers it). So **no `check:lint` yet** — adding it
   would be the over-building reflex `ci-strategy.md` rule 6 warns against.

## Patterns & boundaries relevant downstream

- **No shared files between siblings.** S-001's DAG note and `rdspi-workflow.md`
  §Concurrency: if two tickets touch the same file it's a missing dependency edge.
  So the scaffold must give each sibling its *own* module dir and must NOT create
  files inside `executor/`/`budget/`/`log/` that those tickets will own (a
  collision would serialize the parallel wave). Empty dirs need a `.gitkeep` since
  git does not track empty directories — that keep file is the only thing in them.
- **Smoke test placement.** `check:test` needs one trivial passing test. It must
  live somewhere that does *not* collide with a sibling's module — a top-level
  `src/smoke.test.ts` or a test under a neutral path. Bun's test runner discovers
  `*.test.ts` recursively.
- **BAML generated code.** BAML normally generates a `baml_client/`. For a pure
  scaffold (no `.baml` files yet) none is generated; the dependency is installed
  but unused until S-002. `.gitignore` should anticipate `baml_client/` as build
  output to avoid committing generated code later.

## Open questions surfaced (resolved in Design, not here)

- Exact `tsconfig` beyond the two required flags (module resolution, lib, target)?
- Does `check:typecheck` need `tsconfig` `noEmit` set, or pass `--noEmit` on CLI?
- Where exactly does the smoke test live to stay collision-free?
- Is a `bun run build` script in-scope (CLAUDE.md lists it) or deferred?

## Assumptions

- Bun 1.3.9 is the committed floor; no `engines`/`packageManager` pin required
  beyond noting Bun, but a `packageManager`/`engines` hint is low-cost.
- The five skeleton dirs are created empty (with `.gitkeep`); siblings fill them.
- `bun.lock` (text lockfile, Bun's default since 1.2) is committed.
