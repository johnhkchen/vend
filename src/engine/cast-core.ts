// The generic cast loop's PURE decision core (T-007-02) — the play-agnostic mirror of
// src/play/decompose-epic-core.ts.
//
// Split out from cast.ts (the impure orchestrator) for the same reason the runner's core
// is split: cast.ts value-imports the executor seam (which spawns) and touches fs, so it
// is an impure verb. Keeping the JUDGMENT here — classify (the outcome decision), the
// gate-row translation, the two-surface stream formatter, the model resolver — lets
// cast-core.test.ts exercise it as an ordinary pure-function test. Every import is a
// TYPE (erased under verbatimModuleSyntax); no fs, clock, network, process, or native
// addon ever loads into the test process (the gates.test.ts / decompose-epic.test.ts
// discipline).
//
// WHY NOT REUSE decompose-epic-core.ts: that module lives in src/play/. The engine is the
// generic foundation a concrete play depends UP onto (T-007-03 makes decompose-epic.ts
// import castPlay), so an engine → play import would be a cycle. `classify` here also
// operates on the play-generic `GateVerdict` (gate: string, opaque on clear), NOT gates.ts's
// DecomposeEpic-bound `GateResult` — they are not assignable. So this core mirrors the
// runner's split and decision logic rather than importing it; `formatMessage` /
// `makeStreamSink` / `resolveLoggedModel` are re-implemented identically (already fully
// play-agnostic). A later kaizen can DRY the duplication once T-007-03 has fixed the
// dependency direction (play → engine).

import type { StreamMessage } from "../executor/claude.ts";
import type { ExecutorProbeResult, ResultMessage } from "../executor/executor.ts";
import { countTokens, type BudgetOutcome, type Usage } from "../budget/budget.ts";
import type { AgentSeat } from "../play/agent-seat.ts";
import type { GateVerdict, PlayTools } from "./play.ts";
import type {
  CapWindowExhausted,
  CrossVendorVerdict,
  GateResult as LogGate,
  RunOutcome,
} from "../log/run-log.ts";

/**
 * Logged when no real model id was observed on the stream and the caller pinned none
 * (the seam omits `--model` in that case). Lives in the pure core so the resolver below
 * is testable without the BAML addon. Mirrors decompose-epic-core's sentinel (T-005-01).
 */
export const DEFAULT_MODEL = "claude-cli-default";

/**
 * Pick the model id to stamp on the run log: the REAL id observed on the dispense stream,
 * else the caller's pinned id (`opts.model`), else the {@link DEFAULT_MODEL} sentinel.
 * PURE — the sentinel tail guarantees the non-empty string the run log requires even on a
 * timed-out run that returned no result.
 */
export function resolveLoggedModel(real: string | undefined, opt: string | undefined): string {
  return real ?? opt ?? DEFAULT_MODEL;
}

/**
 * Project a resolved executor's stable id onto the KNOWN_SEATS lane whose budget it burns
 * (T-071-01-02). Exact, explicit matching keeps provenance honest: a future or injected
 * executor has no known lane until its accounting policy is named here, so it returns
 * `undefined` and the run-log field is omitted rather than guessed. PURE — no registry or env
 * lookup; the caller passes the id of the executor instance it actually resolved.
 */
export function resolveSeatOfExecution(executorId: string): AgentSeat | undefined {
  switch (executorId) {
    case "claude":
      return "claude";
    case "openai-compat":
      return "codex";
    default:
      return undefined;
  }
}

/**
 * Resolve the effective agentic turn cap for a cast (T-015-02): the per-cast OVERRIDE
 * (`CastOptions.maxTurns`, T-015-01) wins, else the play's WARRANTED DEFAULT (`Play.maxTurns`),
 * else `undefined` (no cap ⇒ the seam omits `--max-turns` ⇒ turns bounded only by the
 * wall-clock latch + token budget). PURE — pins the override-wins precedence (AC1) in one
 * tested place, exactly as {@link resolveLoggedModel} pins the model-id precedence. The seam's
 * truthy guard folds a `0` to "absent" downstream; this resolver is pure `??`, so a `0`
 * override is returned as-is and the guard handles it.
 */
export function resolveMaxTurns(override: number | undefined, dflt: number | undefined): number | undefined {
  return override ?? dflt;
}

/**
 * The tagged result of {@link resolveTools} — the three states the cast path (T-032-02) branches
 * on. Discriminated first by `ok`, then (among the two successes) by `passthrough` vs `strict`.
 * Both successes carry `deny` (the E-051 denylist, possibly `[]`) — it is ORTHOGONAL to the
 * strict/passthrough split, so it rides on either:
 * - `{ ok: true, passthrough: true, deny }` — the play SCOPES nothing (no `mcp`/`allow` declared:
 *   `tools` absent, `tools: {}`, `tools: {skills}`, or `tools: {deny}`) ⇒ inherit the global MCP
 *   set, emit no scoping flags (byte-identical back-compat), and emit `--disallowedTools` ONLY when
 *   `deny` is non-empty. A deny-only declaration lands here — it denies without locking down.
 * - `{ ok: true, mcp, allowedTools, deny, strict: true, reducedGrounding }` — the play declared
 *   `mcp`/`optionalMcp`/`allow` and every REQUIRED MCP id is present ⇒ emit `--mcp-config` (the
 *   scoped `mcp` ids), `--allowedTools`, `--strict-mcp-config`, and (when non-empty)
 *   `--disallowedTools`. Declaring an allowlist/MCP is what opts into strict least-privilege.
 *   `mcp` carries the required ids PLUS any OPTIONAL ids that were present; `reducedGrounding` is
 *   `true` when ≥1 declared `optionalMcp` id was ABSENT and so dropped from the scoped set (E-060
 *   #3, T-060-01-01) — the honest signal that the cast runs with reduced grounding. It rides the
 *   resolution so the run record (T-060-01-02) can mark a degraded clear; `false` on every fully
 *   grounded strict result (including plays declaring no optional MCP).
 * - `{ ok: false, missing }` — the play declared `mcp` but one or more REQUIRED ids are absent from
 *   `available` ⇒ the missing-MCP andon (T-032-02 refuses to dispense rather than silently inherit
 *   the wrong tool set). `deny` is irrelevant on an andon (nothing is dispensed).
 */
export type ResolvedTools =
  | { readonly ok: true; readonly passthrough: true; readonly deny: readonly string[] }
  | {
      readonly ok: true;
      readonly mcp: readonly string[];
      readonly allowedTools: readonly string[];
      readonly deny: readonly string[];
      readonly strict: true;
      readonly reducedGrounding: boolean;
    }
  | { readonly ok: false; readonly missing: readonly string[] };

/**
 * Resolve a play's {@link PlayTools} against the MCP server ids the project provides (E-032,
 * T-032-01; E-051 deny). PURE — `available` is PASSED IN (the file read that produces it is
 * T-032-02); this is a decision, not I/O, exactly as {@link resolveMaxTurns} takes its numbers
 * rather than reaching for config. Outcomes (see {@link ResolvedTools}):
 * - UNDECLARED play (`declared` undefined) → passthrough, `deny: []`.
 * - DECLARED but SCOPES nothing (no `mcp`/`optionalMcp`/`allow` — e.g. `{}`, `{skills}`, or
 *   `{deny}`) → passthrough carrying `deny`. Declaring a denylist alone does NOT opt into strict:
 *   `deny` is a subtractive filter, independent of the allowlist, so a deny-only play keeps its
 *   global MCP set.
 * - DECLARED `mcp`/`optionalMcp`/`allow` with required `mcp` all present → the strict flags result,
 *   carrying `deny`. The scoped `mcp` = required ids + any `optionalMcp` ids that were PRESENT;
 *   `reducedGrounding` is `true` iff ≥1 `optionalMcp` id was ABSENT (dropped, not andoned —
 *   E-060 #3, T-060-01-01).
 * - DECLARED `mcp` (REQUIRED) missing one or more ids → the andon (`missing` lists the absent ids in
 *   declared order). An absent `optionalMcp` id NEVER andons — it degrades. The andon is reserved
 *   for genuinely required capabilities (IA-17).
 * `skills` is CARRIED on the contract but NOT consulted here (scope cut). Returns fresh arrays so
 * the result never aliases the play's frozen literals.
 */
export function resolveTools(declared: PlayTools | undefined, available: readonly string[]): ResolvedTools {
  if (declared === undefined) return { ok: true, passthrough: true, deny: [] };
  const deny = [...(declared.deny ?? [])];
  const have = new Set(available);
  const required = declared.mcp ?? [];
  const missing = required.filter((id) => !have.has(id));
  if (missing.length > 0) return { ok: false, missing };
  // Optional grounding MCP (E-060 #3): a present optional id is scoped exactly like a required one;
  // an absent one is DROPPED from the scoped set and flips `reducedGrounding` — a degrade, not an
  // andon. So a fresh seed without codebase-memory-mcp clears with reduced grounding.
  const optional = declared.optionalMcp ?? [];
  const presentOptional = optional.filter((id) => have.has(id));
  const reducedGrounding = presentOptional.length < optional.length;
  // Strict least-privilege is opted into by declaring an allowlist/MCP (required OR optional) — NOT
  // by declaring a denylist alone (deny is subtractive and orthogonal). A declaration that scopes
  // nothing stays passthrough and only carries its `deny` forward.
  const scopes = declared.mcp !== undefined || declared.optionalMcp !== undefined || declared.allow !== undefined;
  if (!scopes) return { ok: true, passthrough: true, deny };
  return {
    ok: true,
    mcp: [...required, ...presentOptional],
    allowedTools: [...(declared.allow ?? [])],
    deny,
    strict: true,
    reducedGrounding,
  };
}

/** The seam flags a resolved cast threads into `dispense`/`buildArgs` (E-032, T-032-02; E-051
 *  `disallowedTools`) — the argv-shaped projection of a {@link ResolvedTools} success. All optional
 *  so the empty `{}` (undeclared passthrough / andon) spreads into `dispense` adding nothing
 *  (byte-identical argv). `disallowedTools` rides independently of the strict flags. */
export interface ToolFlags {
  readonly mcpConfig?: string;
  readonly allowedTools?: readonly string[];
  readonly disallowedTools?: readonly string[];
  readonly strictMcp?: boolean;
}

/**
 * Project a {@link resolveTools} result into the `buildArgs`/`dispense` tool flags (E-032,
 * T-032-02; E-051). PURE — this is the DECISION "resolved tools → which argv flags," kept here (not
 * in the impure `castPlay` shell) so the AC's live proof inspects it as an ordinary pure test.
 *
 * - `!ok` (andon) ⇒ `{}` — no flags. `castPlay` handles the missing-capability andon BEFORE
 *   reaching here, so the `{}` is purely defensive.
 * - PASSTHROUGH ⇒ `disallowedTools` ONLY when the play declared a non-empty `deny` (E-051); else
 *   `{}` (the undeclared back-compat path, byte-identical to today). This is what lets a deny-only
 *   play (e.g. propose-epic) make AskUserQuestion unavailable WITHOUT a strict lockdown — it keeps
 *   its global MCP set and gains exactly `--disallowedTools`.
 * - STRICT ⇒ `strictMcp: true` (close the global firehose), `allowedTools` = the play's `allow`
 *   list PLUS one `mcp__<id>` wildcard per declared server, `mcpConfig` (the `.mcp.json` path) ONLY
 *   when the play declares at least one MCP server, and `disallowedTools` when `deny` is non-empty.
 *
 * Why fold `mcp__<id>` into `allowedTools`: `--allowedTools` is an allowlist that, once present,
 * gates ALL tools including MCP tools (named `mcp__<server>__*`). The wildcard entry per declared
 * id is what lets the cast actually CALL its declared servers' tools — so the scoping admits
 * "only its servers": strict closes global, `--mcp-config` loads the project file, the allowlist
 * permits exactly the declared servers (+ the play's built-ins). A play declaring only built-ins
 * (`allow`, no `mcp`) still opts into strict least-privilege but needs no `--mcp-config`. The
 * denylist (`--disallowedTools`) is independent: it subtracts named tools regardless of the
 * allow/strict flags, and `buildArgs` emits it after `--allowedTools`, before `--strict-mcp-config`.
 */
export function toolFlags(resolved: ResolvedTools, mcpConfigPath: string): ToolFlags {
  if (!resolved.ok) return {};
  const denyFlag = resolved.deny.length > 0 ? { disallowedTools: resolved.deny } : {};
  if ("passthrough" in resolved) return { ...denyFlag };
  const allowedTools = [...resolved.allowedTools, ...resolved.mcp.map((id) => `mcp__${id}`)];
  return {
    ...(resolved.mcp.length > 0 ? { mcpConfig: mcpConfigPath } : {}),
    allowedTools,
    strictMcp: true,
    ...denyFlag,
  };
}

/**
 * Harvest turns-used off the terminal result's `num_turns` (T-015-02, AC2). PURE & TOTAL —
 * keeps only a finite, non-negative integer; anything else (absent, NaN, negative, fractional,
 * or a non-number on the open stream record) ⇒ `undefined`, so the run-log field is omitted
 * (reads as unknown) rather than logged as a lie. Mirrors run-log's `normalizeTurnsUsed`.
 */
export function resolveTurnsUsed(numTurns: unknown): number | undefined {
  return typeof numTurns === "number" && Number.isInteger(numTurns) && numTurns >= 0 ? numTurns : undefined;
}

const HTTP_429_CAP_MARKER: CapWindowExhausted = Object.freeze({
  signal: "http-429",
  reason: "executor terminal failure reported HTTP 429 at settlement",
});

const RATE_LIMIT_CAP_MARKER: CapWindowExhausted = Object.freeze({
  signal: "rate-limit",
  reason: "executor terminal failure reported rate-limit exhaustion at settlement",
});

/** Safely read one named field from an open external record. An exotic throwing getter is
 *  malformed evidence, never grounds for losing settlement or inventing a cap event. */
function externalField(record: Record<string, unknown>, key: string): unknown {
  try {
    return record[key];
  } catch {
    return undefined;
  }
}

function isTerminalFailure(result: ResultMessage): boolean {
  const subtype = externalField(result, "subtype");
  return (typeof subtype === "string" && subtype.toLowerCase().startsWith("error")) ||
    externalField(result, "is_error") === true;
}

function is429(value: unknown): boolean {
  return value === 429 || (typeof value === "string" && value.trim() === "429");
}

function hasStructured429(result: ResultMessage): boolean {
  const keys = ["status", "statusCode", "code"] as const;
  if (keys.some((key) => is429(externalField(result, key)))) return true;

  const error = externalField(result, "error");
  return isRecord(error) && keys.some((key) => is429(externalField(error, key)));
}

function appendDiagnosticStrings(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (!isRecord(value)) return;
  for (const key of ["message", "type", "code"] as const) {
    const candidate = externalField(value, key);
    if (typeof candidate === "string") into.push(candidate);
  }
}

/** Extract only bounded terminal diagnostic fields — never arbitrary model/telemetry structure. */
function terminalDiagnostics(result: ResultMessage): readonly string[] {
  const diagnostics: string[] = [];
  for (const key of ["subtype", "result", "message"] as const) {
    const candidate = externalField(result, key);
    if (typeof candidate === "string") diagnostics.push(candidate);
  }

  appendDiagnosticStrings(externalField(result, "error"), diagnostics);
  const errors = externalField(result, "errors");
  if (Array.isArray(errors)) {
    for (const error of errors) appendDiagnosticStrings(error, diagnostics);
  }
  return diagnostics;
}

function hasHttp429Text(value: string): boolean {
  return /\bhttp(?:\s+status)?\s*429\b|\b429\s+too many requests\b/i.test(value);
}

function hasRateLimitText(value: string): boolean {
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return /\brate limit(?:ed|ing)?(?: (?:reached|exceeded|exhausted))?\b/.test(normalized) ||
    /\btoo many requests\b/.test(normalized) ||
    /\bhit your(?: (?:usage|rate))? limit\b/.test(normalized) ||
    /\b(?:usage|quota)(?: limit)? (?:reached|exceeded|exhausted)\b/.test(normalized);
}

/**
 * Classify explicit provider-window exhaustion from a terminal executor failure (T-082-01-02).
 * PURE and total over the seam's open result record. Successful model prose and live
 * `rate_limit_event` telemetry are deliberately outside this settle-only decision.
 */
export function classifyCapWindowExhaustion(
  result: ResultMessage | null,
): CapWindowExhausted | undefined {
  if (result === null || !isTerminalFailure(result)) return undefined;

  const diagnostics = terminalDiagnostics(result);
  if (hasStructured429(result) || diagnostics.some(hasHttp429Text)) {
    return { ...HTTP_429_CAP_MARKER };
  }
  if (diagnostics.some(hasRateLimitText)) {
    return { ...RATE_LIMIT_CAP_MARKER };
  }
  return undefined;
}

/** The inputs to the pure outcome decision (the play-generic analogue of the runner's). */
export interface ClassifyInput {
  /** The shallow pre-dispense capability result; a non-ok executor cannot start a cast. */
  readonly executorProbe?: ExecutorProbeResult;
  /** The seam threw `ClaudeTimeoutError` (no result, nothing parsed/gated). */
  readonly timedOut: boolean;
  /** The token check after the seam returned; null when timed out. */
  readonly budgetOutcome: BudgetOutcome | null;
  /** The play's clearing verdict; null when the run never reached or deliberately skipped gating. */
  readonly gateVerdict: GateVerdict | null;
}

/** The pure decision: the terminal outcome, whether to effect, the run-log gate rows, and any
 *  one-way warning the effect shell must surface and persist. */
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
  /** Present only when a token-exhausted cast explicitly cleared its gates and may materialize. */
  readonly overEnvelope?: true;
}

/** Stable ledger gate name for the autonomous complement-seat review. */
export const CROSS_VENDOR_REVIEW_GATE = "cross-vendor-review";

/**
 * Apply an optional post-effect cross-vendor judgment to a cast's terminal settlement.
 *
 * Diff review necessarily happens after a successful effect has reported artifacts, so this is
 * deliberately separate from {@link classify}: `classify.materialize` authorizes the effect;
 * this function decides whether the already-observed run may settle as cleared. A refusal keeps
 * `materialize` honest (the effect did land) while changing the terminal outcome to
 * `gate-failed`. Absence is the inert single-seat/no-diff path and returns the base value itself.
 */
export function settleCrossReview(base: Verdict, review: CrossVendorVerdict | undefined): Verdict {
  if (review === undefined) return base;

  const reviewRow: LogGate = review.verdict === "pass"
    ? { gate: CROSS_VENDOR_REVIEW_GATE, passed: true }
    : {
        gate: CROSS_VENDOR_REVIEW_GATE,
        passed: false,
        ...(review.detail !== undefined ? { detail: review.detail } : {}),
      };

  return {
    ...base,
    outcome: review.verdict === "fail" ? "gate-failed" : base.outcome,
    gateLog: [...base.gateLog, reviewRow],
  };
}

/**
 * Settle an operationally unavailable reviewer after the effect has already landed.
 *
 * This is not a review FAIL: no adversarial judgment exists, so no cross-vendor gate row is
 * invented. Preserve the physical materialization fact, the play's gate evidence, and any
 * over-envelope warning; relabel only the terminal outcome to the existing capability andon.
 */
export function settleCrossReviewFailure(base: Verdict): Verdict {
  return { ...base, outcome: "missing-capability" };
}

/**
 * Translate a play's {@link GateVerdict} into run-log per-gate rows. A STOP → one failed
 * row naming the (real) gate/unit/reason the play reported. A CLEAR → one passed row per
 * gate name the play echoed in `cleared`, or `[]` when it echoed none. The generic verdict
 * is opaque-by-default (T-007-01 design D2), but a play whose gates already track the
 * cleared names (DecomposeEpic, via gates.ts's `GateClear.cleared` — T-007-03 D3) supplies
 * them so a successful run logs the same per-gate evidence the welded runner wrote. We
 * never FABRICATE a name the play didn't declare: `cleared` absent ⇒ `[]`, honest about the
 * loop not knowing the breakdown. `null` (never gated) → `[]`.
 */
export function castGateRows(g: GateVerdict | null): readonly LogGate[] {
  if (g === null) return [];
  if (g.status === "stop") return [{ gate: g.gate, passed: false, detail: `${g.unit}: ${g.reason}` }];
  return (g.cleared ?? []).map((gate) => ({ gate, passed: true }));
}

/**
 * Decide the run's outcome. PURE. First-match priority (T-068-02-02): TIMEOUT always discards;
 * an explicit gate STOP always discards (P3); a token-exhausted run materializes as `success`
 * ONLY when its gates explicitly CLEAR, carrying the one-way `overEnvelope` warning that keeps
 * the P7 contract breach countable. Exhaustion without a clear remains censored and discarded.
 */
export function classify(i: ClassifyInput): Verdict {
  // A failed pre-dispense capability gate has no play-gate evidence: gates never ran. It outranks
  // downstream terminal facts because no dispense was authorized in the first place.
  if (i.executorProbe?.ok === false) {
    return { outcome: "missing-capability", materialize: false, gateLog: [] };
  }
  const gateLog = castGateRows(i.gateVerdict);
  if (i.timedOut) return { outcome: "timed-out", materialize: false, gateLog };
  if (i.gateVerdict?.status === "stop") {
    return { outcome: "gate-failed", materialize: false, gateLog };
  }
  if (i.budgetOutcome?.status === "exhausted") {
    if (i.gateVerdict?.status === "clear") {
      return { outcome: "success", materialize: true, gateLog, overEnvelope: true };
    }
    return { outcome: "budget-exhausted", materialize: false, gateLog };
  }
  return { outcome: "success", materialize: true, gateLog };
}

/**
 * The immutable live-progress fold over executor messages (T-072-02-01, T-081-02-01).
 * `weightedTokens` uses budget.ts's price-true numeraire: main-loop assistant usage and explicit
 * thinking deltas form the live estimate, then cumulative result usage reconciles it to the same
 * terminal truth the ledger meters. `turns` counts distinct MAIN-LOOP assistant message ids, not
 * stream events or sidechain/subagent ids (one Claude turn is repeated for its
 * thinking/text/tool-use blocks). `seenMessageIds` is transport bookkeeping that makes those
 * repeats idempotent.
 */
export interface CastProgress {
  readonly weightedTokens: number;
  readonly turns: number;
  readonly seenMessageIds: readonly string[];
}

/** Reusable zero value for {@link accumulateCastProgress}; frozen so casts cannot alias-mutate it. */
export const EMPTY_CAST_PROGRESS: CastProgress = Object.freeze({
  weightedTokens: 0,
  turns: 0,
  seenMessageIds: Object.freeze([]) as readonly string[],
});

/**
 * Maximum accepted terminal difference from the ledger, in weighted tokens (T-081-02-01).
 * Both sides apply the canonical `countTokens` function to the same cumulative result usage, so
 * agreement is exact; non-zero slack would hide a meter drift rather than model measurement noise.
 */
export const CAST_PROGRESS_LEDGER_TOLERANCE = 0;

/** Inputs the impure cast shell supplies when rendering one progress state. */
export interface CastProgressFormat {
  /** Elapsed wall time from the shell's injected clock. */
  readonly elapsedMs: number;
  /** The funded token ceiling (`Budget.tokens`) in the same numeraire as weighted spend. */
  readonly tokenEnvelope: number;
  /** Effective agentic turn cap; absent means the cast has no named turn cap. */
  readonly maxTurns?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract one identifiable assistant turn from the open external JSON record. A message without
 * both its transport id and usage cannot be counted safely: the id is what prevents the repeated
 * content-block events in a single turn from charging more than once.
 */
function assistantTurn(msg: StreamMessage): { readonly id: string; readonly usage: Usage } | null {
  if (msg.type !== "assistant" || !isRecord(msg.message)) return null;
  const { id, usage } = msg.message;
  if (typeof id !== "string" || id.length === 0 || !isRecord(usage)) return null;
  return { id, usage: usage as Usage };
}

/** A non-null parent marker is the captured stream's sidechain/subagent boundary. */
function isSidechainMessage(msg: StreamMessage): boolean {
  return msg.parent_tool_use_id !== undefined && msg.parent_tool_use_id !== null;
}

/** Extract one incremental main-loop thinking-token observation from the open stream shape. */
function thinkingTokensDelta(msg: StreamMessage): number | null {
  if (msg.type !== "system" || msg.subtype !== "thinking_tokens") return null;
  const delta = msg.estimated_tokens_delta;
  return typeof delta === "number" && Number.isFinite(delta) && delta >= 0 ? delta : null;
}

/** Extract cumulative terminal usage. It replaces estimates; it is never another increment. */
function resultUsage(msg: StreamMessage): Usage | null {
  return msg.type === "result" && isRecord(msg.usage) ? msg.usage as Usage : null;
}

/**
 * Fold one streamed executor message into live progress. PURE, immutable, and total over the open
 * transport shape. Marked sidechain records and usage-less/malformed/unknown records are no-ops.
 * Main-loop thinking deltas are charged as output through the canonical price-true
 * {@link countTokens} definition. Terminal `result.usage` is authoritative and cumulative, so it
 * REPLACES the live estimate rather than being added as another turn. Otherwise only the first
 * event for each main-loop assistant `message.id` is charged and counted.
 */
export function accumulateCastProgress(state: CastProgress, msg: StreamMessage): CastProgress {
  if (isSidechainMessage(msg)) return state;

  const terminal = resultUsage(msg);
  if (terminal !== null) {
    const weightedTokens = countTokens(terminal);
    return weightedTokens === state.weightedTokens ? state : Object.freeze({ ...state, weightedTokens });
  }

  const thinkingDelta = thinkingTokensDelta(msg);
  if (thinkingDelta !== null) {
    const weightedDelta = countTokens({ output_tokens: thinkingDelta });
    return weightedDelta === 0
      ? state
      : Object.freeze({ ...state, weightedTokens: state.weightedTokens + weightedDelta });
  }

  const turn = assistantTurn(msg);
  if (turn === null || state.seenMessageIds.includes(turn.id)) return state;
  return Object.freeze({
    weightedTokens: state.weightedTokens + countTokens(turn.usage),
    turns: state.turns + 1,
    seenMessageIds: Object.freeze([...state.seenMessageIds, turn.id]),
  });
}

/** Mirror menu.ts's humane token idiom: rounded whole thousands above 1k, integer below. */
function humanProgressTokens(value: number): string {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return normalized >= 1000 ? `${Math.round(normalized / 1000)}k` : `${normalized}`;
}

/** Render elapsed time as compact compound units, keeping the seconds hand visibly moving. */
function humanElapsed(elapsedMs: number): string {
  const seconds = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / 1000)) : 0;
  if (seconds < 60) return `${seconds}s`;
  const s = seconds % 60;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${s.toString().padStart(2, "0")}s`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}m${s.toString().padStart(2, "0")}s`;
}

/**
 * Render one humane progress line from explicit plain values. PURE: the caller owns the clock,
 * funding envelope, and effective turn cap. An uncapped cast omits the denominator rather than
 * inventing one.
 */
export function formatCastProgress(state: CastProgress, opts: CastProgressFormat): string {
  const turn = opts.maxTurns === undefined ? `${state.turns}` : `${state.turns}/${opts.maxTurns}`;
  const detectAfter = state.weightedTokens > opts.tokenEnvelope ? " (detect-after)" : "";
  const tokens = `${humanProgressTokens(state.weightedTokens)}/${humanProgressTokens(opts.tokenEnvelope)} weighted tokens${detectAfter}`;
  return `elapsed ${humanElapsed(opts.elapsedMs)} · ${tokens} · turn ${turn}`;
}

/** Plain facts available when the cast settles and renders its final turn accounting. */
export interface TurnSummaryFormat {
  /** Distinct assistant/model responses observed on the stream — the unit `--max-turns` bounds. */
  readonly agentTurns?: number;
  /** Effective Claude agent-loop cap passed as `--max-turns`; absent means uncapped. */
  readonly maxTurns?: number;
  /** Claude result `num_turns`, which counts conversation events rather than agent-loop turns. */
  readonly executorReportedTurns?: number;
}

/**
 * Render final turn accounting without comparing unlike counters. PURE and TOTAL over optional
 * facts. Claude's `--max-turns` bounds model-loop iterations, while terminal `num_turns` starts at
 * one and advances for emitted user/tool-result messages; one model response can issue several
 * tools, so the latter may legitimately exceed the former. The cap therefore pairs only with the
 * distinct-assistant count. A defensive over-cap observation is labeled as two facts rather than
 * rendered as a misleading fraction; the raw executor count is never clamped or reinterpreted.
 */
export function formatTurnSummary(values: TurnSummaryFormat): string | undefined {
  const parts: string[] = [];
  if (values.agentTurns !== undefined) {
    if (values.maxTurns === undefined) {
      parts.push(`agent turns: ${values.agentTurns}`);
    } else if (values.agentTurns <= values.maxTurns) {
      parts.push(`agent turns: ${values.agentTurns} / ${values.maxTurns} cap`);
    } else {
      parts.push(`agent turns observed: ${values.agentTurns}`, `configured agent-turn cap: ${values.maxTurns}`);
    }
  } else if (values.maxTurns !== undefined) {
    parts.push(`configured agent-turn cap: ${values.maxTurns}`);
  }
  if (values.executorReportedTurns !== undefined) {
    parts.push(`executor conversation events: ${values.executorReportedTurns}`);
  }
  return parts.length > 0 ? `· ${parts.join("; ")}` : undefined;
}

/**
 * Format one stream-json message into a compact human line for the live surface. PURE and
 * TOTAL — never throws on an unknown `type` (the stream is external JSON; tolerate noise).
 * Keeps the line short: the full message goes to the transcript.
 */
export function formatMessage(msg: StreamMessage): string {
  const type = typeof msg.type === "string" ? msg.type : "?";
  if (type === "result") {
    const sub = typeof msg.subtype === "string" ? msg.subtype : "";
    return `· result${sub ? ` (${sub})` : ""}`;
  }
  if (type === "system") {
    const subtype = typeof msg.subtype === "string" ? msg.subtype : "";
    return `· system${subtype ? ` (${subtype})` : ""}`;
  }
  return `· ${type}`;
}

/**
 * Build the seam's `onMessage` hook, fanning each message to BOTH surfaces (AC#1): a human
 * line to `write` (live stdout) and the raw JSON to `sink` (the durable per-run transcript).
 * PURE given its injected edges, so it is testable with a fake writer/sink — the edges (real
 * stdout / file append) are owned by the caller (cast.ts).
 */
export function makeStreamSink(opts: {
  write: (line: string) => void;
  sink: (raw: string) => void;
}): (msg: StreamMessage) => void {
  return (msg) => {
    opts.write(formatMessage(msg));
    opts.sink(JSON.stringify(msg));
  };
}
