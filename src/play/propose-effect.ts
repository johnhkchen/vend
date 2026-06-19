// The ProposeEpic play's EFFECT — the world-touching verb (T-009-03, story S-009-01, epic
// E-009). Split out from BOTH the pure core (propose-core.ts, T-009-02) and the BAML-loading
// shell (propose-epic.ts) for the house testability reason:
//
//  - propose-core.ts keeps a LOUD pure contract (gates + renderer + mint, no fs); adding an
//    fs verb there would re-open a reviewed, committed module. So the effect lives HERE.
//  - propose-epic.ts value-imports `b` (the BAML native addon), so no `bun test` may
//    value-import it. This module imports NO BAML — only the pure `renderCard`/`nextEpicId`
//    (propose-core), the pure `detectCollisions` (id-guard), and the addon-free `listIdsIn`
//    (project-context). So propose-effect.test.ts exercises the effect as an ordinary test
//    against a real temp-dir projectRoot — the `captureNoteEffect`/note-core.ts discipline.
//
// ADDON-FREE but IMPURE: the one verb reads the live epic dir (`listIdsIn`) and writes the
// minted card (`mkdir` + `writeFile`). The `EpicCard`/engine imports are TYPE-ONLY (erased
// under verbatimModuleSyntax), so no addon ever loads through this module.
//
// ID POLICY (T-009-03 design D2): the effect RE-MINTS the authoritative id via `nextEpicId`
// against the LIVE board and writes the card under it, rather than trusting the model's
// gate-passed `card.id`. The `ProposeEpic` BAML signature gives the model no way to learn the
// next free slot, so it guesses blind; re-minting makes a sound proposal always land and is
// TOCTOU-safe (a board change between the gate and the write — or two concurrent casts —
// cannot clobber). The structural gate's `card.id` check stays a quality pre-flight on the
// model's output; THIS is the authoritative assignment. The mirror of materialize.ts's
// final cross-board guard before any write.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { EpicCard } from "../../baml_client/index.ts";
import type { CastContext, EffectResult } from "../engine/play.ts";
import { nextEpicId, renderCard } from "./propose-core.ts";
import { detectCollisions } from "./id-guard.ts";
import { listIdsIn } from "./project-context.ts";

/** Where a minted epic card lands, relative to the cast's `projectRoot`. The real board dir
 *  (singular `epic`, matching `docs/active/epic/`), so a proposed card joins the live board. */
export const EPIC_DIR = "docs/active/epic";

/**
 * The ProposeEpic play's typed inputs — what the cast assembles and `castPlay` threads to BOTH
 * `render` and the gate/effect context. `render` consumes `signal`/`charter`/`project`; the
 * pure gate reads `charter` (greped for live `P#`/`N#` ids) + `existingEpicIds` (its
 * disjointness oracle, a snapshot taken at assemble time). The effect re-reads the LIVE board
 * rather than this snapshot (the TOCTOU layering — design D3), so the snapshot exists only for
 * the pure gate, which cannot touch fs.
 */
export interface ProposeEpicInputs {
  readonly signal: string;
  readonly charter: string;
  readonly project: string;
  readonly existingEpicIds: readonly string[];
}

/**
 * The play's EFFECT — land the cleared epic card on the board. The one async, impure member of
 * the contract. Mints the authoritative id against the LIVE board (design D2), renders the card
 * under it, and writes `docs/active/epic/<minted>.md` beneath `ctx.projectRoot`. Reports back as
 * DATA (`EffectResult`): the minted path in `artifacts`.
 *
 * The post-mint `detectCollisions` guard is empty by construction (`nextEpicId` returns max+1);
 * a non-empty result is an impossible-clash (a logic error / exotic ragged board) and is
 * RELABELLED `id-collision` rather than clobbering — the `decomposeEffect` precedent, the field
 * `EffectResult.outcome` exists for. A genuine fs failure throws (not a clean outcome), the
 * `captureNoteEffect` rule.
 */
export async function proposeEpicEffect(
  card: EpicCard,
  ctx: CastContext<ProposeEpicInputs>,
): Promise<EffectResult> {
  const dir = join(ctx.projectRoot, EPIC_DIR);
  const live = await listIdsIn(dir);

  const minted = nextEpicId(live);
  const collisions = detectCollisions([minted], live);
  if (collisions.length > 0) {
    return {
      ok: false,
      outcome: "id-collision",
      detail: `id-collision — minted ${minted} already on the board (${collisions.join(", ")})`,
    };
  }

  const body = renderCard({ ...card, id: minted });
  const path = join(dir, `${minted}.md`);
  await mkdir(dir, { recursive: true });
  await writeFile(path, body, "utf8");
  return { ok: true, detail: `minted ${minted} → ${path}`, artifacts: [path] };
}
