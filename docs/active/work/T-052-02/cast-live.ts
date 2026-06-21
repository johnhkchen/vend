// T-052-02 — the LIVE METERED cast runner (epic E-052, story S-052-01). Run DIRECTLY, never imported:
//
//   bun run docs/active/work/T-052-02/cast-live.ts <stamp>
//
// It casts the `survey → [propose ×2] → capture-note` diamond LIVE through `castRealPlayGraph` (the
// wallet-threaded entry T-052-01 wired) and dumps the `GraphResult` as machine-readable evidence the
// settlement (`graph-cast-log.md`) quotes. This is the impure shell's CALLER — it value-imports
// `castRealPlayGraph` (which loads the BAML addon + spawns ~4 real `claude -p`), which is exactly why
// it lives under `work/` and not `src/`, and why no `bun test` ever imports it (the house discipline).
//
// CONTAINMENT (Design D1): it casts against a FRESH sandbox = a copy of the vend repo's `docs/` board +
// CLAUDE.md under the GITIGNORED `.vend/live-proof/`, with `projectRoot` pointed at it. Every play
// resolves all paths from `projectRoot`, so ALL mutation (the staged board, the 2 minted epics, the
// note) lands inside the sandbox — the tracked repo board is never touched.
//
// ENVELOPE — two budget layers, learned from run 01 (cast-result-01.json):
//   1. the SHARED WALLET (macro) — the wave-level envelope `castGraph` authorizes/debits across the
//      fan-out. Run 01 PROVED this works: it authorized the full 2-propose wave (no per-branch leak),
//      594k/1.216M drawn off ONE envelope. E-052's fix is sound.
//   2. each node's PER-CAST budget (`PlayNode.budget`) — the in-flight andon ceiling the individual
//      `claude -p` cast stops itself at. Run 01's propose-2 hit THIS (323626/150000) and produced no
//      epic, so the JOIN skipped — the same E-047 failure mode, on the per-CAST layer, NOT the wallet.
// So this run widens the PER-CAST budgets to what real casts actually burn (propose-2 wanted ~324k;
// note's 8k default cannot fund a real note), and lets the macro AUTO-DERIVE via `realPlayMacro` over
// them — one honestly-sized shared wallet that bounds the wave while each cast has room to finish.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { castRealPlayGraph } from "../../../../src/play/graph-real-play.ts";
import { realPlayMacro } from "../../../../src/play/graph-real-play-core.ts";

const REPO = resolve(import.meta.dir, "../../../.."); // docs/active/work/T-052-02 → repo root
const WORK = import.meta.dir;
const stamp = process.argv[2] ?? "run";
const SANDBOX = join(REPO, ".vend/live-proof", `E052-${stamp}`);

// The DEFAULT per-node budgets (src refs), kept only to compute the honest `tight` floor for the
// settlement's comparison.
const DEF_SURVEY = { tokens: 300_000, timeMs: 1_800_000 }; // src/play/survey.ts:88
const DEF_PROPOSE = { tokens: 150_000, timeMs: 1_800_000 }; // src/play/propose-epic.ts:107
const DEF_NOTE = { tokens: 8_000, timeMs: 600_000 }; // src/play/note.ts:77
const TIGHT = realPlayMacro(DEF_SURVEY, DEF_PROPOSE, DEF_NOTE); // { 608_000, 4_200_000 } — the p90 floor

// The PROVISIONED per-cast budgets — widened to what real casts burn (run 01: survey ~145k, propose-2
// ~324k, and a real note far exceeds the 8k default). These are the per-cast andon ceilings AND the
// wave prices; the macro auto-derives from them.
const SURVEY_B = { tokens: 600_000, timeMs: 2_400_000 };
const PROPOSE_B = { tokens: 1_500_000, timeMs: 2_400_000 }; // propose-2 cache_read swings wildly (run 03: 635k) — absorb it
const NOTE_B = { tokens: 600_000, timeMs: 1_800_000 }; // run 02 note burned ~161k AND was cut off mid-task

// ONE shared wallet, sized by realPlayMacro over the PROVISIONED budgets (survey + 2×propose + note
// tokens; proposes overlap ⇒ one propose's wall). Still a single envelope `castGraph` threads as its
// 3rd arg — the AC is about topology (one wallet across the wave), which holds at any honest size.
const MACRO = realPlayMacro(SURVEY_B, PROPOSE_B, NOTE_B); // { 1_720_000, 6_000_000 }

// ── Step 1: prep the sandbox (a fresh, gitignored copy of the rich board) ─────────────────────────
if (!existsSync(SANDBOX)) {
  mkdirSync(SANDBOX, { recursive: true });
  cpSync(join(REPO, "docs"), join(SANDBOX, "docs"), { recursive: true });
  cpSync(join(REPO, "CLAUDE.md"), join(SANDBOX, "CLAUDE.md"));
}
process.stdout.write(`═ T-052-02 live cast ═\n`);
process.stdout.write(`  sandbox:  ${SANDBOX}\n`);
process.stdout.write(`  funded:   ${MACRO.tokens} tok / ${MACRO.timeMs} ms (2× realPlayMacro)\n\n`);

// ── Step 2: cast LIVE (~4 real claude -p; the two proposes run concurrently) ───────────────────────
const result = await castRealPlayGraph({
  projectRoot: SANDBOX,
  surveyBudget: SURVEY_B,
  proposeBudget: PROPOSE_B,
  noteBudget: NOTE_B,
  macroBudget: MACRO, // == realPlayMacro(provisioned) — one shared envelope over the widened per-cast budgets
});

// ── Step 3: dump the GraphResult as machine-readable evidence ──────────────────────────────────────
const rem = result.walletRemaining;
const view = {
  stamp,
  sandbox: SANDBOX,
  funded: MACRO,
  tight: TIGHT,
  walletRemaining: rem,
  spent: rem === undefined ? undefined : { tokens: MACRO.tokens - rem.tokens, timeMs: MACRO.timeMs - rem.timeMs },
  outcome: result.outcome,
  halted: result.halted,
  haltReason: result.haltReason,
  nodes: [...result.nodes].map(([id, s]) => ({
    id,
    runId: s.runId,
    outcome: s.outcome,
    materialized: s.materialized,
    produced: s.produced,
    actuals: s.actuals,
  })),
  skipped: result.skipped,
  produced: [...result.produced],
};
writeFileSync(join(WORK, "cast-result.json"), JSON.stringify(view, null, 2));

// ── Step 4: echo a human readout (the invoking shell tees this to cast-stdout.log) ─────────────────
process.stdout.write(`\n═ cast result ═\n`);
for (const [id, s] of result.nodes) {
  process.stdout.write(`  node ${id}: ${s.outcome}${s.produced ? ` → ${s.produced}` : ""}\n`);
}
for (const sk of result.skipped) process.stdout.write(`  node ${sk.id}: SKIPPED — ${sk.reason}\n`);
process.stdout.write(`  sinks: ${JSON.stringify(Object.fromEntries(result.produced))}\n`);
if (rem !== undefined) {
  process.stdout.write(
    `  wallet: funded ${MACRO.tokens} tok / ${MACRO.timeMs} ms · remaining ${rem.tokens} tok / ${rem.timeMs} ms ` +
      `· spent ${MACRO.tokens - rem.tokens} tok / ${MACRO.timeMs - rem.timeMs} ms\n`,
  );
}
if (result.halted) process.stderr.write(`  graph halted: ${result.haltReason}\n`);

// ── Step 5: exit by outcome (a degrade is loud) ────────────────────────────────────────────────────
process.exit(result.outcome === "success" && !result.halted ? 0 : 1);
