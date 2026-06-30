// `bun run compile` entry (T-062-02) — produce the single self-contained `vend` binary via
// `bun build --compile` for the PINNED target. The thin IMPURE shell: it reads the pin file,
// shells out to `bun build`, writes to stdout/stderr, and exits the process — delegating ALL
// judgment (parse, required-key, argv) to the pure core (compile-core.ts). Mirrors src/ci/*.ts
// (e.g. check-committed.ts): smoke-only, not unit-tested — its observable contract is covered by
// compile.smoke.test.ts.
//
// THE SSOT RULE (.github/release-target.env header): the target is read BY KEY from the pin —
// this script hard-codes NO triple. Adding platforms later is a pin edit, not a code edit.
//
// EXIT CODES (cf. cli.ts / check-committed.ts): 0 = built (wrote the binary); 1 = the `bun build`
// compile failed; 2 = environment/precondition error (not a git repo / no pin file / missing key).

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CLI_ENTRY, compileArgv, DEFAULT_OUTFILE, parseReleaseTarget, PIN_PATH, REQUIRED_KEY, requireKey } from "./compile-core.ts";

if (import.meta.main) {
  // Resolve the repo root so `bun run compile` is correct regardless of cwd (the check-committed
  // idiom). A non-repo cwd is an environment error, not a build failure.
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) {
    process.stderr.write(`compile: not a git repository (${top.stderr.toString().trim()})\n`);
    process.exit(2);
  }
  const root = top.stdout.toString().trim();

  // Read + parse the SSOT pin; a missing file or key is a clean precondition refusal (exit 2),
  // never a silent fall-back to a literal triple.
  const pinFile = Bun.file(join(root, PIN_PATH));
  if (!(await pinFile.exists())) {
    process.stderr.write(`compile: missing ${PIN_PATH} — the release target pin (T-062-01) is absent\n`);
    process.exit(2);
  }
  let target: string;
  try {
    target = requireKey(parseReleaseTarget(await pinFile.text()), REQUIRED_KEY);
  } catch (e) {
    process.stderr.write(`compile: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  const entry = join(root, CLI_ENTRY);
  const outfile = join(root, DEFAULT_OUTFILE);
  await mkdir(join(root, "dist"), { recursive: true });

  // Compile. Inherit stdio so bun's own bundle/compile progress streams straight through.
  process.stdout.write(`compile: building ${DEFAULT_OUTFILE} for ${target} …\n`);
  const build = Bun.spawnSync(compileArgv({ target, entry, outfile }), { stdout: "inherit", stderr: "inherit" });
  if (build.exitCode !== 0) {
    process.stderr.write(`compile: \`bun build --compile\` failed (exit ${build.exitCode})\n`);
    process.exit(1);
  }

  const sizeMb = (Bun.file(outfile).size / (1024 * 1024)).toFixed(0);
  process.stdout.write(`compile: ok — wrote ${DEFAULT_OUTFILE} (${sizeMb} MB) for ${target}\n`);
  process.exit(0);
}
