// `bun run acceptance` entry (T-065-01, story S-065, epic E-061) — the fresh-machine
// end-to-end acceptance harness. It closes the AC's install → version → workspace loop on
// the REAL release artifacts and the REAL compiled binary, on a CLEAN machine, and records
// a transcript:
//
//   > A recorded transcript on a fresh arm64-mac with no vend checkout shows:
//   > `brew install johnhkchen/vend/vend` succeeds, `vend --version` is real semver, and
//   > `vend init --template <name>` lays a workspace in an empty dir — no clone, no Doppler.
//
// It does for the WHOLE chain what brew would do for the binary, minus the one thing it
// cannot do from here (resolve the live tap over the network — see RESIDUAL below): verify
// the asset's sha against the formula's, extract it, put `vend` on a clean PATH, and run it
// in a scrubbed, no-checkout environment. The thin IMPURE shell — it spawns, touches the
// filesystem, and prints — delegating every verdict to the pure core (acceptance-core.ts).
// Smoke-tested, not unit-tested (the package.ts idiom): acceptance.smoke.test.ts.
//
// USAGE: bun run src/release/acceptance.ts [distDir] [--out <path>]
//   distDir   where the release artifacts live (default: <repo>/dist).
//   --out     write the transcript here (default: print to stdout).
//
// EXIT CODES (cf. formula.ts): 0 = every clause cleared; 1 = a clause failed; 2 =
// environment/precondition (not a git repo / no pin / missing artifact — run
// `just release-local` first). The live `brew install johnhkchen/vend/vend` resolution is
// NOT exercised — it needs a published release + tap; this harness verifies the bytes that
// line would serve and names the gap. It NEVER publishes a tap or cuts a release.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseReleaseTarget, PIN_PATH, requireKey } from "./compile-core.ts";
import { parseSha256Sums, SHA256SUMS, TARBALL_KEY } from "./release-core.ts";
import { VERSION } from "../version.ts";
import {
  type Clause,
  expectedScaffoldPaths,
  renderTranscript,
  scrubEnv,
  verifyConverge,
  verifyScaffold,
  verifyVersion,
} from "./acceptance-core.ts";

/** The live-tap residual, with the measured prerequisites — the honest handoff section. */
const RESIDUAL = [
  "`brew install johnhkchen/vend/vend` resolves a PUBLISHED release through a live tap.",
  "That cannot run from this repo — and is NOT faked here. As of this run:",
  "",
  "- the `johnhkchen/homebrew-vend` tap repo does not yet exist (git ls-remote → not found),",
  "- the formula's release-asset url 404s (no `v0.1.0` release is published),",
  "- no `v0.1.0` tag exists to fire `.github/workflows/release.yml`.",
  "",
  "Three human-owned prerequisites close it (T-063-01 review): (1) create the",
  "`johnhkchen/homebrew-vend` repo, (2) add a `HOMEBREW_TAP_TOKEN` secret with write access",
  "to it, (3) push a `v0.1.0` tag. The harness above proves the install→version→workspace",
  "loop on the exact bytes that tag would serve — it verifies, it does not publish.",
].join("\n");

if (import.meta.main) {
  // Inline two-flag parse (the formula.ts idiom — two flags do not warrant a tested core).
  const argv = process.argv.slice(2);
  let distArg: string | undefined;
  let outArg: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") outArg = argv[++i];
    else if (a !== undefined && !a.startsWith("-") && distArg === undefined) distArg = a;
  }

  const fail2 = (msg: string): never => {
    process.stderr.write(`acceptance: ${msg}\n`);
    process.exit(2);
  };

  // Resolve the repo root so the run is correct regardless of cwd (the package.ts idiom).
  const top = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
  if (top.exitCode !== 0) fail2(`not a git repository (${top.stderr.toString().trim()})`);
  const root = top.stdout.toString().trim();
  const distDir = distArg ?? join(root, "dist");

  // Read the pin → the asset name (by key, never hard-coded).
  const pinFile = Bun.file(join(root, PIN_PATH));
  if (!(await pinFile.exists())) fail2(`missing ${PIN_PATH} — the release target pin (T-062-01) is absent`);
  let tarball: string;
  try {
    tarball = requireKey(parseReleaseTarget(await pinFile.text()), TARBALL_KEY);
  } catch (e) {
    // Direct exit (not via fail2) so TS's definite-assignment analysis sees the abort —
    // the formula.ts idiom; a helper's `never` is not traced through for assignment here.
    process.stderr.write(`acceptance: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(2);
  }

  // Preconditions: the release artifacts must already be built (the un-gateable boundary —
  // a 107 MB compile is too slow to do in-line; `just release-local` produces all three).
  const tarPath = join(distDir, tarball);
  const sumsPath = join(distDir, SHA256SUMS);
  const formulaPath = join(distDir, "vend.rb");
  for (const [label, p] of [
    ["tarball", tarPath],
    ["sha256sums.txt", sumsPath],
    ["vend.rb", formulaPath],
  ] as const) {
    if (!(await Bun.file(p).exists())) fail2(`no ${label} at ${p} — run \`just release-local\` first`);
  }

  // ── Clause 1: the brew sha gate, on the REAL bytes ────────────────────────────────────
  // tarball's actual sha == the sha recorded in sha256sums.txt == the sha baked into vend.rb.
  let shaClause: Clause;
  let sha = "";
  try {
    const recordedSha = parseSha256Sums(await Bun.file(sumsPath).text(), tarball);
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(new Uint8Array(await Bun.file(tarPath).arrayBuffer()));
    const actualSha = hasher.digest("hex");
    const formulaSha = /[0-9a-f]{64}/.exec(await Bun.file(formulaPath).text())?.[0] ?? "";
    sha = actualSha;
    const ok = actualSha === recordedSha && recordedSha === formulaSha;
    shaClause = {
      id: "sha",
      title: "brew verifies the asset (sha256 matches)",
      verdict: ok
        ? { ok: true, detail: `tarball sha ${actualSha.slice(0, 12)}… == sha256sums.txt == vend.rb` }
        : { ok: false, detail: `sha mismatch — tarball ${actualSha.slice(0, 12)}…, sums ${recordedSha.slice(0, 12)}…, formula ${formulaSha.slice(0, 12)}…` },
    };
  } catch (e) {
    shaClause = { id: "sha", title: "brew verifies the asset (sha256 matches)", verdict: { ok: false, detail: e instanceof Error ? e.message : String(e) } };
  }

  // ── Build a clean "machine": extract the tarball, put `vend` on a fresh PATH ───────────
  // This is brew's `install do: bin.install "vend"`, faithfully, minus the network fetch.
  const machine = await mkdtemp(join(tmpdir(), "vend-acceptance-"));
  const env = scrubEnv(process.env);
  const versionClause: Clause = await (async () => {
    try {
      const prefix = join(machine, "opt");
      const bin = join(machine, "bin");
      const workdir = join(machine, "workspace");
      await Bun.$`mkdir -p ${prefix} ${bin} ${workdir}`.quiet();
      // macOS tar handles xz natively (the pinned target is mac-only); same tar that wrote it.
      const x = Bun.spawnSync(["tar", "-xJf", tarPath, "-C", prefix]);
      if (x.exitCode !== 0) throw new Error(`tar extract failed: ${x.stderr.toString().trim()}`);
      await Bun.$`cp ${join(prefix, "vend")} ${join(bin, "vend")}`.quiet();
      await Bun.$`chmod +x ${join(bin, "vend")}`.quiet();

      // Clause 2: `vend --version` from a no-checkout dir, scrubbed env, clean PATH.
      const vbin = join(bin, "vend");
      const cleanPath = `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`;
      const ver = Bun.spawnSync([vbin, "--version"], { cwd: workdir, env: { ...env, PATH: cleanPath } });
      return { id: "version", title: "vend --version is real semver", verdict: verifyVersion(ver.stdout.toString(), VERSION) };
    } catch (e) {
      return { id: "version", title: "vend --version is real semver", verdict: { ok: false, detail: e instanceof Error ? e.message : String(e) } };
    }
  })();

  // ── Clauses 3 & 4: init lays a workspace in an empty dir; second run converges ─────────
  const bin = join(machine, "bin");
  const vbin = join(bin, "vend");
  const cleanPath = `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`;
  const expected = expectedScaffoldPaths();

  let initClause: Clause;
  let convergeClause: Clause;
  try {
    const workdir = await mkdtemp(join(machine, "empty-"));
    const first = Bun.spawnSync([vbin, "init", "--template", "minimal"], { cwd: workdir, env: { ...env, PATH: cleanPath } });
    // Read what landed on disk (relative paths), and whether a .git appeared.
    const found = await Bun.$`cd ${workdir} && find . -mindepth 1`.quiet().nothrow();
    const presentPaths = found.stdout
      .toString()
      .split("\n")
      .filter(Boolean)
      .map((p) => p.replace(/^\.\//, ""));
    const hasGit = (await Bun.file(join(workdir, ".git")).exists()) || presentPaths.includes(".git");
    const createdMatch = /—\s*(\d+)\s+created/.exec(first.stdout.toString());
    const created = createdMatch ? Number(createdMatch[1]) : 0;
    initClause = {
      id: "init",
      title: "vend init --template minimal lays a workspace (empty dir, no clone, no Doppler)",
      verdict: verifyScaffold({ created, presentPaths, hasGit, expected }),
    };

    const second = Bun.spawnSync([vbin, "init", "--template", "minimal"], { cwd: workdir, env: { ...env, PATH: cleanPath } });
    convergeClause = { id: "converge", title: "second run is a no-clobber converge", verdict: verifyConverge(second.stdout.toString()) };
  } catch (e) {
    const v = { ok: false, detail: e instanceof Error ? e.message : String(e) };
    initClause = { id: "init", title: "vend init --template minimal lays a workspace", verdict: v };
    convergeClause = { id: "converge", title: "second run is a no-clobber converge", verdict: v };
  } finally {
    await rm(machine, { recursive: true, force: true });
  }

  const clauses: readonly Clause[] = [shaClause, versionClause, initClause, convergeClause];
  const transcript = renderTranscript({ version: VERSION, sha, tarball, clauses, residual: RESIDUAL });

  if (outArg) {
    await Bun.write(outArg, transcript);
    process.stdout.write(`acceptance: wrote transcript → ${outArg}\n`);
  } else {
    process.stdout.write(transcript + "\n");
  }
  const allOk = clauses.every((c) => c.verdict.ok);
  process.stdout.write(allOk ? "acceptance: ok — all clauses cleared\n" : "acceptance: FAILED — a clause did not clear\n");
  process.exit(allOk ? 0 : 1);
}
