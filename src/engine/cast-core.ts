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
import type { BudgetOutcome } from "../budget/budget.ts";
import type { GateVerdict, PlayTools } from "./play.ts";
import type { GateResult as LogGate, RunOutcome } from "../log/run-log.ts";

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
 * - `{ ok: true, mcp, allowedTools, deny, strict: true }` — the play declared `mcp` or `allow` and
 *   every required MCP id is present ⇒ emit `--mcp-config` (the `mcp` ids), `--allowedTools`,
 *   `--strict-mcp-config`, and (when non-empty) `--disallowedTools`. Declaring an allowlist/MCP is
 *   what opts into strict least-privilege.
 * - `{ ok: false, missing }` — the play declared `mcp` but one or more REQUIRED ids are absent from
 *   `available` ⇒ the missing-MCP andon (T-032-02 refuses to dispense rather than silently inherit
 *   the wrong tool set). `deny` is irrelevant on an andon (nothing is dispensed).
 */
export type ResolvedTools =
  | { readonly ok: true; readonly passthrough: true; readonly deny: readonly string[] }
  | { readonly ok: true; readonly mcp: readonly string[]; readonly allowedTools: readonly string[]; readonly deny: readonly string[]; readonly strict: true }
  | { readonly ok: false; readonly missing: readonly string[] };

/**
 * Resolve a play's {@link PlayTools} against the MCP server ids the project provides (E-032,
 * T-032-01; E-051 deny). PURE — `available` is PASSED IN (the file read that produces it is
 * T-032-02); this is a decision, not I/O, exactly as {@link resolveMaxTurns} takes its numbers
 * rather than reaching for config. Outcomes (see {@link ResolvedTools}):
 * - UNDECLARED play (`declared` undefined) → passthrough, `deny: []`.
 * - DECLARED but SCOPES nothing (no `mcp`/`allow` — e.g. `{}`, `{skills}`, or `{deny}`) →
 *   passthrough carrying `deny`. Declaring a denylist alone does NOT opt into strict: `deny` is a
 *   subtractive filter, independent of the allowlist, so a deny-only play keeps its global MCP set.
 * - DECLARED `mcp`/`allow` with required `mcp` all present → the strict flags result, carrying `deny`.
 * - DECLARED `mcp` missing one or more required ids → the andon (`missing` lists the absent ids in
 *   declared order).
 * `skills` is CARRIED on the contract but NOT consulted here (scope cut). Returns fresh arrays so
 * the result never aliases the play's frozen literals.
 */
export function resolveTools(declared: PlayTools | undefined, available: readonly string[]): ResolvedTools {
  if (declared === undefined) return { ok: true, passthrough: true, deny: [] };
  const deny = [...(declared.deny ?? [])];
  const required = declared.mcp ?? [];
  const have = new Set(available);
  const missing = required.filter((id) => !have.has(id));
  if (missing.length > 0) return { ok: false, missing };
  // Strict least-privilege is opted into by declaring an allowlist/MCP — NOT by declaring a denylist
  // alone (deny is subtractive and orthogonal). A declaration that scopes nothing (no `mcp`/`allow`)
  // stays passthrough and only carries its `deny` forward.
  const scopes = declared.mcp !== undefined || declared.allow !== undefined;
  if (!scopes) return { ok: true, passthrough: true, deny };
  return { ok: true, mcp: [...required], allowedTools: [...(declared.allow ?? [])], deny, strict: true };
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

/** The inputs to the pure outcome decision (the play-generic analogue of the runner's). */
export interface ClassifyInput {
  /** The seam threw `ClaudeTimeoutError` (no result, nothing parsed/gated). */
  readonly timedOut: boolean;
  /** The token check after the seam returned; null when timed out. */
  readonly budgetOutcome: BudgetOutcome | null;
  /** The play's clearing verdict; null when the run never reached gating (timeout/exhausted). */
  readonly gateVerdict: GateVerdict | null;
}

/** The pure decision: the terminal outcome, whether to effect, the run-log gate rows. */
export interface Verdict {
  readonly outcome: RunOutcome;
  readonly materialize: boolean;
  readonly gateLog: readonly LogGate[];
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
 * Decide the run's outcome. PURE. First-match priority (mirrors the runner's `classify`): a
 * TIMEOUT or a BUDGET exhaustion outranks the gate verdict — a run that breached its budget
 * contract (charter P7) stops the line even if the output would have cleared. Materialize
 * ONLY on `success` (cleared, in-budget, returned).
 */
export function classify(i: ClassifyInput): Verdict {
  const gateLog = castGateRows(i.gateVerdict);
  if (i.timedOut) return { outcome: "timed-out", materialize: false, gateLog };
  if (i.budgetOutcome?.status === "exhausted") {
    return { outcome: "budget-exhausted", materialize: false, gateLog };
  }
  if (i.gateVerdict?.status === "stop") {
    return { outcome: "gate-failed", materialize: false, gateLog };
  }
  return { outcome: "success", materialize: true, gateLog };
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
