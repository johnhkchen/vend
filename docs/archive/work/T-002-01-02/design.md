# T-002-01-02 — Design: test-gate-subclass-and-router

*Options, tradeoffs, decisions — each grounded in Research, not assumption. Four
real forks hide in a "small" two-file ticket; each is a place the wrong turn
calcifies.*

---

## Decision 1 — Router shape: sub-object vs. flat delegation

**Options:**

- **(A) Sub-object.** `Ci.test(): Test` returns the `Test` sub-object; the work
  lives in `Test.run(source): string`. CLI: `dagger call test run --source=.`.
- **(B) Flat delegation.** `Ci.test(source): string` constructs `Test` and calls
  it, returning stdout directly. CLI: `dagger call test --source=.`.

**Tradeoff.** `ci-strategy.md` is explicit: *"create sub-classes in their own
files and **return them from the main object**,"* and the router is described as
listing `test(), lint(), typecheck(), consistency()`. That is option (A) almost
verbatim — the canonical Dagger composition pattern, and the thinnest possible
`index.ts` (a one-line `return new Test()`, with **zero** container logic and not
even a `Directory` import leaking in). Option (B) reads marginally closer to
T-003's *shorthand* AC (`dagger call test`), but pulls the source-binding
`@argument` and the `Directory` type into `index.ts`, thickening the router for a
cosmetic CLI difference.

**Decision: (A) sub-object.** It is the literal reading of the steering doc, keeps
`index.ts` maximally thin, and makes `Test` a first-class sub-object (clean ground
for `lint`/`typecheck`/`consistency` to follow the identical shape). The cost is
that T-003 invokes `dagger call test run` (a chained leaf) rather than bare
`dagger call test`; T-003 is a spike and will adapt — recorded in Review so its
author isn't surprised.

*Rejected (B)* because it thickens the router (the god-object's first inch) to
match a shorthand command, trading the documented architecture for a flag.

---

## Decision 2 — How to satisfy AC4 ("compiles within the `/ci` toolchain")

**The tension.** AC4 requires the module to compile in its own toolchain. That
needs `@dagger.io/dagger` to resolve, which needs `ci/sdk/` (path-mapped target),
which does not exist and is generated only by **codegen** (`dagger develop`). But
AC3 says *"`dagger develop` not run casually,"* `ci-strategy.md` rule 1 says
*stop and ask*, and the ticket context says *"no Docker needed to build it."*

**Options:**

- **(A) Generate `sdk/` via one deliberate `dagger develop` at the pin** (Docker
  is up), verify the engine stays `v0.21.4` and no tracked file is mutated, then
  prove `tsc` green. `sdk/` is gitignored → never committed.
- **(B) Don't generate `sdk/`.** Write correct TS and verify it only
  *structurally* (imports/decorators/shape), deferring real `tsc`-green to T-003
  (whose `dagger call` provisions `sdk/` via the engine anyway).

**Tradeoff.** The conflicting signals resolve by weight and specificity:

- The **predecessor's handoff** (T-002-01-01 `progress.md`, authoritative, names
  *this* ticket): *"First populate `sdk/` via codegen at the pinned `v0.21.4` … so
  the module compiles in its own toolchain."* This is a direct instruction.
- **AC4 is literal** and only (A) satisfies it; under (B) `tsc` cannot be green.
- **AC3 forbids *casual*** runs — not deliberate ones. A single, scoped,
  pinned-and-reviewed `dagger develop` to populate the gitignored `sdk/` is the
  opposite of casual.
- *"No Docker needed to build it"* is the weakest signal — a parenthetical
  contrasting with T-003's *run* requirement, not a hard constraint; it is
  overridden by the explicit AC4 + handoff.

**Decision: (A), with an andon guard.** Run `dagger develop` once, deliberately,
at the pin. **Before/after, snapshot `git`**: if it (i) bumps `engineVersion` off
`v0.21.4`, or (ii) mutates any *tracked* `/ci` file beyond creating gitignored
`sdk/`, **stop, revert, and surface** rather than accept the change — exactly the
"reviewed step, not casual" contract. Expected result: CLI `v0.21.4` == pin →
no bump; only `sdk/` (gitignored) appears.

*Rejected (B)* because it leaves AC4 unverifiable here and silently shifts a
named deliverable onto T-003. We can satisfy AC4 honestly; we should.

---

## Decision 3 — Container image and the prep steps

**Options for the runtime base:** pinned `oven/bun:1.3.9-slim` vs. floating
`oven/bun:latest`/`:1`. **Decision: pinned `oven/bun:1.3.9-slim`** — matches the
app's `engines.bun >= 1.3.9` and local `1.3.9`, reproducible, and `-slim`
(debian-slim) is small while still glibc-based (the `baml` native binary needs a
normal libc; `alpine`/musl would risk it).

**The prep steps — and why they are *not* a Central-Rule violation.** Research
established that `bun test` cannot pass in a fresh tree: tests import the
**gitignored, generated `baml_client/`**. So the container must, in order:

1. `bun install --frozen-lockfile` — restore deps from the committed `bun.lock`
   (host `node_modules` is darwin-built and must not cross into linux).
2. `bun run baml:gen` — regenerate `baml_client/` (tests import it).
3. `bun run check:test` — **the gate.**

Steps 1–2 are **environment prep / codegen the app itself defines** (the app's own
`check` script runs `baml:gen` first). They restore the state in which
`check:test` is *meant* to run. The *check* remains exactly `bun run check:test`,
byte-identical to standalone and to the play's future andon invocation — which is
precisely what keeps the gate **drift-free**. Inlining would be *reimplementing*
the assertions; we do not. This is documented in the file header so a reviewer
can't mistake prep for logic.

*Rejected:* mounting host `node_modules`/`baml_client` to skip prep — breaks
cross-platform (darwin binaries in a linux container) and makes the gate
non-hermetic (it would pass/fail based on the caller's untracked local state).

---

## Decision 4 — Source binding (`@argument`)

**Options:** required `source: Directory` (caller must pass `--source=.`) vs.
`@argument({ defaultPath: "/", ignore: [...] })` (ergonomic default + excludes).

**Decision: `@argument({ defaultPath: "/", ignore: [...] })` on `Test.run`.**
`defaultPath: "/"` binds the module's context-root directory by default (for a
module in a git repo, the context root is the **repo root** = the app), so
`dagger call test run` works with no flag and stays overridable by `--source`.
`ignore: ["**/node_modules", "baml_client", ".git"]` keeps the mount hermetic and
cache-friendly (no darwin `node_modules`, no stale generated client, no `.git`).

**Surfaced assumption (for T-003 to verify at runtime):** that the context root
resolves to the **git repo root**, not `/ci`. This ticket cannot exercise it
(no run), so it is flagged, not assumed-correct. Fallback is trivial and
documented: if the default mounts the wrong root, pass `--source=.` explicitly.

*Rejected:* a bare required arg — marginally safer but loses the documented
idiom and the ergonomic default that serves T-003's literal command.

---

## Cross-cutting: protect the app build (AC: "the app build is untouched")

- App `tsconfig.json` is `include: ["src"]` → never reaches `/ci`. **Do not widen
  it.** App `bun test` discovers `src/**/*.test.ts`; we add **no** `*.test.ts`
  under `/ci`, so nothing new is collected.
- No root `workspaces`; `/ci/package.json` stays an independent program.
- `@dagger.io/dagger` is **not** added to any `package.json` deps — it resolves
  via the generated `ci/sdk/` path-mapping only (predecessor handoff).

## Anti-over-build (explicitly NOT in this slice)

`lint`/`typecheck`/`consistency` sub-classes; parallel DAG composition; keep-warm
tuning; **running** `dagger call` / proving no-drift / can-fail (all T-003);
any second gate. The `test` gate's code, compiled. Nothing past it.

## Decision summary

| # | Decision | Why |
|---|----------|-----|
| 1 | Sub-object router: `Ci.test(): Test` → `Test.run(source)` | ci-strategy "return sub-classes from the main object"; thinnest `index.ts` |
| 2 | One deliberate `dagger develop` at pin to make `sdk/`, with revert-and-surface andon | AC4 + handoff require toolchain compile; AC3 forbids only *casual* runs |
| 3 | `oven/bun:1.3.9-slim`; prep = `install --frozen-lockfile` → `baml:gen` → `check:test` | tests import gitignored generated `baml_client/`; prep ≠ check logic |
| 4 | `@argument({ defaultPath: "/", ignore: [...] })`, override via `--source` | ergonomic + hermetic; context-root assumption surfaced for T-003 |
