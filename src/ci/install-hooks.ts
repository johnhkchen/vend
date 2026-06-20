// `bun run hooks:install` entry (T-033-02) — activates the committed per-commit gate (E-033) by
// pointing git's `core.hooksPath` at the committed hooks dir. `core.hooksPath` is LOCAL config (not
// committed), so a fresh clone needs this once for the committed `.githooks/pre-commit` to fire.
//
// Idempotent: `git config core.hooksPath <dir>` re-set to the same value is a no-op. Portable: the
// path is the RELATIVE HOOKS_DIR contract from precommit-core.ts — no absolute paths, no re-listed
// string (the core is the single source of the path, per its own doc-comment).

import { HOOKS_DIR } from "./precommit-core.ts";

if (import.meta.main) {
  const res = Bun.spawnSync(["git", "config", "core.hooksPath", HOOKS_DIR]);
  if (res.exitCode !== 0) {
    process.stderr.write(`hooks:install: failed to set core.hooksPath (${res.stderr.toString().trim()})\n`);
    process.exit(1);
  }
  process.stdout.write(`hooks:install: core.hooksPath = ${HOOKS_DIR} — pre-commit gate active\n`);
  process.exit(0);
}
