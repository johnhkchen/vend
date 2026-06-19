// The any-play consistency probe's IMPURE sweep harness (T-019-01, story S-019-01, epic E-019) —
// the generalization of the decompose-only ./run-probe.ts into an ANY-PLAY, run-to-run consistency
// sweep:
//
//   bun run src/probe/run-consistency-probe.ts <play-name> [input.md] [N] [tokenBudget]
//
// It resolves a named play, seeds a DISPOSABLE temp project with that play's FIXED input, casts the
// play N× on it (default 5), classifies each cast (signal / honest-empty / budget-exhausted), and
// prints the PURE core's read (./consistency.ts): the run-to-run signal dispersion + the outcome
// mix. Where ./run-probe.ts hard-wires decompose-epic and a PAIRED gated-vs-ungated diff, this one
// is SINGLE-ARM and play-parametric (a `ProbeTarget` per play; first cut: decompose-epic + survey,
// the two ends of the honest-empty polarity — extending to expand/propose/steer is one new entry).
//
// NOT unit-tested (house rule, exactly as ./run-probe.ts: the impure verbs — `castPlay`, fs,
// seeding — are proven live; their judgment is the tested pure core, ./consistency.ts +
// consistency.test.ts). This file is the sweep instrument, not part of the everyday `vend` surface;
// the actual sweep + findings note is T-019-02.
//
// TWO INVARIANTS (inherited from ./run-probe.ts):
//  1. NO LEDGER POLLUTION — every cast's `runLogPath` points into the temp root, so the real
//     `.vend/runs.jsonl` is never touched by the probe.
//  2. NO COLLISION — `materialize` refuses to re-mint a board id, so each run's output dirs are
//     cleared before the cast (a fresh board lets a clearing run actually materialize).
//
// The temp-ledger helpers are COPIED from ./run-probe.ts, not imported (the no-shared-util idiom +
// AC#3: ./run-probe.ts must stay byte-for-byte unchanged — importing would convert it from a
// self-contained instrument into a library).

import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Budget } from "../budget/budget.ts";
import { castPlay, type RunSummary } from "../engine/cast.ts";
import type { AnyPlay } from "../engine/play.ts";
import { CHARTER_PATH } from "../play/project-context.ts";
import { assembleInputs } from "../play/project-context.ts";
// Value-import the targetable plays so they self-register and their assembly verbs resolve here.
import { decomposeEpicPlay } from "../play/decompose-epic.ts";
import { surveyPlay, assembleSurveyInputs } from "../play/survey.ts";
import { expandFragmentPlay, assembleExpandFragmentInputs } from "../play/expand-fragment.ts";
import { steerProjectPlay, assembleSteerInputs } from "../play/steer.ts";
import { consistencyReport, formatConsistencyReport, type ProbeOutcome, type ProbeResult } from "./consistency.ts";

/** Casts per sweep, default. Overridable via the CLI `N` arg. */
const RUNS_DEFAULT = 5;

/**
 * A play-parametric probe target — the parametric replacement for ./run-probe.ts's hard-wired
 * decompose glue. Each target knows how to seed its fixed input into a temp root, assemble the
 * play's typed inputs, name the run-log subject, which dirs to clear+collect, and how to tell an
 * honest abstention from a real signal (the per-play discriminator — D2/D3).
 */
interface ProbeTarget {
  readonly play: AnyPlay;
  /** Seed the play's FIXED input under the temp root (already `lisa init`-ed). `srcInputPath` is
   *  the optional CLI input file (decompose needs it; survey ignores it). */
  readonly seed: (root: string, srcInputPath?: string) => Promise<void>;
  /** Assemble the play's typed inputs from the seeded root (the play's own impure verb). */
  readonly assemble: (root: string) => Promise<unknown>;
  /** The run-log subject for each cast. */
  readonly subject: (root: string) => string;
  /** The board subdirs the effect writes — cleared before each cast, collected after. */
  readonly outputDirs: readonly string[];
  /** Per-play abstention test over the collected output: an honest-empty cleared `success`
   *  (vs a real signal). Default is null/blank; survey overrides on its abstention marker. */
  readonly isAbstention: (output: string | null) => boolean;
}

/** The default abstention test: nothing (or only whitespace) landed. Decompose/expand use this —
 *  their honest-empty is already a non-success outcome, so it rarely fires. */
function emptyOutput(output: string | null): boolean {
  return output === null || output.trim().length === 0;
}

/** Run `lisa init` in the temp root so each play's effect-stage `lisa validate` has the structure
 *  it requires (CLAUDE.md, `.lisa/hooks`, `docs/active/work`, rdspi-workflow.md). COPIED from
 *  ./run-probe.ts (AC#3: that file stays untouched). */
async function initLisaProject(root: string): Promise<void> {
  const proc = Bun.spawn(["lisa", "init"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const err = (await new Response(proc.stderr).text()).trim();
    throw new Error(`lisa init failed in temp root (exit ${code}): ${err}`);
  }
}

/** Make a disposable temp root and `lisa init` it. The shared seeding prefix for every target. */
async function seedTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-consistency-"));
  await initLisaProject(root);
  return root;
}

/** Copy the REAL charter (the value function the gates grep) to the path the assembly verbs read. */
async function seedCharter(root: string): Promise<void> {
  const charterDst = join(root, CHARTER_PATH);
  await mkdir(join(charterDst, ".."), { recursive: true });
  await cp(join(process.cwd(), CHARTER_PATH), charterDst);
}

/** Copy the live board (stories + tickets) into the temp root so a play that reads the demand
 *  gradient / dedups against existing ids (survey, steer, expand's `listIdsIn`) sees a real,
 *  GROUNDED input — fixed across every cast of one sweep. Absent dirs on the live repo are skipped
 *  (a valid emptier board). The same copy `surveyTarget` does, factored for the new targets. */
async function seedBoardSnapshot(root: string): Promise<void> {
  for (const dir of ["docs/active/stories", "docs/active/tickets"]) {
    try {
      await cp(join(process.cwd(), dir), join(root, dir), { recursive: true });
    } catch {
      // absent on the live repo ⇒ the play reads an emptier board; still a valid fixed input.
    }
  }
}

/** Read+concat every `*.md` the effect materialized under the given dirs, sorted for determinism.
 *  Returns `null` when nothing landed (censored / collided / andon'd). COPIED from ./run-probe.ts,
 *  generalized to take the dirs (run-probe's were a decompose-specific constant). */
async function collectOutput(root: string, outputDirs: readonly string[]): Promise<string | null> {
  const parts: string[] = [];
  for (const dir of outputDirs) {
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

// ── the probe targets (first cut: decompose-epic + survey) ──────────────────────────────────────

/** Decompose-epic: the fixed input is an epic .md (the CLI `input.md`) + the real charter. The
 *  classic ./run-probe.ts shape, single-arm. Honest-empty is not in its vocabulary (an empty plan
 *  gate-fails ⇒ non-success), so the default abstention test suffices. */
function decomposeTarget(srcEpicPath: string): ProbeTarget {
  return {
    play: decomposeEpicPlay,
    seed: async (root) => {
      // The epic dir is OPTIONAL (lisa init does not create it) — make it and seed the fixed epic.
      const epicDir = join(root, "docs", "active", "epic");
      await mkdir(epicDir, { recursive: true });
      await cp(srcEpicPath, join(epicDir, basename(srcEpicPath)));
      await seedCharter(root);
    },
    assemble: (root) => assembleInputs({ epicPath: join(root, "docs", "active", "epic", basename(srcEpicPath)), projectRoot: root }),
    subject: (root) => {
      // Synchronous subject is awkward (epicIdOf reads the epic) — derive it from the basename,
      // which is what `epicIdOf` falls back to anyway; the run-log subject is cosmetic for the probe.
      return basename(srcEpicPath, ".md");
    },
    outputDirs: ["docs/active/stories", "docs/active/tickets"],
    isAbstention: emptyOutput,
  };
}

/** Survey: the fixed input is the real charter + a grounded board snapshot (the live stories +
 *  tickets, copied in so the survey reads a real demand gradient). Survey's empty board CLEARS and
 *  STAGES a "no demand staged" note — so its abstention test keys on that marker, NOT on emptiness
 *  (the note is non-blank text — the central per-play divergence, D3). */
function surveyTarget(): ProbeTarget {
  return {
    play: surveyPlay,
    seed: async (root) => {
      await seedCharter(root);
      // Copy the live board so survey has a grounded gradient to read (a fixed input across casts).
      for (const dir of ["docs/active/stories", "docs/active/tickets"]) {
        const src = join(process.cwd(), dir);
        try {
          await cp(src, join(root, dir), { recursive: true });
        } catch {
          // absent on the live repo ⇒ survey reads an emptier board; still a valid fixed input.
        }
      }
    },
    assemble: (root) => assembleSurveyInputs({ projectRoot: root, budget: surveyPlay.budget }),
    subject: (root) => `survey of ${basename(root)}`,
    outputDirs: ["docs/active/pm/staged"],
    isAbstention: (output) => output === null || output.includes("no demand staged"),
  };
}

/** Expand-fragment: the fixed input is a GROUNDED fragment STRING (read from the CLI `input.md`)
 *  cast against the real charter + the live board's id space (for `listIdsIn` dedup). NOTE the
 *  honest-empty asymmetry (T-019-02 design D4): expand abstains by STOPPING (the honest-empty gate
 *  fails ⇒ a `gate-failed` non-`success` outcome, nothing materialized), so `classifyRun` folds it
 *  into `budget-exhausted` and its abstention NEVER reaches `isAbstention` — the default suffices.
 *  Expand's honest-empty/over-eagerness is therefore read from the RAW `RunOutcome` tally
 *  (`gate-failed` count + the per-cast andon line), NOT this predicate or the probe mix. */
function expandTarget(fragment: string): ProbeTarget {
  return {
    play: expandFragmentPlay,
    seed: async (root) => {
      await seedCharter(root);
      await seedBoardSnapshot(root); // the grounded id space expand dedups against
    },
    assemble: (root) =>
      assembleExpandFragmentInputs({ projectRoot: root, fragment, budget: expandFragmentPlay.budget }),
    subject: () => "expand of grounded fragment",
    outputDirs: ["docs/active/pm/staged"],
    isAbstention: emptyOutput, // expand STOPs ⇒ honest-empty is a non-success outcome (see above)
  };
}

/** Steer: the fixed input is the real charter + the live board snapshot (the whole-project demand
 *  gradient steer reads). Like survey, steer's empty case CLEARS and materializes a marker note, so
 *  its abstention test keys on that marker (the full two-sided "nothing to stage" abstention — NOT
 *  the partial "_No forks_" line, which sits under a real staged board). */
function steerTarget(): ProbeTarget {
  return {
    play: steerProjectPlay,
    seed: async (root) => {
      await seedCharter(root);
      await seedBoardSnapshot(root);
    },
    assemble: (root) => assembleSteerInputs({ projectRoot: root, budget: steerProjectPlay.budget }),
    subject: (root) => `steer of ${basename(root)}`,
    outputDirs: ["docs/active/pm/staged"],
    isAbstention: (output) =>
      output === null ||
      output.includes("# Steer — nothing to stage") ||
      output.includes("honest empty steer"),
  };
}

/** Resolve the CLI play name to a {@link ProbeTarget}, or `null` if unsupported (the caller prints
 *  usage + the supported names). Decompose + expand require the `input.md` (an epic / a fragment);
 *  survey + steer ignore it (they read the whole seeded project). `async` because expand reads its
 *  fragment file. */
async function resolveTarget(
  playName: string,
  srcInputPath: string | undefined,
): Promise<ProbeTarget | null> {
  switch (playName) {
    case "decompose-epic":
      if (!srcInputPath) return null; // the epic is required — caller surfaces the usage
      return decomposeTarget(srcInputPath);
    case "survey":
      return surveyTarget();
    case "expand":
    case "expand-fragment":
      if (!srcInputPath) return null; // the grounded fragment file is required
      return expandTarget((await readFile(srcInputPath, "utf8")).trim());
    case "steer":
      return steerTarget();
    default:
      return null;
  }
}

/** The supported probe-target names. Extend by adding a `ProbeTarget` builder + a `resolveTarget`
 *  case + a value-import (the T-019-01 seam; T-019-02 added expand + steer). */
const SUPPORTED = ["decompose-epic", "survey", "expand", "steer"] as const;

/** Classify one cast into a {@link ProbeOutcome}: a non-`success` outcome is the censored
 *  (budget-exhausted) bucket; a `success` is a signal unless the target's abstention test fires. */
function classifyRun(summary: RunSummary, output: string | null, target: ProbeTarget): ProbeOutcome {
  if (summary.outcome !== "success") return "budget-exhausted";
  return target.isAbstention(output) ? "honest-empty" : "signal";
}

/** Cast the target N× on its fixed seeded input, classifying each. Clears the output dirs before
 *  each cast (the no-collision invariant), threads the run log into the temp ledger (the
 *  no-pollution invariant), and keeps a raw `RunOutcome` tally beside the probe outcomes so the
 *  budget-exhausted fold is never silent (IA-8 honesty). */
async function castN(
  root: string,
  target: ProbeTarget,
  n: number,
  budget: Budget,
): Promise<{ results: ProbeResult[]; rawOutcomes: Record<string, number> }> {
  const runLogPath = join(root, ".vend", "runs.jsonl");
  const subject = target.subject(root);
  const results: ProbeResult[] = [];
  const rawOutcomes: Record<string, number> = {};
  for (let i = 1; i <= n; i++) {
    for (const dir of target.outputDirs) await rm(join(root, dir), { recursive: true, force: true });
    const inputs = await target.assemble(root);
    const summary = await castPlay(target.play, inputs, budget, {
      subject,
      projectRoot: root,
      runLogPath,
      runId: `consistency-${target.play.name}-${i}`,
    });
    const output = await collectOutput(root, target.outputDirs);
    const outcome = classifyRun(summary, output, target);
    rawOutcomes[summary.outcome] = (rawOutcomes[summary.outcome] ?? 0) + 1;
    results.push({ outcome, output });
    process.stdout.write(`  ${target.play.name} ${i}/${n}: ${summary.outcome} → ${outcome}\n`);
  }
  return { results, rawOutcomes };
}

/** The sweep: resolve the target, seed, cast N×, print the consistency report + the raw tally. */
async function main(playName: string, srcInputPath: string | undefined, n: number, tokenBudget?: number): Promise<void> {
  const target = await resolveTarget(playName, srcInputPath);
  if (!target) {
    process.stderr.write(
      `unsupported or under-specified play "${playName}" — supported: ${SUPPORTED.join(", ")}` +
        ` (decompose-epic requires an <input.md> epic; expand requires an <input.md> fragment)\n`,
    );
    process.exit(2);
  }

  const root = await seedTempRoot();
  await target.seed(root, srcInputPath);
  // Per-cast budget defaults to the play's RECALIBRATED envelope (the run-probe lesson: budget,
  // not gates, is the dominant censoring axis), with an optional token override.
  const budget: Budget = { ...target.play.budget, ...(tokenBudget ? { tokens: tokenBudget } : {}) };

  process.stdout.write(`consistency probe — ${n}× ${playName} on a fixed input\n`);
  process.stdout.write(`(temp root: ${root} — ledger + board are disposable; per-cast tokens: ${budget.tokens})\n`);

  const { results, rawOutcomes } = await castN(root, target, n, budget);
  const report = consistencyReport(results);
  process.stdout.write(`\n${formatConsistencyReport(report)}\n`);
  const rawLine = Object.entries(rawOutcomes)
    .map(([k, v]) => `${k} ${v}`)
    .join(" · ");
  process.stdout.write(`raw run-log outcomes: ${rawLine}\n`);
}

if (import.meta.main) {
  const playName = Bun.argv[2];
  if (!playName) {
    process.stderr.write(
      `usage: bun run src/probe/run-consistency-probe.ts <play-name> [input.md] [N] [tokenBudget]\n` +
        `supported plays: ${SUPPORTED.join(", ")}\n`,
    );
    process.exit(2);
  }
  // decompose-epic takes a positional epic before N; survey takes no input, so its first numeric
  // positional is N. Detect: if argv[3] is a number, it is N (no input file).
  const a3 = Bun.argv[3];
  const inputIsNumeric = a3 !== undefined && Number.isFinite(Number.parseInt(a3, 10)) && /^\d+$/.test(a3);
  const srcInputPath = inputIsNumeric ? undefined : a3;
  const nArg = inputIsNumeric ? a3 : Bun.argv[4];
  const tokenArg = inputIsNumeric ? Bun.argv[4] : Bun.argv[5];

  const n = nArg ? Number.parseInt(nArg, 10) : RUNS_DEFAULT;
  if (!Number.isFinite(n) || n <= 0) {
    process.stderr.write(`invalid N: ${nArg}\n`);
    process.exit(2);
  }
  const tokenBudget = tokenArg ? Number.parseInt(tokenArg, 10) : undefined;
  if (tokenBudget !== undefined && (!Number.isFinite(tokenBudget) || tokenBudget <= 0)) {
    process.stderr.write(`invalid tokenBudget: ${tokenArg}\n`);
    process.exit(2);
  }
  await main(playName, srcInputPath, n, tokenBudget);
  process.exit(0);
}
