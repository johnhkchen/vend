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

import { appendFile, mkdir, readFile } from "node:fs/promises";
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

/**
 * The allocated envelope (time + token ceiling) a cast was run under (T-013-01). This
 * is structurally identical to budget's `Budget`, declared HERE so run-log keeps its
 * zero-coupling-to-`src/budget/` invariant (the same `UsageInput` trick): the runner's
 * `Budget` satisfies this by duck-typing, with no compile-time import. Recording it is
 * what makes cost-vs-budget recoverable from the ledger (IA-12/IA-13) — actuals alone
 * cannot tell how close a cast ran to its ceiling, nor mark a censored (andon'd-at-
 * envelope) run.
 */
export interface Envelope {
  readonly timeMs: number;
  readonly tokens: number;
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
  /** The allocated {@link Envelope} this cast ran under; absent ⇒ field omitted (a
   *  cast that recorded no envelope, and every pre-T-013-01 record, look identical). */
  readonly envelope?: Envelope;
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
  /** Present ONLY when the cast supplied one — absence is meaningful (no envelope
   *  recorded), so it is omitted rather than zeroed (a zeroed envelope is an invalid
   *  budget the recalibrator could not distinguish from a real allocation). */
  readonly envelope?: Envelope;
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

/** Normalize the allocated envelope: absent ⇒ `undefined` (the field is then omitted
 *  from the record — absence is meaningful, never written as `0`s); present ⇒ both
 *  numbers coerced finite (the `num` idiom), so a torn input can never inject `NaN`. */
function normalizeEnvelope(e: Envelope | undefined): Envelope | undefined {
  if (!e) return undefined;
  return { timeMs: num(e.timeMs), tokens: num(e.tokens) };
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

  // Spread the envelope only when present, so an envelope-less cast (and every
  // pre-T-013-01 record) leaves the field OFF the record — same shape, byte for byte.
  const envelope = normalizeEnvelope(input.envelope);

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
    ...(envelope ? { envelope } : {}),
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

// ── The read face (T-013-01) ──────────────────────────────────────────────────────
// The mirror image of the write face above, and the foundation the Ledger reads back
// (E-013, IA-13). Same purity split: `reviveRecord` / `readRuns` / `forPlay` and the
// two derivations are PURE (tested on string/object fixtures); `loadRunLog` is the one
// thin impure fs verb. The two boundaries hold OPPOSITE stances by design: the WRITE
// boundary asserts loudly (a malformed input is a caller bug), the READ boundary
// degrades quietly (a torn or stale line in an append-only ledger is expected — skip it
// and count it, never throw, so one bad line can't blind the recalibrator to the rest).

/** The result of reading a ledger: the recovered records plus how many lines were
 *  unreadable (malformed JSON, partial/torn final line, or structurally invalid). The
 *  count is surfaced — not swallowed — so a consumer can flag a corrupt ledger. */
export interface ReadResult {
  readonly records: readonly RunRecord[];
  readonly skipped: number;
}

/** True for a non-empty string — the id/timestamp fields a valid record must carry. */
function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Structurally revive one already-`JSON.parse`d value into a {@link RunRecord}, or
 * return `null` if it is not a usable record. PURE and TOTAL — it NEVER throws; the
 * read boundary degrades, it does not assert. Mirrors the normalization
 * {@link buildRunRecord} applies, but with the opposite failure mode (drop, don't
 * throw). Tolerates absent newer fields (an old `envelope`-less record parses) and
 * drops a malformed `envelope` without rejecting the whole record — the actuals are
 * still useful to the Ledger even if the envelope was corrupted.
 */
export function reviveRecord(parsed: unknown): RunRecord | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (
    !isNonEmptyString(r.runId) ||
    !isNonEmptyString(r.play) ||
    !isNonEmptyString(r.epic) ||
    !isNonEmptyString(r.model) ||
    !isNonEmptyString(r.startedAt) ||
    !isNonEmptyString(r.endedAt)
  ) {
    return null;
  }
  if (typeof r.outcome !== "string" || !(RUN_OUTCOMES as readonly string[]).includes(r.outcome)) {
    return null;
  }

  // `usage`/`gateResults` are re-normalized through the same helpers the writer uses,
  // so a partial or absent block degrades to the same canonical shape (0s / []).
  const usage = normalizeUsage((typeof r.usage === "object" && r.usage !== null ? r.usage : undefined) as UsageInput);
  const gateResults = normalizeGates(Array.isArray(r.gateResults) ? (r.gateResults as GateResult[]) : undefined);

  // An envelope is kept only when BOTH numbers are finite; a malformed one is dropped
  // (field omitted) rather than admitted as a lie or used to reject the record.
  const env = r.envelope;
  let envelope: Envelope | undefined;
  if (typeof env === "object" && env !== null) {
    const e = env as Record<string, unknown>;
    if (Number.isFinite(e.timeMs) && Number.isFinite(e.tokens)) {
      envelope = { timeMs: e.timeMs as number, tokens: e.tokens as number };
    }
  }

  return Object.freeze({
    v: RUN_LOG_SCHEMA_VERSION,
    runId: r.runId,
    play: r.play,
    epic: r.epic,
    model: r.model,
    outcome: r.outcome as RunOutcome,
    usage,
    costUsd: num(typeof r.costUsd === "number" ? r.costUsd : undefined),
    gateResults,
    ...(envelope ? { envelope } : {}),
    startedAt: r.startedAt,
    endedAt: r.endedAt,
  });
}

/**
 * Parse a JSONL ledger string into records. PURE — takes the text, not a path (the fs
 * read is {@link loadRunLog}'s job), so it is unit-testable on a literal. Blank lines
 * are ignored; any line that fails `JSON.parse` or {@link reviveRecord} is skipped and
 * counted. This is the "tolerates malformed/partial lines without throwing" contract:
 * an append-only ledger can end in a torn line if a process died mid-write, and that
 * one casualty must not lose the records before it.
 */
export function readRuns(jsonl: string): ReadResult {
  const records: RunRecord[] = [];
  let skipped = 0;
  for (const line of jsonl.split("\n")) {
    if (line.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }
    const rec = reviveRecord(parsed);
    if (rec === null) {
      skipped++;
      continue;
    }
    records.push(rec);
  }
  return { records, skipped };
}

/**
 * Filter records to one play, optionally to one outcome. PURE. This is the seam the
 * recalibrator needs (IA-13): `forPlay(recs, p, { outcome: "success" })` is the
 * uncensored sample to bound the tail from; the censored set (`budget-exhausted` /
 * `timed-out`, treated as `≥ envelope` lower bounds) is the same call with the other
 * outcome. The split is enabled here; the percentile math is T-013-02.
 */
export function forPlay(
  records: readonly RunRecord[],
  play: string,
  opts: { readonly outcome?: RunOutcome } = {},
): readonly RunRecord[] {
  return records.filter((r) => r.play === play && (opts.outcome === undefined || r.outcome === opts.outcome));
}

/**
 * Derived wall-clock duration of a record in ms (`endedAt − startedAt`). PURE. Returns
 * `null` if either ISO timestamp is unparseable, so a consumer branches explicitly
 * rather than propagating a `NaN`. Not stored on the record — derivable, so not persisted.
 */
export function wallClockMs(r: RunRecord): number | null {
  const start = Date.parse(r.startedAt);
  const end = Date.parse(r.endedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return end - start;
}

/**
 * Derived total tokens for a record: the sum of the four usage sub-counts. PURE. This
 * is the same definition as budget's `countTokens` (the single notion of "spent"); it
 * is inlined here rather than imported to preserve run-log's zero-coupling invariant.
 */
export function totalTokens(r: RunRecord): number {
  const u = r.usage;
  return u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens;
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

/**
 * Load and parse the ledger from disk. The single IMPURE read verb — the mirror of
 * {@link appendRunLog}, composing the pure {@link readRuns} and adding only the fs
 * read. Not unit-tested (its logic is the tested pure core), exactly as `appendRunLog`
 * is not. A MISSING ledger is not an error — a fresh project simply has no runs yet,
 * so ENOENT returns an empty result; any other fs error propagates (a real fault, not
 * a clean "no data" state).
 */
export async function loadRunLog(opts: AppendRunLogOptions = {}): Promise<ReadResult> {
  const path = opts.path ?? DEFAULT_RUN_LOG_PATH;
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException)?.code === "ENOENT") return { records: [], skipped: 0 };
    throw e;
  }
  return readRuns(text);
}
