// The semantic-equivalence judge's IMPURE harness (T-022-01, story S-022-01, epic E-022) — the
// judge cast that gives the consistency probe's dispersion (./consistency.ts) a MEANING axis:
//
//   bun run src/probe/run-equivalence-judge.ts <play-name> [N] [tokenBudget]
//   bun run src/probe/run-equivalence-judge.ts expand [fragment.md] [N] [tokenBudget]
//
// It resolves an ARTICULATION play (survey / expand / steer — the three E-019/E-020 plays whose
// run-to-run divergence we already disperse), seeds a DISPOSABLE temp project with that play's
// FIXED input, casts the play N× collecting each output (exactly ./run-consistency-probe.ts's
// sweep), then CASTS A JUDGE — the dispense seam (src/executor/claude.ts) — over the collected
// SIGNAL outputs to decide, per unordered pair, whether they are EQUIVALENT-DIVERSITY (same intent,
// reworded) or GENUINE-DISAGREEMENT (they propose different things). The PURE core (./equivalence.ts)
// folds the per-pair verdicts into a classification + score, printed BESIDE the existing dispersion
// number (./consistency.ts) — AC#2.
//
// NOT unit-tested (house rule, exactly as ./run-consistency-probe.ts and ./run-probe.ts: the impure
// verbs — `castPlay`, `dispense`, fs, seeding — are proven live; their judgment is the tested pure
// core, ./equivalence.ts + equivalence.test.ts). This file is the judge instrument, not part of the
// everyday `vend` surface.
//
// TWO INVARIANTS (inherited from ./run-consistency-probe.ts):
//  1. NO LEDGER POLLUTION — every cast's `runLogPath` points into the temp root, so the real
//     `.vend/runs.jsonl` is never touched. The judge cast writes nothing (it only reads outputs).
//  2. NO COLLISION — output dirs are cleared before each cast so a fresh board can materialize.
//
// The seeding/collection helpers + the per-play targets are COPIED from ./run-consistency-probe.ts,
// not imported (the self-contained-instrument idiom + AC#3: the cited consistency-probe path must
// stay byte-for-byte unchanged — importing would convert that instrument into a library). Trimmed to
// the three articulation plays the judge classifies (decompose is the gated-vs-ungated probe's
// subject, out of scope here).

import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Budget } from "../budget/budget.ts";
import { timeoutMsFor } from "../budget/budget.ts";
import { castPlay, type RunSummary } from "../engine/cast.ts";
import { dispense } from "../executor/claude.ts";
import type { AnyPlay } from "../engine/play.ts";
import { CHARTER_PATH } from "../play/project-context.ts";
// Value-import the targetable plays so they self-register and their assembly verbs resolve here.
import { surveyPlay, assembleSurveyInputs } from "../play/survey.ts";
import { expandFragmentPlay, assembleExpandFragmentInputs } from "../play/expand-fragment.ts";
import { steerProjectPlay, assembleSteerInputs } from "../play/steer.ts";
import { consistencyReport, formatConsistencyReport, type ProbeOutcome, type ProbeResult } from "./consistency.ts";
import {
  classifyEquivalence,
  formatEquivalenceReport,
  type EquivalenceVerdict,
} from "./equivalence.ts";
import {
  classifyHeadStability,
  formatHeadStabilityReport,
  headVerdictsFromExactMatch,
  topPick,
} from "./head-stability.ts";

/** Casts per sweep, default. Overridable via the CLI `N` arg. */
const RUNS_DEFAULT = 5;

/** The expand-side fixed fragment, reused as the default when no `[fragment.md]` is passed — the
 *  grounded negative-control sibling the consistency probe already pins (T-019-02). */
const GROUNDED_FRAGMENT_PATH = "docs/active/work/T-019-02/fixtures/grounded-fragment.txt";

// ── the judge target (trimmed ProbeTarget — survey / expand / steer) ─────────────────────────────

/**
 * A play-parametric judge target — the survey/expand/steer subset of
 * ./run-consistency-probe.ts's `ProbeTarget`. Each knows how to seed its fixed input into a temp
 * root, assemble the play's typed inputs, name the run-log subject, which dirs to clear+collect,
 * and how to tell an honest abstention from a real signal.
 */
interface JudgeTarget {
  readonly play: AnyPlay;
  readonly seed: (root: string) => Promise<void>;
  readonly assemble: (root: string) => Promise<unknown>;
  readonly subject: (root: string) => string;
  readonly outputDirs: readonly string[];
  readonly isAbstention: (output: string | null) => boolean;
  /** Pull a board-shaped output's #1 ranked pull for the head-stability read (T-023-01), or `null`
   *  when nothing is staged. Set ONLY for the board-shaped plays (survey + steer, identical board
   *  shape); left undefined for expand (one signal, no ranked head) so the head pass skips it. */
  readonly extractHead?: (output: string) => string | null;
}

/** Run `lisa init` in the temp root so each play's effect-stage `lisa validate` has the structure
 *  it requires. COPIED from ./run-consistency-probe.ts. */
async function initLisaProject(root: string): Promise<void> {
  const proc = Bun.spawn(["lisa", "init"], { cwd: root, stdout: "pipe", stderr: "pipe" });
  const code = await proc.exited;
  if (code !== 0) {
    const err = (await new Response(proc.stderr).text()).trim();
    throw new Error(`lisa init failed in temp root (exit ${code}): ${err}`);
  }
}

/** Make a disposable temp root and `lisa init` it. COPIED from ./run-consistency-probe.ts. */
async function seedTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "vend-equivalence-"));
  await initLisaProject(root);
  return root;
}

/** Copy the live charter to the path the assembly verbs read. COPIED from ./run-consistency-probe.ts. */
async function seedCharter(root: string, srcRoot: string = process.cwd()): Promise<void> {
  const charterDst = join(root, CHARTER_PATH);
  await mkdir(join(charterDst, ".."), { recursive: true });
  await cp(join(srcRoot, CHARTER_PATH), charterDst);
}

/** Copy the live board (stories + tickets) so a play reading the demand gradient / id space sees a
 *  fixed input across every cast of one sweep. COPIED from ./run-consistency-probe.ts. */
async function seedBoardSnapshot(root: string, srcRoot: string = process.cwd()): Promise<void> {
  for (const dir of ["docs/active/stories", "docs/active/tickets"]) {
    try {
      await cp(join(srcRoot, dir), join(root, dir), { recursive: true });
    } catch {
      // absent at the source ⇒ the play reads an emptier board; still a valid fixed input.
    }
  }
}

/** Read+concat every `*.md` the effect materialized under the given dirs, sorted for determinism.
 *  Returns `null` when nothing landed. COPIED from ./run-consistency-probe.ts. */
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

// ── the targets (the three articulation plays) — COPIED from ./run-consistency-probe.ts ───────────

/** Survey: the fixed input is the real charter + a grounded board snapshot. Its empty case CLEARS
 *  and stages a "no demand staged" note, so its abstention test keys on that marker, not emptiness. */
function surveyTarget(): JudgeTarget {
  return {
    play: surveyPlay,
    seed: async (root) => {
      await seedCharter(root);
      await seedBoardSnapshot(root);
    },
    assemble: (root) => assembleSurveyInputs({ projectRoot: root, budget: surveyPlay.budget }),
    subject: (root) => `survey of ${basename(root)}`,
    outputDirs: ["docs/active/pm/staged"],
    isAbstention: (output) => output === null || output.includes("no demand staged"),
    extractHead: (output) => topPick(output),
  };
}

/** Expand-fragment: the fixed input is a GROUNDED fragment STRING cast against the real charter +
 *  the live board's id space. Expand abstains by STOPPING (a non-success outcome), so the default
 *  abstention test suffices. */
function expandTarget(fragment: string): JudgeTarget {
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
    isAbstention: (output) => output === null || output.trim().length === 0,
  };
}

/** Steer: the fixed input is the real charter + the live board snapshot. Like survey, its empty
 *  case materializes a marker note, so its abstention test keys on that marker. */
function steerTarget(): JudgeTarget {
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
    extractHead: (output) => topPick(output), // steer shares the survey board's `vend chain` shape
  };
}

/** Resolve the CLI play name to a {@link JudgeTarget}, or `null` if unsupported. Expand reads an
 *  optional `[fragment.md]` (defaulting to the pinned grounded fragment); survey + steer ignore it. */
async function resolveTarget(playName: string, srcFragmentPath: string | undefined): Promise<JudgeTarget | null> {
  switch (playName) {
    case "survey":
      return surveyTarget();
    case "expand":
    case "expand-fragment": {
      const path = srcFragmentPath ?? join(process.cwd(), GROUNDED_FRAGMENT_PATH);
      return expandTarget((await readFile(path, "utf8")).trim());
    }
    case "steer":
      return steerTarget();
    default:
      return null;
  }
}

/** The supported judge-target names — the three articulation plays the judge classifies. */
const SUPPORTED = ["survey", "expand", "steer"] as const;

/** Classify one cast into a {@link ProbeOutcome} (COPIED from ./run-consistency-probe.ts) so the
 *  judge can reuse ./consistency.ts's dispersion read for the "beside the dispersion number" print. */
function classifyRun(summary: RunSummary, output: string | null, target: JudgeTarget): ProbeOutcome {
  if (summary.outcome !== "success") return "budget-exhausted";
  return target.isAbstention(output) ? "honest-empty" : "signal";
}

/** Cast the target N× on its fixed seeded input, classifying + collecting each output. Trimmed from
 *  ./run-consistency-probe.ts's `castN` (no raw-outcome tally — the dispersion read is enough here). */
async function castN(root: string, target: JudgeTarget, n: number, budget: Budget): Promise<ProbeResult[]> {
  const runLogPath = join(root, ".vend", "runs.jsonl");
  const subject = target.subject(root);
  const results: ProbeResult[] = [];
  for (let i = 1; i <= n; i++) {
    for (const dir of target.outputDirs) await rm(join(root, dir), { recursive: true, force: true });
    const inputs = await target.assemble(root);
    const summary = await castPlay(target.play, inputs, budget, {
      subject,
      projectRoot: root,
      runLogPath,
      runId: `equivalence-${target.play.name}-${i}`,
    });
    const output = await collectOutput(root, target.outputDirs);
    const outcome = classifyRun(summary, output, target);
    results.push({ outcome, output });
    process.stdout.write(`  ${target.play.name} ${i}/${n}: ${summary.outcome} → ${outcome}\n`);
  }
  return results;
}

// ── the judge cast (the new impure verb) ─────────────────────────────────────────────────────────

/** Build the judge prompt: present each output labelled by index, then ask for a per-unordered-pair
 *  equivalence JSON array. The definitions are spelled out so the judgment is the ticket's, not the
 *  model's improvisation. */
function buildJudgePrompt(outputs: readonly string[]): string {
  const labelled = outputs
    .map((o, idx) => `### OUTPUT ${idx}\n${o.trim()}`)
    .join("\n\n");
  return [
    "You are a SEMANTIC-EQUIVALENCE JUDGE for an AI agent's repeated runs on a FIXED input.",
    "Below are N outputs the same play produced. They differ in wording. Your job is to decide, for",
    "EACH unordered pair (i, j) with i < j, whether the two outputs are:",
    "  • EQUIVALENT-DIVERSITY — they express the SAME intent / propose the SAME work, just worded",
    "    differently (acceptable variation); OR",
    "  • GENUINE-DISAGREEMENT — they propose DIFFERENT things (a real inconsistency).",
    "",
    "Judge MEANING, not surface form: different ordering, phrasing, or formatting of the same",
    "proposed work is EQUIVALENT. A different set of proposed items, scopes, or decisions is a",
    "DISAGREEMENT.",
    "",
    `There are ${outputs.length} outputs (indices 0..${outputs.length - 1}).`,
    "",
    labelled,
    "",
    "Respond with ONLY a JSON array, one object per unordered pair, no prose:",
    '[{"i":0,"j":1,"equivalent":true,"reason":"<one short phrase>"}, ...]',
  ].join("\n");
}

/** Tolerantly parse the judge's reply into per-pair verdicts. Extracts the first JSON array, coerces
 *  each entry, and DROPS anything malformed or out of range (the `parseStreamJsonLine` tolerate-noise
 *  discipline). `n` bounds the valid index range. */
function parseVerdicts(reply: string, n: number): EquivalenceVerdict[] {
  const start = reply.indexOf("[");
  const end = reply.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const out: EquivalenceVerdict[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const i = Number(rec.i);
    const j = Number(rec.j);
    if (!Number.isInteger(i) || !Number.isInteger(j)) continue;
    if (i < 0 || j < 0 || i >= n || j >= n || i >= j) continue; // unordered, in range
    const key = `${i}-${j}`;
    if (seen.has(key)) continue; // first verdict per pair wins
    seen.add(key);
    const equivalent = rec.equivalent === true;
    const reason = typeof rec.reason === "string" ? rec.reason : undefined;
    out.push(reason !== undefined ? { i, j, equivalent, reason } : { i, j, equivalent });
  }
  return out;
}

/** Cast the judge over the collected outputs: dispense the judge prompt under the budget's
 *  wall-clock, parse the reply into per-pair verdicts. LIVE + metered (the dispense seam). */
async function judgeEquivalence(outputs: readonly string[], budget: Budget): Promise<EquivalenceVerdict[]> {
  if (outputs.length < 2) return []; // nothing to compare — the pure core reads this as vacuous
  const result = await dispense({
    prompt: buildJudgePrompt(outputs),
    timeoutMs: timeoutMsFor(budget),
  });
  return parseVerdicts(result.result ?? "", outputs.length);
}

// ── the sweep ────────────────────────────────────────────────────────────────────────────────────

/** Resolve the target, seed, cast N×, print the dispersion read, then cast the judge over the signal
 *  outputs and print its classification BESIDE the dispersion (AC#2). */
async function main(playName: string, srcFragmentPath: string | undefined, n: number, tokenBudget?: number): Promise<void> {
  const target = await resolveTarget(playName, srcFragmentPath);
  if (!target) {
    process.stderr.write(`unsupported play "${playName}" — supported: ${SUPPORTED.join(", ")}\n`);
    process.exit(2);
  }

  const root = await seedTempRoot();
  await target.seed(root);
  const budget: Budget = { ...target.play.budget, ...(tokenBudget ? { tokens: tokenBudget } : {}) };

  process.stdout.write(`equivalence judge — ${n}× ${playName} on a fixed input, then a per-pair judge cast\n`);
  process.stdout.write(`(temp root: ${root} — ledger + board are disposable; per-cast tokens: ${budget.tokens})\n`);

  const results = await castN(root, target, n, budget);

  // The existing dispersion read (./consistency.ts) — the number the judge classification sits beside.
  const report = consistencyReport(results);
  process.stdout.write(`\n${formatConsistencyReport(report)}\n`);

  // The judge: cast over the SIGNAL outputs (the ones the dispersion measures), classify the meaning.
  const signalOutputs = results
    .filter((r): r is ProbeResult & { output: string } => r.outcome === "signal" && r.output !== null)
    .map((r) => r.output);
  const verdicts = await judgeEquivalence(signalOutputs, budget);
  const equivalence = classifyEquivalence(verdicts, signalOutputs.length);
  process.stdout.write(`${formatEquivalenceReport(equivalence)}\n`);

  // The HEAD read (T-023-01): for board-shaped plays, isolate each board's #1 pull and classify
  // whether the LOAD-BEARING head is stable across the casts — INDEPENDENTLY of tail order (the
  // head-vs-tail caveat work/T-022-02/findings.md raised). Printed BESIDE the whole-board reads
  // above (AC#2). Additive — everything above is unchanged (AC#3).
  if (target.extractHead) {
    const heads = signalOutputs
      .map(target.extractHead)
      .filter((h): h is string => h !== null);
    // The deterministic LEXICAL baseline — surface-form identity of the #1 pull (no judge cast).
    const lexical = classifyHeadStability(headVerdictsFromExactMatch(heads), heads.length);
    process.stdout.write(`${formatHeadStabilityReport(lexical)}  [lexical exact-match]\n`);
    // The SEMANTIC head read — the authoritative one (two #1 picks reworded can be the same pull,
    // IA-17): reuse the equivalence judge over JUST the heads, classify with the same core.
    const headVerdicts = await judgeEquivalence(heads, budget);
    const semantic = classifyHeadStability(headVerdicts, heads.length);
    process.stdout.write(`${formatHeadStabilityReport(semantic)}  [semantic judge]\n`);
  }
}

if (import.meta.main) {
  const playName = Bun.argv[2];
  if (!playName) {
    process.stderr.write(
      `usage: bun run src/probe/run-equivalence-judge.ts <play-name> [fragment.md] [N] [tokenBudget]\n` +
        `supported plays: ${SUPPORTED.join(", ")} (expand takes an optional <fragment.md>)\n`,
    );
    process.exit(2);
  }
  // expand takes an optional positional fragment before N; survey/steer take none, so their first
  // numeric positional is N. Detect: if argv[3] is a number, it is N (no fragment file).
  const a3 = Bun.argv[3];
  const inputIsNumeric = a3 !== undefined && /^\d+$/.test(a3);
  const srcFragmentPath = inputIsNumeric ? undefined : a3;
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
  await main(playName, srcFragmentPath, n, tokenBudget);
  process.exit(0);
}
