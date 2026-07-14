# T-033-01 — Structure: precommit-policy-core

*The blueprint — file-level changes, public interfaces, internal organization, ordering.
Not code; the shape of the code. Two files, both new. Nothing modified, nothing deleted.*

## Changeset overview

| File | Action | Why |
|---|---|---|
| `src/ci/precommit-core.ts` | **create** | the pure policy: types, `HOOKS_DIR`, `classifyPrecommit`, `hookInstallState`, private `assertNever` |
| `src/ci/precommit-core.test.ts` | **create** | the pure-function unit test (mirrors `committed-core.test.ts`) |

No changes to `package.json` (T-033-02 adds `check:hooks`), no hook files, no git config. The existing
`check:test` already discovers `*.test.ts` via `bun test`, and `check:typecheck` already runs `tsc`
over `src/` — so both new files are picked up by the existing `bun run check:*` surface with zero
wiring.

## File 1 — `src/ci/precommit-core.ts`

### Header comment (mirror committed-core.ts / head-build-core.ts tone)

A block comment establishing: this is the per-commit green gate's PURE policy (T-033-01, E-033);
THE CENTRAL RULE (`ci-strategy.md`) — logic lives here, the T-033-02 `.githooks/pre-commit` invoker
only triggers; PURE (no spawn/fs/git/process); the fail-closed (tests-failed) vs fail-open
(could-not-run) disciplines and which mirrors on-stop; the house rule (returned data, never thrown).

### Public interface (export order)

```
// ── classifyPrecommit ──────────────────────────────────────────────
export type PrecommitReason = "green" | "tests-failed" | "could-not-run";

export interface PrecommitRun {        // INPUT — raw facts the impure verb reports (cf. BuildOutcome)
  ran: boolean;                        // did the test process actually spawn/complete?
  exitCode: number | null;            // process exit code; null when !ran (never spawned)
  stderr?: string;                    // captured failure context for the andon message
}

export interface PrecommitVerdict {    // OUTPUT — the decision
  block: boolean;
  reason: PrecommitReason;
  message: string;
}

export function classifyPrecommit(run: PrecommitRun): PrecommitVerdict;

// ── hookInstallState ───────────────────────────────────────────────
export const HOOKS_DIR = ".githooks";  // R12 shared contract (cf. SOURCE_PREFIXES) — as const literal

export interface HookState {
  active: boolean;
  message: string;
}

export function hookInstallState(hooksPath: string | null | undefined): HookState;
```

### Internal organization

1. `PrecommitReason`, `PrecommitRun`, `PrecommitVerdict` types.
2. A module-private `reasonMessage(reason, run)` helper OR inline message construction — decided:
   **inline at each branch** for the data-dependent strings (tests-failed and could-not-run need
   `run.stderr`), with a trailing `assertNever` to lock exhaustiveness. Concretely `classifyPrecommit`:
   - `if (!run.ran)` → `{ block:false, reason:"could-not-run", message: skipMsg(run.stderr) }`
     — **fail-open** first, so a missing/never-ran process can never be misread as a non-zero exit.
   - `if (run.exitCode === 0)` → `{ block:false, reason:"green", message:"…" }`.
   - otherwise (`ran && exitCode !== 0`) → `{ block:true, reason:"tests-failed",
     message: failMsg(run.exitCode, run.stderr) }` — **fail-closed**, message names the failure.
   - The exhaustiveness switch: rather than a 4th unreachable input branch, the function ends by
     building the message through a `switch (reason)` with arms for all three reasons and **no
     `default`**, closed by `return assertNever(reason)`. (See "Exhaustiveness" below for the exact
     shape chosen.)
3. `HOOKS_DIR` constant.
4. `hookInstallState`:
   - normalize: `const v = (hooksPath ?? "").replace(/\/$/, "")` (strip one trailing slash).
   - `if (v === "")` → not installed message.
   - `if (v === HOOKS_DIR)` → active message.
   - else → unexpected-path message (names `v`, points at `hooks:install`).
5. private `function assertNever(x: never): never { throw new Error(...) }`.

### Exhaustiveness — the concrete shape

To satisfy "exhaustively switched (no `default` on `reason`) so tsc proves every case" (D3) **without**
duplicating decision logic, the structure is:

```
function verdictMessage(reason: PrecommitReason, run: PrecommitRun): string {
  switch (reason) {
    case "green":          return "precommit: ok — tests green";
    case "tests-failed":   return `precommit: BLOCK — tests failed (exit ${run.exitCode}); fix before committing${tail(run.stderr)}`;
    case "could-not-run":  return `precommit: skip — could not run tests${tail(run.stderr)} (fail-open)`;
  }
  return assertNever(reason);   // no `default`: a 4th reason fails tsc here
}
```

`classifyPrecommit` decides `{ block, reason }` from the input, then sets `message =
verdictMessage(reason, run)`. `tail(s)` is a tiny private helper: `s` trimmed to a short suffix, or
`""` — so the message "names the failure" (E-008 style) when stderr is present and stays clean when not.

## File 2 — `src/ci/precommit-core.test.ts`

Mirror `committed-core.test.ts` structure exactly.

```
import { describe, expect, test } from "bun:test";
import { classifyPrecommit, hookInstallState, HOOKS_DIR } from "./precommit-core.ts";
```

### `describe("classifyPrecommit")` — the three AC fixtures + edges

- **AC green:** `{ ran:true, exitCode:0 }` → `block:false`, `reason:"green"`.
- **AC tests-failed (fail-closed):** `{ ran:true, exitCode:1, stderr:"3 fail" }` → `block:true`,
  `reason:"tests-failed"`; assert `message` contains the failure context (`"exit 1"`, and the stderr
  tail so the andon names the failure).
- **AC could-not-run (fail-open):** `{ ran:false, exitCode:null }` → `block:false`,
  `reason:"could-not-run"`. A second fixture: `{ ran:false, exitCode:null, stderr:"bun: not found" }`
  asserts the note surfaces the reason (visible, not silent).
- **edge:** non-zero exitCode other than 1 (e.g. `2`) with `ran:true` still → `tests-failed`/block
  (any non-zero is failure, the `buildStepFailed` precedent).
- **edge:** `ran:false` with a stray `exitCode:0` still → `could-not-run` (ran checked first — the
  modeling-looseness neutralizer from D1).

### `describe("hookInstallState")` — both AC cases + edges

- **AC active:** `hookInstallState(".githooks")` → `active:true`.
- **AC not installed:** `hookInstallState(null)` → `active:false`, message contains
  `"hooks:install"`. Repeat for `undefined` and `""`.
- **edge trailing slash:** `hookInstallState(".githooks/")` → `active:true` (normalization).
- **edge unexpected path:** `hookInstallState(".husky")` → `active:false`, message names `.husky` and
  points at `hooks:install`.

### `describe("HOOKS_DIR (R12 shared contract)")`

- `expect(HOOKS_DIR).toBe(".githooks")` — the `SOURCE_PREFIXES` contract-test precedent.

## Ordering of changes

1. Write `precommit-core.ts` first (the test imports it; tsc needs it to exist).
2. Write `precommit-core.test.ts`.
3. `bun run check:typecheck` — proves purity contract + exhaustiveness switch.
4. `bun run check:test` — proves all fixtures green.
5. Single atomic commit (see plan.md). Both files ship together — a test without its module, or a
   module without its test, is never a valid intermediate state for this ticket.

## Boundaries honored

- **No app imports beyond bun:test** in the test; **no imports at all** in the core (pure leaf module).
- `precommit-core.ts` sits under `src/` → automatically inside `check:committed`'s `SOURCE_PREFIXES`
  scope, so the E-008 gate already polices it. No scope edit needed.
- Nothing here references `.githooks/pre-commit` or `package.json`; those are T-033-02's surface and
  stay untouched, preserving the clean T-033-01 → T-033-02 dependency edge.
