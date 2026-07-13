// The completed-cast diff capture (T-073-01-01). This is deliberately an IMPURE shell:
// castPlay decides when an effect landed, while this module asks Git for the patch over the
// effect's declared artifacts and persists that evidence under .vend. It never stages files or
// changes the caller's index. New, untracked artifacts need the explicit no-index arm because an
// ordinary git diff HEAD omits them.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface CaptureEffectDiffInput {
  readonly projectRoot: string;
  readonly runId: string;
  readonly artifacts?: readonly string[];
}

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

function commandFailure(args: readonly string[], result: CommandResult): Error {
  const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
  return new Error(`git ${args.join(" ")} failed: ${detail}`);
}

/** Convert reported artifact paths into stable Git pathspecs, excluding anything outside root. */
function artifactPaths(root: string, artifacts: readonly string[] | undefined): readonly string[] {
  const seen = new Set<string>();
  for (const artifact of artifacts ?? []) {
    if (typeof artifact !== "string" || artifact.length === 0) continue;
    const absolute = isAbsolute(artifact) ? resolve(artifact) : resolve(root, artifact);
    const path = relative(root, absolute);
    if (path.length === 0 || path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path)) continue;
    seen.add(path);
  }
  return [...seen];
}

async function isTracked(root: string, path: string): Promise<boolean> {
  const args = ["ls-files", "--error-unmatch", "--", path] as const;
  const result = await runGit(root, args);
  if (result.exitCode === 0) return true;
  if (result.exitCode === 1) return false;
  throw commandFailure(args, result);
}

async function trackedPatch(root: string, paths: readonly string[]): Promise<string> {
  if (paths.length === 0) return "";
  const args = ["diff", "--binary", "--no-color", "--no-ext-diff", "HEAD", "--", ...paths] as const;
  const result = await runGit(root, args);
  if (result.exitCode !== 0) throw commandFailure(args, result);
  return result.stdout;
}

async function untrackedPatch(root: string, path: string): Promise<string> {
  const args = ["diff", "--binary", "--no-color", "--no-ext-diff", "--no-index", "--", "/dev/null", path] as const;
  const result = await runGit(root, args);
  // git diff --no-index uses 1 to report that it found the useful difference.
  if (result.exitCode !== 0 && result.exitCode !== 1) throw commandFailure(args, result);
  return result.stdout;
}

/**
 * Persist the non-empty working-tree patch for one successful effect's reported artifacts.
 * Returns a repository-relative reference, or undefined when the effect reported no changed
 * artifacts. Unexpected Git/filesystem failures propagate: silently losing review evidence would
 * make a completed run look reviewable when it is not.
 */
export async function captureEffectDiff(input: CaptureEffectDiffInput): Promise<string | undefined> {
  const root = resolve(input.projectRoot);
  const paths = artifactPaths(root, input.artifacts);
  if (paths.length === 0) return undefined;

  // Vend is local-first rather than Git-required. Existing casts in plain directories retain
  // their pre-capture behavior; only a real worktree can supply the Git artifact this gate needs.
  const worktree = await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
  if (worktree.exitCode !== 0 || worktree.stdout.trim() !== "true") return undefined;

  const tracked: string[] = [];
  const untracked: string[] = [];
  for (const path of paths) {
    (await isTracked(root, path) ? tracked : untracked).push(path);
  }

  const segments = [await trackedPatch(root, tracked)];
  for (const path of untracked) segments.push(await untrackedPatch(root, path));
  const patch = segments.filter((segment) => segment.length > 0).join("\n");
  if (patch.length === 0) return undefined;

  const safeRunId = input.runId.replace(/[^A-Za-z0-9._-]/g, "-");
  const reference = join(".vend", "artifacts", `${safeRunId}.diff`);
  const destination = join(root, reference);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, patch, "utf8");
  return reference;
}
