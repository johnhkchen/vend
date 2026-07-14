# T-002-01-01 — Structure: ci-module-bootstrap

*The blueprint — file-level changes, boundaries, ordering. Not code; the shape of it.*

## File manifest

All changes are **additive** and confined to a new top-level `/ci` directory. **Zero**
files in the app (`/src`, root `package.json`, root `tsconfig.json`, root `.gitignore`)
are created, modified, or deleted.

### Created

```
/ci
├── dagger.json          Dagger module config — engine PINNED v0.21.4, Node-runtime TS SDK
├── package.json         Module's own program — Node runtime, sole dep: typescript
├── tsconfig.json        Module toolchain — decorators on, @dagger.io/dagger -> ./sdk paths
├── .gitignore           Ignores generated /sdk, node_modules, .pnpm-store, .env
├── .gitattributes       Marks /sdk/** linguist-generated
└── src/
    └── index.ts         Thin @object() router — EMPTY class, no @func() gates yet
```

### Deliberately NOT created (generated/codegen artifacts — surfaced, not produced)

- `/ci/sdk/**` — the generated Dagger SDK client. Produced by codegen (`dagger develop`)
  at the pinned engine; gitignored; **out of scope** per the andon.
- `/ci/yarn.lock`, `/ci/node_modules/` — codegen/install artifacts; absent until the
  module is first developed (a reviewed step, downstream of this ticket).

### Modified / Deleted

- **None.** The app side stays exactly as-is. This is the boundary, enforced by omission.

## File-by-file specification

### `/ci/dagger.json`
```json
{
  "name": "ci",
  "engineVersion": "v0.21.4",
  "sdk": {
    "source": "typescript"
  }
}
```
- `engineVersion` **pinned** to `v0.21.4` — the load-bearing line (AC: pinned & unchanged).
- `source` key **omitted** → root-source layout (entrypoint at `src/index.ts`).
- `sdk.source: "typescript"` → Node-runtime TypeScript SDK (Bun runs *inside* containers,
  never as orchestrator).

### `/ci/package.json`
```json
{
  "type": "module",
  "dependencies": {
    "typescript": "5.9.3"
  }
}
```
- A **separate program** from the app: its own deps, no `name`/`version` needed for a
  Dagger module, no `workspaces`, **no dependency on app code or `@dagger.io/dagger`**
  (the SDK is path-mapped to generated `./sdk`, not an npm dep).
- Mirrors exactly what `dagger init --sdk=typescript` emits for v0.21.4.

### `/ci/tsconfig.json`
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "moduleResolution": "Node",
    "experimentalDecorators": true,
    "strict": true,
    "skipLibCheck": true,
    "paths": {
      "@dagger.io/dagger": ["./sdk/index.ts"],
      "@dagger.io/dagger/telemetry": ["./sdk/telemetry.ts"]
    }
  }
}
```
- `experimentalDecorators` is what makes `@object()` / `@func()` legal.
- `paths` is the *entire* mechanism by which `@dagger.io/dagger` resolves — to generated
  `./sdk`. This is **independent of the app's tsconfig** (which is `include: ["src"]` and
  never sees `/ci`).

### `/ci/src/index.ts`
- A header comment stating the module's purpose **and the router contract**:
  *one gate = one sub-class = one file; `index.ts` stays a thin router.*
- `import { object } from "@dagger.io/dagger"` — only `object`; no `dag`/`Container`/
  `Directory`/`func` because there is no gate yet.
- `@object() export class Ci {}` — empty body. A note that `test()` (T-002-01-02) will be
  the first `@func()`, delegating to `src/test.ts`.

### `/ci/.gitignore`
```
/sdk
/**/node_modules/**
/**/.pnpm-store/**
/.env
```

### `/ci/.gitattributes`
```
/sdk/** linguist-generated
```

## Module boundary (the invariant this structure encodes)

```
        app (Bun, repo root)                 /ci  (Node Dagger module)
        ────────────────────                 ─────────────────────────
        package.json: check:*  ◀───────────  (later) sub-classes invoke
        src/**                               src/index.ts  (thin router)
                                             tsconfig paths -> ./sdk (generated)

   CONTRACT  = the `bun run check:*` command surface, nothing else
   FORBIDDEN = /ci importing app source · app importing /ci · widening app tsconfig
```

- `/ci` has **no import path** to `/src` (separate tsconfig, separate program).
- `/src` has **no import path** to `/ci` (app tsconfig `include: ["src"]`).
- The contract surface (`check:test`) is referenced only by *future* sub-classes as a
  shell command string — never as a code import.

## Ordering of changes

No hard ordering between the six files, but a sane sequence for one atomic commit:

1. `dagger.json` — declares the module + pins the engine (the spine).
2. `package.json` + `tsconfig.json` — the module's program + toolchain.
3. `.gitignore` + `.gitattributes` — keep generated `sdk/` out of the tree from commit one.
4. `src/index.ts` — the thin router shell.

All land together: a half-shell isn't independently meaningful, and the unit is "the
module exists, clean, pinned." Verification (Plan) runs *after* the files exist.

## Interfaces touched

- **Public surface added:** the `/ci` Dagger module named `ci`, with object `Ci` and (for
  now) **no functions**. T-002-01-02 adds `test()`.
- **App public surface:** unchanged. No new scripts, no tsconfig/package edits.
