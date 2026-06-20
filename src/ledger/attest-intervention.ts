// E1 walk-away back-fill with ATTESTATION (T-014-01 forward instrument, measurement-sprint).
//
//   bun run src/ledger/attest-intervention.ts <runId...> --basis "<why>" [--intervened] [--ledger <path>]
//
// The `intervened` bit (run-log.ts) is FORWARD-looking by design — recorded live at run time. This
// instrument is the ONE honest exception: a human ATTESTS, after the fact, that a named real
// clearing run was (or was not) intervened in, and we record that — *marked as an attestation*, not
// disguised as a live capture. It writes:
//   • `intervened`            — the attested bit (default false = a clean walk-away; --intervened ⇒ true)
//   • `intervenedAttestation` — { by, at, basis } — WHO attested, WHEN, on WHAT BASIS (the audit trail)
//
// HONESTY INVARIANTS (this is trust-signal data — the gate the macro-wallet sits behind):
//  1. NAMED RUNS ONLY — it stamps exactly the runIds passed, never a wildcard / "all". You cannot
//     bulk-attest; you attest specific runs you stand behind. An unknown id is an error, not a skip.
//  2. NEVER FABRICATES THE DENOMINATOR — it refuses to run without a `--basis` (the attestation is
//     worthless without its grounds); the marker makes every back-filled bit distinguishable from a
//     live one in any later audit.
//  3. RAW-LINE REWRITE — preserves every existing field byte-for-byte (no normalizer round-trip that
//     would drop the marker); only adds the two fields to the named lines.

import { readFile, writeFile } from "node:fs/promises";

const DEFAULT_LEDGER = ".vend/runs.jsonl";

interface Attestation {
  readonly by: string;
  readonly at: string;
  readonly basis: string;
}

/** Parse argv into the named ids, the basis, the bit, and the ledger path. */
function parseArgs(argv: readonly string[]): {
  ids: string[];
  basis: string | undefined;
  intervened: boolean;
  ledger: string;
} {
  const ids: string[] = [];
  let basis: string | undefined;
  let intervened = false;
  let ledger = DEFAULT_LEDGER;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) continue;
    if (a === "--basis") basis = argv[++i];
    else if (a === "--intervened") intervened = true;
    else if (a === "--no-intervened") intervened = false;
    else if (a === "--ledger") ledger = argv[++i] ?? DEFAULT_LEDGER;
    else if (a.startsWith("--")) throw new Error(`unknown flag: ${a}`);
    else ids.push(a);
  }
  return { ids, basis, intervened, ledger };
}

async function main(argv: readonly string[]): Promise<void> {
  const { ids, basis, intervened, ledger } = parseArgs(argv);
  if (ids.length === 0) throw new Error("no runIds given — name the runs you attest (no wildcard)");
  if (!basis || basis.trim().length === 0)
    throw new Error("--basis is required — an attestation without its grounds is not recorded");

  const attestation: Attestation = {
    by: process.env.VEND_ATTESTOR ?? process.env.USER ?? "unknown",
    at: new Date().toISOString(),
    basis: basis.trim(),
  };

  const wanted = new Set(ids);
  const raw = (await readFile(ledger, "utf8")).trim();
  const lines = raw.length > 0 ? raw.split("\n") : [];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const line of lines) {
    const rec = JSON.parse(line) as Record<string, unknown>;
    const id = rec.runId as string | undefined;
    if (id !== undefined && wanted.has(id)) {
      seen.add(id);
      out.push(JSON.stringify({ ...rec, intervened, intervenedAttestation: attestation }));
    } else {
      out.push(line); // untouched, byte-for-byte
    }
  }

  const missing = ids.filter((id) => !seen.has(id));
  if (missing.length > 0) throw new Error(`runIds not found in ${ledger}: ${missing.join(", ")}`);

  await writeFile(ledger, out.join("\n") + "\n");
  process.stdout.write(
    `attested intervened=${intervened} on ${seen.size} run(s) in ${ledger}\n` +
      `  by ${attestation.by} at ${attestation.at}\n` +
      `  basis: ${attestation.basis}\n` +
      `  runs: ${[...seen].join(", ")}\n`,
  );
}

if (import.meta.main) {
  try {
    await main(Bun.argv.slice(2));
    process.exit(0);
  } catch (err) {
    process.stderr.write(`attest-intervention: ${(err as Error).message}\n`);
    process.exit(2);
  }
}
