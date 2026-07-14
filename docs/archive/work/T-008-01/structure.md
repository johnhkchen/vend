# T-008-01 — Structure: `check:committed`

*The blueprint: which files are created/modified, their public interfaces,
internal organization, and the order changes must land. Not code — the shape of
the code, grounded in `design.md`.*

---

## File inventory

| File | Action | Role |
|---|---|---|
| `src/ci/committed-core.ts` | **create** | Pure classifier — porcelain → offending source paths. The R12 shared contract. |
| `src/ci/committed-core.test.ts` | **create** | `bun:test` unit tests over porcelain fixtures. |
| `src/ci/check-committed.ts` | **create** | Thin impure entry: run git, classify, exit. Smoke-only. |
| `package.json` | **modify** | Add `"check:committed": "bun run src/ci/check-committed.ts"`. |

No deletions. No changes to existing `src/` modules — this is additive. `ci/`
(the Dagger module) is untouched (Central Rule: logic lives app-side).

---

## `src/ci/committed-core.ts` — the pure core (R12 contract)

The single source of "what counts as uncommitted source." Addon-free, no I/O.

**Public exports**

```ts
/** The source prefixes whose uncommitted/untracked presence fails the gate.
 *  The R12 shared contract — every consumer (the entry, the T-008-02 hook,
 *  any future CI sub-class) derives scope from THIS, never re-lists it. */
export const SOURCE_PREFIXES = ["src/", "baml_src/", "ci/"] as const;

/** Extract the path field from ONE `git status --porcelain` v1 line.
 *  Returns the path (rename → destination; surrounding quotes stripped), or
 *  null for a blank/too-short line. PURE/TOTAL. */
export function parsePorcelainLine(line: string): string | null;

/** Classify full `git status --porcelain` text → the SORTED, DEDUPED list of
 *  offending paths under SOURCE_PREFIXES. Empty array ⇔ clean. PURE/TOTAL.
 *  Emptiness is the verdict — no separate boolean. */
export function classifyPorcelain(porcelain: string): string[];
```

**Internal organization**
- `parsePorcelainLine`: guard length (`< 4` → null after trim-of-blank); take
  `line.slice(3)` as the path field; if it contains ` -> `, take the right side
  (rename destination); strip one layer of wrapping `"…"` if present; return.
- `classifyPorcelain`: split on `\n`, map through `parsePorcelainLine`, drop
  nulls, **keep** paths where `SOURCE_PREFIXES.some(p => path.startsWith(p))`,
  collect into a `Set` (dedup), return `[...set].sort()`.
- No exceptions thrown for any string input — a garbled line degrades to "no path
  matched," never a throw (house rule: this is expected data, not programmer
  error). Malformed *input type* (non-string) is the caller's bug; TS prevents it
  at compile time under `strict`, so no runtime assert is added (cf. parsers in
  `cli.ts` that trust their typed input).

**Imports**: none beyond nothing — no node, no bun, no baml. (Keeps the test a
pure-function test, trivially.)

---

## `src/ci/check-committed.ts` — the thin impure entry

The fire-once shell. Mirrors `cli.ts`'s `import.meta.main` block.

**Behavior (top to bottom)**
1. `import { classifyPorcelain } from "./committed-core.ts";`
2. Guard with `if (import.meta.main) { … }` so importing the file (should anything
   ever import it) triggers no side effects — same discipline as `cli.ts:145`.
3. Resolve repo root: `Bun.spawnSync(["git","rev-parse","--show-toplevel"])`;
   trim stdout. On failure → stderr "not a git repository" + `process.exit(2)`.
4. `Bun.spawnSync(["git","status","--porcelain"], { cwd: root })`. On non-zero
   exit / spawn failure → stderr the git error + `process.exit(2)` (environment
   error, distinct from a dirty tree).
5. `const offenders = classifyPorcelain(result.stdout.toString());`
6. If `offenders.length > 0`:
   - write a one-line andon header to stderr
     (`uncommitted source — commit before stopping (D-005):`),
   - write each offender path on its own stderr line,
   - `process.exit(1)`.
7. Else: optional terse `ok` to stdout, `process.exit(0)`.

**Public exports**: none required (it is an entry). It MAY re-export nothing; all
testable logic lives in the core. Not unit-tested (smoke-only, like `press.ts`).

**Imports**: `./committed-core.ts` (value), Bun globals (ambient via
`types:["bun"]`). No `import type` needed; `verbatimModuleSyntax` is satisfied
since the only import is a value import.

---

## `package.json` — wiring

Add ONE script entry; touch nothing else:

```jsonc
"scripts": {
  "check:test": "bun test",
  "check:typecheck": "tsc --noEmit",
  "check:committed": "bun run src/ci/check-committed.ts",   // NEW
  "baml:gen": "baml-cli generate --from baml_src",
  "check": "bun run baml:gen && bun run check:typecheck && bun run check:test",
  "build": "tsc --noEmit"
}
```

**Deliberately NOT** added to the aggregate `check` (design D6): commit-hygiene is
a post-stop gate, not part of the during-work structural pipeline. It stands
alone so `bun run check:committed` is the exact command the T-008-02 lisa hook
invokes.

---

## Module boundaries & contracts

- **Core ⟂ entry**: the core knows porcelain text → paths and *nothing* about
  process/exit/git. The entry knows git + process and delegates all
  classification to the core. The boundary is the `classifyPorcelain(string):
  string[]` signature — the only thing the entry imports.
- **R12 shared contract**: `SOURCE_PREFIXES` is exported so T-008-02 (and any
  future consumer) imports the scope rather than re-declaring it. The contract is
  "uncommitted/untracked path under one of these prefixes ⇒ offender."
- **No coupling to play/BAML/lisa**: the gate is self-contained; the hook wiring
  is T-008-02's job and lives outside this code.

---

## Ordering of changes

1. **`committed-core.ts`** first — the pure contract, the thing everything else
   depends on. Nothing imports it yet, so it lands type-clean on its own.
2. **`committed-core.test.ts`** — pin the three AC fixtures (dirty→list,
   clean→empty, untracked `src/*.ts`→flagged) plus rename/quote/ignored-absent
   edges. Run `bun test` — must pass and not perturb the existing suite.
3. **`check-committed.ts`** — the entry, importing the now-tested core.
4. **`package.json`** — add the script last, then `bun run check:committed`
   against the real tree as the standalone smoke (AC#3): expect non-zero now
   (work tree dirty with these new files until committed), and exit 0 after a
   clean commit. Verifying the verifier.

Each of 1–4 is independently committable; 1+2 form the tested-core commit, 3+4
form the wired-entry commit. (Implementation may combine, but this is the natural
atomic boundary.)

---

## Typecheck / config considerations

- `tsconfig.json` `include: ["src"]` already covers `src/ci/**` — no config edit.
- `noUncheckedIndexedAccess`: when splitting on ` -> `, index access into the
  resulting array must be guarded (the `[1]` may be `undefined` in TS's view) —
  use a destructure-with-fallback or an explicit check, as `cli.ts` does.
- `verbatimModuleSyntax`: value-only imports here, so no `import type` needed; but
  if any type is imported later it must be `import type`.
- `Bun.spawnSync` result: `.stdout` is a `Buffer`/`Uint8Array` → `.toString()`
  before handing to the core. `.exitCode` checked for the git-error path.
