// Name-based play dispatch (T-007-03) — the seam that makes `vend run <play>` and the
// shelf press route by NAME through the registry + `castPlay`, with no hardcoded
// `decompose-epic` branch (AC#3).
//
// Both gestures resolve a play from the shelf-wide `registry` (populated when this module
// value-imports ./decompose-epic.ts, which self-registers `decomposeEpicPlay`), then cast
// it through the shared `assembleAndCast`. An unknown name is the registry's expected
// andon — returned as `{kind:"no-play", error}` (a typed `PlayNotFoundError`), never an
// undefined-deref — which the CLI shell maps to stderr + a non-zero exit.
//
// IMPURE: value-imports ./decompose-epic.ts (BAML addon) + spawns through `castPlay`. Only
// the impure shells import it (cli.ts lazily, press.ts), so it stays off every pure-test
// path. NOT unit-tested — its logic is the registry's pure `get` + the engine's tested core;
// proven by the T-007-03 registration smoke and T-007-04's second-play dispatch.

import { registry, type PlayNotFoundError } from "../engine/play.ts";
import type { RunSummary } from "../engine/cast.ts";
import { assembleAndCast, type RunOptions } from "./decompose-epic.ts";

/** The outcome of a by-name dispatch: a typed not-found andon, or the cast's summary. */
export type DispatchResult =
  | { readonly kind: "no-play"; readonly error: PlayNotFoundError }
  | { readonly kind: "ran"; readonly summary: RunSummary };

/**
 * Look a play up by name and cast it. The registry miss is DATA (`no-play`), not a throw —
 * a `vend run <name>` driven by user input makes "not found" an expected path. On a hit,
 * the resolved play is cast through {@link assembleAndCast} (the single play-specific input
 * assembly today). IMPURE.
 */
export async function runPlay(name: string, opts: RunOptions): Promise<DispatchResult> {
  const lookup = registry.get(name);
  if (!lookup.found) return { kind: "no-play", error: lookup.error };
  return { kind: "ran", summary: await assembleAndCast(lookup.play, opts) };
}
