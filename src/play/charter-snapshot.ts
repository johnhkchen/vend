// Charter-code snapshot resolver (T-067-01-01) — pay the charter resolution exactly ONCE,
// at the cut.
//
// A cut ticket says `advances: P4` — a bare pointer that dereferences against whatever the
// charter says LATER, so meaning drifts after cut and the opaque code leaks into downstream
// agent context where it explains nothing (honey-kitchen fix #1; the agent:codex no-charter
// case). The E-067 play is snapshot-at-cut: this module turns charter text into a
// code→one-line map the cut-time consumers (materialize's render pair, T-067-01-02; the
// bare-code write guard, T-067-01-03) can trust, so a materialized artifact carries the
// meaning its codes had when the work was warranted and never needs the live charter to
// read standalone (P6, P4).
//
// PURE — the id-guard.ts standard, the strictest in the tree: no fs, no clock, no process,
// no BAML import (not even type-only), ZERO imports. Total — never throws; a charter with
// no definitions yields an EMPTY map (honest empty — whether that refuses a cut is the
// write guard's judgment, not the parser's).
//
// WHAT COUNTS AS A DEFINITION: the bold bullet shape every charter in this repo uses —
// `**P4 — Autonomy by default, not supervision.** body prose…` (live charter P1..P7/N1..N4;
// kitchen-seed charter K1..K3 — the code shape is prefix-generic on purpose). The parse is
// anchored to that bold span: a prose mention of a code (`advances: [P…]`, examples in
// running text) neither creates nor shadows an entry. This is a DIFFERENT question from
// gates.ts's `matchIds`, which greps any occurrence to ask "is this code known?" — the
// bounds gate's contract. This module asks "what did the code SAY?"; the two coexist and
// must not be merged.
//
// A duplicate definition of the same code (a charter authoring error nothing currently
// detects) resolves FIRST-wins, deterministically — the `findExistingByTitle` precedent. A
// malformed definition with a blank title (`**P8 — .**`) mints NO entry: absence is the
// contract's only miss state, so a caller can never receive a silent `""`.

/** The snapshot contract both cut-time consumers build on. Key: the code exactly as the
 *  charter wrote it (`"P4"`, `"N1"`). Value: the definition's one-line title — trailing
 *  period stripped, whitespace collapsed, guaranteed non-blank. Absence (unknown or retired
 *  code) is `.get()` → `undefined`: a typed miss strict tsc forces the caller to handle —
 *  never an empty string. */
export type CharterSnapshot = ReadonlyMap<string, string>;

/** The definition shape: a bold span opening with a code + em-dash — `**P4 — <title>**`.
 *  Code is prefix-generic (`[A-Z]{1,3}\d+`: P/N today, K in kitchen charters, PE if it is
 *  ever minted). The title is non-greedy and `*`-free so a match can never leak across bold
 *  boundaries; `[^*]` matches `\n`, so a bold span wrapped by an editor still captures
 *  whole. */
const DEFINITION = /\*\*([A-Z]{1,3}\d+) — ([^*]+?)\*\*/g;

/** Normalize a captured title to its one line: collapse whitespace runs (unwraps a wrapped
 *  span), trim, strip exactly ONE trailing period (`Ships v2.` → `Ships v2`; interior
 *  periods kept). The single home of what "one-line text" means. */
function oneLine(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed.endsWith(".") ? collapsed.slice(0, -1).trimEnd() : collapsed;
}

/**
 * Snapshot a charter's code definitions into a {@link CharterSnapshot}. PURE and TOTAL —
 * never throws; inputs are not mutated; no definitions means an empty map. Each bold
 * definition contributes one entry keyed by its code; the first definition of a code wins;
 * a blank-titled definition contributes nothing (never a silent `""`).
 */
export function snapshotCharterCodes(charter: string): CharterSnapshot {
  const snapshot = new Map<string, string>();
  for (const m of charter.matchAll(DEFINITION)) {
    const code = m[1];
    const title = m[2] === undefined ? "" : oneLine(m[2]);
    if (code === undefined || title === "" || snapshot.has(code)) continue;
    snapshot.set(code, title);
  }
  return snapshot;
}
