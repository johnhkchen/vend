// The consistency probe's PURE diff/variance core (T-014-02, PRD KR3 — the E2 arm).
//
// The core promise of Vend is CONSISTENCY: gates turn a natively probabilistic process into
// a repeatable one. This module quantifies that, for the first time, as a single number —
// the gate-driven variance reduction — over a set of materialized outputs from one play cast
// repeatedly ±gates on a fixed input. The live 5×2 casting is the impure sweep harness
// (./run-probe.ts); THIS module is the pure judgment it feeds, and the only part unit-tested.
//
// WHY OVER MATERIALIZED OUTPUT, NOT THE RAW DISPENSE: the gates' only consistency mechanism is
// CENSORING — they do not rewrite the model's reply, they STOP a divergent plan from
// materializing (a gate-failed run lands nothing). So the consistency they buy shows up as the
// gated MATERIALIZED set being tighter than the ungated one (the wild outputs were dropped).
// Diffing the raw dispense would measure a channel the gates never touch. Hence the inputs
// here are per-run materialized output, or `null` when a run materialized nothing.
//
// THE METRIC: line-set Jaccard distance between two outputs (1 − |∩|/|∪| over trimmed
// non-blank lines), dispersion = the mean over all unordered pairs of a set, and the headline
// = the reduction ratio (ungated − gated)/ungated. Order-insensitive (we measure CONTENT
// consistency, not ordering), O(n) per pair, dependency-free — so the test is an ordinary
// pure-function test. Char-level edit distance and schema-specific structural metrics were
// considered and rejected (heavier / play-coupled — see design.md D3).
//
// HONESTY (IA-8, the meter must not lie): a gated set can shrink below its run count when
// gates censor runs; if almost everything is censored the 1–2 survivors are trivially
// consistent and the reduction inflates toward 1.0. So the report carries the censored counts
// and member counts, and the formatter caveats a reduction earned by censoring. T-014-03 reads
// this into the go/reroute call.
//
// PURE: no fs, clock, network, process, or addon — every export takes plain values and returns
// fresh ones. Imports nothing.

/** One pair's divergence within a set: the two run indices (into the set's materialized
 *  members, not the original run order) and their distance ∈ [0, 1]. */
export interface PairDiff {
  readonly i: number;
  readonly j: number;
  readonly distance: number;
}

/** A set's dispersion: how many materialized members it has, the mean pairwise distance over
 *  them (0 when fewer than two — a single point cannot disperse), and the raw per-pair diffs. */
export interface SetDispersion {
  readonly n: number;
  readonly dispersion: number;
  readonly pairs: readonly PairDiff[];
}

/** The whole probe read: both arms' dispersion, the headline reduction, and the censored
 *  counts (runs that materialized nothing) — kept beside the number so it can never read as a
 *  win earned purely by censoring. */
export interface VarianceReport {
  readonly gated: SetDispersion;
  readonly ungated: SetDispersion;
  /** (ungated − gated) / ungated, in (−∞, 1]: `> 0` ⇒ gates made output more consistent (the
   *  hoped result); `≈ 0` ⇒ no effect (A5 flat); `< 0` ⇒ gates increased dispersion. Defined
   *  as 0 when the ungated baseline has no variance (no baseline to reduce — never NaN). */
  readonly reduction: number;
  /** Gated runs that materialized nothing (a `null` input — gate-censored or collided). */
  readonly censoredGated: number;
  /** Ungated runs that materialized nothing (rare — a non-gate andon, e.g. timeout). */
  readonly censoredUngated: number;
}

/** The set of trimmed, non-blank lines of a text — the comparison unit. PURE. Trimming and
 *  blank-dropping make the metric insensitive to whitespace-only noise; using a Set makes it
 *  order-insensitive (content, not ordering). */
export function lineSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length > 0) out.add(line);
  }
  return out;
}

/**
 * Jaccard distance between two texts' line sets: `1 − |∩| / |∪|`. PURE. Range `[0, 1]`:
 * `0` = identical line content, `1` = no shared line. Two empty (or whitespace-only) texts
 * are identical ⇒ `0` (the empty-union case is defined, not a divide-by-zero).
 */
export function lineJaccardDistance(a: string, b: string): number {
  const la = lineSet(a);
  const lb = lineSet(b);
  if (la.size === 0 && lb.size === 0) return 0;
  let intersection = 0;
  for (const line of la) if (lb.has(line)) intersection++;
  const union = la.size + lb.size - intersection;
  return union === 0 ? 0 : 1 - intersection / union;
}

/**
 * The dispersion of a set of materialized outputs: the mean of {@link lineJaccardDistance}
 * over every unordered pair, with the raw per-pair diffs. PURE. Fewer than two members ⇒
 * `{ n, dispersion: 0, pairs: [] }` (a single point — or none — cannot disperse).
 */
export function dispersion(outputs: readonly string[]): SetDispersion {
  const n = outputs.length;
  const pairs: PairDiff[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const distance = lineJaccardDistance(outputs[i]!, outputs[j]!);
      pairs.push({ i, j, distance });
      sum += distance;
    }
  }
  return { n, dispersion: pairs.length === 0 ? 0 : sum / pairs.length, pairs };
}

/**
 * The headline read of the paired probe. PURE. Each arm's input is per-run materialized
 * output, or `null` when that run materialized nothing (gate censoring / collision / a
 * non-gate andon); the `null`s are counted as censored and excluded from the dispersion.
 * `reduction = (ungated.dispersion − gated.dispersion) / ungated.dispersion`, defined as `0`
 * when the ungated baseline dispersion is `0` (no variance to reduce — never NaN). Totals over
 * every edge case: empty arms, all-censored arms, single survivors.
 */
export function varianceReduction(
  gated: readonly (string | null)[],
  ungated: readonly (string | null)[],
): VarianceReport {
  const gatedOut = gated.filter((o): o is string => o !== null);
  const ungatedOut = ungated.filter((o): o is string => o !== null);
  const gatedDisp = dispersion(gatedOut);
  const ungatedDisp = dispersion(ungatedOut);
  const reduction =
    ungatedDisp.dispersion === 0 ? 0 : (ungatedDisp.dispersion - gatedDisp.dispersion) / ungatedDisp.dispersion;
  return {
    gated: gatedDisp,
    ungated: ungatedDisp,
    reduction,
    censoredGated: gated.length - gatedOut.length,
    censoredUngated: ungated.length - ungatedOut.length,
  };
}

/** Round a 0–1 ratio to a whole-percent string (the headline format). */
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Round a dispersion to 2dp for display. */
function d2(x: number): string {
  return x.toFixed(2);
}

/**
 * Render a {@link VarianceReport} as one honest line for the findings note (KR4 / IA-8). PURE.
 * Leads with the single number, then the raw dispersions and member counts of each arm, and —
 * when gated runs were censored — an explicit caveat, so a reduction inflated by censoring (or
 * an absent ungated baseline) reads truthfully rather than as a clean win.
 */
export function formatVarianceReport(r: VarianceReport): string {
  const head = `gate-driven variance reduction: ${pct(r.reduction)}`;
  const body =
    `ungated dispersion ${d2(r.ungated.dispersion)} over ${r.ungated.n}` +
    ` · gated ${d2(r.gated.dispersion)} over ${r.gated.n}`;
  const caveats: string[] = [];
  if (r.censoredGated > 0) caveats.push(`${r.censoredGated} gated censored`);
  if (r.censoredUngated > 0) caveats.push(`${r.censoredUngated} ungated censored`);
  if (r.ungated.dispersion === 0) caveats.push("no ungated baseline variance");
  if (r.gated.n < 2) caveats.push("gated arm too small to disperse — reduction not meaningful");
  const tail = caveats.length > 0 ? ` — ⚠ ${caveats.join("; ")}` : "";
  return `${head} (${body})${tail}`;
}
