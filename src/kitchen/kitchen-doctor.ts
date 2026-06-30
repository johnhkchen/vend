// The `vend doctor` KITCHEN-WORKSPACE probe (T-062-02-02, story S-062-02, epic E-062
// kitchen-emdash-dress-rehearsal) — the kitchen analogue of src/doctor/doctor-probe.ts: the
// thin IMPURE shell that gathers the prerequisites a freshly-scaffolded kitchen workspace
// (the EmDash+Astro seed laid by `vend init --template kitchen`, T-062-02-01) actually needs,
// emitting one `Check` each for the pure renderer (`renderDoctorReport`, doctor-core.ts) to verdict.
//
// WHY A SEPARATE PROBE — WORKSPACE-AWARE DOCTOR: a kitchen workspace is a STANDALONE Astro app
// (`kitchen` ∈ init-core's STANDALONE_TEMPLATES; it writes NO lisa marker). Its prerequisites are
// the APP's — bun, the Astro/Cloudflare storefront config, the EmDash Dish seed — NOT the
// vend/lisa BUILD-ENGINE deps (lisa & claude on PATH, the BAML addon) that doctor-probe.ts checks.
// So `vend doctor` reports on "the prerequisites for what you'd do HERE": in a build project that
// is the build engine; in a standalone kitchen app it is this set. The CLI doctor arm dispatches
// on {@link isKitchenWorkspace}. (The CAST door guard — preflight.ts — deliberately keeps the
// build-engine checks: a kitchen app still needs the engine to `vend work` the menu-render slice.)
//
// THE CENTRAL RULE (mirrors doctor-probe.ts): the report/exit-code LOGIC lives in doctor-core.ts —
// pure, total. THIS module is the world-touching verb. It decides NOTHING about exit codes and it
// does NOT print or `process.exit` (the CLI arm does). It only produces the `Check[]`.
//
// NEVER THROWS (the headline doctor AC): a failed prerequisite is the EXPECTED outcome of a
// preflight — a red `Check`, never an exception. Every check runs through {@link safeCheck}, which
// degrades ANY thrown value (a missing file, malformed JSON, a backend quirk) to `failed(name,
// <message>)`. So `probeKitchen` RESOLVES — it never rejects.
//
// NAME THE FAILURE (E-008): every red `Check` is minted via `failed`, which REQUIRES a fix-it hint
// — so the cook reading the preflight sees the broken prerequisite and the exact fix (almost always
// "re-run `vend init --template kitchen`", since the seed is vend-owned).
//
// TESTABLE TODAY (the planInit / probeDoctor discipline): the world-facts are INJECTED via
// {@link KitchenProbeDeps}, defaulting to the real envinfo `which` / node fs backends. A test passes
// fabricated facts to exercise every branch deterministically, with no dependence on the host.
//
// PURE VALIDATORS REUSED: the Dish-seed contract (dish-seed.ts) is consumed as-is — its header
// already anticipates "a future `vend doctor` kitchen check". The fs lives here; the grading is pure.

import envinfo from "envinfo";
import { readFile as fsReadFile } from "node:fs/promises";
import { join } from "node:path";
import { failed, passed, type Check } from "../doctor/doctor-core.ts";
import { parseKitchenSeed, validateDishSeed } from "./dish-seed.ts";

// ── Check names + fix-it hints (single source of truth, asserted by the tests) ───────────────

/** The bun-on-PATH check name + hint. bun is the one genuine SYSTEM prerequisite — astro and the
 *  Cloudflare adapter install THROUGH it, so it must exist before anything else in the seed works. */
export const BUN_CHECK = "bun on PATH";
export const BUN_HINT = "install bun (https://bun.sh) and ensure `bun` is on your PATH";

/** The Astro/Cloudflare storefront-config check name + hint. A config-PRESENCE check (the seed
 *  ships no node_modules), so it is green right after scaffold without a `bun install`. */
export const ASTRO_CHECK = "Astro storefront config present";
export const ASTRO_HINT =
  "re-run `vend init --template kitchen` to restore the Astro/Cloudflare storefront config";

/** The EmDash Dish-seed check name + hint. Grades `.emdash/seed.json` against the dish-seed.ts
 *  contract; on a violation the hint leads with the specific reason, then this restore hint. */
export const SEED_CHECK = "EmDash Dish seed valid";
export const SEED_HINT = "re-run `vend init --template kitchen` to restore a valid Dish seed";

// ── Workspace detection (pure, mirrors init-core's isLisaProject) ─────────────────────────────

/** The top-level entries that together signature a kitchen workspace: the EmDash content dir and
 *  the Astro storefront config. BOTH are required so a generic Astro repo (or some unrelated
 *  `.emdash`) is not mistaken for one. */
export const KITCHEN_SIGNATURE = [".emdash", "astro.config.mjs"] as const;

/** Is this a kitchen workspace? True iff the top-level listing contains EVERY {@link
 *  KITCHEN_SIGNATURE} entry. PURE — takes a listing, touches no fs (the `isLisaProject(existing)`
 *  idiom), so the CLI arm reads the dir once and this decides without IO of its own. */
export function isKitchenWorkspace(entries: Iterable<string>): boolean {
  const set = new Set(entries);
  return KITCHEN_SIGNATURE.every((s) => set.has(s));
}

// ── Injectable world-fact backends ───────────────────────────────────────────────────────────

/**
 * The world-facts the probe reads, injected so every check is unit-testable with fabricated inputs
 * (the `probeDoctor` discipline). Defaults are {@link DEFAULT_KITCHEN_PROBE_DEPS} — the real
 * envinfo `which` / node `readFile` backends.
 */
export interface KitchenProbeDeps {
  /** Is `binary` resolvable on PATH? Default: {@link whichOnPath} (envinfo-backed). */
  readonly onPath: (binary: string) => Promise<boolean>;
  /** Read a workspace file as UTF-8 text. Default: `node:fs/promises` readFile. */
  readonly readFile: (path: string) => Promise<string>;
}

/**
 * Default on-PATH predicate, envinfo-backed (the doctor-probe mandate). A private copy of
 * doctor-probe's identical 4-line idiom rather than exporting/cross-importing a one-liner — it
 * keeps the two probes independent. `which` → absolute path when present, `undefined` when absent;
 * `Boolean` collapses that. Wrapped `try/catch → false` so even a backend throw reads as "absent".
 */
async function whichOnPath(binary: string): Promise<boolean> {
  try {
    return Boolean(await envinfo.helpers.which(binary));
  } catch {
    return false;
  }
}

/** The real backends: envinfo `which` and `node:fs/promises` readFile (utf8). */
export const DEFAULT_KITCHEN_PROBE_DEPS: KitchenProbeDeps = {
  onPath: whichOnPath,
  readFile: (path) => fsReadFile(path, "utf8"),
};

// ── The three check verbs (each total over its injected fact) ──────────────────────────────────

/** bun-on-PATH → green when resolvable, else red with {@link BUN_HINT}. */
export async function bunCheck(onPath: KitchenProbeDeps["onPath"]): Promise<Check> {
  return (await onPath("bun")) ? passed(BUN_CHECK) : failed(BUN_CHECK, BUN_HINT);
}

/**
 * Astro/Cloudflare storefront-config presence — green iff `astro.config.mjs` declares the
 * Cloudflare adapter (text contains `adapter` AND `cloudflare`) AND `package.json` declares both
 * the `astro` and `@astrojs/cloudflare` dependencies. A config-PRESENCE check (no node_modules
 * resolution), tracking exactly the signals T-062-02-01's scaffold test pins. A missing/garbled
 * file throws and is degraded to red by {@link safeCheck}.
 */
export async function astroConfigCheck(
  readFile: KitchenProbeDeps["readFile"],
  dir: string,
): Promise<Check> {
  const config = await readFile(join(dir, "astro.config.mjs"));
  const hasAdapter = config.includes("adapter") && config.includes("cloudflare");

  const pkg = JSON.parse(await readFile(join(dir, "package.json"))) as {
    dependencies?: Record<string, unknown>;
  };
  const deps = pkg.dependencies ?? {};
  const hasDeps = "astro" in deps && "@astrojs/cloudflare" in deps;

  return hasAdapter && hasDeps ? passed(ASTRO_CHECK) : failed(ASTRO_CHECK, ASTRO_HINT);
}

/**
 * EmDash Dish-seed validity — read `.emdash/seed.json`, then grade it with the pure dish-seed.ts
 * contract (`parseKitchenSeed` → `validateDishSeed`). Green iff zero violations; on a violation the
 * hint LEADS with the first specific reason, then {@link SEED_HINT}. A read error or malformed JSON
 * (parseKitchenSeed throws) is degraded to red by {@link safeCheck} carrying the parse message.
 */
export async function dishSeedCheck(
  readFile: KitchenProbeDeps["readFile"],
  dir: string,
): Promise<Check> {
  const seed = parseKitchenSeed(await readFile(join(dir, ".emdash", "seed.json")));
  const check = validateDishSeed(seed);
  if (check.ok) return passed(SEED_CHECK);
  return failed(SEED_CHECK, `${check.violations[0]} — ${SEED_HINT}`);
}

// ── never-throw wrapper ──────────────────────────────────────────────────────────────────────

/** The message of any thrown value, total (an `Error` → its message; anything else → `String`). */
function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Run a check, degrading ANY thrown error to `failed(name, <message>)`. The central guarantee that
 * {@link probeKitchen} returns a result rather than raising — a missing file / malformed seed /
 * backend quirk becomes a red `Check`, never a propagated crash.
 */
async function safeCheck(name: string, run: () => Promise<Check> | Check): Promise<Check> {
  try {
    return await run();
  } catch (e) {
    return failed(name, messageOf(e));
  }
}

// ── probeKitchen — the one public entry ────────────────────────────────────────────────────────

/**
 * Run the kitchen-workspace prerequisite checks against `dir` (and the injected/real world) and
 * return the ordered {@link Check}[] for the core's `renderDoctorReport` to verdict. The checks run
 * concurrently but the result preserves a FIXED order — bun, Astro config, EmDash seed — because
 * `Promise.all` preserves input order. NEVER REJECTS: every check is {@link safeCheck}-wrapped.
 * `deps` overrides individual backends ({@link DEFAULT_KITCHEN_PROBE_DEPS} supplies the rest).
 */
export async function probeKitchen(
  dir: string,
  deps: Partial<KitchenProbeDeps> = {},
): Promise<Check[]> {
  const d: KitchenProbeDeps = { ...DEFAULT_KITCHEN_PROBE_DEPS, ...deps };
  return Promise.all([
    safeCheck(BUN_CHECK, () => bunCheck(d.onPath)),
    safeCheck(ASTRO_CHECK, () => astroConfigCheck(d.readFile, dir)),
    safeCheck(SEED_CHECK, () => dishSeedCheck(d.readFile, dir)),
  ]);
}
