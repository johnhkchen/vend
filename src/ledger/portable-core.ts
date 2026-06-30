// The portable forward-E1 ledger PURE core (proposed-batch #4 / F3) — the addon-free heart of
// making the autonomy keystone's cleared-forward count survive a device / repo transfer.
//
// THE PROBLEM: the operational ledger `.vend/runs.jsonl` is gitignored + per-device (one per repo),
// so a CLEARED FORWARD-E1 record produced by a drive on ANOTHER repo (the kitchen clean-room drive,
// E-062 phase 2) is stranded there — it never accumulates toward the ">=10 cleared-forward" bar that
// flips the macro-wallet provisional -> confirmed (the count is ~4 today). This core curates those
// records into a COMMITTED ledger (`.vend/forward-e1.jsonl`, un-gitignored like `.vend/decisions.jsonl`)
// that IS tracked, so the count is durable and cross-repo: promote a drive's cleared-forward record
// into it from any source `runs.jsonl` and it counts.
//
// PURE (the walk-away.ts / recalibrate.ts discipline): every export takes plain records and returns
// fresh values — no fs, clock, network, process. The one impure verb (read source + committed ledger,
// merge, write) lives in promote-forward.ts. Reuses run-log's `RunRecord` (TYPE) so the committed
// ledger is the SAME schema as the operational one — a curated subset, not a parallel format.

import { DEFAULT_PROJECT, type RunRecord } from "../log/run-log.ts";

/** The committed, tracked keystone ledger. Under `.vend/` (beside `runs.jsonl`) but un-gitignored via
 *  the `!.vend/forward-e1.jsonl` exception — mirroring the existing `!.vend/decisions.jsonl` precedent —
 *  so it travels in git and the cleared-forward count survives a device/repo transfer (F3). */
export const FORWARD_LEDGER_PATH = ".vend/forward-e1.jsonl";

/**
 * Is this record a genuine CLEARED FORWARD-E1 — the keystone gauge? The three conjuncts, single-
 * sourced here (the ~4-today count is exactly `records.filter(isForwardCleared).length`):
 *  - `outcome === "success"`        — it cleared its gates, in budget, and materialized;
 *  - `intervened === false`         — it ran UNTOUCHED, recorded so at run time (NOT `undefined`,
 *    which is "unknown" — an unreported run is not evidence);
 *  - `intervenedAttested !== true`  — FORWARD/live, not a post-hoc attested back-fill (the E-026
 *    over-claim trap: attested back-fill is real evidence but a DIFFERENT kind, never the keystone).
 * PURE/TOTAL.
 */
export function isForwardCleared(r: RunRecord): boolean {
  return r.outcome === "success" && r.intervened === false && r.intervenedAttested !== true;
}

/** The cleared-forward subset of a record slice, order-preserving. PURE. */
export function selectForwardCleared(records: readonly RunRecord[]): RunRecord[] {
  return records.filter(isForwardCleared);
}

/** The result of a merge: the full deduped ledger to write, and just the records newly added (for
 *  the promote verb's report — empty `added` means "nothing new, the ledger is already current"). */
export interface MergeResult {
  readonly merged: readonly RunRecord[];
  readonly added: readonly RunRecord[];
}

/**
 * Merge cleared-forward records from a source slice INTO an existing committed ledger. PURE/TOTAL.
 * Keeps every `existing` record (in order, byte-identity is the writer's job), then appends each
 * cleared-forward record from `incoming` whose `runId` is not already present — DEDUPED by runId, so
 * re-promoting the same source (a re-run, an overlapping window) is idempotent. `existing` is trusted
 * as-is (already curated); only `incoming` is filtered through {@link isForwardCleared}. The result is
 * append-ordered (existing first, then new in source order), matching the ledger's chronological grain.
 */
export function mergeForwardLedger(
  existing: readonly RunRecord[],
  incoming: readonly RunRecord[],
): MergeResult {
  const seen = new Set(existing.map((r) => r.runId));
  const added: RunRecord[] = [];
  for (const r of selectForwardCleared(incoming)) {
    if (seen.has(r.runId)) continue;
    seen.add(r.runId);
    added.push(r);
  }
  return { merged: [...existing, ...added], added };
}

/** Per-project counts over a ledger — the honest provenance breakdown the report shows (e.g. how many
 *  cleared-forward came from `vend` vs the `kitchen` clean-room repo). PURE. Sorted by project id. */
export function countByProject(records: readonly RunRecord[]): Array<{ project: string; count: number }> {
  const counts = new Map<string, number>();
  // `project` is optional on a record (every pre-T-013-03 one lacks it) — group those under
  // DEFAULT_PROJECT, exactly as run-log's read-side does, so the breakdown never keys on undefined.
  for (const r of records) {
    const p = r.project ?? DEFAULT_PROJECT;
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].map(([project, count]) => ({ project, count })).sort((a, b) => a.project.localeCompare(b.project));
}

/** The keystone bar: cleared-forward records needed to flip the macro-wallet provisional -> confirmed
 *  (OKR Set-A KR1). The count is read against THIS; surfaced so the report says "N/10". */
export const KEYSTONE_BAR = 10;
