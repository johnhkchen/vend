import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SCAFFOLD_MANIFEST } from "../init/init-core.ts";
import { VERSION } from "../version.ts";
import {
  expectedScaffoldPaths,
  REPO_COUPLING_PREFIXES,
  renderTranscript,
  scrubEnv,
  verifyConverge,
  verifyScaffold,
  verifyVersion,
} from "./acceptance-core.ts";

// T-065-01 fresh-machine-end-to-end-acceptance (story S-065, epic E-061). Two layers:
//
//   UNIT — the pure core's verdicts/scrub/transcript, always run, millisecond-fast. These
//   are the drift guards: scrub really removes Doppler, the expected paths really track the
//   manifest, the verdicts have the right truth tables.
//
//   INTEGRATION — the REAL harness against a built dist/. Opportunistic: it runs only when
//   the artifacts exist (a local `just release-local`, or the CI release job which builds
//   dist/ before this step). When absent, it logs a clear skip rather than red — the same
//   un-gateable-boundary treatment as package.smoke / formula.smoke. The recorded transcript
//   in docs/active/work/T-065-01/ is the by-hand gold master.

describe("scrubEnv — the structural no-Doppler / no-coupling proof (T-065-01)", () => {
  test("removes every DOPPLER_* var", () => {
    const out = scrubEnv({ DOPPLER_TOKEN: "x", DOPPLER_PROJECT: "y", PATH: "/bin" });
    expect("DOPPLER_TOKEN" in out).toBe(false);
    expect("DOPPLER_PROJECT" in out).toBe(false);
    expect(out.PATH).toBe("/bin");
  });
  test("removes other repo-coupling prefixes, keeps ordinary vars", () => {
    const out = scrubEnv({ VEND_ROOT: "/repo", HOME: "/h", LANG: "en" });
    expect("VEND_ROOT" in out).toBe(false);
    expect(out.HOME).toBe("/h");
    expect(out.LANG).toBe("en");
  });
  test("drops undefined values (process.env shape)", () => {
    const out = scrubEnv({ A: undefined, B: "b" });
    expect("A" in out).toBe(false);
    expect(out.B).toBe("b");
  });
  test("DOPPLER is among the coupling prefixes — the AC's named exclusion", () => {
    expect(REPO_COUPLING_PREFIXES).toContain("DOPPLER");
  });
});

describe("expectedScaffoldPaths — derived from the manifest, never hand-typed (T-065-01)", () => {
  test("equals exactly the SCAFFOLD_MANIFEST paths", () => {
    expect(expectedScaffoldPaths()).toEqual(SCAFFOLD_MANIFEST.map((e) => e.path));
  });
  test("is non-empty (a minimal workspace has files)", () => {
    expect(expectedScaffoldPaths().length).toBeGreaterThan(0);
  });
});

describe("verdict truth tables (T-065-01)", () => {
  test("verifyVersion: trim-equal passes, anything else fails", () => {
    expect(verifyVersion("0.1.0\n", "0.1.0").ok).toBe(true);
    expect(verifyVersion("0.0.0", "0.1.0").ok).toBe(false);
  });
  test("verifyScaffold: created + all paths present + no .git passes", () => {
    const expected = ["docs/active", ".vend/.gitignore"];
    expect(verifyScaffold({ created: 17, presentPaths: expected, hasGit: false, expected }).ok).toBe(true);
    expect(verifyScaffold({ created: 17, presentPaths: expected, hasGit: true, expected }).ok).toBe(false); // .git
    expect(verifyScaffold({ created: 0, presentPaths: expected, hasGit: false, expected }).ok).toBe(false); // nothing made
    expect(verifyScaffold({ created: 17, presentPaths: ["docs/active"], hasGit: false, expected }).ok).toBe(false); // missing
  });
  test("verifyConverge: 0 created passes, >0 fails, unreadable fails", () => {
    expect(verifyConverge("vend init: scaffolded — 0 created, 17 skipped").ok).toBe(true);
    expect(verifyConverge("vend init: scaffolded — 3 created, 14 skipped").ok).toBe(false);
    expect(verifyConverge("garbage").ok).toBe(false);
  });
});

describe("renderTranscript — the recorded artifact text (T-065-01)", () => {
  const clauses = [
    { id: "sha", title: "sha", verdict: { ok: true, detail: "match" } },
    { id: "version", title: "version", verdict: { ok: true, detail: "0.1.0" } },
  ];
  test("all-ok banner + every clause id + the residual section", () => {
    const t = renderTranscript({ version: "0.1.0", sha: "abc", tarball: "t.tar.xz", clauses, residual: "LIVE TAP GAP" });
    expect(t).toContain("ALL CLAUSES GREEN");
    expect(t).toContain("✓ **sha**");
    expect(t).toContain("✓ **version**");
    expect(t).toContain("Residual gap");
    expect(t).toContain("LIVE TAP GAP");
  });
  test("a failed clause flips the banner and marks ✗", () => {
    const bad = [{ id: "init", title: "init", verdict: { ok: false, detail: "no .git but nothing made" } }];
    const t = renderTranscript({ version: "0.1.0", sha: "abc", tarball: "t", clauses: bad, residual: "x" });
    expect(t).toContain("FAILED");
    expect(t).toContain("✗ **init**");
  });
});

// ── Integration: the REAL harness on a built dist/ (opportunistic) ───────────────────────
const root = join(import.meta.dir, "..", "..");
const distDir = join(root, "dist");
const tarball = "vend-cli-aarch64-apple-darwin.tar.xz";
const haveArtifacts = (await Bun.file(join(distDir, tarball)).exists()) && (await Bun.file(join(distDir, "vend")).exists());

describe("integration — bun run acceptance on the real dist/ (T-065-01)", () => {
  test.if(haveArtifacts)(
    "clears all four clauses and exits 0 against the real binary + tarball",
    async () => {
      const out = await mkdtemp(join(tmpdir(), "vend-acc-it-"));
      const outFile = join(out, "transcript.md");
      try {
        const r = Bun.spawnSync(["bun", "run", "src/release/acceptance.ts", "--out", outFile], { cwd: root });
        expect(r.exitCode).toBe(0);
        const t = await Bun.file(outFile).text();
        expect(t).toContain("ALL CLAUSES GREEN");
        expect(t).toContain(`vend**: \`${VERSION}\``);
        for (const id of ["sha", "version", "minimal lays a workspace", "no-clobber converge"]) {
          // each clause rendered with a ✓ (all-green run)
          expect(t).toMatch(new RegExp(`✓ \\*\\*[^\\n]*${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        }
      } finally {
        await rm(out, { recursive: true, force: true });
      }
    },
    120_000,
  );

  test.if(!haveArtifacts)("skipped — no dist/ artifacts (run `just release-local` to exercise)", () => {
    console.log("[acceptance.smoke] integration skipped: dist/ artifacts absent; CI's release job builds them first.");
    expect(haveArtifacts).toBe(false);
  });
});
