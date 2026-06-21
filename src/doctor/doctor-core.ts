// The `vend doctor` preflight's PURE check/report model (T-042-01, story S-042-01, epic
// E-042 vend-doctor-preflight) — the addon-free heart of the preflight gate: a `Check`
// (a named dependency probe result with a fix-it hint) and a pure renderer that maps a set
// of check results to a human-readable report plus an exit code (0 when every dep is green,
// non-zero when any fails).
//
// THE CENTRAL RULE (mirrors src/ci/precommit-core.ts and src/init/init-core.ts): the
// report/verdict *logic* lives here, addon-free; the world-touching PROBE — the
// `envinfo`-backed checks (lisa & claude on PATH, the BAML native addon loadable, the
// active executor's config present) — is the sibling ticket T-042-02 (`doctor-probe`), a
// thin impure shell that emits `Check`s this module renders. The CLI `doctor` dispatch arm
// (T-042-03) prints `report` and `process.exit(exitCode)`; the cast-precondition reuse
// (T-042-04) refuses a cast at the door when `!report.ok`. None of those is in this file.
//
// PURE/TOTAL: every export takes plain data and returns fresh values — no envinfo, no
// node:fs, no child_process, no process.env, no clock, no addon, no IO of any kind. So
// doctor-core.test.ts is an ordinary pure-function test, the same discipline committed-core
// / history-core / init-core follow. The first impure import belongs to T-042-02, never here.
//
// HOUSE RULE (committed-core.ts / budget.ts): an offending outcome is RETURNED data, never
// thrown. "A dependency check failed" is an expected outcome — the whole point of a preflight
// — modelled as data (a red `Check` → a non-zero `exitCode`), not an exception. This module
// has ZERO throws.
//
// NAME THE FAILURE (E-008 style): a failed check renders its NAME and its fix-it HINT, so the
// human/agent reading the preflight sees exactly what is broken and how to fix it — a clean,
// actionable gated refusal, never a cryptic mid-run trace.

// ── Check — the unit the probe emits ─────────────────────────────────────────────────────────

/**
 * One dependency-probe result — DATA the impure probe (T-042-02) reports, deciding nothing
 * about exit codes. By convention `hint` is present iff `ok` is false (a green check needs no
 * fix-it); the {@link passed} / {@link failed} constructors enforce that at the construction
 * site. The renderer is robust to a hintless failure regardless (a probe bug must not crash
 * the renderer — returned-data-never-thrown).
 */
export interface Check {
  /** The dependency being verified, e.g. `"lisa on PATH"` or `"BAML native addon loadable"`. */
  readonly name: string;
  /** `true` = green (the dep is present/usable); `false` = the preflight found it broken. */
  readonly ok: boolean;
  /** The actionable fix-it hint, surfaced on a failure (the E-008 "name the fix" style).
   *  Present iff `!ok`; absent on a green check. */
  readonly hint?: string;
}

/** Mint a green {@link Check}. PURE. No hint — a passing dep needs no fix-it. */
export function passed(name: string): Check {
  return { name, ok: true };
}

/** Mint a red {@link Check}. PURE. `hint` is REQUIRED — a failure must always carry its
 *  actionable fix (this is where the D1 hint-on-failure convention is enforced). */
export function failed(name: string, hint: string): Check {
  return { name, ok: false, hint };
}

// ── Exit-code R12 shared contract ────────────────────────────────────────────────────────────

/** Exit code when every check is green — the SHARED CONTRACT (cf. precommit-core's HOOKS_DIR,
 *  history-core's DEFAULT_HISTORY_MAX). The CLI (T-042-03) derives its `process.exit` argument
 *  from {@link DoctorReport.exitCode} / these constants — it never re-literals the number. */
export const EXIT_OK = 0 as const;

/** Exit code when any check fails — `1`, the operational-andon code `src/cli.ts` uses uniformly
 *  (`exit(outcome === "success" ? 0 : 1)`). `2` is reserved for usage errors, so a broken dep
 *  is `1`, not `2`. */
export const EXIT_FAILED = 1 as const;

// ── DoctorReport — the renderer's verdict ──────────────────────────────────────────────────────

/** The rendered preflight verdict: the all-green boolean, the exit code, and the full text the
 *  CLI prints verbatim. `exitCode` is derived from `ok`, never a parallel field to desync. */
export interface DoctorReport {
  /** `true` iff every check is green (vacuously true for an empty set). */
  readonly ok: boolean;
  /** {@link EXIT_OK} when `ok`, else {@link EXIT_FAILED}. The CLI exits with exactly this. */
  readonly exitCode: number;
  /** The complete human-readable report the impure caller prints. Lists EVERY check (green and
   *  red), naming any failure + its hint. */
  readonly report: string;
}

// ── internal renderers ─────────────────────────────────────────────────────────────────────────

/**
 * Render the fix-it suffix for a failing check's line. PURE/TOTAL. Returns `""` when the hint is
 * absent or blank (so a hintless failure yields a bare `✗ <name>` line, never `✗ <name> —
 * undefined`), else ` — <hint>` with internal whitespace collapsed so a multi-line hint stays one
 * line. Mirrors precommit-core's `tail` / history-core's `summarySuffix`.
 */
function hintSuffix(hint: string | undefined): string {
  const s = (hint ?? "").trim();
  return s === "" ? "" : ` — ${s.replace(/\s+/g, " ")}`;
}

/**
 * Render one {@link Check} to its report line. PURE/TOTAL. A green check is `  ✓ <name>`; a red
 * check is `  ✗ <name>` + its {@link hintSuffix}. Greens are listed too (D2) — doctor is a status
 * checklist, not an offenders-only audit, so a passing dep is positive confirmation, not silence.
 */
function line(check: Check): string {
  if (check.ok) return `  ✓ ${check.name}`;
  return `  ✗ ${check.name}${hintSuffix(check.hint)}`;
}

// ── renderDoctorReport — the one public verb ───────────────────────────────────────────────────

/**
 * Render a set of {@link Check} results into a {@link DoctorReport}. PURE/TOTAL — the whole of
 * the preflight's judgment. Three mutually-exclusive, exhaustive report shapes, each returning a
 * complete report (no parallel field to desync — `ok` is `failCount === 0`, `exitCode` follows
 * from `ok`):
 *  - EMPTY set  → an HONEST-EMPTY line ("no checks to run"), `ok` true, exit 0 — never a
 *                 misleading "all deps green" when nothing was checked (mirrors history-core's
 *                 empty-range line). In practice the probe always supplies checks; this is the
 *                 degenerate/test-only input, modelled as data rather than thrown.
 *  - all GREEN  → header `doctor: ok — N check(s) passed`, then one `✓` line per check, exit 0.
 *  - any RED    → header `doctor: FAILED — K of N check(s) failed`, then one marked line per
 *                 check (greens `✓`, reds `✗ <name> — <hint>`) in INPUT ORDER, exit 1. The
 *                 header NAMES the failure count; each red line NAMES its check + fix-it hint.
 * The caller exits with `exitCode` and prints `report`.
 */
export function renderDoctorReport(checks: readonly Check[]): DoctorReport {
  const total = checks.length;
  const failCount = checks.filter((c) => !c.ok).length;

  if (total === 0) {
    return { ok: true, exitCode: EXIT_OK, report: "doctor: no checks to run" };
  }

  const body = checks.map(line).join("\n");

  if (failCount === 0) {
    const header = `doctor: ok — ${total} check(s) passed`;
    return { ok: true, exitCode: EXIT_OK, report: `${header}\n${body}` };
  }

  const header = `doctor: FAILED — ${failCount} of ${total} check(s) failed`;
  return { ok: false, exitCode: EXIT_FAILED, report: `${header}\n${body}` };
}
