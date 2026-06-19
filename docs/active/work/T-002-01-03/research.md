# T-002-01-03 — Research: verify-no-drift

*Descriptive map of the terrain this spike runs over. What exists, where, how it
connects, what is assumed. No solutions proposed here — that is Design.*

## What this ticket is

A **spike**, not a feature. No production code is the deliverable. The deliverable
is *evidence*: proof that the `test` gate built in T-002-01-02 is **real** and
**drift-free**. Concretely, three things must be shown on the machine:

1. `dagger call test run` (Docker up) runs the suite **in-container** and **agrees**
   with standalone `bun run check:test` — both green on the current tree.
2. A **deliberately-broken** test makes the gate go **red** (non-zero), proving the
   gate *can* fail — then the break is reverted.
3. A short note records **cold-start / run time** and confirms `/ci` stays a
   **separate program** (imports nothing from the app).

The "point" (ticket Context, `ci-strategy.md`): the **three-way agreement** —
standalone · play-andon · CI — over the *same* `bun run check:test` string. This
slice exercises two of the three legs directly (standalone and CI-in-container);
the play-andon leg is the *same string*, so agreement there is by construction.

## The gate under test (T-002-01-02, committed `36dbdc6`)

`ci/src/test.ts` — `@object() Test` with one `@func() async run(source: Directory)`:

```
dag.container()
  .from("oven/bun:1.3.9-slim")
  .withMountedDirectory("/app", source)   // source: @argument defaultPath "/",
  .withWorkdir("/app")                     //   ignore node_modules/baml_client/.git
  .withExec(["bun", "install", "--frozen-lockfile"])
  .withExec(["bun", "run", "baml:gen"])    // PREP: regenerate gitignored baml_client/
  .withExec(["bun", "run", "check:test"])  // THE CHECK — byte-identical to standalone
  .stdout()
```

`ci/src/index.ts` — thin router, one real `@func() test(): Test { return new Test() }`.
Because the router returns a **sub-object**, the run leaf is the **chained**
`dagger call test run`, not bare `dagger call test`. (T-002-01-02 handoff flagged
this; T-003's AC text shorthands "dagger call test".)

## The check itself (the app side — the single definition of "good")

`package.json` scripts (the app, repo root):
- `check:test` → `bun test`
- `baml:gen` → `baml-cli generate --from baml_src`
- `check` → `bun run baml:gen && bun run check:typecheck && bun run check:test`

The suite baseline from T-002-01-02's verification: **229 pass / 0 fail**. The tests
import the generated `baml_client/` (gitignored), so `baml:gen` must run before the
suite — both standalone and in-container. `baml_src/` has `clients.baml`,
`decompose.baml`, `generators.baml`. `bun.lock` (3827 bytes) is tracked → the
in-container `bun install --frozen-lockfile` resolves against it.

## Environment — andon precondition (verified this session)

The spike's hard precondition is the **Docker daemon up** (engine cold-start
~18.4s per `ci-strategy.md`). Checked on the machine right now:

- `docker info` → **UP**.
- `dagger version` → **`dagger v0.21.4`** (`registry.dagger.io/engine:v0.21.4`),
  darwin/arm64 — **matches the pin** in `ci/dagger.json`. No version skew.
- `git log` HEAD = `6a5a16d` (T-002-01-02 RDSPI artifacts); the gate code is on
  `main`. Working tree: only the three ticket `.md` files are modified (Lisa's
  phase bookkeeping) — `ci/` is clean.

So the andon ("if Docker is down, surface it — do not fake the verification") is
**satisfied**; the verification can be run for real, not simulated.

## Boundary facts (the "separate program" claim to confirm, not assume)

- `ci/.gitignore` ignores `/sdk` (generated Dagger client), `node_modules`,
  `.pnpm-store`, `.env`. `ci/sdk/**` is codegen, gitignored.
- `ci/tsconfig.json` maps `@dagger.io/dagger` → `./sdk/index.ts` via `paths` — so
  the SDK resolves locally, **not** as an npm dependency. `@dagger.io/dagger`
  appears in **no** `package.json` deps (T-002-01-02 verified).
- `ci/dagger.json`: `{ name: ci, engineVersion: v0.21.4, sdk.source: typescript }`.
- The "imports nothing from the app" claim is a `grep`-able invariant over
  `ci/src` (no `from "../"`, no `/src/`, no `@boundaryml`). T-002-01-02 ran it
  green; this spike re-confirms as part of AC3.

## Constraints & assumptions this spike inherits (must hold at runtime)

From T-002-01-02's handoff — *unverified there, this spike's job to confirm*:

- **`defaultPath: "/"` resolves to the git repo root** (the app), not `/ci`. If it
  mounts the wrong root, fall back to explicit `--source=.` from the repo root.
- The **linux `baml` native binary** generates `baml_client/` cleanly inside
  `oven/bun:1.3.9-slim`. If it needs extra libs, that is **prep** tuning owned
  here — *never* a change to the `check:test` definition (the Central Rule).
- `bun install --frozen-lockfile` succeeds in-container against the committed
  `bun.lock`.

## Scope fence (explicitly out — do not bundle)

`lint`, `typecheck`, `consistency`, **keep-warm** — each generalizes out of this
one honest gate (`ci-strategy.md` "First slice"; playbook step 6). This spike
proves the *one* gate honest; it does not add gates, tune caching, or build a
second sub-class. No production code changes are expected at all — the only
durable artifact is the recorded evidence (and possibly a tiny scratch test that
is created and reverted within Implement, never committed).
