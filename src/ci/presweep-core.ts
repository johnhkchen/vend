// The `check:presweep` PURE classifier (E-061 #9) — the addon-free heart of the
// "done ⇒ committed" pre-sweep net, the second edge of the vend/lisa seam contract (#8 closed
// the first: decompose can no longer mint a graph-invalid board).
//
// THE GAP IT CLOSES: E-008's `check:committed` is an on-stop gate over SOURCE_PREFIXES — it proves
// the SOURCE is committed, but it does NOT cover the BOARD (`docs/active/`) and is not bound to
// `phase: done`. The E-060 build hit exactly that blind spot (F2, recurring): lisa marked tickets
// `done` while its commit step silently dropped a code file AND the epic board (both left untracked),
// so phase-state and git-state diverged and the failure was only caught by a hand-run verify-git.
// This net BINDS them: before an epic is swept to done, every `phase: done` ticket implies a clean
// tree across source AND the board — otherwise andon. It runs at sweep time (a `bun run check:*`
// script a lisa pre-sweep hook / a human invokes), not continuously, so a dirty tree mid-build (the
// next ticket in progress) is never false-flagged.
//
// PURE (the committed-core discipline): every export takes plain data and returns fresh values — no
// fs, clock, network, process, or git. The one IMPURE verb (load the board, run `git status`, exit)
// lives in check-presweep.ts. REUSES committed-core's parser (`classifyPorcelain`, now scope-
// parameterized) rather than re-implementing porcelain handling — one source of "what counts as
// uncommitted."

import { classifyPorcelain, SOURCE_PREFIXES } from "./committed-core.ts";

/**
 * The pre-sweep scope: the E-008 source contract PLUS the board itself. Adding `docs/active/` is the
 * whole point — it is the half E-008 omits and exactly what the E-060 F2 dropped (an untracked board
 * while tickets were `done`). Single-sourced from {@link SOURCE_PREFIXES} so widening the source
 * contract there flows here for free.
 */
export const SWEEP_PREFIXES = [...SOURCE_PREFIXES, "docs/active/"] as const;

/** A board ticket reduced to the two fields this net judges. The impure entry lifts these off the
 *  loaded `WorkGraph` so the core never imports the graph model (stays a plain-data pure test). */
export interface TicketPhase {
  readonly id: string;
  readonly phase: string;
}

/** The SORTED ids of every `phase: done` ticket. PURE/TOTAL — the antecedent of the implication
 *  ("if anything is done…"). Empty ⇒ nothing has been declared done yet, so the net is a no-op. */
export function donePhaseIds(tickets: readonly TicketPhase[]): string[] {
  return tickets
    .filter((t) => t.phase === "done")
    .map((t) => t.id)
    .sort();
}

/** The pre-sweep verdict. `ok: false` is an expected ANDON (returned data, not a throw — the
 *  committed-core / gates house rule); `offenders` names the uncommitted in-scope paths and
 *  `doneIds` the done tickets whose "done" the dirty tree contradicts. */
export interface SweepVerdict {
  readonly ok: boolean;
  readonly doneIds: readonly string[];
  readonly offenders: readonly string[];
}

/**
 * Classify `done ⇒ committed`. PURE/TOTAL. The implication: IF any ticket is `phase: done`, THEN the
 * tree must be clean across {@link SWEEP_PREFIXES} (source + board). So it ANDONs iff there is at
 * least one done ticket AND at least one uncommitted/untracked in-scope path — the F2 signature. A
 * board with no done work yet (empty antecedent) is vacuously ok even with a dirty tree (legitimate
 * in-progress edits); a fully-committed tree is ok regardless of how much is done.
 */
export function classifySweep(opts: { doneIds: readonly string[]; porcelain: string }): SweepVerdict {
  // Empty antecedent → vacuously ok, and report nothing: a dirty tree with no done work yet is
  // legitimate in-progress state, not an offense, so we don't even classify it.
  if (opts.doneIds.length === 0) return { ok: true, doneIds: [], offenders: [] };
  const offenders = classifyPorcelain(opts.porcelain, SWEEP_PREFIXES);
  return { ok: offenders.length === 0, doneIds: [...opts.doneIds], offenders };
}
