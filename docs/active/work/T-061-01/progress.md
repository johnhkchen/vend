# T-061-01 — Progress

_Phase: Implement. What was done, what was verified, deviations._

## Completed

### Step 1 — `package.json` edits ✓
- `version`: `0.0.0` → `0.1.0`.
- `private: true` line removed (key now absent).
- Added `"bin": { "vend": "./src/cli.ts" }` after `"type": "module"`.
- Valid JSON (parsed by the new test and by tooling).

### Step 2 — Shebang on `src/cli.ts` ✓
- Prepended `#!/usr/bin/env bun` as line 1; original header now line 2, unchanged.
- `bun run check:typecheck` (`tsc --noEmit`) passes — exit 0. The shebang does not
  break strict typecheck (as predicted in Research/Design).

### Step 3 — `src/packaging.test.ts` ✓
- New test reads the root manifest at runtime (`join(import.meta.dir, "..")`) and
  asserts the three AC invariants: semver ≠ 0.0.0 & matches `\d+\.\d+\.\d+`;
  `private` absent; `bin.vend === "./src/cli.ts"` **and** that file exists on disk.
- `bun test src/packaging.test.ts` → **3 pass, 0 fail.**

### Step 5 — Entrypoint smoke ✓
- `bun run ./src/cli.ts` executes through `src/cli.ts` (shebang present, path
  resolves) and prints the shelf/usage surface. The `bin` target is genuinely
  runnable, not just path-resolvable.

## Verification of THIS ticket's work

- Typecheck: **clean** (exit 0).
- The three AC invariants: **proven by passing tests** (`src/packaging.test.ts`).
- My change set in isolation introduces **zero** new test failures.

## Deviation — the full gate (`bun run check`) is RED, pre-existing, out of scope

`bun run check` exits non-zero, but **not because of this ticket**. Eight tests
fail, all the "live board" smoke tests that load `docs/active/**`, all from a
single root cause:

```
GraphIntegrityError: 4 unresolved edge(s):
- story 'S-063' has no epic 'E-063'
- story 'S-062' has no epic 'E-062'
- story 'S-065' has no epic 'E-065'
- story 'S-064' has no epic 'E-064'
```

Stories `S-062`–`S-065` exist on the board with **no corresponding epic file**
(`docs/active/epic/E-06{2,3,4,5}*.md` do not exist). The graph integrity check
(`src/graph/model.ts:361`) throws, and every live-board test inherits the failure.

**Proof this is not caused by my change:** I stashed `package.json` + `src/cli.ts`
(`git stash push -- package.json src/cli.ts`) and re-ran the failing test — it still
failed identically on the clean manifest. The failure is board data, not code, and
predates this ticket (the session opened with `S-061`-related ticket files already
modified; the orphan stories are board-state debt unrelated to the manifest).

**Scope:** T-061-01's AC is three `package.json` fields + the gate "still passing."
Authoring missing epics for S-062–S-065 is not this ticket's work (those belong to
their own epics/decompose runs — e.g. E-062 is named in E-061 as a separate epic).
Fixing them here would be unscoped board surgery.

## Not done, and why

### Step 6 — Commit: NOT performed
The project enforces a **test-green pre-commit hook** (`just setup` installs it;
README: "installs the pre-commit gate"). With the board-orphan failures above, the
hook rejects any commit unless bypassed with `--no-verify`. I will not bypass the
project's own quality gate to land a commit, and the blocking failures are not
mine to fix. The code changes are complete and verified in isolation; committing is
deferred to a human/Lisa once the board orphans (missing epics E-062–E-065) are
resolved and the suite is green again. Flagged for attention in `review.md`.

(No deviation from the manifest design itself — Steps 1–3 landed exactly as
planned. The only deviation is the unrelated red gate blocking the commit step.)
