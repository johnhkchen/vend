# T-042-04 — Design: doctor-cast-precondition-guard

Decide HOW to reuse the doctor check as a cast precondition, grounded in the research.

## The decision in one line

Add an **addon-safe guard module** `src/doctor/preflight.ts` exporting
`castPreflight(deps?) → Promise<DoctorReport>` (= `renderDoctorReport(await probeDoctor(deps))`),
unit-tested with injected deps; wire it into `castWork` as a pre-budget refusal returning a new
`WorkResult` kind `unfit-env`; render it in the CLI `work` arm with a non-zero exit.

## Forces (from Research)

1. The guard must be **value-importable by `bun test`** to satisfy the AC's "Test:" clause — so it
   cannot live in `work.ts` (BAML loads at its module eval).
2. The refusal must be the **same named-check + hint** surface the doctor produces — so it must be
   `renderDoctorReport(...).report`, not a paraphrase.
3. It must refuse **before any budget is spent / no partial metered run** — so the call sits before
   `allocate`/`spendDown` in `castWork`.
4. A **wired env proceeds unchanged** — so the gate is a thin prepend that falls through on `ok`.
5. The deps must be **injectable** so the AC matrix (broken dep ↔ wired) is deterministic, exactly
   as `doctor-probe.test.ts` injects `onPath`/`bamlLoadable`/`env`.

## Options considered

### Option A — Compose in a new addon-safe `src/doctor/preflight.ts`, wire into `castWork` (CHOSEN)

`castPreflight(deps?: Partial<DoctorProbeDeps>): Promise<DoctorReport>` simply returns
`renderDoctorReport(await probeDoctor(deps))`. `castWork` calls it first and returns
`{ kind: "unfit-env"; report }` when `!report.ok`. The CLI renders `report.report` and exits
`report.exitCode`.

- **Pros**: (1) addon-safe — imports only `doctor-probe` (dynamic BAML) + pure `doctor-core`, so
  `preflight.test.ts` is an ordinary `bun test` injecting deps → the AC test is fully deterministic.
  (2) Refusal text IS the doctor report (force 2, free). (3) The compose is the smallest possible
  reuse — no re-implemented check logic. (4) Mirrors `runInit`'s refuse-or-apply and `castWork`'s
  own `stale-board` pre-budget refusal exactly (force 3/4). (5) `castPreflight` is REUSABLE by the
  not-yet-wired `vend doctor` command (T-042-03) — the same probe+render compose.
- **Cons**: `castWork`'s one-line wiring is not itself `bun test`-covered (BAML). Acceptable: this
  is the established house discipline (work.ts header) — the LOGIC under test is `castPreflight`,
  proven directly; the wiring is proven by structure + the live smoke, exactly as the
  `no-board`/`stale-board` wiring is.

### Option B — Put the gate logic directly inside `castWork` (no new module)

Inline `renderDoctorReport(await probeDoctor())` at the top of `castWork`.

- **Rejected**: makes the precondition UNTESTABLE (work.ts loads BAML), failing the AC's "Test:"
  clause outright. Also non-reusable — T-042-03's `vend doctor` would duplicate the compose.

### Option C — Put the gate only in the CLI `work` arm

Run the doctor in `cli.ts` before calling `castWork`.

- **Rejected**: the ticket says "before a CAST" (mirror lisa's check-before-`run_loop`) — the
  precondition belongs on the cast path, so any caller of `castWork` (not just the CLI) is guarded.
  CLI-only would leave `castWork` itself crashable, and the CLI arm is not unit-tested either.

### Option D — A typed `Preflight` union (`{ok:true} | {ok:false; report; exitCode}`) instead of `DoctorReport`

- **Rejected as redundant**: `DoctorReport` ALREADY is exactly that shape (`ok`/`exitCode`/`report`).
  Returning it directly is the maximally-reusable, zero-new-type choice and keeps `castPreflight` a
  pure compose. `castWork`'s `WorkResult` is the place a new tagged kind is warranted (it must name
  the refusal among the existing `no-board`/`stale-board` family); the guard need not re-tag.

## Chosen shape (Option A) — specifics

- **Module** `src/doctor/preflight.ts`: `export async function castPreflight(deps: Partial<
  DoctorProbeDeps> = {}): Promise<DoctorReport>`. One-liner compose + a header documenting the
  reuse, the addon-safety, and the never-throws inheritance (probeDoctor never rejects, render is
  total ⇒ `castPreflight` never throws → a broken env is DATA, exactly like the rest of doctor).
- **`WorkResult`** gains `| { readonly kind: "unfit-env"; readonly report: DoctorReport }`.
- **`castWork`** first statement (after resolving `root`): `const preflight = await castPreflight();
  if (!preflight.ok) return { kind: "unfit-env", report: preflight };` — BEFORE `readBoard`, so a
  broken env refuses at the very door (force 3; nothing read, nothing allocated, nothing metered).
- **CLI `work` arm** gains a branch: `if (result.kind === "unfit-env") { process.stderr.write(
  \`${result.report.report}\n\`); process.exit(result.report.exitCode); }` — same shape as the other
  refusal kinds (stderr + non-zero), reusing the doctor's exit code rather than re-literalling `1`.

## Why no `--skip-doctor` override (decision)

A broken dependency is a hard environment fault — unlike the `stale-board` mtime heuristic, there is
no false-positive to escape. `runInit`'s `not-lisa` gate sets the precedent: a hard precondition
with no flag. An override is a possible future kaizen, documented in Review, not this slice's scope.

## Test strategy (satisfies the AC "Test:" clause)

`src/doctor/preflight.test.ts` (ordinary `bun test`, injected deps):
- **broken dep** (`onPath` false for `lisa`, rest green) → `report.ok === false`, `exitCode === 1`,
  `report.report` CONTAINS `LISA_CHECK` and `LISA_HINT` (the same named-check + hint), and the
  report is `FAILED` — the cast-precondition refusal. (Maps to: "refuses … emitting the same
  named-check + hint refusal and a non-zero outcome".)
- **wired env** (all `onPath` true, `bamlLoadable` true, `env: {}`) → `report.ok === true`,
  `exitCode === 0` — the gate is transparent, the cast proceeds. (Maps to: "a wired env proceeds
  unchanged".)
- **never-throws**: a backend that throws still resolves to a red report (inherited from
  `probeDoctor`'s `safeCheck`) — asserted so the gate can't crash the cast it guards.
- **guarded-live**: `castPreflight()` with REAL defaults composes + resolves without throwing
  (the doctor-probe live-smoke discipline) — proves the real probe→render→verdict path.

"No partial metered run" is established STRUCTURALLY: `castWork` returns `unfit-env` before
`allocate`/`spendDown`, so on the broken path zero tokens are metered and the run log is untouched.
