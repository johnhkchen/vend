# T-008-01 — Research: `check:committed`

*Descriptive map of the codebase as it bears on a `bun run check:committed` gate.
What exists, where, how it connects. No solutions proposed here.*

---

## 1. What the ticket asks for

A `bun run check:committed` that **fails (exits non-zero) when there is
uncommitted or untracked *source* in the working tree** — scoped to `src/`,
`baml_src/`, and `ci/`. It is the structural detector that would have caught the
E-001 / E-006 / E-007 residuals (`D-005` / `D-010`): a loop ending with a dirty
HEAD, source written but never committed.

Shape called for by the ACs:
- A **pure classifier**: `git status --porcelain` text → the offending source
  paths. No fs/clock/process/network. Unit-tested with porcelain fixtures.
- A **thin impure verb**: actually invoke `git status --porcelain`, hand the text
  to the classifier, exit 0/non-zero.
- A `package.json` `check:committed` script wiring the two so `bun run` reaches it.

T-008-01 owns the **script + R12 shared contract**; T-008-02 (separate ticket,
depends on this) wires it into a **lisa on-stop hook**. The hook is out of scope
here — this ticket builds the standalone, hook-agnostic gate.

---

## 2. The Central Rule this gate must obey (`ci-strategy.md`)

> **Dagger invokes, it never defines.** Check *logic* lives in the app repo as
> `bun run check:*` scripts. Dagger / lisa / the play are thin triggers that call
> those scripts. Neither owns the definition of "good" — the shared script does.

`check:committed` is exactly such a `check:*` script. Two consequences fixed by
the strategy doc:

1. **Logic lives in the script, not the trigger.** The lisa hook (T-008-02) must
   be a thin shell calling `bun run check:committed`; the classification of
   "what counts as uncommitted source" lives here.
2. **Dagger cannot host this check.** Memory S3077 records the key architectural
   constraint: *Dagger containers cannot read the host git working tree.* A
   container sees only the committed snapshot it was handed, never the dirty host
   tree. So `check:committed` is the one `check:*` that a Dagger sub-class can
   never meaningfully invoke — its enforcement point is a **lisa hook** (the play
   side), not `/ci`. This is *why* E-008 exists as a lisa-hook epic, not a `/ci`
   sub-class.

The other `check:*` (`check:test`, `check:typecheck`) are pure inline commands in
the app `package.json` (§4). `check:committed` differs: it needs real logic, so
it follows the **pure-core + thin-impure** house pattern rather than staying a
one-liner.

---

## 3. The house pattern this gate will mirror: pure core + thin impure verb

The codebase has a strong, repeated idiom (memory 20402, 20477): **every module
splits a PURE decision core from a thin IMPURE verb.** Confirmed instances:

| Pure core (tested) | Impure verb (untested, smoke-only) | What's impure |
|---|---|---|
| `src/shelf/press-core.ts` | `src/shelf/press.ts` | reads `.vend/menu.json`, dispatches |
| `src/play/decompose-epic-core.ts` | `src/play/decompose-epic.ts` | BAML addon, fs |
| `src/play/note-core.ts` | `src/play/note.ts` | BAML addon |
| `src/gate/gates.ts` (`clear`) | the runner that calls it | (gates are already pure) |
| `src/cli.ts` parsers | the `import.meta.main` block | `process.exit`, lazy imports |

Pattern specifics this gate should copy:
- **Pure functions take plain values, return fresh ones.** `gates.ts#clear` takes
  an already-parsed `WorkPlan` and returns a discriminated result; it never does
  I/O. The classifier here should take the porcelain **string** and return the
  offending paths.
- **The impure shell is the `import.meta.main` block** (`cli.ts:145`). It does the
  side effects (run git, `process.exit`) and is *not* unit-tested — it is proven
  by smoke. Tests import only the pure core, so they never trigger side effects.
- **House rule on errors** (`gates.ts:16`, `budget.ts`): a *programmer* error (a
  malformed call) THROWS; an expected terminal state is a RETURNED VALUE. For this
  gate, "source is dirty" is an expected outcome (a returned list / exit code),
  not a thrown exception. A git binary that isn't present is closer to a
  programmer/environment error.

---

## 4. `package.json` as it stands (the wiring point)

```jsonc
"scripts": {
  "check:test": "bun test",
  "check:typecheck": "tsc --noEmit",
  "baml:gen": "baml-cli generate --from baml_src",
  "check": "bun run baml:gen && bun run check:typecheck && bun run check:test",
  "build": "tsc --noEmit"
}
```

Observations:
- `check:*` names are the contract surface CI/play/lisa invoke. Adding
  `check:committed` extends that surface; it is **not** added to the aggregate
  `check` script (that one is the structural pipeline gen→typecheck→test;
  commit-hygiene is a *post-stop* concern, a different trigger — see §2).
- The existing `check:*` are inline shell. `check:committed` needs logic, so it
  will run a TS entry file: the established way is `bun run <path>.ts` (the CLI is
  run the same way via `import.meta.main`). No bin wiring exists; scripts invoke
  files directly.

---

## 5. What counts as "source", and what is gitignored runtime

From the ticket + `.gitignore` (repo root):

```gitignore
node_modules/
baml_client/        # generated from baml_src — NOT source
*.tsbuildinfo
dist/
.lisa-layout.kdl
.vend/*             # runtime telemetry
!.vend/decisions.jsonl   # the ONE durable exception (steering data)
```

So the **source prefixes that must trigger a failure** are `src/`, `baml_src/`,
`ci/`. The **runtime that must never trigger** is everything gitignored:
`baml_client/`, `node_modules/`, `dist/`, `*.tsbuildinfo`, `.lisa-layout.kdl`,
and `.vend/*` (except the tracked `.vend/decisions.jsonl`).

Key fact to verify-and-rely-on (AC#1 parenthetical): **gitignored paths do not
appear in `git status --porcelain` at all** (unless `--ignored` is passed, which
this gate will not pass). So `baml_client/`, `node_modules/`, etc. are excluded
*by git itself* — the classifier does not need an ignore-list; it only needs to
**keep** lines under the three source prefixes. The ignore exclusions are
belt-and-suspenders, not the primary mechanism. This was directly verified:
`git status --porcelain` on the current tree shows only
` M docs/active/tickets/T-008-01.md` — no `baml_client/` despite it existing on
disk and being regenerated this session.

There is a nested `ci/.gitignore` and `ci/package.json` — `ci/` is a separate
Dagger program with its own deps. `ci/` source (`ci/src/*.ts`, `dagger.json`,
etc.) IS in scope as source; `ci/`'s own gitignored runtime (`ci/sdk/`,
`node_modules`) is excluded by git the same way.

---

## 6. `git status --porcelain` format (the input to classify)

Porcelain v1 (default) line shape: `XY<space>PATH`, where:
- `XY` = two status columns (index, worktree). E.g. ` M` modified-unstaged,
  `M ` staged, `MM` both, `A ` added, `??` untracked, `!!` ignored (only with
  `--ignored`), `R ` rename, `D ` delete, `UU` unmerged.
- Then exactly one space, then the path. So `line.slice(3)` is the path field.
- **Renames/copies**: the path field is `OLD -> NEW` (e.g. `R  a.ts -> b.ts`).
  The interesting "uncommitted source" is the destination `NEW`.
- **Quoting**: paths with unusual bytes are C-quoted in double-quotes
  (`core.quotePath`), e.g. `"src/\303\251.ts"`. The default tree here has no such
  paths; this is an edge case to note, not a present hazard.
- **`-z` mode** exists (NUL-terminated, no quoting, rename emits two records) but
  is more complex to parse; the plain mode is sufficient for fixtures.

Untracked whole directories appear once with a trailing slash: `?? src/new/`.
`startsWith("src/")` still catches it. Untracked individual files appear per file.

---

## 7. Where the new code lands (no `src/ci/` yet)

`src/` is organized by domain folder, each with `*.ts` + `*.test.ts` (and a
`.gitkeep` in some). Existing folders: `baml/`, `budget/`, `engine/`, `executor/`,
`gate/`, `log/`, `play/`, `shelf/`. There is **no `src/ci/` folder yet** — the
Dagger module lives at repo-root `/ci`, separate from app `src/`. A new
app-side home for this gate's logic is needed. Candidate domains by precedent:
`src/gate/` already exists (clearing gates) but is play-semantic; a `committed`
classifier is a CI/structural concern. This is a Design decision (§ design.md),
not settled here.

Test convention (`gates.test.ts`, `press-core.test.ts`): `import { describe,
expect, test } from "bun:test"`, fixtures inline, assert on pure return values.
`tsconfig.json` uses `verbatimModuleSyntax` (type-only imports must say `import
type`), `noUncheckedIndexedAccess`, `strict`, `.ts` extensions allowed in imports.

---

## 8. Constraints & assumptions surfaced

- **A1.** The gate runs on the host (where the working tree is), invoked by `bun
  run` — never inside a Dagger container. (S3077 constraint.)
- **A2.** `git` is on PATH wherever the gate runs; it runs at the repo root (or
  git resolves the root itself). Absence of `git` is an environment error.
- **A3.** Scope is exactly `src/`, `baml_src/`, `ci/`. Root-level files
  (`package.json`, `tsconfig.json`, docs) are deliberately **out of scope** — a
  modified `package.json` does not fail this gate. (Possible gap; note for review.)
- **A4.** Gitignored runtime never surfaces in porcelain (verified §5), so the
  classifier keys on the source prefixes, not an ignore denylist.
- **A5.** Staged-but-uncommitted source (`M `/`A ` in the index) is still
  *uncommitted* — it must fail. "Committed" means in HEAD, not in the index.
- **A6.** The classifier must be addon-free (no BAML import) so its test runs as
  an ordinary pure-function test — trivially satisfied (git, not BAML).
- **A7.** `check:test` / `check:typecheck` must stay green and the script must run
  standalone (AC#3) — so the new files must typecheck under the strict config and
  not break the existing suite.
