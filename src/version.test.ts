import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "./cli.ts";
import { VERSION } from "./version.ts";

// T-061-02 version-command-embeds-semver (story S-061, epic E-061). The AC has two
// clauses, each proven here:
//   (1) `vend --version` prints the package.json semver (not 0.0.0), and
//   (2) it still resolves when run from a COMPILED binary with no node_modules.
//
// Clause 1 is unit-testable (the embedded constant + the pure parse + the wired CLI
// surface). Clause 2 is the substance: it can only be proven by actually running
// `bun build --compile` and executing the artifact where no package.json is on disk —
// so the integration test below compiles a tiny harness around `version.ts` (the same
// module the CLI consumes) and runs it from an empty cwd. The harness is BAML-free, so
// the compile is ~0.1s rather than dragging the executor graph through `--compile`.

/** The repo-root manifest, read at RUNTIME (the packaging.test.ts idiom) — no JSON
 *  import in the test itself, so the assertion compares the embed against the file on
 *  disk independently of how `version.ts` obtained it. */
const pkg = JSON.parse(await Bun.file(join(import.meta.dir, "..", "package.json")).text());

/** Absolute path to the CLI entry (this file is src/, the CLI is src/cli.ts). */
const CLI = join(import.meta.dir, "cli.ts");
/** Absolute path to the embed module the compiled-binary harness imports verbatim. */
const VERSION_MODULE = join(import.meta.dir, "version.ts");

describe("VERSION embed (T-061-02)", () => {
  test("equals the manifest version — a real semver, not the 0.0.0 placeholder", () => {
    expect(VERSION).toBe(pkg.version);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(VERSION).not.toBe("0.0.0");
  });
});

describe("parseArgs --version (T-061-02)", () => {
  test("`--version` parses to the version command", () => {
    expect(parseArgs(["--version"])).toEqual({ cmd: "version" });
  });
  test("`--version` short-circuits — trailing tokens are ignored", () => {
    expect(parseArgs(["--version", "extra", "junk"])).toEqual({ cmd: "version" });
  });
  test("the interception is specific — an unknown flag is still a usage error", () => {
    expect(parseArgs(["--nope"])).toEqual({ cmd: "usage", error: "unknown command: --nope" } as never);
  });
});

describe("vend --version — wired CLI surface (T-061-02)", () => {
  // The dispatch arm lives behind `import.meta.main` (the thin untested shell by house
  // convention); its print-and-exit can only be observed by running the real CLI. Same
  // approach as doctor-cli.smoke.test.ts.
  test("`bun run src/cli.ts --version` prints the semver and exits 0", () => {
    const r = Bun.spawnSync(["bun", "run", CLI, "--version"]);
    expect(r.exitCode).toBe(0);
    expect(r.stdout.toString().trim()).toBe(VERSION);
  });
});

describe("compiled-binary survival — the AC's no-node_modules clause (T-061-02)", () => {
  // Compile a minimal harness that imports ONLY `version.ts`, then run it from an empty
  // dir with no node_modules and no package.json. If the embed mechanism ever regressed
  // (e.g. a future Bun stopped inlining imported JSON into `--compile`), THIS fails —
  // it is the canary for the whole ticket. Generous timeout so a cold compile can't flake.
  test(
    "`bun build --compile` embeds the version; the binary reports it with no node_modules",
    async () => {
      const work = await mkdtemp(join(tmpdir(), "vend-version-compile-"));
      const runDir = await mkdtemp(join(tmpdir(), "vend-version-run-"));
      try {
        // Harness imports the real embed module by absolute path; its own `../package.json`
        // relative import is resolved (and inlined) by the bundler at compile time.
        const harness = join(work, "harness.ts");
        const bin = join(work, "vend-version-bin");
        await writeFile(harness, `import { VERSION } from ${JSON.stringify(VERSION_MODULE)};\nconsole.log(VERSION);\n`);

        const build = Bun.spawnSync(["bun", "build", "--compile", harness, "--outfile", bin]);
        expect(build.exitCode).toBe(0);

        // Run from a dir guaranteed to have no node_modules / no package.json on disk —
        // so a passing assertion can only mean the value was embedded, not read.
        const run = Bun.spawnSync([bin], { cwd: runDir });
        expect(run.exitCode).toBe(0);
        expect(run.stdout.toString().trim()).toBe(VERSION);
      } finally {
        await rm(work, { recursive: true, force: true });
        await rm(runDir, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
