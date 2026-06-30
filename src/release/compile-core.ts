// The pure core of the binary producer (T-062-02) — parse the release-target pin and
// assemble the `bun build --compile` argv. PURE: no I/O, no process, no BAML. All judgment
// lives here so the impure shell (compile.ts) and the smoke test compile IDENTICALLY (one
// owner of the flag spelling → no drift). Mirrors the src/ci/*-core.ts split.
//
// THE SSOT RULE (.github/release-target.env header): downstream tickets must reference the
// pin BY KEY, never hard-code the triple. `requireKey` therefore THROWS on a missing key
// rather than defaulting — a missing pin must fail loud, never silently fall back to a literal.

/** Path (repo-root-relative) to the machine-readable target pin authored by T-062-01. */
export const PIN_PATH = ".github/release-target.env";

/** The one pin key this ticket consumes: the string passed to `bun build --compile --target=`. */
export const REQUIRED_KEY = "BUN_COMPILE_TARGET";

/** The compile entry — the `vend` CLI (repo-root-relative). The `bin.vend` in package.json. */
export const CLI_ENTRY = "src/cli.ts";

/** Default output path for the single-file binary (repo-root-relative). `dist/` is gitignored. */
export const DEFAULT_OUTFILE = "dist/vend";

/**
 * Parse `KEY=VALUE` lines from the pin file's text into a plain record. PURE.
 * Blank lines and `#`-comment lines are ignored; the FIRST `=` splits each line (so an `=`
 * inside a value is preserved); keys and values are trimmed. Matches the env-file shape the
 * `release-target-check.yml` guard `cat`s into `$GITHUB_ENV`.
 */
export function parseReleaseTarget(envText: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of envText.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue; // not a KEY=VALUE line — skip, don't guess.
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key !== "") out[key] = value;
  }
  return out;
}

/**
 * Read a required key from a parsed pin, or throw a typed, message-bearing error naming the
 * key and the file. PURE. The SSOT contract: never default to a hard-coded triple.
 */
export function requireKey(pin: Record<string, string>, key: string): string {
  const value = pin[key];
  if (value === undefined || value === "") {
    throw new Error(`missing ${key} in ${PIN_PATH} — the release target pin is incomplete`);
  }
  return value;
}

/**
 * Assemble the `bun build --compile` argv for one target. PURE — the SINGLE owner of the flag
 * spelling, so the producer shell and the smoke test build the exact same command.
 */
export function compileArgv(opts: { readonly target: string; readonly entry: string; readonly outfile: string }): string[] {
  return ["bun", "build", "--compile", `--target=${opts.target}`, opts.entry, "--outfile", opts.outfile];
}
