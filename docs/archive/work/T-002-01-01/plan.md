# T-002-01-01 — Plan: ci-module-bootstrap

*Ordered, independently-verifiable steps + the testing/verification strategy.*

## Testing strategy (stated up front)

This ticket ships **no executable code paths and no unit tests** — and that is correct,
not a gap:

- The deliverable is a **config/skeleton shell**. There is no logic to unit-test; the
  Central Rule keeps all check *logic* in the app's `check:*` scripts (none added here).
- Adding a `*.test.ts` under `/ci` would be wrong twice over: nothing to assert, and it
  would risk being collected by the app's `bun test` (boundary violation).
- **Verification is structural**, done by inspection + the app's existing gate:
  1. The six files exist with the specified content (esp. `engineVersion: "v0.21.4"`).
  2. The app's `bun run check:test` and `bun run check:typecheck` remain **green and
     unchanged** — proving the shell perturbs nothing (AC4).
  3. The boundary holds: no `/ci`→app import, no app→`/ci` import, app tsconfig untouched.
- The *behavioural* proof of the module (`dagger call`, can-fail, no-drift) is **owned by
  T-002-01-03** and intentionally deferred — bundling it here is the over-build reflex.

## Steps

### Step 1 — Create the `/ci` module shell (one atomic unit)

Author the six files from Structure, hand-written, no codegen:

- `/ci/dagger.json` — `engineVersion: "v0.21.4"`, `sdk.source: "typescript"`, `source` key
  omitted (root layout).
- `/ci/package.json` — `{ "type": "module", "dependencies": { "typescript": "5.9.3" } }`.
- `/ci/tsconfig.json` — decorators on; `@dagger.io/dagger` paths → `./sdk`.
- `/ci/.gitignore` — `/sdk`, node_modules, `.pnpm-store`, `.env`.
- `/ci/.gitattributes` — `/sdk/** linguist-generated`.
- `/ci/src/index.ts` — header comment (router contract) + `import { object }` +
  `@object() export class Ci {}` (empty, no `@func()`).

**Verify:** `find ci -type f` lists exactly the six files; `dagger.json` contains
`"v0.21.4"`; `index.ts` has no `@func()` and imports nothing from the app.

### Step 2 — Prove the app build is unaffected (AC4)

Run the app's own gates from the repo root, unchanged:

- `bun run check:typecheck` → exits 0 (tsc still only sees `src/`; `/ci` excluded).
- `bun run check:test` → still `229 pass / 0 fail`.

**Verify:** both exit 0 with identical pass counts to the pre-change baseline (229).
`git status` shows **only** new `/ci` files + the work artifacts — no app-source edits.

### Step 3 — Confirm the boundary by inspection (AC2)

- `grep -R` from `/ci/src` for any `from "../`, `from "../../src`, or app-package import →
  must be empty.
- Confirm root `package.json` gained **no** `workspaces` key and no new scripts.
- Confirm root `tsconfig.json` still reads `"include": ["src"]` (not widened to `/ci`).

**Verify:** all three checks clean.

### Step 4 — Confirm the andon held (AC3)

- `dagger develop` / `dagger init --sdk` were **not** run against `/ci`. (The only `dagger`
  invocations this session were throwaway probes in `/tmp`, since deleted.)
- `/ci/dagger.json` `engineVersion` is `v0.21.4` and `/ci/sdk/` does **not** exist
  (codegen deliberately deferred).

**Verify:** `ls ci/sdk` → "No such file"; `dagger.json` engine line unchanged from authored.

### Step 5 — Commit the shell atomically

Single commit on the shared `main` branch (the established loop pattern; lisa serializes
commits across threads):

```
T-002-01-01: /ci Dagger module bootstrap shell — Node runtime, engine pinned v0.21.4

Thin shell only: dagger.json (pinned), package.json (Node, own deps),
tsconfig, src/index.ts empty @object() router. No gate logic (T-002-01-02
adds test()). /ci imports nothing from the app; dagger develop NOT run —
sdk/ codegen deferred as a reviewed step.
```

**Verify:** `git show --stat` lists only `/ci/**` (+ optionally the RDSPI artifacts);
tree clean afterward.

### Step 6 — Write progress.md, then review.md

Record completion, the one notable decision (hand-authored, no codegen) and any deviation
in `progress.md`; then the Review handoff. Optionally fold the artifacts into a follow-up
commit so the working tree is clean for the next ticket.

## Commit boundaries

- **Commit 1:** the `/ci` shell (Step 5) — the atomic deliverable.
- **Commit 2 (optional):** RDSPI artifacts for T-002-01-01, to leave a clean tree.

## Verification criteria (acceptance, restated as checks)

| AC | Check |
|----|-------|
| `/ci` own module: dagger.json (pinned v0.21.4), package.json (Node), thin index.ts | Step 1 |
| `/ci` imports nothing from app; app imports nothing from `/ci` | Step 3 |
| Engine pinned & unchanged; `dagger develop` not run casually | Step 4 |
| App `check:test` / `check:typecheck` unaffected | Step 2 |

## Risks & mitigations

- **Risk:** an empty `@object()` class triggers a "module has no functions" warning under
  `dagger call`. **Mitigation:** we never run `dagger call` here; it resolves the instant
  T-002-01-02 adds `test()`. Not a blocker for this ticket's structural acceptance.
- **Risk:** someone later "fixes" the `@dagger.io/dagger` import by adding it to
  `package.json` deps. **Mitigation:** documented in Review — it resolves via generated
  `sdk/` path-mapping, not npm; do not add it as a dep.
