# T-042-01 — Structure: doctor-check-report-model

_File-level blueprint. The shape of the code, not the code._

## Files

| File | Op | Purpose |
|------|----|---------|
| `src/doctor/doctor-core.ts` | **create** | The pure check/report model — `Check`, constructors, `renderDoctorReport`, exit-code contract. |
| `src/doctor/doctor-core.test.ts` | **create** | Pure-function tests: AC fixtures + edges. Imports ONLY the core. |

Nothing else changes. No `package.json` dep (that's T-042-02's `envinfo`). No `src/cli.ts`
edit (that's T-042-03). No fs/spawn anywhere.

## `src/doctor/doctor-core.ts` — internal organization

Top-to-bottom, mirroring precommit-core.ts's layout:

1. **Header comment block.** Places the module in E-042 / story S-042-01. States: this is the
   pure `*-core` half; the impure twin is T-042-02 (`doctor-probe`, the `envinfo`-backed
   probe); the CLI arm is T-042-03; the cast-precondition reuse is T-042-04. Declares the
   PURE/TOTAL contract (no fs/spawn/clock/process/addon) and the returned-data-never-thrown
   house rule.

2. **`Check` interface.** The DATA shape the probe emits and the renderer consumes.
   ```ts
   export interface Check {
     readonly name: string;   // the dep being verified, e.g. "lisa on PATH"
     readonly ok: boolean;    // true = green
     readonly hint?: string;  // fix-it hint; present iff !ok (D1 convention)
   }
   ```

3. **`passed` / `failed` constructors.** Mint canonical checks. `failed` *requires* a hint
   (enforces the D1 convention at construction).
   ```ts
   export function passed(name: string): Check        // { name, ok: true }
   export function failed(name: string, hint: string): Check   // { name, ok: false, hint }
   ```

4. **`DoctorReport` interface.** The renderer's return value.
   ```ts
   export interface DoctorReport {
     readonly ok: boolean;       // every check green (vacuously true for an empty set)
     readonly exitCode: number;  // EXIT_OK when ok, else EXIT_FAILED
     readonly report: string;    // the full human-readable text the CLI prints verbatim
   }
   ```

5. **Exit-code R12 contract.**
   ```ts
   export const EXIT_OK = 0 as const;
   export const EXIT_FAILED = 1 as const;
   ```
   The CLI (T-042-03) derives its `process.exit` arg from `report.exitCode` / these — never
   re-literals `0`/`1`.

6. **`hintSuffix(hint)` — internal helper.** PURE. Whitespace-collapse a hint to a one-line
   ` — <hint>` suffix, or `""` when absent/blank (guards against a literal `"undefined"`).
   The `tail`/`summarySuffix` idiom from precommit-core/history-core.

7. **`line(check)` — internal helper.** PURE. Render one check to `  ✓ <name>` (green) or
   `  ✗ <name><hintSuffix>` (red).

8. **`renderDoctorReport(checks)` — the one public verb.** PURE/TOTAL. The whole judgment:
   - count failures (`checks.filter(c => !c.ok)`);
   - **empty set** → `{ ok: true, exitCode: EXIT_OK, report: "doctor: no checks to run" }`
     (honest-empty, D4);
   - **all green** → header `doctor: ok — N check(s) passed` + one `✓` line per check;
     `{ ok: true, exitCode: EXIT_OK }`;
   - **any red** → header `doctor: FAILED — K of N check(s) failed` + one marked line per
     check (greens `✓`, reds `✗ … — hint`), in INPUT ORDER; `{ ok: false, exitCode:
     EXIT_FAILED }`.
   - `ok` is derived as `failCount === 0`; `exitCode` derived from `ok` — no parallel field
     to desync (history-core's `anyRed = redCount > 0` discipline).

No `assertNever` is needed here — there is no closed string union to switch on (the three
report shapes are `if`-branches over counts, each returning a complete `DoctorReport`, the
way `classifyHistory` does). So this module has **zero `throw`s**, fully honoring the house
rule.

## Public interface (frozen)

```ts
export interface Check { readonly name: string; readonly ok: boolean; readonly hint?: string; }
export interface DoctorReport { readonly ok: boolean; readonly exitCode: number; readonly report: string; }
export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export function passed(name: string): Check;
export function failed(name: string, hint: string): Check;
export function renderDoctorReport(checks: readonly Check[]): DoctorReport;
```

## Consumers (downstream, not built here)

- **T-042-02 `doctor-probe`** imports `Check`, `passed`, `failed` to emit the ~3
  `envinfo`-backed results without ever throwing.
- **T-042-03 CLI `doctor` arm** imports `renderDoctorReport`, prints `report.report`,
  `process.exit(report.exitCode)`.
- **T-042-04 cast precondition** imports `renderDoctorReport` (+ the probe) to refuse a cast
  at the door when `!report.ok`, reusing the same named-check + hint refusal.

## `src/doctor/doctor-core.test.ts` — test map

Imports ONLY `./doctor-core.ts`. `describe` blocks:

- **`renderDoctorReport`**
  - AC: all-green set → `ok` true, `exitCode === EXIT_OK` (0), report contains each dep name
    and a `✓` per check (renders each dep green).
  - AC: one failing check among greens → `ok` false, `exitCode` non-zero (`=== EXIT_FAILED`),
    report contains the failing check's NAME and its HINT, and a `✗`.
  - AC (purity / no IO): structural — the module imports nothing impure; the call is a plain
    function over data (asserted by the test running with no fs/spawn and being deterministic
    across repeated calls).
  - Edges: empty set → honest "no checks to run", `ok` true, exit 0, NOT containing "green".
    Multiple failures → header names `K of N`. A failing check with a multi-line hint → hint
    collapsed to one line. All-green report does NOT contain `✗`.
- **`passed` / `failed`** — `passed(name)` → `{ ok: true }`, no hint; `failed(name, hint)` →
  `{ ok: false, hint }`. A `failed` check flows through the renderer as a red line with its
  hint.
- **exit-code constants** — `EXIT_OK === 0`, `EXIT_FAILED` non-zero (and `!== EXIT_OK`).

## Ordering

Single atomic unit: write `doctor-core.ts`, then `doctor-core.test.ts`, then run `tsc
--noEmit` + `bun test`. One commit. No inter-step dependency beyond core-before-test.
