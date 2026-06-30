// Promote cleared forward-E1 records into the COMMITTED keystone ledger (proposed-batch #4 / F3).
//
//   bun run src/ledger/promote-forward.ts [--from <runs.jsonl>] [--into <ledger>] [--dry-run]
//
// THE PORTABILITY VERB: the operational `.vend/runs.jsonl` is gitignored + per-device, so a cleared
// forward-E1 record produced on ANOTHER repo (the kitchen clean-room drive, E-062 phase 2) is stranded
// there. This reads a SOURCE ledger (default the local `.vend/runs.jsonl`; `--from <other-repo>/.vend/
// runs.jsonl` for a clean-room drive), selects the genuine cleared-forward records (isForwardCleared:
// success + intervened:false + not attested), and MERGES them — deduped by runId — into the committed
// `.vend/forward-e1.jsonl` (the tracked, cross-repo keystone count). After a phase-2 drive:
//   bun run src/ledger/promote-forward.ts --from /path/to/kitchen-cleanroom/.vend/runs.jsonl
// and the drive's cleared record counts toward the >=10 bar.
//
// The thin IMPURE shell (the attest-intervention.ts pattern): it reads/writes files and reports;
// ALL judgment (what's cleared-forward, the dedup merge) lives in portable-core.ts. `--dry-run` prints
// the plan + the resulting count and writes nothing.
//
// EXIT: 0 = ok (merged, or dry-run); 2 = environment/arg error (missing source, bad flag).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { reviveRecord, serializeRunRecord, type RunRecord } from "../log/run-log.ts";
import {
  countByProject,
  FORWARD_LEDGER_PATH,
  KEYSTONE_BAR,
  mergeForwardLedger,
  selectForwardCleared,
} from "./portable-core.ts";

const DEFAULT_SOURCE = ".vend/runs.jsonl";

interface Args {
  from: string;
  into: string;
  dryRun: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  let from = DEFAULT_SOURCE;
  let into = FORWARD_LEDGER_PATH;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--from") from = argv[++i] ?? from;
    else if (a === "--into") into = argv[++i] ?? into;
    else if (a === "--dry-run") dryRun = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return { from, into, dryRun };
}

/** Read a JSONL ledger into typed records, tolerating absence (→ []) and skipping malformed/foreign
 *  lines (reviveRecord → null). The same lenient read both the source and the committed ledger get. */
async function loadLedger(path: string, required: boolean): Promise<RunRecord[]> {
  let raw: string;
  try {
    raw = (await readFile(path, "utf8")).trim();
  } catch {
    if (required) throw new Error(`source ledger not found: ${path}`);
    return []; // the committed ledger may not exist yet — first promote creates it
  }
  if (raw.length === 0) return [];
  const out: RunRecord[] = [];
  for (const line of raw.split("\n")) {
    if (line.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue; // a corrupt line is skipped, not fatal (over-tolerant beats a crash on a stray byte)
    }
    const rec = reviveRecord(parsed);
    if (rec !== null) out.push(rec);
  }
  return out;
}

async function main(argv: readonly string[]): Promise<void> {
  const { from, into, dryRun } = parseArgs(argv);

  const incoming = await loadLedger(from, true);
  const existing = await loadLedger(into, false);
  const { merged, added } = mergeForwardLedger(existing, incoming);

  const candidates = selectForwardCleared(incoming).length;
  const total = merged.length;
  const short = Math.max(0, KEYSTONE_BAR - total);

  process.stdout.write(
    `promote-forward: ${from} → ${into}${dryRun ? "  (dry-run)" : ""}\n` +
      `  source: ${incoming.length} record(s), ${candidates} cleared-forward\n` +
      `  ${added.length === 0 ? "nothing new (ledger already current)" : `+${added.length} promoted`}` +
      `${added.length > 0 ? `: ${added.map((r) => r.runId).join(", ")}` : ""}\n`,
  );
  for (const { project, count } of countByProject(merged)) {
    process.stdout.write(`    ${project}: ${count}\n`);
  }
  process.stdout.write(
    `  cleared-forward total: ${total}/${KEYSTONE_BAR}` +
      `${short > 0 ? ` (${short} short of the keystone bar)` : " — keystone bar MET"}\n`,
  );

  if (dryRun) {
    process.stdout.write("  dry-run — nothing written.\n");
    return;
  }
  if (added.length === 0) return; // no write when nothing changed (idempotent re-promote)

  await mkdir(dirname(into), { recursive: true });
  await writeFile(into, merged.map(serializeRunRecord).join("\n") + "\n");
  process.stdout.write(`  wrote ${into}\n`);
}

if (import.meta.main) {
  try {
    await main(Bun.argv.slice(2));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`promote-forward: ${(err as Error).message}\n`);
    process.exit(2);
  }
}
