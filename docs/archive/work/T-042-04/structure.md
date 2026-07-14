# T-042-04 — Structure: doctor-cast-precondition-guard

File-level blueprint. Shape of the code, not the code.

## Files

| File | Change | Why |
|---|---|---|
| `src/doctor/preflight.ts` | **CREATE** | the addon-safe reusable guard `castPreflight` (compose probe + render) |
| `src/doctor/preflight.test.ts` | **CREATE** | the AC test — injected-deps matrix + guarded-live |
| `src/play/work.ts` | **MODIFY** | add `unfit-env` to `WorkResult`; call `castPreflight` before any budget |
| `src/cli.ts` | **MODIFY** | render the `unfit-env` refusal + non-zero exit in the `work` arm |

No deletions. No changes to `doctor-core.ts` / `doctor-probe.ts` (consumed as-is).

## `src/doctor/preflight.ts` (new) — the guard

Header (~20 lines): the cast precondition (mirror lisa `check_required_deps`-before-`run_loop`);
the reuse (`probeDoctor` + `renderDoctorReport`, no re-implemented checks); ADDON-SAFE at import
(only `doctor-probe`'s dynamic BAML, never eager) so it is `bun test`-importable; NEVER throws
(inherits `probeDoctor`'s never-reject + `renderDoctorReport`'s totality) ⇒ a broken env is DATA;
who reuses it (`castWork` now; `vend doctor` T-042-03 later).

Imports:
```ts
import { renderDoctorReport, type DoctorReport } from "./doctor-core.ts";
import { probeDoctor, type DoctorProbeDeps } from "./doctor-probe.ts";
```

Public surface — exactly one verb:
```ts
/** Run the vend doctor preflight and render it to a verdict — the cast precondition.
 *  `deps` overrides individual world-fact backends (DEFAULT_PROBE_DEPS supplies the rest), the
 *  injection seam the test uses. NEVER throws: probeDoctor never rejects, renderDoctorReport is
 *  total — a broken dep is a red DoctorReport (ok:false, exitCode:1), never an exception. */
export async function castPreflight(deps: Partial<DoctorProbeDeps> = {}): Promise<DoctorReport>
```
Body: `return renderDoctorReport(await probeDoctor(deps));`

No new types — `DoctorReport` (`{ ok; exitCode; report }`) is already the refuse-or-proceed shape.

## `src/doctor/preflight.test.ts` (new) — the AC proof

`import { describe, expect, test } from "bun:test"`, `castPreflight` from `./preflight.ts`, and
`LISA_CHECK`/`LISA_HINT`/`EXECUTOR_CHECK` (+ green fixtures) from `./doctor-probe.ts`. Fixtures:
`allOnPath = async () => true`, `onPathFor(present)`, `yes/no` (mirroring doctor-probe.test.ts).

Blocks (each comment-mapped to an AC phrase):
1. **broken dep refuses** — `castPreflight({ onPath: onPathFor(["claude"]), bamlLoadable: yes,
   env: {} })` ⇒ `ok===false`, `exitCode===1`, `report` includes `LISA_CHECK` + `LISA_HINT`,
   header starts `doctor: FAILED`. (Same named-check + hint refusal, non-zero outcome.)
2. **wired env proceeds** — `castPreflight({ onPath: allOnPath, bamlLoadable: yes, env: {} })` ⇒
   `ok===true`, `exitCode===0`. (A wired env proceeds unchanged.)
3. **never-throws** — `onPath: async () => { throw new Error("boom") }` ⇒ resolves to `ok===false`
   (not a rejection) — the gate can't crash the cast it guards.
4. **guarded-live** — `await castPreflight()` with real defaults resolves to a `DoctorReport`
   (assert shape: boolean `ok`, numeric `exitCode`, string `report`), no throw.

## `src/play/work.ts` (modify)

1. Import: `import { castPreflight } from "../doctor/preflight.ts";` and
   `import type { DoctorReport } from "../doctor/doctor-core.ts";` (type-only).
2. `WorkResult` union — add, FIRST arm (it is the at-the-door refusal):
   ```ts
   /** The environment failed the doctor preflight (T-042-04): a broken dep — a CLEAN refusal at
    *  the door BEFORE any budget is committed (no board read, no wallet, no metered cast). Carries
    *  the rendered DoctorReport so the CLI prints the same named-check + hint surface `vend doctor`
    *  would and exits with its exitCode. Mirrors lisa's check_required_deps-before-run_loop. */
   | { readonly kind: "unfit-env"; readonly report: DoctorReport }
   ```
3. `castWork` body — the FIRST statement after `const root = ...`, before `readBoard`:
   ```ts
   // Doctor preflight (T-042-04): refuse a cast against a broken environment at the door — before
   // the board is read, the wallet is funded, or any token is metered (P3/P4/P7). The same
   // named-check + hint surface `vend doctor` emits, returned as DATA (a successful refusal).
   const preflight = await castPreflight();
   if (!preflight.ok) return { kind: "unfit-env", report: preflight };
   ```
   Everything below is byte-unchanged ⇒ a wired env proceeds exactly as before.

## `src/cli.ts` (modify) — the `work` arm

Add as the FIRST `result.kind` branch (the door refusal), before `no-board`:
```ts
if (result.kind === "unfit-env") {
  // Doctor preflight refused (T-042-04): a broken dependency. Print the doctor report (named
  // checks + fix-it hints) and exit with its code — a clean precondition refusal, not a crash,
  // exactly like the no-board / stale-board family.
  process.stderr.write(`${result.report.report}\n`);
  process.exit(result.report.exitCode);
}
```
Reuses `report.exitCode` (no re-literalled `1`). No `parseWorkArgs` change (no new flag — hard gate).

## Ordering of changes (for atomic commits)

1. `preflight.ts` + `preflight.test.ts` — the guard + its proof (self-contained, green alone).
2. `work.ts` — `WorkResult` kind + `castWork` wiring (depends on step 1's export).
3. `cli.ts` — render + exit (depends on step 2's new kind).

## Invariants preserved

- Pure/impure split intact: pure verdict (`doctor-core`), addon-safe compose (`preflight`),
  impure shell (`work.ts`). No new BAML eager import; `preflight.ts` stays `bun test`-importable.
- "Returned data, never thrown": the refusal is a `WorkResult` kind / `DoctorReport`, no exception.
- Exit-code single source: CLI uses `report.exitCode`, never a parallel literal.
