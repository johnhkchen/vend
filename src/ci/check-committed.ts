// `bun run check:committed` entry (T-008-01) — the thin IMPURE verb of the "done means
// committed" gate (E-008). Mirrors cli.ts's `import.meta.main` shell: it does the side effects
// (run git, write stderr, exit the process) and delegates ALL judgment to the pure core. It is
// smoke-only, not unit-tested — exactly as press.ts / the cli dispatch block are.
//
// THE CENTRAL RULE (ci-strategy.md): this is a `check:*` script in the app repo. The T-008-02
// lisa on-stop hook is the trigger that invokes it; the definition of "good" lives in
// committed-core.ts, never in the hook. It runs on the HOST working tree (a Dagger container
// can't see it), which is why E-008 enforces here, not in /ci.
//
// EXIT CODES (cf. cli.ts): 0 = clean (all source committed); 1 = ANDON (uncommitted/untracked
// source — the D-005 failure mode); 2 = environment error (git missing / not a repo) — kept
// distinct from a dirty tree so the hook can tell "couldn't check" from "found a problem."

import { classifyPorcelain } from "./committed-core.ts";

if (import.meta.main) {
  // Resolve the repo root so the gate is correct regardless of where `bun run` was invoked.
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`check:committed: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();

  const status = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root });
  if (status.exitCode !== 0) {
    process.stderr.write(`check:committed: git status failed (${status.stderr.toString().trim()})\n`);
    process.exit(2);
  }

  const offenders = classifyPorcelain(status.stdout.toString());
  if (offenders.length > 0) {
    process.stderr.write("check:committed: uncommitted source — commit before stopping (D-005):\n");
    for (const path of offenders) process.stderr.write(`  ${path}\n`);
    process.exit(1);
  }

  process.stdout.write("check:committed: ok — all source committed\n");
  process.exit(0);
}
