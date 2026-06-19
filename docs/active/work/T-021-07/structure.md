# T-021-07 — Structure: one-way-authority-guarantee

_File-level blueprint. The shape of the code, not the code. Grounded in design.md._

## Files

| File | Change | Purpose |
|---|---|---|
| `src/present/authority-guard.ts` | **new (~90 lines)** | PURE static classifier (G2 core). |
| `src/present/authority-guard.test.ts` | **new (~110 lines)** | classifier unit tests + real-source scan. |
| `src/present/one-way-authority.test.ts` | **new (~90 lines)** | byte-hash E2E (G1). |

No existing source is modified. No package.json change (enforcement rides `check:test`). No new
dependency (`node:crypto`, `node:fs/promises`, `bun:test` are all available).

---

## `src/present/authority-guard.ts` — the pure classifier

Module header (house style): states it is the static half of E-021 one-way authority; PURE
(string-in, data-out, never throws — budget.ts rule); calls out the two false-positive traps it is
built to avoid (presets.ts writes to `.vend`; every module names `docs/active` in comments) and the
E-012 self-exemption trap (detection is import/call-shaped so the guard passes its own scan).

### Exports & internal organization (top → bottom)

1. **`WRITE_PRIMITIVES: readonly string[]`** (exported const, R12 contract). The `node:fs` /
   `node:fs/promises` mutation surface: `writeFile`, `appendFile`, `mkdir`, `rm`, `rmdir`, `unlink`,
   `rename`, `copyFile`, `cp`, `truncate`, and the `*Sync` siblings (`writeFileSync`, `mkdirSync`,
   `rmSync`, `appendFileSync`, `unlinkSync`, `renameSync`). Frozen.
2. **`PROTECTED_PATH = "docs/active"`** (exported const). The canonical-board path no presentation
   module may write to. Single source of the protected token.
3. **`interface Violation { file: string; primitive: string; reason: string }`** — returned data,
   the offender record (mirrors committed-core returning offender strings).
4. **`stripComments(src: string): string`** — remove `// line` and `/* block */` comments so the
   subsequent scans see **code only**. The single defense against the "docs/active in a comment"
   false positive. (Pragmatic regex; not a full tokenizer — adequate for our own first-party source,
   consistent with the house pragmatic-string posture.)
5. **`importedFsNames(code: string): string[]`** — from comment-stripped code, collect the named
   specifiers of every `import { … } from "node:fs"` / `"node:fs/promises"` (and `"fs"`/
   `"fs/promises"`). Returns the imported identifiers.
6. **`importsWriter(code: string): string | null`** — returns the first imported name that is in
   `WRITE_PRIMITIVES`, or detects a `Bun.write(` / `createWriteStream(` **call**; else `null`. This
   is the "writer capability present?" predicate, **import/call-shaped** (so a bare mention as data
   does not match — the guard's own `WRITE_PRIMITIVES` array is data, not an import).
7. **`referencesProtectedPath(code: string): boolean`** — `code.includes(PROTECTED_PATH)` on
   comment-stripped code.
8. **`classifyAuthorityViolations(sources: Iterable<[file, src]>): Violation[]`** — the one public
   entry. For each `[file, src]`: `code = stripComments(src)`; if `importsWriter(code)` **and**
   `referencesProtectedPath(code)` → push a `Violation`. Returns the sorted list (empty = clean, the
   committed-core "empty array is the verdict" idiom — no separate boolean).

All functions pure/total. No fs, no clock, no throw on a finding.

### Why this shape passes its own scan (E-012 lesson, made structural)

`authority-guard.ts` contains the string `"docs/active"` (the `PROTECTED_PATH` const) and the names
`"writeFile"` etc. (the `WRITE_PRIMITIVES` array). But it **imports nothing from `node:fs`** and
calls **no** `Bun.write(`/`createWriteStream(`, so `importsWriter` returns `null` for it → it is
**not** a violation. No self-exclusion needed; a unit test asserts this explicitly.

---

## `src/present/authority-guard.test.ts`

Two `describe` blocks.

### `describe("classifyAuthorityViolations — fabricated sources")`

- **positive:** a fabricated module that `import { writeFile } from "node:fs/promises"` and calls
  `writeFile(join(root, "docs/active/tickets/x.md"), …)` → exactly one violation naming the file and
  `writeFile`.
- **negative — presets-shaped:** imports `writeFile`/`mkdir` but writes to `".vend/presets"` (no
  `docs/active` in code) → **zero** violations. The canonical "legitimate spec-store write" case.
- **negative — pure module w/ docs/active in a comment:** `// grounded in docs/active/pm/…` plus a
  type-only import, no writer → **zero** (proves comment-stripping + the conjunction).
- **negative — Bun.write to .vend:** `Bun.write(".vend/x", …)` → zero; **positive — Bun.write to
  docs/active:** → one (proves the call-shaped Bun.write detection).
- **self-check:** `classifyAuthorityViolations([["authority-guard.ts", <its own source read from
  disk>]])` → **zero** (the E-012 self-exemption guarantee, tested not assumed).

### `describe("real-source scan — src/present/*.ts")`

- Read every non-`*.test.ts` file under `src/present/` from disk (`readdir` + `readFile`).
- `classifyAuthorityViolations(entries)` → assert `[]`. A clear failure message lists offenders.
- Assert the scan actually covered the known modules (`project.ts`, `translate.ts`, `spec.ts`,
  `presets.ts`, `presets`-adjacent) — so an empty/mis-globbed read can't pass vacuously (guards
  against the "scanned nothing, therefore clean" failure).

---

## `src/present/one-way-authority.test.ts` — the byte-hash E2E (G1)

Imports: `loadWorkGraph` (`../graph/load.ts`), `projectGraph` (`./project.ts`),
`DESIGNER_PRESET`/`DEV_PRESET` (`./spec.ts`), `loadSeatSpec` (`./presets.ts`), `node:crypto`,
`node:fs/promises`, `node:path`.

### Helpers

- **`hashTree(root): Promise<Map<string,string>>`** — recursively walk `root` (`readdir
  withFileTypes`, recurse dirs), for each file compute `createHash("sha256").update(bytes)` → map
  `relpath → hex`. Sorted/total over the subtree.

### `describe("one-way authority — docs/active is byte-unchanged by the read path")`

- **`test("load → project → render leaves every source file byte-identical")`:**
  1. `before = await hashTree("docs/active")`.
  2. `graph = await loadWorkGraph()` (live board, `process.cwd()` — the load.test.ts precedent).
  3. Project under several specs to exercise breadth: `projectGraph(graph, DESIGNER_PRESET)`,
     `projectGraph(graph, DEV_PRESET)`, and a `groupBy`-varied spec — then "render" each via
     `JSON.stringify(projection)` (the deferred-renderer stand-in, design D3). Assert each render is
     a non-empty string (the pipeline produced output).
  4. Also drive the calibration read path: `await loadSeatSpec("designer")` (reads `.vend`, never
     docs/active) and project under it.
  5. `after = await hashTree("docs/active")`.
  6. Assert `after` deep-equals `before`: same key set **and** identical hashes. On mismatch, report
     added/removed/changed paths by name.
- **`test("the graph object is reference-unchanged after projection")`** — a thin in-memory
  companion: capture `graph.tickets` by reference, project, assert `graph.tickets === ref` and
  `Object.isFrozen(graph)`. (Complements project.test.ts's existing purity assertion at the
  pipeline level.)
- **`test("the loader imports no fs writer")`** — read `src/graph/load.ts`, run
  `classifyAuthorityViolations` over it (it references `docs/active` in code via the default dirs) →
  assert zero (proves the one module that *does* name docs/active in code imports only readers). This
  ties the static guard to the loader too, closing the "what about the file that actually touches the
  board?" question.

---

## Ordering of changes

1. `authority-guard.ts` (pure core — nothing depends on it yet).
2. `authority-guard.test.ts` (unit + real scan — must be green against existing source as-is).
3. `one-way-authority.test.ts` (E2E — independent of 1–2; needs the live board to load clean).

Each step is independently committable and verifiable. Steps 2 and 3 are the AC's two teeth.

## Risk register

- **Comment-stripper over/under-reach.** A regex stripper can mishandle `//` inside a string literal.
  Mitigation: our first-party present sources don't embed `docs/active` inside a string-with-`//`;
  the unit tests pin the exact behavior; over-stripping only risks a *false negative on docs/active*
  which the real-source scan + the runtime G1 would still catch. Documented as accepted.
- **Vacuous real-source scan.** Mitigated by asserting the known module set was covered.
- **Future renderer changes "render."** The byte-hash brackets the whole pipeline; swapping the
  render leg is one line and the invariant is unaffected.
