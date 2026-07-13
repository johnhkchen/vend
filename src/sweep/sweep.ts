// The IMPURE sweep shell (S-079-02): observe one current board + Git snapshot, delegate all
// eligibility/path/message judgment to sweep-core, present that assembly, and only after the
// operator's one-keystroke consent apply and commit the exact epic-card pathspec. No executor,
// budget, run ledger, or archive operation belongs on this free closeout path.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { classifySweep, donePhaseIds } from "../ci/presweep-core.ts";
import { loadWorkGraph } from "../graph/load.ts";
import { parseFrontmatter } from "../graph/model.ts";
import {
  computeSweep,
  type EpicFrontmatterFlip,
  type SweepFlipSet,
  type SweepRefusal,
  type SweepResult,
} from "./sweep-core.ts";

interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

async function runGit(root: string, args: readonly string[]): Promise<CommandResult> {
  const process = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

function gitFailure(args: readonly string[], result: CommandResult): Error {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
  return new Error(`git ${args.join(" ")} failed: ${detail}`);
}

async function requireGit(root: string, args: readonly string[]): Promise<CommandResult> {
  const result = await runGit(root, args);
  if (result.exitCode !== 0) throw gitFailure(args, result);
  return result;
}

/** A selected epic card no longer has the exact identity/state the prepared flip described. */
export class SweepApplyError extends Error {
  constructor(path: string, detail: string) {
    super(`sweep apply ${path}: ${detail}`);
    this.name = "SweepApplyError";
  }
}

/**
 * Apply one checked status transition to the leading YAML frontmatter while preserving every other
 * byte. PURE. The graph parser supplies semantic identity/state checks; the line scan supplies the
 * narrower write contract (one top-level status key, body never searched or reconstructed).
 */
export function renderEpicStatusFlip(contents: string, flip: EpicFrontmatterFlip): string {
  const frontmatter = /^(---(?:\r?\n))([\s\S]*?)(\r?\n---(?:\r?\n|$))/.exec(contents);
  if (frontmatter === null) {
    throw new SweepApplyError(flip.path, "missing leading fenced frontmatter");
  }

  // The canonical graph parser expects LF fences. Normalize only its validation copy; the byte
  // rewrite below still operates on `contents`, preserving a CRLF card outside the changed scalar.
  const parsed = parseFrontmatter(contents.replaceAll("\r\n", "\n"), flip.path);
  if (parsed.data["id"] !== flip.epicId) {
    throw new SweepApplyError(
      flip.path,
      `expected id ${flip.epicId}, observed ${JSON.stringify(parsed.data["id"])}`,
    );
  }
  if (parsed.data["status"] !== flip.from) {
    throw new SweepApplyError(
      flip.path,
      `expected status ${JSON.stringify(flip.from)}, observed ${JSON.stringify(parsed.data["status"])}`,
    );
  }

  const yaml = frontmatter[2] as string;
  const statusLines = [...yaml.matchAll(/(^|\r?\n)status:[^\r\n]*(?=\r?\n|$)/g)];
  if (statusLines.length !== 1) {
    throw new SweepApplyError(
      flip.path,
      `expected exactly one top-level status field, observed ${statusLines.length}`,
    );
  }

  const rewrittenYaml = yaml.replace(
    /(^|\r?\n)status:[^\r\n]*(?=\r?\n|$)/,
    "$1status: done",
  );
  return `${frontmatter[1]}${rewrittenYaml}${frontmatter[3]}${contents.slice(frontmatter[0].length)}`;
}

export interface PrepareSweepOptions {
  readonly root?: string;
}

/** Observe the board and presweep facts and return the authoritative pure assembly. No writes. */
export async function prepareSweep(options: PrepareSweepOptions = {}): Promise<SweepResult> {
  const root = options.root ?? process.cwd();
  const graph = await loadWorkGraph({ root });
  const status = await requireGit(root, ["status", "--porcelain"]);
  const presweep = classifySweep({
    doneIds: donePhaseIds(graph.tickets),
    porcelain: status.stdout,
  });
  return computeSweep({ graph, presweep });
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

interface PreparedCard {
  readonly path: string;
  readonly original: string;
  readonly replacement: string;
}

async function restoreAfterFailedCommit(
  root: string,
  cards: readonly PreparedCard[],
  pathspec: readonly string[],
): Promise<string | null> {
  const failures: string[] = [];
  for (const card of cards) {
    try {
      await writeFile(join(root, card.path), card.original, "utf8");
    } catch (error) {
      failures.push(`${card.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const reset = await runGit(root, ["reset", "--quiet", "HEAD", "--", ...pathspec]);
  if (reset.exitCode !== 0) failures.push(gitFailure(["reset", "--quiet", "HEAD", "--", ...pathspec], reset).message);
  return failures.length === 0 ? null : failures.join("; ");
}

export interface CommitSweepOptions {
  readonly root?: string;
}

/** Apply and commit one already-presented core plan, returning the landed commit SHA. */
export async function commitSweep(
  plan: SweepFlipSet,
  options: CommitSweepOptions = {},
): Promise<string> {
  const root = options.root ?? process.cwd();
  const flipPaths = plan.flips.map((flip) => flip.path);
  if (plan.flips.length === 0 || !sameStrings(plan.pathspec, flipPaths)) {
    throw new SweepApplyError("<plan>", "pathspec must exactly equal the non-empty ordered flip paths");
  }

  // Validate and render every selected card before the first write. A malformed/stale later card
  // cannot leave an earlier card partially swept.
  const cards: PreparedCard[] = [];
  for (const flip of plan.flips) {
    const original = await readFile(join(root, flip.path), "utf8");
    const replacement = renderEpicStatusFlip(original, flip);
    if (replacement === original) {
      throw new SweepApplyError(flip.path, "status flip produced no byte change");
    }
    cards.push({ path: flip.path, original, replacement });
  }

  const attempted: PreparedCard[] = [];
  let committed = false;
  try {
    for (const card of cards) {
      attempted.push(card);
      await writeFile(join(root, card.path), card.replacement, "utf8");
    }

    await requireGit(root, ["add", "--", ...plan.pathspec]);
    await requireGit(root, ["commit", "--only", "-m", plan.message, "--", ...plan.pathspec]);
    committed = true;
    const head = await requireGit(root, ["rev-parse", "HEAD"]);
    return head.stdout.trim();
  } catch (error) {
    if (committed) throw error;
    const rollback = await restoreAfterFailedCommit(root, attempted, plan.pathspec);
    const primary = error instanceof Error ? error.message : String(error);
    throw new Error(rollback === null ? primary : `${primary}; rollback failed: ${rollback}`);
  }
}

/** Render the exact assembly the operator is consenting to. PURE. */
export function renderSweepPlan(plan: SweepFlipSet): string {
  return [
    "sweep",
    "files:",
    ...plan.pathspec.map((path) => `  ${path}`),
    "message:",
    plan.message,
  ].join("\n") + "\n";
}

/** Render one named core refusal without inventing a successful assembly. PURE. */
export function renderSweepRefusal(refusal: SweepRefusal): string {
  const lines = [`sweep refusal [${refusal.code}]: ${refusal.reason}`];
  if (refusal.code === "presweep-offenders") {
    lines.push("offenders:", ...refusal.offenders.map((path) => `  ${path}`));
  }
  lines.push(`next: ${refusal.nextAction}`);
  return `${lines.join("\n")}\n`;
}

/** Read exactly the first available input byte; only y/Y is consent. Enter is not required. */
export async function readSweepConfirmation(input: typeof process.stdin = process.stdin): Promise<boolean> {
  const wasRaw = input.isRaw;
  const useRawMode = input.isTTY && typeof input.setRawMode === "function";
  if (useRawMode) input.setRawMode(true);
  input.resume();

  try {
    return await new Promise<boolean>((resolve, reject) => {
      const onData = (chunk: Buffer | string) => finish(chunk.toString().slice(0, 1).toLowerCase() === "y");
      const onEnd = () => finish(false);
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const cleanup = () => {
        input.removeListener("data", onData);
        input.removeListener("end", onEnd);
        input.removeListener("error", onError);
      };
      const finish = (confirmed: boolean) => {
        cleanup();
        resolve(confirmed);
      };

      input.once("data", onData);
      input.once("end", onEnd);
      input.once("error", onError);
    });
  } finally {
    input.pause();
    if (useRawMode) input.setRawMode(wasRaw ?? false);
  }
}
