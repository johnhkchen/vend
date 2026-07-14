# T-010-01 — Structure: file-level blueprint

*The shape of the code — files, interfaces, boundaries, ordering. Not the code.*

## Files

| action | path | role |
|--------|------|------|
| **create** | `src/ci/head-build-core.ts` | PURE classifier: `BuildOutcome → HeadVerdict` |
| **create** | `src/ci/check-head.ts` | IMPURE: `buildCommittedHead` verb + `import.meta.main` entry |
| **create** | `src/ci/head-build-core.test.ts` | pure-mapping unit tests + synthetic-HEAD integration test |
| **modify** | `package.json` | add `"check:head"` script |

No deletions. `check-committed.ts` / `committed-core.ts` untouched.

---

## `src/ci/head-build-core.ts` — PURE

Header comment: same doctrine note as `committed-core.ts` — the single source of
"did the committed HEAD build, and what does that mean for the exit." No fs /
git / process. Mirrors the E-008 0/1/2 exit vocabulary.

```ts
/** Which pipeline step failed, or null if every step passed. */
export type BuildStep = "preflight" | "worktree" | "build";

/** Raw result the impure verb reports — data, not a decision. */
export interface BuildOutcome {
  /** null = all steps passed; otherwise the first step that failed. */
  failedStep: BuildStep | null;
  /** human context (e.g. captured stderr tail, git message). */
  detail: string;
}

/** The classified verdict: process exit code + message. */
export interface HeadVerdict {
  exitCode: 0 | 1 | 2;
  ok: boolean;        // true iff exitCode === 0
  message: string;    // what the entry writes to stdout/stderr
}

/** The R12-style shared mapping. PURE/TOTAL. */
export function classifyBuildOutcome(outcome: BuildOutcome): HeadVerdict;
```

Mapping rules (the whole logic):

- `failedStep === null` → `{ 0, ok:true,  "check:head: ok — committed HEAD builds" }`
- `failedStep === "build"` → `{ 1, ok:false, "check:head: HEAD does not build from a clean checkout (E-007 class): <detail>" }`
- `failedStep === "preflight" | "worktree"` → `{ 2, ok:false, "check:head: could not check HEAD (<step>): <detail>" }`

`build` is the ANDON (exit 1, found a real problem); `preflight`/`worktree` are
environment errors (exit 2, couldn't check) — preserving E-008's distinction so
the future hook can fail-open on 2.

A second tiny pure helper, exported for the verb's convenience and testing:

```ts
/** Map a child-process exit code to pass/fail for the build step. PURE. */
export function buildStepFailed(exitCode: number): boolean;  // exitCode !== 0
```

---

## `src/ci/check-head.ts` — IMPURE verb + entry

Header comment: same as `check-committed.ts` — the thin impure verb; side
effects only; all judgment delegated to `head-build-core.ts`. Smoke-only entry;
`buildCommittedHead` is the integration-test seam.

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyBuildOutcome, buildStepFailed, type BuildOutcome } from "./head-build-core.ts";

export interface HeadBuildOptions {
  /** repo whose committed HEAD to build (default: git toplevel of cwd). */
  root: string;
  /** install command run in the worktree; null skips it. default ["bun","install"]. */
  install?: readonly string[] | null;
  /** the build/check command run in the worktree. default ["bun","run","check"]. */
  check?: readonly string[];
}

/**
 * Materialize HEAD in an isolated git worktree, run install+check there, and
 * report a BuildOutcome. Removes the worktree in ALL paths (finally). IMPURE.
 */
export async function buildCommittedHead(opts: HeadBuildOptions): Promise<BuildOutcome>;
```

`buildCommittedHead` control flow:

1. **preflight** — `git -C <root> rev-parse --show-toplevel`. Non-zero ⇒ return
   `{ failedStep:"preflight", detail }`. Use the resolved toplevel as the build
   source.
2. **worktree add** — `mkdtemp(join(tmpdir(),"vend-head-"))` → `wt = join(parent,"head")`
   → `git -C <top> worktree add --detach <wt> HEAD`. Non-zero ⇒
   `{ failedStep:"worktree", detail }` (after cleanup of `parent`).
3. **build** — in a `try`:
   - if `install` (default `["bun","install"]`, unless `null`): run in `cwd:wt`;
     non-zero ⇒ outcome `{ failedStep:"build", detail }`.
   - run `check` (default `["bun","run","check"]`) in `cwd:wt`; `buildStepFailed`
     on its exit ⇒ `{ failedStep:"build", detail }`; else `{ failedStep:null }`.
4. **finally** — `git -C <top> worktree remove --force <wt>` (best-effort) then
   `rm(parent,{recursive:true,force:true})`. Never throws out of cleanup.

Spawns use `Bun.spawnSync([...], { cwd })` (the `check-committed.ts` idiom);
`detail` captures a trimmed tail of stderr/stdout for the message.

Entry:

```ts
if (import.meta.main) {
  const outcome = await buildCommittedHead({ root: process.cwd() });
  const verdict = classifyBuildOutcome(outcome);
  (verdict.ok ? process.stdout : process.stderr).write(verdict.message + "\n");
  process.exit(verdict.exitCode);
}
```

---

## `src/ci/head-build-core.test.ts` — tests

Two `describe` blocks:

1. **`classifyBuildOutcome` (pure)** — fast, no spawning:
   - `failedStep:null` → exit 0, ok, "builds" message.
   - `failedStep:"build"` → exit 1, message names E-007 class + detail.
   - `failedStep:"preflight"` and `"worktree"` → exit 2, message names the step.
   - `buildStepFailed(0) === false`, `buildStepFailed(1) === true`.

2. **`buildCommittedHead` integration (synthetic HEAD)** — uses `mkdtemp` +
   `Bun.spawnSync(["git", ...])` to construct a throwaway repo:
   - helper `makeRepo()`: `git init`, set user.email/name (commit needs identity),
     write `package.json` (`check: "bun run app.ts"`), `app.ts`
     (`import "./dep.ts"`), `dep.ts`.
   - **broken HEAD test:** `git add package.json app.ts` (NOT dep.ts) → commit →
     `dep.ts` left uncommitted in the tree. Call
     `buildCommittedHead({ root, install:null, check:["bun","run","check"] })`.
     Assert `failedStep === "build"` and `classifyBuildOutcome(...).exitCode === 1`.
   - **clean HEAD test:** `git add -A` (all three) → commit. Same call. Assert
     `failedStep === null`, `exitCode === 0`.
   - **no-leak test:** after a run, `git worktree list` in the repo shows only the
     main worktree (the temp one was removed); the temp parent dir no longer exists.
   - `afterEach`/`finally` removes the temp repo.

`install:null` keeps every integration run offline & sub-second (synthetic repo
has no deps; `bun run app.ts` is pure Bun).

---

## Ordering of changes

1. `head-build-core.ts` (pure, no deps) — compiles & unit-tests alone.
2. `head-build-core.test.ts` pure block — green before the verb exists.
3. `check-head.ts` (verb + entry) — imports the core.
4. `head-build-core.test.ts` integration block — drives the verb.
5. `package.json` `check:head` line — wiring last.

## Boundaries honored

- **Central Rule:** logic in `head-build-core.ts`, behind a `check:*` script; no
  trigger here (T-010-02 owns wiring).
- **Pure/impure doctrine:** core is fs/git-free; verb is side-effect-only.
- **No Docker; offline.** Worktree shares the object store; synthetic test needs
  no network.
- **Worktree never leaks:** removal in `finally`, asserted by the no-leak test.
- **E-008 untouched;** `check:*` in-place scripts unchanged.
