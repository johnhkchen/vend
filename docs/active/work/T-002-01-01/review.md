# T-002-01-01 — Review: ci-module-bootstrap

*Handoff document. What changed, how it's verified, and what a human reviewer must know
without reading every diff.*

## Summary

Brought up `/ci` as its **own Dagger module** — a separate Node-runtime program with its
own `package.json`, engine **pinned to `v0.21.4`**, and a **thin** `src/index.ts` router
holding **no gate logic**. This is the bootstrap shell of story S-002-01's "one honest
gate, end to end." The `test()` gate is T-002-01-02; the `dagger call` no-drift proof is
T-002-01-03. Both are intentionally out of this slice.

## Files changed

**Created (6, all under `/ci/`, all additive):**

| File | Purpose |
|------|---------|
| `ci/dagger.json` | Module config. `engineVersion: "v0.21.4"` (pinned), `sdk.source: typescript`, root-source layout (`source` omitted). |
| `ci/package.json` | The module as a **separate program**: `type: module`, sole dep `typescript`. No app deps, no `workspaces`. |
| `ci/tsconfig.json` | Module toolchain: `experimentalDecorators`; `@dagger.io/dagger` path-mapped to generated `./sdk`. |
| `ci/.gitignore` | Keeps generated `/sdk`, node_modules, `.pnpm-store`, `.env` out of the tree. |
| `ci/.gitattributes` | Marks `/sdk/**` linguist-generated. |
| `ci/src/index.ts` | `@object() export class Ci {}` — empty thin router; header documents the Central Rule + one-gate-one-file contract. |

**Modified / Deleted:** none. The app side (root `package.json`, `tsconfig.json`,
`src/**`) is untouched — that absence *is* the boundary.

**Commit:** `f6c9568` (six files, `main`).

## Acceptance criteria — status

- ✅ **`/ci` is its own module:** `dagger.json` (engine pinned `v0.21.4`), `package.json`
  (Node runtime, own deps), `src/index.ts` a thin router with **no check logic**.
- ✅ **No cross-imports:** `grep` over `ci/src` finds no app import; app `tsconfig`
  (`include: ["src"]`) never reaches `/ci`; nothing in the app references `/ci`.
- ✅ **Engine pinned & unchanged:** `engineVersion: "v0.21.4"`; `dagger develop` was **not**
  run against `/ci` (only throwaway probes in `/tmp`, deleted). `ci/sdk/` does not exist —
  codegen is surfaced as a downstream reviewed step, not silently performed.
- ✅ **App gates unaffected:** `bun run check:typecheck` exit 0; `bun run check:test`
  **229 pass / 0 fail**, identical to baseline.

## Test coverage

**No unit tests added — and that is the correct call, not a gap.** This ticket is a
config/skeleton shell with no executable logic to assert. Per the Central Rule, all check
*logic* stays in the app's `bun run check:*` scripts (none added here), so there is nothing
to unit-test in `/ci`. A `*.test.ts` under `/ci` would also risk being collected by the
app's `bun test` — a boundary violation. Verification is therefore **structural**
(file/content inspection) plus the app's own existing gate proving non-perturbation. The
*behavioural* proof of the module (`dagger call test` agrees with standalone + can-fail) is
explicitly **owned by T-002-01-03** and deferred by design.

## Open concerns / known limitations

1. **`sdk/` not yet generated → `/ci` does not self-compile yet.** The `@dagger.io/dagger`
   import resolves via a tsconfig `paths` mapping to `./sdk`, which is produced by codegen.
   Codegen is the andon-fenced step, so it was deferred. **T-002-01-02 must populate `sdk/`
   at the pinned `v0.21.4` (no version bump)** as its first action — that ticket's AC
   ("Compiles within the `/ci` module's own toolchain") is where this resolves. This is a
   deliberate hand-off, not an omission.
2. **Do not "fix" the import by adding `@dagger.io/dagger` to `ci/package.json` deps.** It
   is *meant* to resolve via generated `sdk/` path-mapping, exactly as `dagger init` sets
   up. Adding it as an npm dep would diverge from the tool's model.
3. **Empty `@object()` class warns under `dagger call`.** A module with zero functions may
   warn — irrelevant here (we never invoke it this slice) and resolved the moment
   T-002-01-02 adds `test()`.
4. **Version-bump nag is live.** The CLI reports `v0.21.7` available. Staying pinned at
   `v0.21.4` is intentional; any bump is a **reviewed human step** (`ci-strategy.md` rule
   1) — flag, do not auto-apply.
5. **Keep-warm not addressed.** The measured ~18.4s cold-start makes keep-warm mandatory
   *eventually* (`ci-strategy.md`), but it generalizes out of the first honest gate and is
   out of this slice — correctly deferred (no over-build).

## For the human reviewer — the one thing to check

The whole investment hinges on the boundary: **`/ci` imports nothing from the app; the app
imports nothing from `/ci`; the only contract is `bun run check:*`.** This shell holds it
by construction (separate program, separate tsconfig, no cross-imports, app side
untouched). If a later change makes `/ci` reach into app source, or inlines check logic
into a sub-class instead of calling a `check:*` script — that is the andon; stop the line.

## Nothing critical blocks the next ticket

T-002-01-02 (`test-gate-subclass-and-router`) can proceed: it adds `src/test.ts` and a
single `test()` route, and populates `sdk/` at the pinned engine. The shell gives it
exactly the clean, pinned, boundary-respecting foundation it depends on.
