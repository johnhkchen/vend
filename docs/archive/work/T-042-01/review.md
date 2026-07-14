# T-042-01 — Review: doctor-check-report-model

_Handoff self-assessment. What a reviewer needs without reading every diff._

## What changed

| File | Op | Lines | Notes |
|------|----|----|-------|
| `src/doctor/doctor-core.ts` | new | ~130 | Pure check/report model. Zero non-TS imports, zero throws. |
| `src/doctor/doctor-core.test.ts` | new | ~150 | 13 pure-function tests, imports only the core. |
| `docs/active/work/T-042-01/*.md` | new | — | RDSPI artifacts (research/design/structure/plan/progress/review). |

New `src/doctor/` dir created (mirrors `src/init/` for E-040). **No** edit to `src/cli.ts`,
**no** `package.json` dep, **no** other source touched — scope held exactly to the pure core.

## Public surface

```ts
export interface Check { readonly name: string; readonly ok: boolean; readonly hint?: string; }
export interface DoctorReport { readonly ok: boolean; readonly exitCode: number; readonly report: string; }
export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export function passed(name: string): Check;
export function failed(name: string, hint: string): Check;
export function renderDoctorReport(checks: readonly Check[]): DoctorReport;
```

`renderDoctorReport` is total over its input: empty → honest "no checks to run" (ok, exit 0);
all-green → checklist + exit 0; any-red → `K of N failed` tally with each failing check's
name + fix-it hint + exit 1. Every check (green and red) is listed — doctor is a status
checklist, not an offenders-only audit (the divergence from history-core, demanded by the AC
"renders each dep green").

## Acceptance criteria — status

- [x] **All-green set renders each dep green + exit code 0** — test "AC: all-green set…":
  asserts `ok`, `exitCode === 0`, each dep name present, `✓` present, `✗` absent.
- [x] **Any single failing check renders its name + fix-it hint + non-zero code** — test "AC:
  any single failing check…": asserts `!ok`, `exitCode === EXIT_FAILED` (non-zero), the
  failing name + its hint + `✗` present, greens still listed.
- [x] **No probing/IO — pure, mirrors the *-core split** — the module imports nothing impure
  (the test's import block is the proof); the purity test asserts deterministic, identical
  repeated calls. Same pure/impure boundary as precommit-core / init-core.

## Test coverage

13 tests / 54 expect() calls, all green. Beyond the three AC fixtures: empty-set honesty,
multi-failure tally, multi-line-hint collapse, input-order preservation, hintless-failure
robustness (no `"undefined"` leak), ok/exitCode never-desync invariant, constructor behavior,
constant values. Full suite: **1045 pass / 0 fail**, zero regressions.

## House-rule conformance

- **Pure/total**: no fs/spawn/clock/process/env/addon; plain data in, fresh data out.
- **Returned data, never thrown**: zero `throw`s — a failed dep is data (red `Check` →
  non-zero `exitCode`), the expected preflight outcome.
- **Name the failure (E-008)**: the header names the failure count; each red line names its
  check + actionable hint.
- **R12 shared contract**: exit codes exported as constants for the CLI (T-042-03) to derive
  from, never re-literal.
- **Derived-not-parallel fields**: `ok = failCount === 0`, `exitCode` follows `ok` — no
  desync possible (asserted by a dedicated test).

## Open concerns / notes for the reviewer

- **None blocking.** The model is intentionally minimal — the real diagnostic value arrives
  when T-042-02 feeds it real `envinfo` probe results.
- **Plain text, no color.** Deliberate (design D5): color/presentation is the CLI's concern
  (T-042-03, mirroring `renderReceipt`'s `{ color }` option in the play layer). If the CLI
  wants ANSI, it wraps `report`; the core stays deterministic and trivially assertable.
- **Hint-on-failure is a convention, not a type guarantee** (design D1). `failed()` enforces
  it at construction; a hand-built `{ ok: false }` without a hint is tolerated by the renderer
  (renders a bare `✗ <name>`, no crash) rather than rejected — the returned-data-never-thrown
  rule. If a stronger guarantee is ever wanted, a discriminated union is the upgrade path.
- **Downstream contract**: T-042-02 imports `Check`/`passed`/`failed`; T-042-03 imports
  `renderDoctorReport` + the exit constants; T-042-04 reuses `renderDoctorReport().ok` for the
  cast precondition. The check list lives in the probe, not here — the core renders an
  arbitrary ordered set, so new checks need no core change.

## Critical issues needing human attention

None.
