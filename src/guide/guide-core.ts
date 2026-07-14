// `vend user-guide` — the PURE guide text (T-066, the fresh-repo orientation gesture).
//
// WHY: a fresh-repo agent runs `vend --help`, sees a list of verbs, and gets no orientation on how
// vend and lisa work TOGETHER — the exact friction the field reported (lisa has `lisa setup-guide`;
// vend had nothing). This module renders the LLM-friendly guide the `user-guide` command prints.
//
// DRY: the body IS `VEND_WORKFLOW` — the same "Driving with vend (and lisa)" doc `vend init` lays
// into `docs/knowledge/vend-workflow.md` — so the in-repo file and the printed command never drift.
// This module only appends a short terminal footer (where to go next). PURE: plain string in, plain
// string out, no fs/clock/addon — init-core is addon-free (its own pure test proves the import graph),
// so this stays a plain `bun test` unit.

import { VEND_WORKFLOW } from "../init/init-core.ts";

/** A short "where to go next" footer appended under the workflow body — the command-context the
 *  in-repo file doesn't need (run `--help`, read the deeper docs, set up if you haven't). */
const FOOTER = `## Next
- \`vend --help\` — every gesture (steer · chain · settle · sweep · doctor · svg · shelf · init · envelope · audit).
- \`docs/knowledge/vend-workflow.md\` — this guide, saved in the repo (laid by \`vend init\`).
- \`docs/knowledge/rdspi-workflow.md\` — lisa's per-ticket build loop (what lisa runs each ticket through).
- Not set up yet? Run \`lisa init\`, then \`vend init\`, then \`vend doctor\` (green = ready to drive).
`;

/** The full `vend user-guide` output: the canonical workflow doc + the terminal footer. PURE and
 *  deterministic (a stable string), so a unit test can pin its load-bearing anchors. */
export const USER_GUIDE = `${VEND_WORKFLOW}\n${FOOTER}`;

/** Render the guide (a function for parity with the other `-core` render seams; today a passthrough
 *  of the composed constant, so a caller never reaches into the module internals). PURE. */
export function renderUserGuide(): string {
  return USER_GUIDE;
}
