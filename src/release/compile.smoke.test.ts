import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileArgv, parseReleaseTarget, PIN_PATH, requireKey } from "./compile-core.ts";
import { VERSION } from "../version.ts";

// T-062-02 compile-self-contained-binary (story S-062, epic E-061) — the AC, OBSERVED.
//
//   > On a directory with no node_modules/checkout, the compiled binary runs `vend --version`
//   > (real semver) and exercises a BAML-backed path proving the native addon loads.
//
// This is an integration claim, so it is discharged by actually compiling the REAL `src/cli.ts`
// for the pinned target (read from the live pin, not a literal) and running the artifact from a
// freshly-made empty dir — no node_modules, no package.json, no repo. Two observations:
//   (1) `vend --version` prints a real semver equal to the embedded VERSION (T-061-02), and
//   (2) `vend doctor` prints `✓ BAML native addon loadable` — the app's own PATH-independent
//       proof that BAML's native .node addon dlopen'd from inside the single-file binary.
//
// It also stands as the CANARY for the whole ticket: if a future Bun/BAML stops auto-embedding
// the native addon into `--compile` output, observation (2) reds and the gate catches it.
//
// NON-FLAKY: observation (2) asserts the BAML LINE, never `doctor`'s exit code — on a CI box
// without lisa/claude on PATH that exit is 1 though BAML still loaded (the doctor-cli.smoke.test
// invariant discipline). The compile happens ONCE in beforeAll; the binary + an empty run dir are
// mkdtemp'd and rm-cleaned. Generous timeout so a cold compile (45 MB addon read + ~103 MB write)
// can't flake.

const root = join(import.meta.dir, "..", "..");
const CLI_ENTRY_ABS = join(root, "src", "cli.ts");

let workDir: string; // holds the compiled binary
let emptyRunDir: string; // the no-node_modules/no-package.json cwd the AC requires
let bin: string;

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "vend-compile-"));
  emptyRunDir = await mkdtemp(join(tmpdir(), "vend-emptyrun-"));
  bin = join(workDir, "vend");

  // Compile the SHIPPED entry for the SHIPPED target — read the live pin by key (no literal).
  const target = requireKey(parseReleaseTarget(await Bun.file(join(root, PIN_PATH)).text()), "BUN_COMPILE_TARGET");
  const argv = compileArgv({ target, entry: CLI_ENTRY_ABS, outfile: bin });
  const build = Bun.spawnSync(argv, { cwd: root });
  if (build.exitCode !== 0) {
    throw new Error(`bun build --compile failed (exit ${build.exitCode}): ${build.stderr.toString()}`);
  }
}, 90_000);

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
  await rm(emptyRunDir, { recursive: true, force: true });
});

describe("compiled vend binary — self-contained from an empty dir (T-062-02)", () => {
  test("`vend --version` prints the real embedded semver", () => {
    // cwd is an empty mkdtemp dir: no node_modules, no package.json — so a passing assertion can
    // only mean the value was EMBEDDED (T-061-02), not read off disk.
    const r = Bun.spawnSync([bin, "--version"], { cwd: emptyRunDir });
    expect(r.exitCode).toBe(0);
    const printed = r.stdout.toString().trim();
    expect(printed).toBe(VERSION);
    expect(printed).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
    expect(printed).not.toBe("0.0.0");
  });

  test("`vend doctor` proves the native BAML addon loads (PATH-independent line)", () => {
    const r = Bun.spawnSync([bin, "doctor"], { cwd: emptyRunDir });
    // The BAML check imports `@boundaryml/baml` and asserts BamlRuntime is a function; if the
    // .node had failed to dlopen, the import throws and the line reds. A GREEN line is the proof.
    const stdout = r.stdout.toString();
    expect(stdout).toContain("✓ BAML native addon loadable");
    // NOT asserting exit code: lisa/claude may be off PATH on CI → exit 1, but BAML still loaded.
  });
});
