# T-061-01 — Design

_Phase: Design. Enumerate options, weigh against Research, decide with rationale._

## What must be true at the end (from AC)

In `package.json`: `version` is a non-zero semver, `private` is **absent**,
`bin.vend` resolves to the CLI entrypoint, and `bun run check` still passes.

Three sub-decisions, each with options.

---

## Decision 1 — The version value

**Options**
- (a) `0.1.0` — the AC's own example; conventional first pre-1.0 public release.
- (b) `0.0.1` — non-zero but signals "patch of nothing"; reads as accidental.
- (c) `1.0.0` — overclaims stability for a tool with no install path yet.

**Decision: (a) `0.1.0`.** It is exactly the AC example, matches the "first real
but pre-1.0" reality (lisa, the reference, is at `0.3.0`), and reads as an
intentional minor release. (c) violates the modesty the epic implies ("a real
semver, not 0.0.0" — not "a stable release"). (b) is technically non-zero but
semantically wrong for a first cut. Grounded in Research §"Version value".

---

## Decision 2 — Removing `private`

**Options**
- (a) Delete the `private` key entirely.
- (b) Set `private: false`.

**Decision: (a) delete the key.** AC says the "`private` key is absent." `false`
is the implicit default; carrying an explicit `private: false` is noise and does
not satisfy "absent." Straightforward. (Research §"three fields" confirms `private`
removal is what unblocks the manifest reading as installable.)

No other publish-readiness fields (`files`, `repository`, `license`, `description`)
are added: AC does not require npm-publish completeness, and the chosen
distribution is brew + compiled binary, not `npm publish` (Research §constraint 3).
Adding them would be scope creep beyond the ticket. They can come with the release
CI ticket in E-061 if/when npm publish is ever wanted.

---

## Decision 3 — The `bin.vend` target (the only real design question)

`bin.vend` must "resolve to the CLI entrypoint." Two sub-questions: **what path**,
and **does the entrypoint need a shebang to be genuinely runnable**.

### 3A — Path target

**Options**
- (a) `"./src/cli.ts"` — the actual, existing entrypoint (Research: `src/cli.ts`,
  invoked today as `bun run src/cli.ts`).
- (b) Point at a compiled binary, e.g. `"./dist/vend"` — does **not exist** in the
  tree (the `bun build --compile` artifact is produced by a *later* E-061 ticket).
  A `bin` pointing at a non-existent path does **not** resolve — fails the AC.
- (c) A new tiny `bin/vend.ts` wrapper that re-exports/calls `src/cli.ts`.

**Decision: (a) `"./src/cli.ts"`.** It is the one path that resolves today and is
already the project's declared entrypoint. (b) fails "resolves" — `dist/` is
gitignored and empty; you cannot point a `bin` at a file the repo does not contain.
(c) adds an indirection file for no benefit: `src/cli.ts` already *is* the
entrypoint with its `import.meta.main` shell; a wrapper is surface we'd maintain.
Bun runs a `.ts` `bin` target directly, so a TS path is valid.

### 3B — Shebang on `src/cli.ts`?

A `bin` entry is how a package manager creates an executable shim. For that shim
to actually exec the file, the file conventionally starts with a shebang
(`#!/usr/bin/env bun`). Today `src/cli.ts` has **no shebang** (Research §entrypoint).

**Options**
- (a) Add `#!/usr/bin/env bun` as line 1 of `src/cli.ts`.
- (b) Leave the file shebang-less; rely on the path alone "resolving."

**Decision: (a) add the shebang.** Reasons, each grounded:
- **Correctness of intent.** The point of `bin.vend` (per the epic) is a real,
  installable `vend` command. A `bin` whose target cannot self-exec is a half
  measure that "resolves" on paper but does not run when installed. The shebang is
  what makes `vend` actually executable after `bun link` / a package install,
  mirroring how real CLI packages (and lisa) ship.
- **Zero gate risk.** Research confirmed experimentally that `tsc --noEmit --strict`
  tolerates a leading shebang (exit 0), and `package.json`/`src/cli.ts` typecheck
  is unaffected. A shebang changes no export, so `src/cli.test.ts` (which imports
  `USAGE` and the parse helpers) is unaffected. `bun test` stays green.
- **Bun-native.** `#!/usr/bin/env bun` matches the stack (TypeScript on Bun) and
  the existing `justfile` invocation `bun run src/cli.ts`.

(b) is rejected: it satisfies a literal reading of "resolves" but leaves the
entrypoint non-executable, defeating the epic's purpose for a 1-line, zero-risk
cost. The shebang is the small honest completion of "a `bin` that works."

**Guard:** line 1 of `src/cli.ts` is currently a `//` comment that the rest of the
header continues. Inserting the shebang **above** that comment preserves the entire
existing header verbatim; no comment text is lost or reflowed.

---

## The shape of the change

`package.json` after:

```json
{
  "name": "vend",
  "version": "0.1.0",
  "type": "module",
  "bin": { "vend": "./src/cli.ts" },
  "engines": { "bun": ">=1.3.9" },
  "scripts": { ... unchanged ... },
  "dependencies": { ... unchanged ... },
  "devDependencies": { ... unchanged ... }
}
```

- `version` 0.0.0 → 0.1.0.
- `private: true` line removed.
- `bin` object added. Placement: after `type` / before `engines` is conventional
  and keeps related "what/how this package runs" fields together. (Exact key order
  is cosmetic; JSON is unordered. Chosen for readability.)

`src/cli.ts`: prepend `#!/usr/bin/env bun` as a new line 1; existing line 1
(`// The \`vend\` CLI entry point ...`) becomes line 2, unchanged.

## What is explicitly out of scope (deferred, by design)

- `vend --version` runtime surface + build-time embed → **T-061-02** (depends on
  this). This ticket sets the *value*; that ticket *reads* it.
- npm-publish completeness fields (`files`, `repository`, `license`, `description`).
- The compiled-binary / release-CI / tap formula → later E-061 tickets.

## Verification intent

`bun run check` green after the edits; a focused assertion that the manifest now
reads `version !== "0.0.0"`, has no `private` key, and `bin.vend` points at an
existing file. (Detailed in Plan.)
