# Design — T-001-01 scaffold-bun-project

Decisions for the scaffold, each grounded in Research. The scaffold is small but
load-bearing: three sibling agents build on it in parallel and two downstream
consumers (the play's andon gates, E-002 CI) bind to its `check:*` surface.

## Decision 1 — `check:*` script surface (what to define now)

**Options:**
- (A) Only `check:test` + `check:typecheck` (ticket AC minimum).
- (B) Add `check:lint` now (anticipate E-002).
- (C) Add `check:test`, `check:typecheck`, plus an umbrella `check` that runs both.

**Chosen: C.** Ticket AC requires `check:test` and `check:typecheck`; an umbrella
`check` (runs typecheck then test) costs one line and gives the play / CI a single
entry point without committing to lint logic. Reject **B** — `stack.md` lists Biome
as "to confirm at scaffold time" and the ticket explicitly defers lint/format to
E-002; adding `check:lint` now is the over-building reflex `ci-strategy.md` rule 6
names. Reject **A** as needlessly bare when the umbrella is free and useful.

Scripts:
```jsonc
"check:test":      "bun test",
"check:typecheck": "tsc --noEmit",
"check": "bun run check:typecheck && bun run check:test",
"build": "tsc --noEmit"   // see Decision 5
```
The `check:*` names match `ci-strategy.md`'s first-slice contract verbatim so the
Dagger sub-classes (E-002) and play gates invoke the identical strings.

## Decision 2 — `tsc` provisioning

**Options:** (A) `typescript` as devDependency, call `tsc`. (B) Use
`bunx tsc`. (C) Rely on `bun --check` / editor only.

**Chosen: A.** Bun runs TS but does not type-*check*; `check:typecheck` must shell
to the real compiler. A pinned `typescript` devDependency makes `tsc` deterministic
and offline-reproducible (clean-clone AC). `bunx tsc` (B) would resolve a floating
version per machine — non-reproducible, rejected. (C) does not satisfy a scriptable
gate. Pin a recent stable: `typescript@^5.7.0`.

## Decision 3 — `tsconfig.json` shape

Required by AC: `"strict": true`, `"noUncheckedIndexedAccess": true`. Beyond those,
pick the **Bun-recommended** baseline so `tsc --noEmit` agrees with how Bun runs
the code (ESM, bundler resolution, no emit):

```jsonc
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "types": ["bun"],            // bun-types for the test runner / bun:sqlite
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src"]
}
```

Rationale per choice:
- `moduleResolution: "bundler"` + `allowImportingTsExtensions` — matches Bun's
  loader; lets sibling modules import `./x.ts` without an emit step.
- `types: ["bun"]` (via `@types/bun` devDep) — gives `Bun`, `bun:test`,
  `bun:sqlite` types so the smoke test and T-001-03/04 typecheck cleanly.
- `noEmit: true` — `check:typecheck` is `tsc --noEmit`; setting it in the config
  too means a bare `tsc` never accidentally emits `.js` next to sources.
- `skipLibCheck: true` — standard; keeps typecheck fast and immune to
  third-party (`@boundaryml/baml`) declaration noise. This is a structural-gate
  pragmatism, not a correctness compromise.

Rejected: a stricter `"exactOptionalPropertyTypes"` etc. — not required by AC,
adds friction for sibling modules with no proven need. Hold the line at the two
mandated flags plus the Bun baseline.

## Decision 4 — skeleton dirs & collision avoidance

The five dirs (`executor/ budget/ log/ gate/ play/`) are created **empty** with a
`.gitkeep` in each. Critical constraint (Research §patterns, S-001 DAG): T-001-02/
03/04 own files inside `executor/`, `budget/`, `log/` respectively and run in
parallel. If the scaffold writes any real source into those dirs it manufactures a
file collision → serializes the parallel wave (a missing-edge defect per
`rdspi-workflow.md` §Concurrency).

**Therefore:** scaffold places *only* `.gitkeep` in each of the five dirs. No
`index.ts`, no placeholder module. The directories exist; the siblings fill them.

## Decision 5 — smoke test placement & `build` script

**Smoke test:** lives at `src/smoke.test.ts` (top level of `src/`, not inside any
sibling-owned dir). One trivial assertion (`expect(1 + 1).toBe(2)`) using
`bun:test`. This satisfies `check:test` while staying collision-free — no sibling
ticket owns `src/smoke.test.ts`.

**`build` script:** CLAUDE.md lists `bun run build` as a convention ("typecheck +
bundle"). For a scaffold with no entrypoint there is nothing to bundle yet.
**Decision:** make `build` an alias to `tsc --noEmit` for now (typecheck-only), so
the documented command exists and passes, and bundling is added when there is an
actual entrypoint (later epic). This avoids a broken/empty bundle step while
honoring the documented surface. Noted as a known simplification in Review.

## Decision 6 — `.gitignore` contents

Cover (ticket AC + Research): `node_modules/`, build output, `.vend/`. Concretely:
```
node_modules/
.vend/
baml_client/      # BAML-generated client (build output, regenerated)
*.tsbuildinfo
dist/
```
`bun.lock` is **committed** (reproducible installs), so it is NOT ignored.
`baml_client/` is pre-emptively ignored so S-002's generated code never lands in
git.

## Decision 7 — dependency pins

- Runtime: `@boundaryml/baml@^0.222.0` (verified version, ticket AC).
- Dev: `typescript@^5.7.0`, `@types/bun@latest` (pinned to installed at lock time).
- `"type": "module"`, `"private": true`. Add `engines`/`packageManager` hint for
  Bun to document the floor (low cost, aids reproducibility).

## What this design deliberately does NOT do

- No lint/format tool (deferred to E-002 per stack.md + ticket).
- No app logic, no entrypoint, no TUI (scaffold-only AC).
- No files inside the five skeleton dirs beyond `.gitkeep` (collision avoidance).
- No Dagger/CI module (`/ci` is E-002).
- No `bun:sqlite` state code (state/ is not even a scaffold dir here).

Every one of these is a real temptation the steering docs explicitly warn off.
