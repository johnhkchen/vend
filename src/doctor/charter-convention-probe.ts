// The `vend doctor` CHARTER-CONVENTION probe (T-078-02-02, story S-078-02) — a
// non-blocking diagnostic that introduces the P-label convention at the health surface. It stays
// separate from doctor-probe.ts because that dependency probe also guards every cast: an organic
// charter with no labels needs an amber how-to, never a gate that prevents work.
//
// PURE CORE / IMPURE SHELL: gates.ts owns the shared P/N label detector; doctor-core.ts owns report
// rendering and exit codes. This module maps charter bytes to one passing Check and supplies a thin,
// injectable cwd-relative reader. Both green and amber are `ok: true` by design, so the convention
// signal cannot flip doctor's exit code or become a babysitting gate (N2).

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { matchIds } from "../gate/gates.ts";
import { CHARTER_PATH } from "../play/project-context.ts";
import { passed, type Check } from "./doctor-core.ts";

/** Stable prefix for every charter-convention doctor line. */
export const CHARTER_CONVENTION_CHECK = "charter convention";

/** The labeling how-to shown when no convention can be observed. */
export const CHARTER_CONVENTION_HOW_TO =
  "label charter invariants like `P1 — Author once, run forever` so casts can cite them in `advances`";

/** Injectable charter backend. The default reads the canonical charter beneath `process.cwd()`. */
export interface CharterConventionProbeDeps {
  readonly readCharter: () => Promise<string>;
}

const DEFAULT_CHARTER_CONVENTION_DEPS: CharterConventionProbeDeps = {
  readCharter: () => readFile(join(process.cwd(), CHARTER_PATH), "utf8"),
};

/**
 * Turn charter bytes into the non-blocking convention check. The count comes from the same
 * exported detector the clearing gates use, so doctor cannot drift into a parallel definition of
 * a P label. PURE given `charter`.
 */
export function charterConventionCheck(charter: string): Check {
  const count = matchIds(charter, "P").size;
  if (count > 0) {
    const subject = count === 1 ? "labeled invariant" : "labeled invariants";
    return passed(`${CHARTER_CONVENTION_CHECK}: green — ${count} ${subject} found`);
  }

  return passed(
    `${CHARTER_CONVENTION_CHECK}: amber — no labeled invariants found; ${CHARTER_CONVENTION_HOW_TO}`,
  );
}

/** Total conversion of any thrown value to a human-readable message. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read and diagnose the canonical charter. Returns exactly one passing Check. A missing or
 * unreadable charter is still diagnostic-only: amber names the read problem and teaches the same
 * how-to, without turning doctor red or rejecting with a stack trace.
 */
export async function probeCharterConvention(
  deps: Partial<CharterConventionProbeDeps> = {},
): Promise<Check[]> {
  const d: CharterConventionProbeDeps = { ...DEFAULT_CHARTER_CONVENTION_DEPS, ...deps };
  try {
    return [charterConventionCheck(await d.readCharter())];
  } catch (error) {
    return [
      passed(
        `${CHARTER_CONVENTION_CHECK}: amber — could not read ${CHARTER_PATH}: ${messageOf(error)}; ${CHARTER_CONVENTION_HOW_TO}`,
      ),
    ];
  }
}
