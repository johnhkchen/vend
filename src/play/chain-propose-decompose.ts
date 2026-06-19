// The propose→decompose chain (T-011-02, story S-011-01, epic E-011) — the CAPSTONE of the
// clearing pipeline and the convergence node of E-011: a pulled demand SIGNAL → ProposeEpic → a
// gated EpicCard on the board → DecomposeEpic → gated stories/tickets, in ONE gesture. The first
// CONCRETE chain assembled over the `castChain` primitive (T-011-01): two `PlayStep`s wired so
// ProposeEpic's `produced` (the minted epic path) threads into DecomposeEpic's `epicPath` input.
//
// DEPENDENCY DIRECTION (E-007 keystone): this is the one site where the two concrete plays depend
// UP onto the chain primitive. A `src/play/` citizen, it imports the engine (`castChain`) and the
// two plays (`proposeEpicPlay` + `assembleProposeEpicInputs`, `decomposeEpicPlay` +
// `assembleInputs`). The engine never imports this; the primitive never depends down on the plays.
// Acyclic, exactly as the single-play `castProposeEpic` / `runDecomposeEpic` verbs.
//
// PULL-DISCIPLINE (PE-1): casts ONE explicitly pulled `signal`. It does NOT read or iterate
// `demand.md` / the board — the single-signal gesture IS the pull-discipline, by construction.
//
// GATING (the headline): `castChain` halts on ProposeEpic's gate STOP (value/bounds/structural)
// BEFORE DecomposeEpic runs — the pure `decideThread`/`runChain` halt, proven in chain-core.test.ts.
// On success BOTH plays cast, each appending exactly one run-log record (two records), each gated.
//
// PURITY (house pattern): the impure shell over the tested pure `runChain`. It value-imports both
// plays (the BAML native addon), so NO `bun test` value-imports this module — its logic is the
// tested `runChain` + the offline thread proof (chain-propose-decompose.test.ts, addon-free) + the
// live sweep (AC#4). `castProposeDecomposeChain` is the IMPURE verb (assembles inputs, spawns);
// `epicSubjectFromPath` is its one pure helper.

import type { Budget } from "../budget/budget.ts";
import { castChain, type ChainResult, type PlayStep } from "../engine/chain.ts";
import { proposeEpicPlay, assembleProposeEpicInputs } from "./propose-epic.ts";
import { decomposeEpicPlay } from "./decompose-epic.ts";
import { assembleInputs } from "./project-context.ts";

/** Options for {@link castProposeDecomposeChain} — the per-cast values the chain does not carry. */
export interface ChainProposeDecomposeOptions {
  /** The ONE pulled demand signal to propose an epic from, then decompose (PE-1). */
  readonly signal: string;
  /** Optional budget override applied to BOTH steps; omitted ⇒ each play's warranted default. */
  readonly budget?: Budget;
  /** Repo root the snapshot/board are gathered from and artifacts are written under. */
  readonly projectRoot?: string;
  /** Pinned model id; omitted ⇒ CLI default (and the engine's `DEFAULT_MODEL` logged). */
  readonly model?: string;
  /** Override the transcript dir (default `<root>/.vend/transcripts`). */
  readonly transcriptDir?: string;
}

/**
 * Derive the epic id (the decompose step's run-log `subject`) from a minted epic path. PURE.
 * `proposeEpicEffect` writes `<minted-id>.md`, so the basename without `.md` IS the epic id
 * (e.g. `…/docs/active/epic/E-012.md` → `E-012`). Falls back to the whole path if it has no
 * basename — a defensive non-empty subject (`appendRunLog` asserts non-empty).
 */
export function epicSubjectFromPath(epicPath: string): string {
  const base = epicPath.split("/").pop() ?? epicPath;
  return base.replace(/\.md$/, "") || epicPath;
}

/**
 * Cast the propose→decompose chain end to end — the capstone gesture. Threads ProposeEpic's minted
 * epic path into DecomposeEpic's `epicPath`; on a ProposeEpic gate STOP the chain HALTS before
 * DecomposeEpic (the `castChain` halt). On success it produces BOTH the epic card AND its
 * stories/tickets, each gated and logged (two run-log records). IMPURE (assembles inputs, spawns);
 * NOT unit-tested — its logic is the pure `runChain`, proven by the offline thread test + sweep.
 *
 * The `PlayStep<any, any>[]` element type is the same documented type-erasure as `AnyPlay`: the
 * chain is heterogeneous (ProposeEpic's `EpicCard` vs DecomposeEpic's `WorkPlan`); type safety
 * lives at each step's internally-consistent construction below and at the `adapt`/`opts` seams.
 */
export async function castProposeDecomposeChain(
  opts: ChainProposeDecomposeOptions,
): Promise<ChainResult> {
  const root = opts.projectRoot ?? process.cwd();
  const proposeBudget = opts.budget ?? proposeEpicPlay.budget;
  const decomposeBudget = opts.budget ?? decomposeEpicPlay.budget;

  const steps: PlayStep<any, any>[] = [
    {
      // Step 1 — ProposeEpic: turn the pulled signal into a gated, minted EpicCard. No upstream.
      play: proposeEpicPlay,
      budget: proposeBudget,
      opts: { subject: opts.signal, projectRoot: root, model: opts.model, transcriptDir: opts.transcriptDir },
      adapt: () =>
        assembleProposeEpicInputs({
          signal: opts.signal,
          budget: proposeBudget,
          projectRoot: root,
          model: opts.model,
          transcriptDir: opts.transcriptDir,
        }),
    },
    {
      // Step 2 — DecomposeEpic: decompose the epic ProposeEpic just minted. `upstream` is that
      // epic's path — present + non-empty here, since `runChain` only casts this step when
      // `decideThread` proved step 1 surfaced a non-empty `produced`. The run-log subject is the
      // minted epic id (derived from the path), so the two records read propose/<signal> +
      // decompose/<minted id>.
      play: decomposeEpicPlay,
      budget: decomposeBudget,
      opts: (upstream) => ({
        subject: epicSubjectFromPath(upstream ?? ""),
        projectRoot: root,
        model: opts.model,
        transcriptDir: opts.transcriptDir,
      }),
      adapt: async (upstream) => assembleInputs({ epicPath: upstream as string, projectRoot: root }),
    },
  ];

  return castChain(steps);
}
