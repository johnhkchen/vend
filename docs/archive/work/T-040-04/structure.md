# T-040-04 — Structure: init-idempotency-and-validate

The file-level blueprint. One file created, zero modified, zero deleted. This is the shape
of the proof, not its code.

## Files

### CREATED — `src/init/init-idempotency.test.ts`

The guarded-live end-to-end proof. ~120 lines. Depends on `lisa` on PATH (guarded). Imports:

```ts
import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { countDemandRows, SCAFFOLD_MANIFEST } from "./init-core.ts";
import { runInit } from "./init-effect.ts";
```

No value import of any BAML/engine module — `runInit` and `init-core` are addon-free, so this
stays an ordinary `bun test` (the propose-effect / init-effect discipline). The ONLY external
coupling is the `lisa` binary, reached through `Bun.spawnSync`, gated by `Bun.which`.

### MODIFIED — none

`init-core.ts`, `init-effect.ts`, `cli.ts` are untouched. The verbs under proof already exist
and behave correctly (go-and-see confirmed). Re-opening reviewed source for a proof would violate
the pure/impure split this epic was built on.

### DELETED — none

## Module-internal organization of the test file

A short header block (the house convention: ticket id, what the proof is, why guarded), then:

1. **Module-level guard constant**
   - `const LISA = Bun.which("lisa");` — `string | null`. Drives `describe.skipIf(!LISA)`.

2. **Spawn helpers (terse, throw-on-misuse — the `head-build-core.test.ts` `git()` idiom)**
   - `lisaInit(root: string): void` — `Bun.spawnSync(["lisa", "init"], { cwd: root })`; throw if
     `exitCode !== 0` (a broken fixture must fail loudly, not silently produce a bad tree).
   - `lisaValidate(root: string): number` — `Bun.spawnSync(["lisa", "validate", "--path", root])`;
     **return** `exitCode` (the assertion target — 0 = valid). NOT thrown: validate's exit code IS
     the thing under test, so it is returned as data and asserted with `expect(...).toBe(0)`.
   - `exists(abs: string): Promise<boolean>` — `stat`→true / catch→false (copied from
     init-effect.test.ts; the no-shared-util idiom — five lines, copied not coupled).

3. **Fixture constant**
   - `SEED_TICKET: string` — a minimal VALID lisa ticket (frontmatter: `id` T-001-01, `story`,
     `title`, `type: task`, `status: open`, `priority: high`, `phase: ready`, `depends_on: []`,
     plus a Context + Acceptance Criteria body). This is the one ticket that makes the bare lisa
     project valid to begin with. Written to `docs/active/tickets/T-001-01.md`.
   - `TICKET_REL = "docs/active/tickets/T-001-01.md"` — the relative path, reused by Test B's
     byte-identity snapshot.

4. **`describe.skipIf(!LISA)("vend init → lisa-valid + idempotent (E-040 done-looks-like)", …)`**
   containing two tests:

   - **Test A — `"first run scaffolds & validates; second run writes nothing & still validates"`**
     The AC's twice-run scenario, end to end. Body shape:
     ```
     root = mkdtemp("vend-init-e2e-")
     try {
       lisaInit(root)
       writeFile(join(root, TICKET_REL), SEED_TICKET)
       expect(lisaValidate(root)).toBe(0)            // valid input (the bare lisa project)

       first = await runInit(root)
       expect(first.kind).toBe("scaffolded")
       for (e of SCAFFOLD_MANIFEST) expect(await exists(join(root, e.path))).toBe(true)
       expect(lisaValidate(root)).toBe(0)            // still valid after layering vend
       expect(countDemandRows(read demand.md)).toBe(0)
       expect(countDemandRows(read demand-cleared.md)).toBe(0)   // honestly-empty board + archive

       second = await runInit(root)
       expect(second.kind).toBe("scaffolded")
       narrow; expect(second.result.created).toEqual([])
       expect(second.result.skipped.length).toBe(SCAFFOLD_MANIFEST.length)  // zero new writes
       expect(lisaValidate(root)).toBe(0)            // still valid after the no-op re-run
     } finally { rm(root, {recursive,force}) }
     ```

   - **Test B — `"one-way to lisa: a pre-existing lisa ticket is left byte-identical"`**
     ```
     root = mkdtemp(...)
     try {
       lisaInit(root); writeFile(TICKET_REL, SEED_TICKET)
       await runInit(root)
       expect(await readFile(join(root, TICKET_REL), "utf8")).toBe(SEED_TICKET)  // untouched
     } finally { rm(...) }
     ```

## Teardown discipline

Each test owns its temp dir and removes it in a `finally` (the `init-effect.test.ts` pattern, the
sibling file family). No shared module-level array; each `mkdtemp` is paired with one `rm`. A failed
assertion still tears down because the `rm` is in `finally`.

## Public-interface impact

None. No export added, changed, or removed anywhere. The test consumes the existing public surface
(`runInit`, `SCAFFOLD_MANIFEST`, `countDemandRows`) and the external `lisa` CLI only.

## Ordering of changes

Single atomic unit — write the one test file, run the gate, commit. There is no internal step
ordering that matters (no source dependency chain), so Plan's steps are about *authoring + verifying*
the one file, not sequencing edits across files.

## Risk surface

- **`lisa` contract drift** — the test pins lisa's exit-code semantics. Mitigated by the guard
  (absent ⇒ skip) and accepted by design (a real contract change SHOULD surface here).
- **Temp-dir leak** — mitigated by `finally` rm in both tests.
- **Spawn flakiness** — `lisa init`/`validate` are offline, headless, sub-second; no network, no
  interactive prompt (go-and-see confirmed). Spawn is synchronous (`spawnSync`) so no async race.
