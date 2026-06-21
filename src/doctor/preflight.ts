// The cast PRECONDITION GUARD (T-042-04, story S-042-02, epic E-042 vend-doctor-preflight) —
// reuse the `vend doctor` check as the gate at the door of a cast, mirroring lisa's
// `check_required_deps`-before-`run_loop`: a cast against a broken environment refuses CLEANLY
// before a budget is committed, instead of crashing mid-run after tokens are already spent (P3/P4/P7).
//
// THE REUSE: this module composes the two doctor halves and adds NO check logic of its own — the
// world-touching probe (`probeDoctor`, T-042-02) emits the `Check[]`, the pure renderer
// (`renderDoctorReport`, T-042-01) verdicts them into a `DoctorReport`. The cast path (`castWork`,
// src/play/work.ts) calls this BEFORE reading the board or funding the wallet; the same
// probe→render compose is reusable by the `vend doctor` command (T-042-03).
//
// ADDON-SAFE AT IMPORT (the load-bearing reason this is its own module, not inlined in work.ts):
// it imports only `doctor-core` (pure) and `doctor-probe` (whose single BAML touch is a DYNAMIC
// import INSIDE a function — module evaluation loads no native addon). So `preflight.test.ts`
// value-imports it as an ordinary `bun test`, injecting fabricated world-facts to exercise the
// refuse-or-proceed contract deterministically — which work.ts itself can never be (it eagerly
// loads the BAML addon through the chain).
//
// NEVER THROWS: `probeDoctor` never rejects (every check is `safeCheck`-wrapped) and
// `renderDoctorReport` is pure/total, so a broken dependency is RETURNED data — a red
// `DoctorReport` (`ok:false`, `exitCode:1`) — never an exception. The gate cannot crash the cast
// it guards (the house "a clean refusal returns data, a real fault throws" rule).

import { renderDoctorReport, type DoctorReport } from "./doctor-core.ts";
import { probeDoctor, type DoctorProbeDeps } from "./doctor-probe.ts";

/**
 * Run the vend doctor preflight and render it to a verdict — the precondition for a cast. Returns
 * the {@link DoctorReport} the caller branches on: `ok` true ⇒ the environment is wired, proceed;
 * `ok` false ⇒ a broken dependency — refuse at the door, printing `report.report` (the same
 * named-check + fix-it-hint surface `vend doctor` emits) and exiting `report.exitCode`.
 *
 * `deps` overrides individual world-fact backends ({@link DoctorProbeDeps}); the rest come from
 * `DEFAULT_PROBE_DEPS` (the real envinfo / addon / `process.env`). That injection seam is how the
 * test fabricates a broken-vs-wired env deterministically, with no dependence on the host. NEVER
 * throws — see the module header.
 */
export async function castPreflight(deps: Partial<DoctorProbeDeps> = {}): Promise<DoctorReport> {
  return renderDoctorReport(await probeDoctor(deps));
}
