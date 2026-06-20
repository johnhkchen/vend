// The `vend work` gesture's PURE core (T-024-03, story S-024-01, epic E-024) — the Confirm→Run→Settle
// surface (IA-6) at macro scale, the addon-free half of the counter gesture. Where work.ts is the
// impure shell (reads the board, casts the chain, drives the loop), THIS module is the parse + the
// render: the board → ranked signals, and the loop's signals/result → the human-facing production
// line (IA-7) and receipt (IA-6). Split out for the house testability reason (the steer-core / steer
// three-file discipline): work.ts value-imports the chain (the BAML native addon), so no `bun test`
// may value-import it — this pure module holds the load-bearing branching and is unit-tested.
//
// PURITY (house pattern): every export takes plain values and returns plain values — no fs, clock,
// network, process, seam, or addon. The ONE value import is `formatWallet` (wallet.ts), itself pure:
// the single source of two-denomination truth (IA-8), reused for both the stream meter and the
// receipt balance so the meter never lies. The engine/wallet types are TYPE-ONLY (erased).

import type { Budget } from "../budget/budget.ts";
import { formatWallet, type Wallet } from "../budget/wallet.ts";
import type { SessionResult, StepSignal } from "../engine/spend-core.ts";

/** Match a staged board's `vend chain "<signal>"` line — the `## Pull these` gesture every board
 *  emits (steer-effect / survey-core), already ranked highest-leverage-first (IA-1). The inner text
 *  never contains a literal `"` (boards use backticks + single quotes), so the greedy `(.*)"` lands
 *  on the closing quote; an optional ` # comment` tail (the recommended-pull marker) is dropped. */
const CHAIN_LINE = /^vend chain "(.*)"(?:\s+#.*)?$/;

/** ANSI amber (33) — IA-9: an andon renders amber (a successful refusal), NEVER red. Local because
 *  src/ has no shared color helper; gated by `on` so the pure renderer's text stays assertable. */
function amber(s: string, on: boolean): string {
  return on ? `\x1b[33m${s}\x1b[0m` : s;
}

/** Render a token count terse: k-suffixed at ≥ 1000 (`120k`, `1.2k`), raw below. Local mirror of
 *  wallet.ts's private formatter (the no-shared-util idiom) for the per-cast cost line. */
function fmtTok(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** Render a ms duration as a human span: `0s` / `450ms` / `45s` / `30m` / `1h30m`. Local mirror of
 *  wallet.ts's private formatter (cost-line only — the meter itself goes through `formatWallet`). */
function fmtDur(ms: number): string {
  if (ms === 0) return "0s";
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/** A per-cast cost as the two denominations, never conflated (IA-8). */
function fmtCost(b: Budget): string {
  return `◇ ${fmtTok(b.tokens)}   ⏱ ${fmtDur(b.timeMs)}`;
}

/**
 * Parse the staged board markdown into the ranked list of demand signals to spend down. PURE/TOTAL.
 * Scans every line for the `vend chain "<signal>"` gesture (the `## Pull these` block both steer and
 * survey emit), returning the quoted signal strings IN FILE ORDER — which is already ranked
 * highest-leverage-first (IA-1; the loop never re-sorts). A board with no such lines (an honest-empty
 * steer, or a non-board file) returns `[]`. The signal string is exactly `castProposeDecomposeChain`'s
 * input — `work.ts` casts each verbatim.
 */
export function parseBoardSignals(md: string): string[] {
  const signals: string[] = [];
  for (const raw of md.split("\n")) {
    const m = CHAIN_LINE.exec(raw.trim());
    if (m) signals.push(m[1]!);
  }
  return signals;
}

/**
 * The production-line label (IA-7) for a signal: its "what" half — the text before the first ` — `
 * (the staged board's what/why separator) — trimmed and truncated to `max` with an ellipsis. A
 * signal with no ` — ` labels with the whole (truncated) string. PURE/TOTAL. The label names "which
 * pull is running" on the stream and in the receipt, not the rationale (that is the `why` half).
 */
export function labelForSignal(signal: string, max = 80): string {
  const what = signal.split(" — ")[0]!.trim();
  return what.length > max ? `${what.slice(0, max - 1)}…` : what;
}

/**
 * One IA-7 production-line line: an arrow (`▶` casting / `✓` done), the candidate label, and the
 * two-denomination wallet meter (IA-8) — the burn at this moment. PURE. The meter goes through
 * `formatWallet` (the single source of two-denomination truth) by synthesizing the wallet from the
 * `funded` allocation (threaded in — it is not on `StepSignal`) and the signal's `remaining`.
 */
export function formatStepSignal(s: StepSignal, funded: Budget): string {
  const wallet: Wallet = { funded, remaining: s.remaining };
  const arrow = s.phase === "start" ? "▶ casting" : "✓ done   ";
  return `${arrow}: ${s.candidate}\n    ${formatWallet(wallet)}`;
}

/**
 * The board-freshness decision (T-027-01, epic E-027). PURE/TOTAL. The board is **stale** iff it
 * predates the project's live state — `boardMtimeMs < liveMtimeMs` — so equal/newer is FRESH
 * (fresh-on-tie: a board re-staged at the instant the project last moved is current). No I/O: the
 * caller (`castWork`) gathers the two mtimes (the board's stat + the newest across
 * `docs/active/{epic,stories,tickets}`) and asks here. **Honest caveat:** mtime is a heuristic — a
 * `git checkout` can reset it — so this gate is `--stale-ok`-overridable (IA-5), never a hard lock.
 */
export function isBoardStale(boardMtimeMs: number, liveMtimeMs: number): boolean {
  return boardMtimeMs < liveMtimeMs;
}

/**
 * The stale-board andon (T-027-01, IA-9): a stale board is a **successful refusal**, not a crash —
 * amber at the surface, exiting like the other broken-precondition outcomes. PURE. Renders both
 * timestamps (ISO 8601, so the text is deterministic + unit-assertable — `new Date(ms)` is total,
 * unlike argless `new Date()`), the board it refused, the re-survey next move (IA-9 summons the fix),
 * and the honest mtime caveat (the `--stale-ok` escape hatch, IA-5). `opts.color` (default false)
 * gates the ANSI so tests assert plain text and the CLI passes `color: true` — exactly `renderReceipt`.
 */
export function renderStaleBoard(
  r: { readonly boardPath: string; readonly boardMtimeMs: number; readonly liveMtimeMs: number },
  opts: { color?: boolean } = {},
): string {
  const color = opts.color ?? false;
  const boardWhen = new Date(r.boardMtimeMs).toISOString();
  const liveWhen = new Date(r.liveMtimeMs).toISOString();
  return [
    amber("⚠ stale board — refused (a successful stop, not a crash)", color),
    `  board:           ${r.boardPath}`,
    `  board staged:    ${boardWhen}`,
    `  project changed: ${liveWhen}  (newer than the board)`,
    "  The board predates the project's current state — spending would clear superseded work.",
    "  Re-survey before spending:  vend steer  (or  vend survey ),  then  vend work",
    "  (mtime is a heuristic — a git checkout can reset it; pass --stale-ok to spend anyway.)",
  ].join("\n");
}

/** Human phrasing for each clean stop (IA-9). `andon` is the successful refusal (amber at the
 *  surface); the other two are clean terminal states (the wallet spent, or the board cleared). */
const STOP_HEAD: Record<SessionResult["stop"], string> = {
  "board-cleared": "board cleared",
  "wallet-exhausted": "wallet exhausted",
  andon: "andon — refused (a successful stop, not a crash)",
};

/**
 * The Settle receipt (IA-6) — the gesture's close-out: what cleared, what each cast cost, what the
 * wallet has left, and WHY it stopped. PURE. Renders a header, one line per cast (a `✓` cleared line
 * with its cost, or an amber `⚠` andon line carrying the outcome), the final wallet via `formatWallet`
 * (IA-8), and the stop reason — rendered amber when the session ended on an `andon` (IA-9: amber, a
 * successful refusal, NEVER red). `opts.color` (default false) gates the ANSI so this text is asserted
 * plainly in tests; the CLI passes `color: true`.
 */
export function renderReceipt(
  result: SessionResult,
  wallet: Wallet,
  opts: { color?: boolean } = {},
): string {
  const color = opts.color ?? false;
  const lines: string[] = ["═ vend work — receipt ═", ""];

  if (result.steps.length === 0) {
    lines.push("No cast ran — the wallet funded nothing on this board.", "");
  } else {
    lines.push(`Cast ${result.steps.length}, cleared ${result.cleared}:`);
    for (const step of result.steps) {
      if (step.outcome === "success") {
        lines.push(`  ✓ ${step.candidate}   ${fmtCost(step.cost)}`);
      } else {
        lines.push(amber(`  ⚠ ${step.candidate}   andon: ${step.outcome}   ${fmtCost(step.cost)}`, color));
      }
    }
    lines.push("");
  }

  lines.push(`wallet: ${formatWallet(wallet)}`, "");

  const head = STOP_HEAD[result.stop];
  const stopLine = `stopped: ${head} — ${result.stopDetail}`;
  lines.push(result.stop === "andon" ? amber(stopLine, color) : stopLine, "");

  return lines.join("\n");
}
