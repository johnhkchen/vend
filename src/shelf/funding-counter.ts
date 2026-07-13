// The shared funding counter (T-074-02-02) — compare the budget an operator actually
// funded with the play's measured shelf floor, warn on a severe mismatch, then ALWAYS
// dispense the cast. Both named/pressed runs and the direct steer gesture pass through
// this seam, so counter policy cannot drift between entry points.
//
// The decision half is PURE: it consumes a play + already-read records, reuses shelfRows
// for rarity/recalibration/provenance, and delegates the threshold/message to
// underfunding-core. The wrapper is the thin IMPURE shell: load the project-local ledger,
// write a non-null warning, and invoke the supplied cast callback in that order. The
// callback keeps concrete input assembly outside this module and makes warn-don't-block
// directly testable without loading a concrete play's BAML addon.

import { join } from "node:path";
import type { Budget } from "../budget/budget.ts";
import type { AnyPlay } from "../engine/play.ts";
import { DEFAULT_RUN_LOG_PATH, loadRunLog, type RunRecord } from "../log/run-log.ts";
import { shelfRows } from "./shelf-row.ts";
import { underfundingWarning } from "./underfunding-core.ts";

/** Resolve the optional counter warning from the SAME row the supply shelf presents.
 * PURE. A default row is cold-start/prior provenance and is deliberately silent; only a
 * measured row's recalibrated envelope is a legitimate floor for the warning core. */
export function fundingWarningFor(
  play: AnyPlay,
  funded: Budget,
  records: readonly RunRecord[],
): string | null {
  const row = shelfRows([play], records)[0]!;
  if (row.confidence.kind === "default") return null;
  return underfundingWarning(funded, row.envelope);
}

/** Effect seams are injectable so ordering/silence can be proven addon-free. Production
 * callers omit both: records come from `<projectRoot>/.vend/runs.jsonl`, and warnings go
 * to stdout. These are effect overrides only — threshold and calibration policy are fixed. */
export interface FundingCounterOptions {
  readonly projectRoot?: string;
  readonly records?: readonly RunRecord[];
  readonly write?: (text: string) => void;
}

/**
 * Pass a cast through the funding counter. IMPURE by default (ledger read + stdout), but
 * policy-free beyond composing the pure decision. A warning is written BEFORE `cast` is
 * invoked. `cast` is outside every warning branch, so a severe mismatch never blocks,
 * changes funding, or transforms the cast's result.
 */
export async function withFundingCounter<T>(
  play: AnyPlay,
  funded: Budget,
  cast: () => Promise<T>,
  opts: FundingCounterOptions = {},
): Promise<T> {
  const root = opts.projectRoot ?? process.cwd();
  const records =
    opts.records ?? (await loadRunLog({ path: join(root, DEFAULT_RUN_LOG_PATH) })).records;
  const warning = fundingWarningFor(play, funded, records);
  if (warning !== null) (opts.write ?? ((text: string) => process.stdout.write(text)))(`${warning}\n`);
  return await cast();
}
