# T-042-04 — Review: doctor-cast-precondition-guard

Handoff for a human reviewer. What changed, how it's covered, what to watch.

## What changed

Reuses the `vend doctor` check as a precondition at the door of a cast — mirroring lisa's
`check_required_deps`-before-`run_loop`. A `vend work` cast against a broken environment now refuses
cleanly with the doctor report BEFORE the board is read, the wallet is funded, or any token is
metered — instead of crashing mid-run after a budget is committed (P3/P4/P7).

### Files

| File | Change | Summary |
|---|---|---|
| `src/doctor/preflight.ts` | **NEW** (~40 lines) | `castPreflight(deps?) → renderDoctorReport(await probeDoctor(deps))` — the addon-safe reusable guard, no new check logic |
| `src/doctor/preflight.test.ts` | **NEW** (~90 lines) | the AC proof: injected-deps matrix (broken refusal / wired proceed / never-throws) + guarded-live |
| `src/play/work.ts` | **MODIFY** (+~10 lines) | `unfit-env` arm on `WorkResult`; `castPreflight()` as `castWork`'s first statement, before any budget |
| `src/cli.ts` | **MODIFY** (+~7 lines) | the `work` arm renders the `unfit-env` doctor report to stderr + exits `report.exitCode` |

No deletions; `doctor-core.ts` / `doctor-probe.ts` consumed unchanged.

## How it maps to the Acceptance Criterion

> invoking a cast (castWork) in an env with a broken dep refuses BEFORE any budget is spent —
> emitting the same named-check + hint refusal and a non-zero outcome — with no partial metered run;
> a wired env proceeds unchanged.

- **broken dep refuses, same named-check + hint, non-zero** — `preflight.test.ts` block (1): a lisa-
  off-PATH probe ⇒ `ok:false`, `exitCode:1`, report contains `LISA_CHECK` + `LISA_HINT` + `FAILED`.
  Live: `VEND_EXECUTOR=bogus … work` exited 1 with the doctor `FAILED` report naming the executor
  check + its hint.
- **before any budget / no partial metered run** — STRUCTURAL: `castWork` returns `unfit-env` as its
  first statement, before `readBoard`/`allocate`/`spendDown`. Live: the broken-env smoke produced an
  empty stdout (no receipt) — nothing was metered or logged.
- **a wired env proceeds unchanged** — `preflight.test.ts` block (2): all-green ⇒ `ok:true`,
  `exitCode:0`. Live: a wired `work --board <missing>` proceeded PAST the preflight to the existing
  `no-board` refusal, proving the gate is transparent when the env is healthy.

## Test coverage

- **Unit (the AC):** `bun test src/doctor/preflight.test.ts` → 4 pass / 16 expect(). Deterministic,
  addon-free (injected deps) — including a never-throws case so the gate can't crash the cast.
- **Full suite:** 1071 pass / 0 fail / 2835 expect() across 73 files. No regressions.
- **Typecheck:** `tsc --noEmit` exit 0.
- **Live smoke:** broken-env (refuses with report, exit 1, no receipt) + wired-env (proceeds past
  the gate) — the work.ts untested-shell discipline.

### Coverage gaps (by design / house rule)

- `castWork`'s one-line wiring is not in `bun test` — work.ts eagerly loads the BAML addon via the
  chain, so the house rule forbids value-importing it in a test. The wiring is proven by the guard's
  unit tests + the two live smokes. This matches how every other `WorkResult` branch
  (`no-board`/`empty-board`/`stale-board`) is verified.

## Open concerns / follow-ups

- **No `--skip-doctor` override** (deliberate, per design.md). A broken dependency is a hard
  environment fault with no false-positive to escape — unlike the heuristic `stale-board` gate
  (`--stale-ok`). Precedent: `runInit`'s `not-lisa` hard gate. An override is a possible future
  kaizen, not this slice.
- **Other cast entry points** (`vend run`/`chain`/`expand`/`survey`/`steer`) do NOT yet run the
  preflight — this ticket scopes the guard to the `vend work` macro-wallet cast (the one that
  commits a large budget up front, where mid-run failure is costliest). `castPreflight` is the
  reusable seam to extend to the other `cast*` shells in a follow-up if desired.
- **`castPreflight` overlaps the `vend doctor` command** (T-042-03, landed concurrently): both are
  `probeDoctor` → `renderDoctorReport`. A small kaizen could route `vend doctor` through
  `castPreflight` to make the compose single-sourced; left out to avoid touching another thread's
  freshly-landed arm in this ticket.

## Reviewer checklist

- [ ] `preflight.ts` adds no eager addon import (keeps the test addon-free). ✔ imports only
  `doctor-core` + `doctor-probe`.
- [ ] The preflight call precedes `allocate`/`spendDown` in `castWork`. ✔ first statement after `root`.
- [ ] The CLI exits with `report.exitCode`, not a re-literalled `1`. ✔
