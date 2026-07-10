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

/** The project bucket a record with no `project` field is grouped under (T-013-03). Every
 *  pre-T-013-03 record (and any cast that recorded no project) falls here. A stable,
 *  parenthesized sentinel so it never collides with a real project basename. */
export const DEFAULT_PROJECT = "(default)";

/**
 * The terminal states a run can reach, as a `const` tuple so {@link RunOutcome} is
 * a literal union a `switch` can check exhaustively. Each maps to a state the other
 * modules already produce: `timed-out` ← seam's `ClaudeTimeoutError`;
 * `budget-exhausted` ← budget's `check` returning `exhausted`; `gate-failed` ← a
 * gate verdict; `id-collision` ← `materialize`'s cross-board guard refusing a plan
 * whose ids already live on the board (T-004-02); `missing-capability` ← a declared
 * play's required MCP server absent from the project registry, refused BEFORE dispense
 * (E-032, T-032-02 — an IA-9 amber refusal, nothing cast/materialized); `graph-invalid`
 * ← decompose's pre-write net: the canonicalized plan would not materialize to a board
 * vend's own `buildGraph` accepts (a dangling/un-nested id), refused BEFORE any write
 * (E-061 retro #8); `bare-code` ← materialize's write guard: a rendered body would carry
 * a policed charter code with no cut-time gloss — the charter cannot resolve a cited
 * code — refused BEFORE any write (T-067-01-03); `errored` ← a node's cast THREW (E-054
 * — the graph runner wraps the throw into a marked, non-proceeding node summary rather
 * than crashing the wave; a throw is not a crash); `success` ← none tripped. The runner
 * classifies; the log records.
 */
export const RUN_OUTCOMES = ["success", "gate-failed", "timed-out", "budget-exhausted", "id-collision", "missing-capability", "graph-invalid", "bare-code", "errored"] as const;

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
  /** Stable project identifier this cast ran against (T-013-03) — the dataset-shape field
   *  the two-level bias correction groups by (project deviation vs the generic play). The
   *  runner stamps the repo-root basename; absent ⇒ field omitted (every pre-T-013-03
   *  record), grouped under {@link DEFAULT_PROJECT} on read. */
  readonly project?: string;
  /** One self-reported bit (T-014-01, PRD KR1): did the author step in mid-run (`true`) or
   *  let it clear (`false`)? Absent ⇒ unknown — back-compat (every pre-T-014-01 record), and
   *  the only legal "we don't know" value, so this coerces (non-boolean ⇒ omitted) rather
   *  than asserting. The forward-looking E1 walk-away instrument. */
  readonly intervened?: boolean;
  /** Provenance of the {@link intervened} bit (T-028-01): `true` ⇒ this self-report is a
   *  post-hoc ATTESTATION (back-fill via `attest-intervention.ts`), not a live forward capture.
   *  Absent ⇒ forward/live (the real instrument) — the only road a verdict cites. A one-way flag:
   *  only `true` is meaningful, so `false`/absent are identical (both not-attested) and `false`
   *  is never written — keeping a forward record byte-identical to a pre-T-028-01 one. */
  readonly intervenedAttested?: boolean;
  /** Agentic turns the cast took (T-015-02), harvested off the seam's `result.num_turns`.
   *  Absent ⇒ field omitted (unknown) — back-compat, exactly like {@link intervened}. The
   *  forward-looking signal the warranted turn cap is calibrated from (the cap is a judgment,
   *  not a frozen guess; logging turns is what lets data refine it). */
  readonly turnsUsed?: number;
  /** One-way honest marker (T-060-01-02, E-060 #3): `true` ⇒ this cast ran with REDUCED
   *  grounding — a declared `optionalMcp` server (e.g. `codebase-memory-mcp`) was absent and so
   *  dropped from the scoped tool set (`resolveTools`' `reducedGrounding`). Absent ⇒ fully
   *  grounded (the default) / unknown. Only `true` is meaningful, so this is a ONE-WAY flag exactly
   *  like {@link intervenedAttested}: `false`/absent are identical (both not-degraded) and `false`
   *  is never written, keeping a fully-grounded record byte-identical to a pre-T-060-01-02 one. The
   *  signal that makes a degraded clear COUNTABLE (a degraded run = a record carrying this marker)
   *  rather than invisible. */
  readonly reducedGrounding?: boolean;
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
  /** Present ONLY when the cast supplied one — absence is meaningful (a pre-T-013-03
   *  record), so it is omitted rather than written, and {@link projectOf} supplies the
   *  default bucket on read. */
  readonly project?: string;
  /** Present ONLY when the cast supplied one — absence is meaningful (unknown), so it is
   *  omitted rather than written, exactly like {@link RunRecord.envelope}/`project`. `false`
   *  (a clean walk-away) is a real value and IS written; only absence reads as unknown. */
  readonly intervened?: boolean;
  /** Present ONLY when `true` — the provenance of {@link RunRecord.intervened} (T-028-01).
   *  `true` ⇒ the bit was ATTESTED post-hoc (back-fill); absent ⇒ forward/live. A one-way flag:
   *  `false` is never written, so a forward record stays byte-identical to a pre-T-028-01 one.
   *  {@link reviveRecord} derives it from the raw `intervenedAttestation` marker on read, so
   *  existing back-fill records reclassify with NO ledger rewrite. The forward count is the one
   *  a verdict cites — this is what keeps attested back-fill from being mistaken for it. */
  readonly intervenedAttested?: boolean;
  /** Present ONLY when the cast supplied one — absence is meaningful (unknown), so it is
   *  omitted rather than written, exactly like {@link RunRecord.intervened}. The signal the
   *  warranted turn cap (T-015-02) is calibrated from. */
  readonly turnsUsed?: number;
  /** Present ONLY when `true` (T-060-01-02) — this cast ran with reduced grounding (a declared
   *  optional MCP server was absent). A ONE-WAY marker like {@link intervenedAttested}: `false` is
   *  never written, so a fully-grounded record stays byte-identical to a pre-T-060-01-02 one.
   *  {@link reviveRecord} preserves it across the read boundary, so a degraded clear stays
   *  countable after a ledger round-trip. */
  readonly reducedGrounding?: true;
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

/** Normalize the stable project id: absent / empty / non-string ⇒ `undefined` (the field
 *  is then omitted — absence is meaningful, never written, exactly like the envelope); a
 *  present non-empty string is trimmed and taken verbatim. Unlike the id fields, an absent
 *  project is LEGAL (back-compat), so this coerces rather than asserting. */
function normalizeProject(p: string | undefined): string | undefined {
  if (typeof p !== "string") return undefined;
  const trimmed = p.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Normalize the self-reported intervention bit (T-014-01): a real boolean is taken
 *  verbatim (`false` is a value, not absence — it is the clean walk-away); anything else
 *  (absent, or a non-boolean from a torn caller) ⇒ `undefined`, so the field is omitted and
 *  reads as unknown. Like {@link normalizeProject}, absence is LEGAL back-compat — coerce,
 *  don't assert. */
function normalizeIntervened(v: boolean | undefined): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/** Normalize the attestation provenance flag (T-028-01): a ONE-WAY marker — only `true` is
 *  meaningful (this self-report is a post-hoc back-fill). Anything else (`false`, absent, or a
 *  non-boolean) ⇒ `undefined`, so the field is omitted and a forward record stays byte-identical
 *  to a pre-T-028-01 one. Like {@link normalizeIntervened}, absence is LEGAL — coerce, don't assert. */
function normalizeIntervenedAttested(v: boolean | undefined): true | undefined {
  return v === true ? true : undefined;
}

/** Normalize turns-used (T-015-02): a finite, non-negative integer is taken verbatim;
 *  anything else (absent, non-finite, negative, or non-integer from a torn caller) ⇒
 *  `undefined`, so the field is omitted and reads as unknown. Like {@link normalizeIntervened},
 *  absence is LEGAL back-compat — coerce, don't assert. */
function normalizeTurnsUsed(v: number | undefined): number | undefined {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined;
}

/** Normalize the reduced-grounding marker (T-060-01-02): a ONE-WAY flag — only `true` is
 *  meaningful (this cast ran with reduced grounding). Anything else (`false`, absent, or a
 *  non-boolean from a torn caller) ⇒ `undefined`, so the field is omitted and a fully-grounded
 *  record stays byte-identical to a pre-T-060-01-02 one. Mirrors {@link normalizeIntervenedAttested}. */
function normalizeReducedGrounding(v: boolean | undefined): true | undefined {
  return v === true ? true : undefined;
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

  // Spread envelope/project/intervened only when present, so an envelope-less cast (and every
  // pre-T-013-01 / pre-T-013-03 / pre-T-014-01 record) leaves the field OFF the record — same
  // shape, byte for byte. `intervened: false` is a value, not absence, so it IS written.
  const envelope = normalizeEnvelope(input.envelope);
  const project = normalizeProject(input.project);
  const intervened = normalizeIntervened(input.intervened);
  const intervenedAttested = normalizeIntervenedAttested(input.intervenedAttested);
  const turnsUsed = normalizeTurnsUsed(input.turnsUsed);
  const reducedGrounding = normalizeReducedGrounding(input.reducedGrounding);

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
    ...(project ? { project } : {}),
    ...(intervened !== undefined ? { intervened } : {}),
    ...(intervenedAttested ? { intervenedAttested } : {}),
    ...(turnsUsed !== undefined ? { turnsUsed } : {}),
    ...(reducedGrounding ? { reducedGrounding } : {}),
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

  // A project is kept only when it is a non-empty string; a malformed one is dropped
  // (field omitted, grouped under the default) rather than admitted or used to reject.
  const project = isNonEmptyString(r.project) ? r.project : undefined;

  // The intervention bit is kept only when it is a real boolean (T-014-01); anything else
  // (absent — a pre-T-014-01 record — or a malformed value) is dropped (field omitted, reads
  // as unknown) rather than admitted or used to reject the record. `false` is kept.
  const intervened = typeof r.intervened === "boolean" ? r.intervened : undefined;

  // Provenance (T-028-01): the bit is ATTESTED back-fill when the raw line carries a truthy
  // `intervenedAttestation` MARKER (the `{ by, at, basis }` object `attest-intervention.ts`
  // writes) OR an explicit `intervenedAttested === true` (write-symmetry). This is the
  // root-cause fix — before T-028-01 the reviver read `intervened` but dropped its provenance,
  // so the audit could not tell attested back-fill from a live forward capture. A truthy-OBJECT
  // check (not a bare truthy) matches the attestor's shape and won't trip on a stray non-object.
  // One-way: only `true` is surfaced (forward/unknown records leave the field omitted), so no
  // ledger rewrite is needed — existing back-fill records reclassify purely on their marker.
  const attestedByMarker = typeof r.intervenedAttestation === "object" && r.intervenedAttestation !== null;
  const attestedByFlag = r.intervenedAttested === true;
  const intervenedAttested = attestedByMarker || attestedByFlag ? true : undefined;

  // turns-used (T-015-02) is kept only when it is a finite non-negative integer; anything
  // else (absent — a pre-T-015-02 record — or a malformed value) is dropped (field omitted,
  // reads unknown) rather than admitted or used to reject the record. Mirrors `intervened`.
  const turnsUsed = normalizeTurnsUsed(typeof r.turnsUsed === "number" ? r.turnsUsed : undefined);

  // The reduced-grounding marker (T-060-01-02) is kept only when it is the boolean `true`; anything
  // else (absent — a pre-T-060-01-02 record — `false`, or a malformed value) is dropped (field
  // omitted, reads as fully-grounded/unknown) rather than admitted or used to reject. One-way, so
  // the read boundary preserves a degraded clear's countability across the ledger round-trip.
  const reducedGrounding = normalizeReducedGrounding(typeof r.reducedGrounding === "boolean" ? r.reducedGrounding : undefined);

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
    ...(project ? { project } : {}),
    ...(intervened !== undefined ? { intervened } : {}),
    ...(intervenedAttested ? { intervenedAttested } : {}),
    ...(turnsUsed !== undefined ? { turnsUsed } : {}),
    ...(reducedGrounding ? { reducedGrounding } : {}),
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
 * The project a record is grouped under (T-013-03): its `project` field, or
 * {@link DEFAULT_PROJECT} when absent (every pre-T-013-03 record). PURE — the read-side
 * mirror of the write-side basename stamp, so the two-level bias correction can group
 * runs by project as well as by play.
 */
export function projectOf(r: RunRecord): string {
  return r.project ?? DEFAULT_PROJECT;
}

/**
 * Filter records to one play, optionally to one outcome and/or one project. PURE. This is
 * the seam the recalibrator needs (IA-13): `forPlay(recs, p, { outcome: "success" })` is
 * the uncensored sample to bound the tail from; the censored set (`budget-exhausted` /
 * `timed-out`, treated as `≥ envelope` lower bounds) is the same call with the other
 * outcome. The `project` filter (T-013-03) is the seam the hierarchical bias correction
 * needs — `forPlay(recs, p, { project })` per distinct {@link projectOf} groups a play's
 * runs by project (legacy records fall under {@link DEFAULT_PROJECT}).
 */
export function forPlay(
  records: readonly RunRecord[],
  play: string,
  opts: { readonly outcome?: RunOutcome; readonly project?: string } = {},
): readonly RunRecord[] {
  return records.filter(
    (r) =>
      r.play === play &&
      (opts.outcome === undefined || r.outcome === opts.outcome) &&
      (opts.project === undefined || projectOf(r) === opts.project),
  );
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
