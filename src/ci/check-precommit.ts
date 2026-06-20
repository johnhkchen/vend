// `bun run check:precommit` entry (T-033-02) — the thin IMPURE verb of the per-commit green-gate
// (E-033). Mirrors check-committed.ts / check-head.ts's `import.meta.main` shell: it does the side
// effects (spawn the test gate, write stderr, exit the process) and delegates ALL judgment to the
// pure core in precommit-core.ts. Smoke-only, not unit-tested — exactly as the other two invokers
// (their delegated logic is covered by precommit-core.test.ts).
//
// THE CENTRAL RULE (ci-strategy.md): the `.githooks/pre-commit` shell only INVOKES this; the
// definition of "what a test-run outcome MEANS for whether the commit may proceed" lives in
// classifyPrecommit, never here and never in the shell.
//
// FAIL OPEN: the whole body is wrapped so any inability to run (no test gate, spawn/env error, an
// unexpected throw) exits 0 — a broken checker must never wedge a developer's `git commit`. The only
// non-zero exit is a deliberate BLOCK (exit 1) on red tests. The shell relies on exactly this 0/1
// contract (any other code it treats as env-error → fail open).

import { classifyPrecommit, type PrecommitRun } from "./precommit-core.ts";

/** Bounded, whitespace-collapsed suffix of captured output for the andon message. */
function tail(text: string, max = 400): string {
  const s = text.trim().replace(/\s+/g, " ");
  return s.length > max ? `…${s.slice(-max)}` : s;
}

if (import.meta.main) {
  try {
    // ── preflight: resolve the repo root (cwd-robust; also proves it is a git repo) ──────────────
    const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
    let run: PrecommitRun;
    if (top.exitCode !== 0) {
      // Not a repo / git missing → could-not-run → fail open (the core decides ALLOW from this).
      run = { ran: false, exitCode: null, stderr: "not a git repository" };
    } else {
      const root = top.stdout.toString().trim();
      // ── run the test gate (headline: check:test). NOT the full `check`/baml:gen per commit. ─────
      const res = Bun.spawnSync(["bun", "run", "check:test"], { cwd: root });
      const out = res.stderr.toString() + res.stdout.toString();
      // exitCode === null ⇒ the process never produced a code (couldn't run) ⇒ fail open.
      run = { ran: res.exitCode !== null, exitCode: res.exitCode, stderr: tail(out) };
    }

    const verdict = classifyPrecommit(run);
    (verdict.block ? process.stderr : process.stdout).write(verdict.message + "\n");
    process.exit(verdict.block ? 1 : 0);
  } catch (err) {
    // Last-resort fail-open: a runner that throws must never block a commit.
    process.stderr.write(`precommit: runner error — allowing (fail-open): ${String(err)}\n`);
    process.exit(0);
  }
}
