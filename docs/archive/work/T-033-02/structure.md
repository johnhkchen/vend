# T-033-02 — Structure: precommit-hook-and-guard

The blueprint — files created/modified, their public shape, and the ordering. No full code; the
shape of the code.

## Changeset overview

| # | File | Action | Role |
|---|---|---|---|
| 1 | `src/ci/check-precommit.ts` | create | Impure runner: spawn `check:test` → `classifyPrecommit` → exit 0/1 |
| 2 | `src/ci/install-hooks.ts` | create | Impure runner: `git config core.hooksPath HOOKS_DIR` (idempotent) |
| 3 | `src/ci/check-hooks.ts` | create | Impure runner/guard: read `core.hooksPath` → `hookInstallState` → exit 0/1 |
| 4 | `.githooks/pre-commit` | create | Fail-open POSIX-sh invoker; `chmod +x` |
| 5 | `package.json` | modify | Add `check:precommit`, `hooks:install`, `check:hooks` scripts |
| 6 | *(local)* `core.hooksPath` | configure | `bun run hooks:install` — not committed; activates the repo |

No file is deleted. No existing source file (`precommit-core.ts`, `check-committed.ts`,
`check-head.ts`, the `check`/`check:committed`/`check:head` scripts) is modified.

## 1. `src/ci/check-precommit.ts` (new)

Header comment in the house style: names the layer (E-033, the per-commit gate), states the Central
Rule (this runner is the impure verb; judgment lives in `precommit-core.ts`), and states the
fail-open contract (emits only 0/1; any throw → 0).

```
import { classifyPrecommit, type PrecommitRun } from "./precommit-core.ts";

function tail(text, max=400): string   // bounded, whitespace-collapsed suffix for the message

if (import.meta.main) {
  try {
    // preflight: resolve repo root (cwd-robust, proves it's a repo)
    top = Bun.spawnSync(["git","rev-parse","--show-toplevel"])
    run: PrecommitRun
    if (top.exitCode !== 0) run = { ran:false, exitCode:null, stderr:"not a git repository" }
    else {
      root = top.stdout.toString().trim()
      res  = Bun.spawnSync(["bun","run","check:test"], { cwd: root })
      out  = res.stderr.toString() + res.stdout.toString()
      run  = { ran: res.exitCode !== null, exitCode: res.exitCode, stderr: tail(out) }
    }
    verdict = classifyPrecommit(run)
    ;(verdict.block ? process.stderr : process.stdout).write(verdict.message + "\n")
    process.exit(verdict.block ? 1 : 0)
  } catch (err) {
    // fail-open: a broken runner must never wedge a commit
    process.stderr.write(`precommit: runner error — allowing (fail-open): ${String(err)}\n`)
    process.exit(0)
  }
}
```

Public interface: none exported (the `import.meta.main` block IS the entry, like check-committed.ts).
Smoke-only, not unit-tested.

## 2. `src/ci/install-hooks.ts` (new)

```
import { HOOKS_DIR } from "./precommit-core.ts";

if (import.meta.main) {
  res = Bun.spawnSync(["git","config","core.hooksPath", HOOKS_DIR])   // idempotent
  if (res.exitCode !== 0) {
    process.stderr.write(`hooks:install: failed to set core.hooksPath (${res.stderr...trim()})\n`)
    process.exit(1)
  }
  process.stdout.write(`hooks:install: core.hooksPath = ${HOOKS_DIR} — pre-commit gate active\n`)
  process.exit(0)
}
```

Portable (relative `HOOKS_DIR`, no absolute paths). Idempotent (same value re-set is a no-op for git).

## 3. `src/ci/check-hooks.ts` (new — the guard)

```
import { hookInstallState } from "./precommit-core.ts";

if (import.meta.main) {
  res = Bun.spawnSync(["git","config","--get","core.hooksPath"])
  // git config --get exits 1 with empty stdout when the key is unset → null
  hooksPath = res.exitCode === 0 ? res.stdout.toString().trim() : null
  state = hookInstallState(hooksPath)
  ;(state.active ? process.stdout : process.stderr).write(state.message + "\n")
  process.exit(state.active ? 0 : 1)     // non-zero when absent → gate can't be silent (E-012)
}
```

## 4. `.githooks/pre-commit` (new, executable)

```
#!/bin/sh
# T-033-02 git pre-commit gate (E-033) — third commit-discipline layer (after E-008/E-010).
# ONLY invokes; the verdict logic lives in src/ci/precommit-core.ts. FAIL OPEN on its own errors.

command -v bun >/dev/null 2>&1 || exit 0                 # no bun → can't check → allow
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
[ -n "$ROOT" ] || exit 0
cd "$ROOT" || exit 0

bun run check:precommit                                  # runner: 0=allow, 1=BLOCK (msg printed)
case "$?" in
  0) exit 0 ;;        # allow — green, or fail-open skip
  1) exit 1 ;;        # BLOCK — red tests; message already on stderr
  *) exit 0 ;;        # runner couldn't even start → fail open (on-stop.sh discipline)
esac
```

Must be committed with the executable bit (`git update-index --chmod=+x` / `chmod +x` before add).

## 5. `package.json` (modify — `scripts` only)

Add three keys to the `scripts` block; touch nothing else:

```
"check:precommit": "bun run src/ci/check-precommit.ts",
"hooks:install":   "bun run src/ci/install-hooks.ts",
"check:hooks":     "bun run src/ci/check-hooks.ts",
```

Placement: alongside the existing `check:*` keys for discoverability. `check`,
`check:committed`, `check:head`, `baml:gen`, `build` unchanged.

## 6. Activation (local, not committed)

`bun run hooks:install` → sets `core.hooksPath = .githooks` in this repo's local git config. Verified
with `git config --get core.hooksPath` and `bun run check:hooks`.

## Ordering that matters

1. Runners (1–3) before the shell (4) — the shell invokes `check:precommit`, so the script + runner
   must exist first for the live proof to work.
2. `package.json` scripts (5) before activation/proof — `bun run check:precommit` / `check:hooks` /
   `hooks:install` resolve only once the keys exist.
3. Activation (6) before the live red/green proof.
4. The implementing **commit** happens *after* activation only if the tree is green — the installed
   hook gates that very commit (dogfooding). Run `check:test` green first.

## Module boundaries (unchanged invariants)

- The three runners import **only** from `./precommit-core.ts` — no cross-import among gates, no app
  code reached from elsewhere. They are the impure shell; the core stays pure.
- `HOOKS_DIR` is named in exactly one place (`precommit-core.ts`); install + guard import it; the
  shell embodies it by location. The path string `.githooks` appears as a literal only in the shell
  file's own path and in this blueprint — never re-listed in TS.
