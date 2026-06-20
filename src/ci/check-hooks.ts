// `bun run check:hooks` entry (T-033-02) — the GUARD that keeps the per-commit gate (E-033) from
// being silently absent (the E-012 "police the gate" move). Thin IMPURE verb: reads the configured
// `core.hooksPath` and delegates the verdict to hookInstallState in precommit-core.ts. Smoke-only,
// not unit-tested (its judgment is covered by precommit-core.test.ts).
//
// Exits NON-ZERO when the gate is not active and NAMES the fix (`bun run hooks:install`), so a fresh
// clone or a clobbered `core.hooksPath` surfaces loudly instead of letting commits slip through
// ungated.

import { hookInstallState } from "./precommit-core.ts";

if (import.meta.main) {
  // `git config --get core.hooksPath` exits 1 with empty stdout when the key is unset → treat as null.
  const res = Bun.spawnSync(["git", "config", "--get", "core.hooksPath"]);
  const hooksPath = res.exitCode === 0 ? res.stdout.toString().trim() : null;

  const state = hookInstallState(hooksPath);
  (state.active ? process.stdout : process.stderr).write(state.message + "\n");
  process.exit(state.active ? 0 : 1);
}
