// Countable run log (T-001-04) — every run leaves exactly one JSONL record so the
// later consistency layer is just *reading data we already kept* (E-001
// done-looks-like; charter's "you got what you paid for" must be demonstrable).
//
// Append-only, one line per run, countable with `wc -l` / `jq`. A failed run still
// writes a record carrying its failure `outcome` — that falls out of the design,
// not a special branch, because `outcome` is a field the runner passes.
//
// Two faces, mirroring the house pattern (budget.ts pure; claude.ts pure helpers +
// one impure verb):
//   (a) PURE  — `buildRunRecord` validates + normalizes the runner's data into a
//               frozen `RunRecord`; `serializeRunRecord` renders it as one JSONL
//               line. Both are unit-tested to the branch with fabricated inputs.
//   (b) IMPURE — `appendRunLog` is the single thin fs verb: it composes the pure
//               pair and does `mkdir -p` + append. Not unit-tested (its logic lives
//               in the pure pair), exactly as `dispense` is the seam's one untested
//               function.
//
// DECOUPLED (AC #4): this module imports NOTHING from src/executor/ (the seam) or
// src/budget/. The shapes it logs (`UsageInput`, `GateResult`) are declared locally
// as structural contracts — the seam's `result.usage` and budget's `Usage` satisfy
// `UsageInput` by duck-typing, with zero compile-time coupling. The runner passes
// the data; the log is a sink, never a collaborator. This keeps the DAG edge
// (T-001-04 depends only on T-001-01) honest.

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/** Default ledger location, relative to cwd. Overridable per call (AC #1). */
export const DEFAULT_RUN_LOG_PATH = ".vend/runs.jsonl";

/**
 * The terminal states a run can reach, as a `const` tuple so {@link RunOutcome} is
 * a literal union a `switch` can check exhaustively. Each maps to a state the other
 * modules already produce: `timed-out` ← seam's `ClaudeTimeoutError`;
 * `budget-exhausted` ← budget's `check` returning `exhausted`; `gate-failed` ← a
 * gate verdict; `id-collision` ← `materialize`'s cross-board guard refusing a plan
 * whose ids already live on the board (T-004-02); `success` ← none tripped. The
 * runner classifies; the log records.
 */
export const RUN_OUTCOMES = ["success", "gate-failed", "timed-out", "budget-exhausted", "id-collision"] as const;

/** The schema version stamped on every record. An append-only ledger is forever;
 *  this one integer is the cheapest insurance against an unversioned migration. */
export const RUN_LOG_SCHEMA_VERSION = 1;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];

/**
 * The usage shape the runner forwards — structurally identical to the seam's
 * `result.usage` and budget's `Usage`, declared here so neither is imported. Any
 * field may be absent on a given message, so all are optional and coerced
 * `undefined / non-finite → 0` during normalization.
 */
export interface UsageInput {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly cache_read_input_tokens?: number;
  readonly cache_creation_input_tokens?: number;
}

/** Usage after normalization: every sub-count is a finite number (no `undefined`). */
export interface NormalizedUsage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_input_tokens: number;
  readonly cache_creation_input_tokens: number;
}

/** One gate's verdict. Declared locally — `src/gate/` has no type to import yet. */
export interface GateResult {
  readonly gate: string;
  readonly passed: boolean;
  readonly detail?: string;
}

/** What the runner hands {@link buildRunRecord} / {@link appendRunLog} (pre-normalization). */
export interface RunRecordInput {
  readonly runId: string;
  readonly play: string;
  readonly epic: string;
  readonly model: string;
  readonly outcome: RunOutcome;
  /** Seam's `result.usage`; absent ⇒ all sub-counts logged as 0. */
  readonly usage?: UsageInput;
  /** Seam's `result.total_cost_usd`; absent / non-finite ⇒ logged as 0. */
  readonly costUsd?: number;
  /** Per-gate verdicts; absent ⇒ logged as `[]`. */
  readonly gateResults?: readonly GateResult[];
  /** ISO-8601, stamped by the runner — the log keeps no clock (purity). */
  readonly startedAt: string;
  readonly endedAt: string;
}

/** The normalized, frozen record that is serialized to one JSONL line. */
export interface RunRecord {
  readonly v: typeof RUN_LOG_SCHEMA_VERSION;
  readonly runId: string;
  readonly play: string;
  readonly epic: string;
  readonly model: string;
  readonly outcome: RunOutcome;
  readonly usage: NormalizedUsage;
  readonly costUsd: number;
  readonly gateResults: readonly GateResult[];
  readonly startedAt: string;
  readonly endedAt: string;
}

/** Options for {@link appendRunLog}. */
export interface AppendRunLogOptions {
  /** Ledger path; defaults to {@link DEFAULT_RUN_LOG_PATH}. */
  readonly path?: string;
}

/** Coerce a possibly-absent count to a finite number, defaulting to 0 (budget idiom). */
function num(v: number | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Require a non-empty string; an empty / non-string id is a caller error surfaced
 *  loudly at the boundary, before a malformed line can reach the ledger. */
function assertNonEmpty(s: string, label: string): void {
  if (typeof s !== "string" || s.length === 0) {
    throw new RangeError(`run-log ${label} must be a non-empty string, got ${JSON.stringify(s)}`);
  }
}

/** Require `o` to be a known outcome; an unknown label is a caller error. */
function assertOutcome(o: string): asserts o is RunOutcome {
  if (!(RUN_OUTCOMES as readonly string[]).includes(o)) {
    throw new RangeError(`run-log outcome must be one of ${RUN_OUTCOMES.join(" | ")}, got ${JSON.stringify(o)}`);
  }
}

/** Normalize usage: each sub-count coerced to a finite number, absent ⇒ 0. */
function normalizeUsage(u: UsageInput | undefined): NormalizedUsage {
  return {
    input_tokens: num(u?.input_tokens),
    output_tokens: num(u?.output_tokens),
    cache_read_input_tokens: num(u?.cache_read_input_tokens),
    cache_creation_input_tokens: num(u?.cache_creation_input_tokens),
  };
}

/** Normalize gate results: absent ⇒ `[]`; otherwise a defensively-copied array of
 *  the three logged fields (drops any extra keys the runner attached). */
function normalizeGates(g: readonly GateResult[] | undefined): readonly GateResult[] {
  if (!g) return [];
  return g.map(({ gate, passed, detail }) => (detail === undefined ? { gate, passed } : { gate, passed, detail }));
}

/**
 * Build a normalized, frozen {@link RunRecord} from the runner's data. PURE — no fs,
 * clock, network, or process. Validation throws `RangeError` for caller errors
 * (empty ids/timestamps, unknown outcome); absent data is coerced (`usage → 0s`,
 * `costUsd → 0`, `gateResults → []`). The split mirrors budget: programmer error
 * throws, absent data coerces.
 */
export function buildRunRecord(input: RunRecordInput): RunRecord {
  assertNonEmpty(input.runId, "runId");
  assertNonEmpty(input.play, "play");
  assertNonEmpty(input.epic, "epic");
  assertNonEmpty(input.model, "model");
  assertNonEmpty(input.startedAt, "startedAt");
  assertNonEmpty(input.endedAt, "endedAt");
  assertOutcome(input.outcome);

  return Object.freeze({
    v: RUN_LOG_SCHEMA_VERSION,
    runId: input.runId,
    play: input.play,
    epic: input.epic,
    model: input.model,
    outcome: input.outcome,
    usage: normalizeUsage(input.usage),
    costUsd: num(input.costUsd),
    gateResults: normalizeGates(input.gateResults),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  });
}

/**
 * Render a record as exactly one JSONL line. PURE. `JSON.stringify` with NO `space`
 * argument emits no literal newline (it escapes any `\n` inside string fields), so
 * the record occupies one physical line; the appended `\n` terminates it. This is
 * the single home of the "one record per line" invariant — `wc -l` == run count,
 * each line a standalone `jq` object.
 */
export function serializeRunRecord(record: RunRecord): string {
  return `${JSON.stringify(record)}\n`;
}

/**
 * Append one run's record to the ledger. The single IMPURE verb — composes the pure
 * pair above and adds only the fs calls. Not unit-tested (its logic is the tested
 * pure pair). `mkdir -p` is idempotent (first run creates `.vend/`); `appendFile`
 * (O_APPEND) never truncates, so the ledger is a monotonic, append-only record. A
 * failed run logs through this same call — `outcome` is just a field — so AC #2's
 * "a failed run still writes a record" is structural, not a branch.
 */
export async function appendRunLog(input: RunRecordInput, opts: AppendRunLogOptions = {}): Promise<void> {
  const path = opts.path ?? DEFAULT_RUN_LOG_PATH;
  const line = serializeRunRecord(buildRunRecord(input));
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, line, "utf8");
}
