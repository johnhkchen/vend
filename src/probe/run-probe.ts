// The consistency probe's IMPURE sweep harness (T-014-02, PRD KR3 — the E2 arm).
//
// Run by a human AT SWEEP, once, to produce the gate-driven variance-reduction number the
// findings note (T-014-03) reads:
//
//   bun run src/probe/run-probe.ts <epic.md>
//
// It casts ONE play (decompose-epic) on a FIXED input N×N: N times gated, N times ungated
// (`--no-gates` via `castPlay`'s `skipGates`), diffs the materialized output of each arm with
// the PURE core (./variance.ts), and prints the single reduction number plus the raw per-run
// outcomes. ≤ the PRD's cast budget (N per arm, default 5 → 10 total).
//
// NOT unit-tested (house rule: the impure verbs — `castPlay`, `assembleInputs`, fs — are
// proven live; their judgment is the tested pure core). This file is the sweep instrument, not
// part of the everyday `vend` surface.
//
// TWO THINGS THIS HARNESS MUST GET RIGHT (research.md):
//  1. NO LEDGER POLLUTION — every cast's `runLogPath` points into the temp root, so the real
//     `.vend/runs.jsonl` (which the Ledger recalibrates from) is never touched by the probe.
//  2. NO COLLISION — `materialize` refuses to re-mint a board id, so each run's output dirs are
//     cleared before the cast; a fresh board lets a clearing run actually materialize (instead
//     of relabelling to `id-collision` and producing nothing).

import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { castPlay } from "../engine/cast.ts";
import { assembleInputs, CHARTER_PATH } from "../play/project-context.ts";
import { decomposeEpicPlay, epicIdOf } from "../play/decompose-epic.ts";
import { formatVarianceReport, varianceReduction } from "./variance.ts";

/** Casts per arm. 5 ⇒ 10 total, within the PRD's ≤5-cast-per-arm budget. */
const RUNS_PER_ARM = 5;

/** The two board subdirs the effect writes, cleared between runs to dodge the collision guard. */
const OUTPUT_DIRS = ["docs/active/stories", "docs/active/tickets"] as const;

/** A seeded temp project: the fixed epic + the REAL charter (the bounds gate greps it), under a
 *  disposable root so the live board and ledger are never touched. */
interface TempProject {
  readonly root: string;
  readonly epicPath: string;
}

/** Seed a disposable project root from the live repo: copy the epic in, and the real charter to
 *  the path `assembleInputs` reads. The src/board snapshot is intentionally left empty — it is
 *  identical across all 10 runs (a fixed input), so it cannot bias the gated-vs-ungated read. */
async function seedTempProject(srcEpicPath: string): Promise<TempProject> {
  const root = await mkdtemp(join(tmpdir(), "vend-probe-"));
  const epicName = basename(srcEpicPath);
  const epicPath = join(root, epicName);
  await cp(srcEpicPath, epicPath);
  const charterDst = join(root, CHARTER_PATH);
  await mkdir(join(charterDst, ".."), { recursive: true });
  await cp(join(process.cwd(), CHARTER_PATH), charterDst);
  return { root, epicPath };
}

/** Read+concat every `*.md` the effect materialized under the temp board, sorted by name for a
 *  deterministic string. Returns `null` when nothing materialized (gate-censored / collided /
 *  andon'd) — the `null` the variance core counts as censored. */
async function collectOutput(root: string): Promise<string | null> {
  const parts: string[] = [];
  for (const dir of OUTPUT_DIRS) {
    const abs = join(root, dir);
    let names: string[];
    try {
      names = (await readdir(abs)).filter((n) => n.endsWith(".md")).sort();
    } catch {
      continue; // dir absent ⇒ nothing materialized here
    }
    for (const name of names) parts.push(await readFile(join(abs, name), "utf8"));
  }
  return parts.length > 0 ? parts.join("\n") : null;
}

/** Cast one arm `RUNS_PER_ARM` times, clearing the board before each so a clearing run
 *  materializes rather than collides. Returns each run's materialized output (or null). */
async function castArm(proj: TempProject, skipGates: boolean): Promise<(string | null)[]> {
  const label = skipGates ? "ungated" : "gated";
  const epic = await readFile(proj.epicPath, "utf8");
  const subject = epicIdOf(epic, proj.epicPath);
  const runLogPath = join(proj.root, ".vend", "runs.jsonl");
  const outputs: (string | null)[] = [];
  for (let i = 1; i <= RUNS_PER_ARM; i++) {
    for (const dir of OUTPUT_DIRS) await rm(join(proj.root, dir), { recursive: true, force: true });
    const inputs = await assembleInputs({ epicPath: proj.epicPath, projectRoot: proj.root });
    const summary = await castPlay(decomposeEpicPlay, inputs, decomposeEpicPlay.budget, {
      subject,
      projectRoot: proj.root,
      runLogPath,
      skipGates,
      runId: `probe-${label}-${i}`,
    });
    const output = await collectOutput(proj.root);
    process.stdout.write(
      `  ${label} ${i}/${RUNS_PER_ARM}: ${summary.outcome} (materialized: ${summary.materialized})\n`,
    );
    outputs.push(output);
  }
  return outputs;
}

/** The sweep: seed, cast both arms, diff, print the single number + the honest caveats. */
async function main(srcEpicPath: string): Promise<void> {
  const proj = await seedTempProject(srcEpicPath);
  process.stdout.write(`variance probe — ${RUNS_PER_ARM}× gated, ${RUNS_PER_ARM}× ungated on ${srcEpicPath}\n`);
  process.stdout.write(`(temp root: ${proj.root} — ledger + board are disposable)\n`);

  process.stdout.write("gated arm (gates ON):\n");
  const gated = await castArm(proj, false);
  process.stdout.write("ungated arm (--no-gates):\n");
  const ungated = await castArm(proj, true);

  const report = varianceReduction(gated, ungated);
  process.stdout.write(`\n${formatVarianceReport(report)}\n`);
}

if (import.meta.main) {
  const srcEpicPath = Bun.argv[2];
  if (!srcEpicPath) {
    process.stderr.write("usage: bun run src/probe/run-probe.ts <epic.md>\n");
    process.exit(2);
  }
  await main(srcEpicPath);
  process.exit(0);
}
