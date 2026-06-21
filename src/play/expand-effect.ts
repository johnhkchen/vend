// The ExpandFragment play's EFFECT — the world-touching verb (T-016-02, story S-016-01, epic
// E-016). Split out from BOTH the pure core (expand-core.ts, T-016-01) and the BAML-loading shell
// (expand-fragment.ts) for the house testability reason, exactly as propose-effect.ts is:
//
//  - expand-core.ts keeps a LOUD pure contract (gates + renderer, NO runtime import at all); adding
//    an fs verb there would re-open a reviewed, committed module. So the effect lives HERE.
//  - expand-fragment.ts value-imports `b` (the BAML native addon), so no `bun test` may value-import
//    it. This module imports NO BAML — only the pure `renderSignalRow` (expand-core). So
//    expand-effect.test.ts exercises the effect as an ordinary test against a real temp-dir
//    projectRoot — the `proposeEpicEffect`/`captureNoteEffect` discipline.
//
// ADDON-FREE but IMPURE: the one verb writes the staged signal (`mkdir` + `writeFile`). The
// `Signal`/engine imports are TYPE-ONLY (erased under verbatimModuleSyntax), so no addon ever loads
// through this module.
//
// STAGING, NOT PROMOTION (the headline — AC#2): a cleared signal is STAGED under the PM desk
// (`docs/active/pm/staged/`, the upstream un-promoted space — docs/active/pm/README.md), where a
// human reviews + pulls it. It is NEVER appended to `demand.md` or the board (`epic/`,`stories/`,
// `tickets/`). Promotion is the separate human gesture `vend chain "<signal>"`.
//
// NAMING (T-016-02 design D3): a Signal has NO id — `ExpandClearContext` carries no `existingEpicIds`,
// so the effect mints none. The artifact name is a `slugify(signal.what)` stem; re-expanding to the
// same `what` OVERWRITES the prior draft (idempotent staging — a draft you iterate on, not a board
// artifact with a DAG identity). This is the DELIBERATE divergence from `proposeEpicEffect`, which
// re-mints a unique id to avoid clobbering live board work; a staged draft has no such identity.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Signal } from "../../baml_client/index.ts";
import type { CastContext, EffectResult } from "../engine/play.ts";
import { renderSignalRow } from "./expand-core.ts";

/** Where a staged signal lands, relative to the cast's `projectRoot`. The PM desk's machine-written
 *  inbox (`docs/active/pm/README.md`: the upstream, un-promoted space) — distinct from the PM
 *  agent's hand-authored `proposed-batch.md`, so the two writers never collide. NEVER the board. */
export const STAGING_DIR = "docs/active/pm/staged";

/**
 * The ExpandFragment play's typed inputs — what the cast assembles and `castPlay` threads to BOTH
 * `render` and the gate/effect context. `render` consumes `fragment`/`charter`/`project`; the pure
 * value-link gate reads `charter` (greped for live `P#`/`N#` ids). No `existingEpicIds`: a signal
 * mints no id (it is not an epic), so this is the slimmed sibling of `ProposeEpicInputs`.
 */
export interface ExpandFragmentInputs {
  readonly fragment: string;
  readonly charter: string;
  readonly project: string;
  /** OPTIONAL provenance for the E-057 round-trip: when this cast originated as a non-dev's
   *  annotation on a rendered work-graph node, the effect renders its provenance trailer +
   *  back-link into the staged signal. Absent for a plain `vend expand` fragment — the staged
   *  file is then byte-identical to before. `render` (BAML) ignores it; this is staging-time
   *  provenance, never prompt input (the annotation reaches the effect via `ctx.inputs`, the
   *  engine's established side-channel — the `Play.effect` signature stays `(signal, ctx)`). */
  readonly annotation?: Annotation;
}

/** Cap the filename stem: a Signal's `what` can be a full sentence (a live cast slugged a ~250-char
 *  `what` → ENAMETOOLONG). 60 chars is a readable, well-under-`PATH_MAX` stem. */
const MAX_SLUG_LEN = 60;

/**
 * Slugify a signal's `what` line into a filename stem. PURE. Lowercase, runs of non-alphanumerics →
 * a single `-`, leading/trailing dashes trimmed, then **capped at {@link MAX_SLUG_LEN}** (a `what`
 * is a full sentence, not a title — uncapped it overflows the filesystem's name limit). A `what`
 * that slugs to empty (all punctuation) falls back to `"signal"` so the effect always has a writable
 * `{stem}.md` — the artifact name is never empty (the note-core `slugify` idiom, copied not imported:
 * a cross-play core edge is worse than five lines, per the gates.ts no-shared-util rule).
 */
export function slugify(what: string): string {
  const slug = what
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN)
    .replace(/-+$/g, ""); // re-trim a dash the slice may have left dangling
  return slug.length > 0 ? slug : "signal";
}

/**
 * Render a cleared Signal → the staged markdown artifact. PURE (the `renderNoteFile`/`renderCard`
 * pattern): deterministic, no clock. Carries, in order:
 *  - a `# <what>` heading,
 *  - the `demand.md` table header + the single `renderSignalRow(signal)` row (the "structured signal
 *    in the demand.md shape" — every Signal field round-trips through expand-core's renderer),
 *  - a `## Pull this` block quoting the exact signal string a human hands to `vend chain` (`<what> —
 *    <why>`, the staging unit the clearing plays already take — docs/active/pm/README.md),
 *  - an origin trailer naming the play + its un-promoted status,
 *  - and, WHEN an {@link Annotation} is supplied (the E-057 round-trip), the provenance trailer +
 *    back-link from {@link renderAnnotationProvenance} appended after the origin trailer — the
 *    machine origin (the play) then the human origin (seat X on node Y). Still PURE: the
 *    annotation is an argument, not an fs read, so determinism holds. With no annotation the
 *    returned string is byte-identical to before (the plain `vend expand` path).
 */
export function renderStagedSignal(signal: Signal, annotation?: Annotation): string {
  const pull = `${signal.what} — ${signal.why}`;
  const lines = [
    `# ${signal.what}`,
    "",
    "| Signal | Value | Budget (envelope) | Status |",
    "|---|---|---|---|",
    renderSignalRow(signal),
    "",
    "## Pull this",
    "",
    "A human pulls this staged signal onto the board with one gesture:",
    "",
    "```",
    `vend chain "${pull}"`,
    "```",
    "",
    "_Staged by Vend's `expand-fragment` play — not promoted; pull to clear._",
  ];
  if (annotation) {
    lines.push("", renderAnnotationProvenance(signal, annotation));
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * A non-dev's feedback on a rendered work-graph node — the inbound half of E-057's round-trip.
 * Captured ONCE, at annotation, as data (P1): the feedback `text` (the fragment the expand clearing
 * prices into a Signal), the `nodeId` it was left on (a board work-item id from the rendered view —
 * `E-…`/`S-…`/`T-…`), and the `seat` that left it. An Annotation mints no id and carries no Signal
 * fields (tier/budget/advances are DERIVED by the clearing, not stated here) — it is the raw
 * fragment + provenance, exactly the E-016 "annotation = fragment plus provenance" reuse contract.
 */
export interface Annotation {
  readonly text: string;
  readonly nodeId: string;
  readonly seat: string;
}

/** Map a work-item node id to a board-relative back-link href, as seen from a staged file under
 *  {@link STAGING_DIR} (`docs/active/pm/staged/`). PURE: id-prefix → board dir (`E-`→epic,
 *  `S-`→stories, `T-`→tickets); an unknown prefix → an in-doc anchor `#<id>` so the link is never
 *  broken and the helper never throws on odd input. Local to this module (the {@link slugify}
 *  copied-not-imported idiom — no shared util, the gates.ts no-shared-util rule). */
function workItemHref(nodeId: string): string {
  const dir = nodeId.startsWith("E-")
    ? "epic"
    : nodeId.startsWith("S-")
      ? "stories"
      : nodeId.startsWith("T-")
        ? "tickets"
        : null;
  return dir ? `../../${dir}/${nodeId}.md` : `#${nodeId}`;
}

/**
 * Render an Annotation's PROVENANCE TRAILER + BACK-LINK for a staged signal — the sibling of
 * {@link renderStagedSignal}'s origin trailer, naming the HUMAN source (seat X on node Y) rather
 * than the play source. PURE (the `renderStagedSignal`/`slugify` pattern): deterministic, no clock,
 * no fs, no BAML — `Signal` is a type-only import. Two italic-underscore lines:
 *  - a provenance line quoting the priced `signal.what`, naming the `seat` and the `nodeId`,
 *  - a back-link referencing the annotated work item ({@link workItemHref} gives the board-relative
 *    path).
 * T-057-02 threads this into `renderStagedSignal`; here it is the standalone pure building block.
 */
export function renderAnnotationProvenance(signal: Signal, annotation: Annotation): string {
  const { nodeId, seat } = annotation;
  return [
    `_Provenance: “${signal.what}” — raised by **${seat}** annotating node \`${nodeId}\` on the rendered work-graph._`,
    `_↩ Back to the annotated work item: [\`${nodeId}\`](${workItemHref(nodeId)})._`,
  ].join("\n");
}

/**
 * The play's EFFECT — STAGE the cleared signal under the PM desk. The one async, impure member of
 * the contract: it `mkdir -p`s `docs/active/pm/staged/` under `ctx.projectRoot` and writes the
 * rendered markdown to `<slug>.md`. NO BAML, NO spawn — so it is testable against a real temp-dir
 * fixture (the `captureNoteEffect`/`proposeEpicEffect` precedent). Reports back as DATA
 * (`EffectResult`): the staged path in `artifacts` and as `produced` (the explicit downstream
 * handle, parity with the other effects, though no chain consumes a staged draft today).
 *
 * No `outcome` relabel: a Signal has no board id, so the id-collision branch `proposeEpicEffect`
 * carries does not apply — overwrite-by-slug is intended (design D3). A genuine fs failure THROWS
 * (not a clean outcome), the `captureNoteEffect` rule.
 */
export async function expandFragmentEffect(
  signal: Signal,
  ctx: CastContext<ExpandFragmentInputs>,
): Promise<EffectResult> {
  const dir = join(ctx.projectRoot, STAGING_DIR);
  const path = join(dir, `${slugify(signal.what)}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, renderStagedSignal(signal, ctx.inputs.annotation), "utf8");
  return { ok: true, detail: `staged ${path}`, artifacts: [path], produced: path };
}
