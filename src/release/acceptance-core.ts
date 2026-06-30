// Pure core for the fresh-machine end-to-end acceptance harness (T-065-01, story S-065,
// epic E-061). Owns ALL judgment the harness defers to — env scrubbing, the expected
// workspace shape, the per-clause verdicts, and the transcript text — so the impure shell
// (acceptance.ts) only spawns the binary, touches the filesystem, and prints. No I/O, no
// `process`, no BAML import: kept in the `*-core.ts` lane (cf. release-core/formula-core)
// so unit tests stay millisecond-fast and nothing drags the executor graph in.
//
// The harness drives the REAL compiled binary + the REAL release tarball/formula on a
// clean machine; this module decides what "passed" means for each clause of the AC:
//
//   > brew install … succeeds, `vend --version` is real semver, and `vend init --template
//   > <name>` lays a workspace in an empty dir — no clone, no Doppler.

import { SCAFFOLD_MANIFEST, type ScaffoldEntry } from "../init/init-core.ts";

/** A single pass/fail check with a human-readable reason, the unit of the transcript. */
export type Verdict = { readonly ok: boolean; readonly detail: string };

/** One AC clause: a stable id, a title for the transcript, and its verdict. */
export type Clause = { readonly id: string; readonly title: string; readonly verdict: Verdict };

/** Env-var NAME prefixes a fresh-machine run must NOT carry. `DOPPLER` is the AC's named
 *  one (the loop must work with no Doppler); the rest guard against this checkout's own
 *  coupling leaking into the spawned binary so "no clone" is structural, not merely hoped.
 *  A prefix list (not exact names) catches `DOPPLER_TOKEN`, `DOPPLER_PROJECT`, … at once. */
export const REPO_COUPLING_PREFIXES: readonly string[] = ["DOPPLER", "VEND_", "BUN_INSTALL"];

/** Return a copy of `env` with every `undefined` value dropped and every key whose name
 *  starts with a {@link REPO_COUPLING_PREFIXES} prefix removed. The structural proof of the
 *  "no Doppler / no repo coupling" clause: the spawned binary cannot read what is not in
 *  its environment. PURE — takes the env, returns a new map; the shell passes `process.env`. */
export function scrubEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (REPO_COUPLING_PREFIXES.some((p) => k.startsWith(p))) continue;
    out[k] = v;
  }
  return out;
}

/** The workspace paths a `vend init --template minimal` run must lay, DERIVED from the
 *  scaffold manifest (never a hand-typed list — the no-drift rule the release chain
 *  follows). `minimal`'s overlay is empty, so the expected set is exactly the base
 *  manifest's paths. Both `dir` and `file` entries count: the run creates both. */
export function expectedScaffoldPaths(
  manifest: readonly ScaffoldEntry[] = SCAFFOLD_MANIFEST,
): readonly string[] {
  return manifest.map((e) => e.path);
}

/** `vend --version` clause: the trimmed stdout must equal the embedded semver. */
export function verifyVersion(stdout: string, expected: string): Verdict {
  const got = stdout.trim();
  return got === expected
    ? { ok: true, detail: `vend --version → ${got} (== embedded VERSION)` }
    : { ok: false, detail: `vend --version → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}` };
}

/** `vend init --template minimal` clause: it created files, every expected path is present
 *  on disk, and it left NO `.git` (the "no clone" structural check). */
export function verifyScaffold(opts: {
  readonly created: number;
  readonly presentPaths: readonly string[];
  readonly hasGit: boolean;
  readonly expected: readonly string[];
}): Verdict {
  if (opts.hasGit) return { ok: false, detail: "a `.git` exists — the run depended on / created a checkout" };
  if (opts.created <= 0) return { ok: false, detail: `init reported ${opts.created} created — nothing was scaffolded` };
  const present = new Set(opts.presentPaths);
  const missing = opts.expected.filter((p) => !present.has(p));
  if (missing.length > 0) return { ok: false, detail: `missing ${missing.length} workspace path(s): ${missing.slice(0, 3).join(", ")}…` };
  return { ok: true, detail: `${opts.created} created, all ${opts.expected.length} workspace paths present, no .git` };
}

/** No-clobber converge clause: a second identical run must create nothing. The init shell
 *  prints `— <n> created, <m> skipped`; converge means the created count is 0. */
export function verifyConverge(stdout: string): Verdict {
  const m = /—\s*(\d+)\s+created/.exec(stdout);
  if (!m) return { ok: false, detail: `could not read the create tally from: ${JSON.stringify(stdout.trim())}` };
  const created = Number(m[1]);
  return created === 0
    ? { ok: true, detail: "second run → 0 created (idempotent no-clobber converge)" }
    : { ok: false, detail: `second run created ${created} — not idempotent` };
}

/** Assemble the recorded transcript (PURE string build, so the smoke test can assert it
 *  without a spawn). Banner reflects all-clear vs. a failed clause; the RESIDUAL section is
 *  always present — it names the one thing the harness cannot exercise from here. */
export function renderTranscript(opts: {
  readonly version: string;
  readonly sha: string;
  readonly tarball: string;
  readonly clauses: readonly Clause[];
  readonly residual: string;
}): string {
  const allOk = opts.clauses.every((c) => c.verdict.ok);
  const banner = allOk
    ? "ALL CLAUSES GREEN — install → version → workspace loop cleared on the real artifacts."
    : "FAILED — at least one clause did not clear (see below).";
  const lines: string[] = [];
  lines.push("# T-065-01 — Fresh-machine acceptance transcript");
  lines.push("");
  lines.push(`> ${banner}`);
  lines.push("");
  lines.push(`- **vend**: \`${opts.version}\``);
  lines.push(`- **asset**: \`${opts.tarball}\``);
  lines.push(`- **sha256**: \`${opts.sha}\` (tarball == sha256sums.txt == vend.rb)`);
  lines.push("");
  lines.push("## Clauses (real binary, clean machine, scrubbed env)");
  lines.push("");
  for (const c of opts.clauses) {
    lines.push(`- ${c.verdict.ok ? "✓" : "✗"} **${c.title}** — ${c.verdict.detail}`);
  }
  lines.push("");
  lines.push("## Residual gap — the live tap (human-owned)");
  lines.push("");
  lines.push(opts.residual);
  lines.push("");
  return lines.join("\n");
}
