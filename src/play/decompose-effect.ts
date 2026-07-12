// DecomposeEpic's impure effect, separated from the BAML-bearing play definition so the real
// materialize/relabel path can be driven in addon-free unit tests. The generic cast engine stays
// below this concrete play boundary; this module owns only board writes and Lisa validation.

import { join } from "node:path";
import type { WorkPlan } from "../../baml_client/index.ts";
import type { CastContext, EffectResult } from "../engine/play.ts";
import { DEFAULT_RUN_LOG_PATH, loadRunLog } from "../log/run-log.ts";
import {
  blockEntryTicketsAfter,
  epicIdFromDoc,
  graphIntegrityViolations,
  renumberPlanToEpic,
} from "./decompose-epic-core.ts";
import { listIdsIn, type DecomposeInputs } from "./project-context.ts";
import { inferDefaultSeat } from "./lane-heat.ts";
import {
  materialize,
  BareCodeError,
  IdCollisionError,
} from "./materialize.ts";

/** The result of spawning `lisa validate` (the final structural poka-yoke). */
export interface ValidateResult {
  readonly ok: boolean;
  readonly output: string;
}

/** Injectable validation boundary: production spawns Lisa; tests supply a deterministic stub. */
export type LisaValidator = (projectRoot: string) => Promise<ValidateResult>;

/**
 * Spawn `lisa validate --path <root>` — the final structural poka-yoke run after the files
 * are written. IMPURE verb. Tolerates `lisa` being absent (returns `ok: false` with the
 * reason rather than crashing the run record), so a missing binary degrades to a logged
 * validate-failure, not an unhandled throw.
 */
export async function lisaValidate(projectRoot: string): Promise<ValidateResult> {
  try {
    const proc = Bun.spawn(["lisa", "validate", "--path", projectRoot], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { ok: code === 0, output: `${out}${err}`.trim() };
  } catch (e) {
    return { ok: false, output: `lisa validate could not run: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Land a cleared plan in the world. Expected pre-write materializer refusals are returned as
 * named effect outcomes so the cast loop can log them without exceptions crossing the
 * orchestration boundary. Any other throw remains an honest unexpected failure.
 */
export async function decomposeEffect(
  plan: WorkPlan,
  ctx: CastContext<DecomposeInputs>,
  validate: LisaValidator = lisaValidate,
): Promise<EffectResult> {
  const root = ctx.projectRoot;

  // Canonicalize ids, then PROVE the board before writing (E-061 retro #8). The model emits ids
  // (its prompt shows the old flat `T-002-01` form), but vend OWNS the board's identifiers: derive
  // the epic from the epic doc and renumber every story/ticket onto the nested `S-<epic>-<NN>` /
  // `T-<epic>-<NN>-<MM>` convention the graph model requires, remapping all cross-refs. Then run
  // vend's OWN `buildGraph` over the would-be board fragment; on any violation, refuse with a
  // relabeled `graph-invalid` andon BEFORE the first write (no partial materialization), so the play
  // can never land a board `bun run check` would reject. A doc with no parseable `id:` skips both
  // (degrade, not regress); gates already cleared the plan's value/allocation/bounds/structural.
  const epicId = epicIdFromDoc(ctx.inputs.epic);
  let finalPlan = epicId ? renumberPlanToEpic(plan, epicId) : plan;
  if (epicId) {
    const violations = graphIntegrityViolations(finalPlan, epicId);
    if (violations.length > 0) {
      return {
        ok: false,
        outcome: "graph-invalid",
        detail: `graph-invalid — the plan would not materialize to a valid board:\n- ${violations.join("\n- ")}`,
      };
    }
  }

  // Born-blocked mint (`--after`, field fix #3): once the INTERNAL net has proven the plan's own
  // graph, block the epic's ENTRY tickets on the requested existing board ticket(s) so queuing
  // behind a live loop is race-free. The targets live OUTSIDE the plan fragment (other epics'
  // tickets), so validate them against the LIVE board before adding the external edge.
  const after = ctx.inputs.after ?? [];
  if (after.length > 0) {
    const boardTickets = new Set(await listIdsIn(join(root, "docs", "active", "tickets")));
    const missing = [...new Set(after)].filter((id) => !boardTickets.has(id));
    if (missing.length > 0) {
      return {
        ok: false,
        outcome: "graph-invalid",
        detail: `--after names ticket(s) not on the board: ${missing.join(", ")} — nothing materialized`,
      };
    }
    finalPlan = blockEntryTicketsAfter(finalPlan, after);
  }

  try {
    // An explicit counter choice is authoritative. Only an omitted `--agent` consults the
    // project ledger; ambiguous/both-cool evidence returns null and preserves today's unrouted
    // materialization bytes. Both direct decompose and chain converge on this one effect.
    const seatInferred = ctx.inputs.agent === undefined
      ? inferDefaultSeat((await loadRunLog({ path: join(root, DEFAULT_RUN_LOG_PATH) })).records)
      : null;
    const effectiveAgent = ctx.inputs.agent ?? seatInferred?.seat;

    // The charter is the same string `gates` fed ClearContext — materialize snapshots it once
    // per cut so every written body carries its codes' cut-time text. The optional routing seat
    // is resolved by materialize: known seats stamp; unknown seats omit the key and report the
    // safe default disposition rather than discarding the cleared board.
    const { storyFiles, ticketFiles, seatDefaulted } = await materialize(
      finalPlan,
      {
        storiesDir: join(root, "docs", "active", "stories"),
        ticketsDir: join(root, "docs", "active", "tickets"),
      },
      ctx.inputs.charter,
      effectiveAgent,
    );
    const validated = await validate(root);
    return {
      ok: validated.ok,
      detail: validated.ok ? "lisa validate ✓" : `lisa validate ✗\n${validated.output}`,
      artifacts: [...storyFiles, ...ticketFiles],
      ...(seatDefaulted !== undefined ? { seatDefaulted } : {}),
      ...(seatInferred !== null ? { seatInferred } : {}),
    };
  } catch (e) {
    if (e instanceof IdCollisionError) {
      return { ok: false, outcome: "id-collision", detail: `id-collision — reused board id(s): ${e.collisions.join(", ")}` };
    }
    if (e instanceof BareCodeError) {
      const where = e.hits.map((h) => `${h.file}: ${h.codes.join(", ")}`).join("; ");
      return { ok: false, outcome: "bare-code", detail: `bare-code — charter cannot resolve cited code(s): ${where}` };
    }
    throw e;
  }
}
