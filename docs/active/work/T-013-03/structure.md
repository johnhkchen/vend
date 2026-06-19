# T-013-03 — Structure

*The blueprint: which files change, the public interfaces, the internal organization, the
ordering. Not code — the shape of the code.*

Four source files touched, three test files extended. No new files (the `calibrate` core
lands beside `recalibrate` in `src/ledger/recalibrate.ts`, per E-013's "the Ledger grows
in one place"). All additions are backward-compatible (optional field + new pure exports +
additive CLI flags).

```
src/log/run-log.ts          MODIFY  + project? field, projectOf, DEFAULT_PROJECT, forPlay project opt
src/log/run-log.test.ts     MODIFY  + project field/back-compat/forPlay-by-project tests
src/ledger/recalibrate.ts   MODIFY  + BiasFactor, BiasPrior, CalibrateResult, learnBiasFactor,
                                      calibrate, formatCorrectionLabel
src/ledger/recalibrate.test.ts MODIFY + learnBiasFactor / calibrate / pooling / label tests
src/engine/cast.ts          MODIFY  + project (basename) on CastOptions + appendRunLog input
src/cli.ts                  MODIFY  + --estimate / --project on envelope; correction line in dispatch
src/cli.test.ts             MODIFY  + envelope --estimate / --project parse tests
```

---

## 1. `src/log/run-log.ts` — the project field + reader grouping (AC1)

Mirror the `envelope?` idiom step for step.

- **`Envelope` block neighbours** — add a documented `DEFAULT_PROJECT` const:
  ```ts
  /** The project bucket a record with no `project` field is grouped under (back-compat:
   *  every pre-T-013-03 record). A stable sentinel, never collides with a real basename. */
  export const DEFAULT_PROJECT = "(default)";
  ```
- **`RunRecordInput`** — add `readonly project?: string;` (doc: "stable project id;
  absent ⇒ field omitted, grouped under {@link DEFAULT_PROJECT} on read").
- **`RunRecord`** — add `readonly project?: string;` (same omitted-when-absent doc as
  `envelope?`).
- **`normalizeProject(p)`** — private helper beside `normalizeEnvelope`:
  ```ts
  /** Absent / empty / non-string ⇒ undefined (field omitted — back-compat). A present
   *  non-empty string is taken verbatim (trimmed). */
  function normalizeProject(p: string | undefined): string | undefined
  ```
  Returns `undefined` for absent/empty so `buildRunRecord` omits it; a real id passes
  through. (Unlike `assertNonEmpty` ids, an absent project is **legal** — do not throw.)
- **`buildRunRecord`** — spread it like `envelope`:
  `...(project ? { project } : {})` (placed right after the envelope spread).
- **`reviveRecord`** — keep `project` only when it is a non-empty string:
  ```ts
  const project = isNonEmptyString(r.project) ? r.project : undefined;
  ...(project ? { project } : {})
  ```
- **`projectOf(r)`** — exported pure derivation:
  ```ts
  /** The project a record is grouped under: its `project` field, or {@link DEFAULT_PROJECT}
   *  when absent (every legacy record). PURE — the read-side mirror of the write-side
   *  basename stamp. */
  export function projectOf(r: RunRecord): string
  ```
- **`forPlay`** — widen the opts bag (additive, the `outcome?` precedent):
  ```ts
  export function forPlay(
    records, play,
    opts: { readonly outcome?: RunOutcome; readonly project?: string } = {},
  ): readonly RunRecord[]
  ```
  Filter adds `&& (opts.project === undefined || projectOf(r) === opts.project)`. Grouping
  "a play's runs by project" = `forPlay(recs, play, { project })` per distinct
  `projectOf`.

**Invariant preserved:** zero new imports; `project` is a plain string. Legacy records
(no field) round-trip byte-identical.

## 2. `src/ledger/recalibrate.ts` — the bias-correction core (AC2–AC4)

Append below `formatEnvelopeLabel`, under a new section banner. Imports gain `projectOf`
(value, pure) from run-log; `Budget` stays type-only.

- **Types** (beside `RecalibrateResult`):
  ```ts
  export interface BiasFactor { readonly tokens: number; readonly timeMs: number }
  export interface BiasPrior  { readonly factor: BiasFactor; readonly n: number }
  export interface CalibrateResult {
    readonly corrected: Budget;
    readonly factor: BiasFactor;
    readonly confidence: { readonly projectN: number; readonly genericN: number };
  }
  ```
- **Constants:**
  ```ts
  export const DEFAULT_SHRINKAGE = 5;                          // K — prior's equivalent sample size
  export const IDENTITY_FACTOR: BiasFactor = { tokens: 1, timeMs: 1 };  // no correction
  ```
- **`learnBiasFactor(records, opts?) → BiasPrior`** — PURE. Filters to `success` runs that
  carry an `envelope`; builds two ratio samples (tokens always; time only when
  `wallClockMs` is non-null **and** `envelope.timeMs > 0`); each factor dim = median ratio
  (`percentile(sortedAsc, 0.5)`), or `1` when that dim's sample is empty. `n` = the
  **token**-pair count (the headline sample size; tokens are always present when an
  envelope is). Returns `{ factor: IDENTITY_FACTOR, n: 0 }` for an empty sample — the
  authored-default identity. `opts.window?` reuses the recency-window idea (default
  `DEFAULT_WINDOW`).
- **`calibrate(estimate, key, projectRecords, genericPrior, opts?) → CalibrateResult`** —
  PURE. Steps:
  1. `proj = learnBiasFactor(projectRecords.filter(r => r.play === key.play && projectOf(r)
     === key.project))` — robust to an unfiltered caller; `projectN = proj.n`.
  2. `genericN = genericPrior.n`; `g = genericPrior.factor`.
  3. `w = projectN / (projectN + K)`, `K = opts.shrinkage ?? DEFAULT_SHRINKAGE`.
  4. per dim: `pooled = w·proj.factor.dim + (1−w)·g.dim`; `corrected.dim =
     positiveInt(estimate.dim · pooled)`.
  5. return `{ corrected, factor: pooledFactor, confidence: { projectN, genericN } }`.
  - When `projectN = 0`: `proj.factor` is identity, **and** `w = 0`, so `pooled = g`
    (generic dominates) — both paths agree; pooled = generic. When `genericN = 0` too,
    `g` is identity ⇒ `corrected = estimate` (authored default). No branches.
- **`formatCorrectionLabel(result) → string`** — PURE, mirrors `formatEnvelopeLabel`. Reads
  e.g. `"× t0.30 / w0.50 · 8 project / 40 generic"` (token & time factors to 2dp, then the
  data backing). When `projectN = 0 ∧ genericN = 0` reads `"uncorrected (no data)"`.

## 3. `src/engine/cast.ts` — stamp the project (AC1 write side)

- **`CastOptions`** — add `readonly project?: string;` (doc: "stable project id stamped on
  the record; defaults to the repo-root basename").
- **Import** `basename` from `node:path` (already imports `dirname, join`).
- **In `castPlay`** — after `const root = …`: `const project = opts.project ?? basename(root)`.
- **`appendRunLog` input** — add `project,` beside `envelope: budget`. (basename of a real
  root is always non-empty; `normalizeProject` still guards.)

## 4. `src/cli.ts` — the surface (AC4/AC5)

- **`ParsedCommand` envelope variant** — extend:
  `{ cmd: "envelope"; play; tier: ValueTier; estimate?: Budget; project?: string }`.
- **`parseEnvelopeArgs`** — after `--tier`, parse optional `--estimate <ms>,<tokens>` (via
  `parseBudgetArg`, returning a usage error on a bad value, like `parseRunArgs`) and
  optional `--project <id>` (any token after the flag; missing value ⇒ usage error). Return
  them only when present (additive, no behavior change for the existing two-arg form).
- **`USAGE`** — extend the envelope line:
  `vend envelope <play> [--tier …] [--estimate <ms>,<tokens>] [--project <id>]`.
- **Dispatch `envelope` arm** — after printing the existing recalibrate line, add the
  correction:
  ```ts
  const { calibrate, learnBiasFactor, formatCorrectionLabel } = recalibrate-module;
  const { forPlay, projectOf } = run-log-module;
  const project = parsed.project ?? basename(process.cwd());
  const estimate = parsed.estimate ?? result.envelope;          // measured default feeds through
  const genericPrior = learnBiasFactor(forPlay(records, parsed.play));
  const projectRecords = forPlay(records, parsed.play, { project });
  const corr = calibrate(estimate, { play: parsed.play, project }, projectRecords, genericPrior);
  process.stdout.write(`  ↳ corrected: ${corr.corrected.tokens} tokens / ${corr.corrected.timeMs} ms — ${formatCorrectionLabel(corr)}\n`);
  process.exit(0);
  ```
  Lazy imports already in place; add `basename` import or use the existing path import.
  Still exit 0.

## 5–7. Tests (AC1–AC4 coverage)

- **`run-log.test.ts`** — new describe blocks: project field round-trips
  (build→serialize→revive), absent ⇒ omitted & `projectOf` → `DEFAULT_PROJECT`, malformed
  project dropped, `forPlay … { project }` filters (incl. default bucket for legacy records).
- **`recalibrate.test.ts`** — extend `recordOf` usage with `envelope` + `project`; describe
  blocks: `learnBiasFactor` (median ratio per dim, no-envelope skipped, null-time dropped,
  empty ⇒ identity/n0), `calibrate` three pooling regimes (N=0 generic, small-N shrunk,
  large-N project-dominant) + **monotonicity** across growing N + direction (over/under) +
  authored-default when both empty + positive-int output, `formatCorrectionLabel`.
- **`cli.test.ts`** — extend the envelope `parseArgs` block: `--estimate` parsed to a
  Budget, `--project` carried, bad `--estimate` ⇒ usage, combined with `--tier`.

## Ordering

1. run-log field + reader (foundation; AC1) → its tests green.
2. `learnBiasFactor` + `calibrate` + label (AC2/AC3) → its tests green.
3. cast.ts write-side stamp (AC1 write).
4. cli surface (AC4/AC5) → parse tests green.
5. Full `bun run check` + a live `vend envelope … --estimate` smoke (AC5).

Each step compiles and tests independently; 1–2 are the high-value pure cores.
