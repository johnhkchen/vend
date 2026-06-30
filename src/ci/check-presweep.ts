// `bun run check:presweep` entry (E-061 #9) — the thin IMPURE verb of the "done ⇒ committed"
// pre-sweep net. Mirrors check-committed.ts's `import.meta.main` shell: it does the side effects
// (load the board, run git, write stderr, exit) and delegates ALL judgment to presweep-core.ts.
// Smoke-only, not unit-tested — exactly as check-committed.ts / press.ts are.
//
// THE CENTRAL RULE (ci-strategy.md): a `check:*` script in the app repo; a lisa pre-sweep hook (or a
// human, before declaring an epic done) is the trigger that invokes it — the definition of "good"
// lives in presweep-core.ts, never in the hook. It reads the HOST board + working tree, so it runs
// here, not in a Dagger container.
//
// EXIT CODES (cf. check-committed.ts): 0 = clean (no done tickets, or every done ticket's work is
// committed); 1 = ANDON (done tickets exist but source/board is dirty — the F2 done≠committed
// divergence); 2 = environment error (git missing / not a repo / the board could not be loaded —
// a corrupt board is its own "couldn't verify", kept distinct from a dirty tree).

import { loadWorkGraph } from "../graph/load.ts";
import { classifySweep, donePhaseIds, type TicketPhase } from "./presweep-core.ts";

if (import.meta.main) {
  // Resolve the repo root so the gate is correct regardless of where `bun run` was invoked.
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`check:presweep: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();

  // Load the board → the done-ticket antecedent. A corrupt board (GraphParseError /
  // GraphIntegrityError) is a "couldn't verify", not a dirty-tree andon — exit 2 with the reason.
  let tickets: readonly TicketPhase[];
  try {
    const graph = await loadWorkGraph({ root });
    tickets = graph.tickets.map((t) => ({ id: t.id, phase: t.phase }));
  } catch (e) {
    process.stderr.write(`check:presweep: could not load the board — ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  const status = Bun.spawnSync(["git", "status", "--porcelain"], { cwd: root });
  if (status.exitCode !== 0) {
    process.stderr.write(`check:presweep: git status failed (${status.stderr.toString().trim()})\n`);
    process.exit(2);
  }

  const doneIds = donePhaseIds(tickets);
  const verdict = classifySweep({ doneIds, porcelain: status.stdout.toString() });

  if (!verdict.ok) {
    process.stderr.write(
      `check:presweep: done ≠ committed — ${verdict.doneIds.length} ticket(s) are phase:done but ` +
        `${verdict.offenders.length} source/board path(s) are uncommitted (F2). Commit before sweeping:\n`,
    );
    for (const path of verdict.offenders) process.stderr.write(`  ${path}\n`);
    process.exit(1);
  }

  process.stdout.write(
    doneIds.length === 0
      ? "check:presweep: ok — no done tickets yet (nothing to verify)\n"
      : `check:presweep: ok — ${doneIds.length} done ticket(s), source + board all committed\n`,
  );
  process.exit(0);
}
