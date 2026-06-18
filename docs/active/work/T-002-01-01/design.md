# T-002-01-01 — Design: ci-module-bootstrap

*Options, tradeoffs, and the decision — each grounded in Research, not assumption.*

The shell is small, but three real decisions hide in it. Each is a fork where the wrong
turn calcifies (the "mess that can't be cleaned later" `ci-strategy.md` warns about).

---

## Decision 1 — How to create the module files

**Options:**

- **(A) Run `dagger init --sdk=typescript` in `/ci`.** Authoritative; produces the exact
  files the tool expects, including `sdk/` codegen.
- **(B) Hand-author the files** (dagger.json, package.json, tsconfig.json, src/index.ts,
  .gitignore, .gitattributes), modelled on the captured ground-truth shapes; do **not**
  run any codegen.

**Tradeoff.** (A) is "correct by tool", but `dagger init --sdk` *runs codegen* — it
provisions the engine and writes `sdk/`. That is the `dagger develop`-equivalent step the
ticket andon explicitly fences off ("`dagger develop` was **not** run as a casual step";
"if a regen blocker is hit, it is surfaced, not bumped"). The Research probe also showed
`init` happily prints "a new release is available" and is one flag away from a bump. (B)
keeps the version-defining step in human hands and is sufficient because **this ticket's
acceptance is structural** — file existence, boundaries, pinned version — none of which
require `sdk/` to exist or `dagger call` to run (that's T-002-01-03).

**Decision: (B) hand-author.** The files are modelled byte-for-shape on the captured
v0.21.4 output, so they are exactly what the tool would emit — minus the codegen the andon
reserves. `sdk/` is deliberately absent and **surfaced** (see Decision 3). This is the
faithful reading of "Dagger invokes; it never defines… this is only the shell."

*Rejected (A)* because it couples bootstrap to a guarded codegen step for zero benefit to
this ticket's criteria, and risks a silent engine touch.

---

## Decision 2 — Source layout: root-source vs. `src`-source

**Options:**

- **(A) Root source (`source` omitted).** `package.json`/`tsconfig.json`/`sdk/` at `/ci`
  root; entrypoint at `/ci/src/index.ts`.
- **(B) `source: "src"`.** SDK config nests under `src/`, entrypoint lands at
  `/ci/src/src/index.ts`.

**Tradeoff.** `ci-strategy.md`'s structure diagram is unambiguous: `package.json` at the
`/ci` root, code in `/ci/src/`. Research confirmed that is precisely the **default**
(root-source) layout — `dagger init` omits `source` and puts `index.ts` in `src/`. Option
(B), which an earlier probe produced via `--source=src`, double-nests to `src/src/` and
contradicts the doc.

**Decision: (A) root source.** Matches the canonical doc layout and the tool default;
keeps `/ci/src/test.ts`, `/ci/src/index.ts` etc. exactly where T-002-01-02 and the
playbook expect them. `dagger.json` therefore omits the `source` key.

---

## Decision 3 — What `index.ts` contains with zero gates

**Options:**

- **(A) Keep the generated demo functions** (`containerEcho`, `grepDir`).
- **(B) Empty `@object() class Ci {}`** — no `@func()` methods, a comment documenting the
  one-gate-one-sub-class-one-file router contract.
- **(C) A placeholder `test()` that returns a stub.**

**Tradeoff.** (A) violates "no gate logic yet" and ships throwaway container code. (C)
pre-empts T-002-01-02, which explicitly owns adding `test()` ("routes `test()` and nothing
else yet"); a stub here would collide with that ticket's file ownership (the two tickets
*share* `index.ts`, hence the dependency edge). (B) is the honest thinnest shell: a valid
Dagger module object with no functions, ready to receive exactly one `@func()` next ticket.

**Decision: (B) empty router.** Import only `object` from `@dagger.io/dagger`; define
`@object() export class Ci {}`; a header comment states the router rule so the next agent
adds `test()` as a one-line delegation to `src/test.ts`. A module with zero functions is
structurally valid TS; we are not invoking `dagger call` in this ticket, so the "no
functions yet" warning is irrelevant here and resolves the moment T-002-01-02 lands.

*Rejected (C)* specifically to respect file-ownership/DAG modelling: `test()` is the next
ticket's deliverable, not this one's.

---

## Cross-cutting: protect the app's build (AC4)

The shell must leave `bun run check:test` / `check:typecheck` **unaffected**. Grounded in
Research:

- App `tsconfig.json` is `"include": ["src"]` → it never reaches `/ci`. No change needed,
  and I must **not** widen it.
- `bun test` discovers `*.test.ts`. The shell ships **no** test files, so nothing new is
  collected. `/ci/src/index.ts` is not a test and is imported by nothing in the app.
- No root `workspaces` field → `/ci/package.json` stays an independent program; root
  `bun install` won't adopt it.
- The broken-looking `@dagger.io/dagger` import in `/ci/src/index.ts` resolves only inside
  the `/ci` toolchain (via `sdk/`, generated later). It is invisible to the app because
  **nothing in the app imports `/ci`** — the boundary is the safeguard.

## What this design explicitly does NOT do (anti-over-build)

`ci-strategy.md` rule 6 calls out the over-building reflex. So, out of scope by decision:
the `test()`/`lint()`/`typecheck()`/`consistency()` sub-classes, any container code,
running `dagger develop`/`call`, generating `sdk/`, keep-warm tuning, and a root
`check:lint` script. The shell, and only the shell.

## Decision summary

| # | Decision | Why |
|---|----------|-----|
| 1 | Hand-author; no codegen | Andon fences `dagger develop`; structural AC needs no `sdk/` |
| 2 | Root-source layout (`source` omitted) | Matches `ci-strategy.md` diagram + tool default |
| 3 | Empty `@object() class Ci {}` router | "No gate logic yet"; `test()` is T-002-01-02's |
