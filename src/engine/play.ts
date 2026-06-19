// The Play contract + registry (T-007-01) — the shared contract every play hangs on
// (R12, shared-contract-first). This is the foundation of the casting engine (E-007):
// it extracts the six per-play variation points currently WELDED into
// `runDecomposeEpic` (src/play/decompose-epic.ts) — render, parse, gates, effect,
// default budget, name+card — into a typed `Play<I, O>` interface, plus a `name → Play`
// registry. The generic cast loop that consumes this contract is T-007-02; registering
// DecomposeEpic onto it is T-007-03.
//
// PURE (house pattern, cf. gates.ts / budget.ts / id-guard.ts): this module is types +
// a Map only — no fs, clock, network, process, or native addon. A CONCRETE play's
// `render`/`parse` do load the BAML addon (`b.request.X` / `b.parse.X`); the INTERFACE
// does not, so play.test.ts is an ordinary pure-function test that never loads the addon
// into the bun-test process (the discipline gates.test.ts / materialize.test.ts follow).
//
// Both imports are TYPE-ONLY (verbatimModuleSyntax): `Budget` (the play's default mana
// cost) and `RunOutcome` (the vocabulary an effect may relabel into). Neither pulls a
// runtime value, so the addon-free guarantee holds. `GateVerdict` is declared locally
// rather than imported from gates.ts so the contract is not bound to DecomposeEpic's four
// gate names — gates.ts's `GateResult` is structurally assignable to it (see below).

import type { Budget } from "../budget/budget.ts";
import type { RunOutcome } from "../log/run-log.ts";

// ── Card metadata (card-model.md) ───────────────────────────────────────────────────

/** The WUBRG discipline pie (card-model.md): White=order/gates, Blue=planning/knowledge,
 *  Black=power-at-a-cost, Red=speed, Green=ramp/scaffolding. Multi-color is normal. */
export const COLORS = ["white", "blue", "black", "red", "green"] as const;
export type Color = (typeof COLORS)[number];

/** The single-use/reusable axis (card-model.md): a `sorcery` is cast once for the moment;
 *  a `permanent` generalizes and is recast forever; an `instant` is a reactive one-shot. */
export const CARD_TYPES = ["sorcery", "permanent", "instant"] as const;
export type CardType = (typeof CARD_TYPES)[number];

/** Value tier in card-model.md's MTG vocabulary (common → mythic ≈ demand.md's
 *  leaf → keystone). Kept MTG-native (not shelf/menu.ts's `ValueTier`) so the engine
 *  contract does not depend upward on the shelf; the `Rarity → ValueTier` mapping is
 *  wired at the shelf boundary in T-007-03. */
export const RARITIES = ["common", "uncommon", "rare", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

/** A play's classification metadata — the three axes the shelf reads to rank and tag it.
 *  `color` is an array: multi-color is normal (DecomposeEpic = Blue planning + White
 *  gates = Azorius WU). */
export interface Card {
  readonly color: readonly Color[];
  readonly type: CardType;
  readonly rarity: Rarity;
}

// ── The clearing verdict ──────────────────────────────────────────────────────────────

/**
 * A play-generic clearing verdict: did the parsed output clear the play's gates? `stop`
 * names the gate, the offending unit, and why — the andon the cast loop surfaces and
 * refuses to materialize on.
 *
 * Deliberately uses `gate: string` (not gates.ts's DecomposeEpic-specific `GateName`) so
 * the contract is play-agnostic. gates.ts's `GateResult` (`GateClear | GateStop`) is
 * STRUCTURALLY ASSIGNABLE to this — `GateName ⊂ string`, and `GateClear`'s `cleared:
 * readonly GateName[]` satisfies the optional `cleared?: readonly string[]` below — so
 * DecomposeEpic's existing `clear()` return drops into a `Play.gates` with no adaptation
 * (wired in T-007-03).
 *
 * `cleared` is the OPTIONAL per-gate echo a play MAY supply on a pass: the names of the
 * gates it cleared, in order. A play whose gates carry that list (DecomposeEpic, via
 * gates.ts's `GateClear.cleared`) lets the cast loop log one passed row per gate — the
 * same evidence the welded runner wrote (T-007-03 D3). A play that returns a bare
 * `{status:"clear"}` supplies none, and the loop logs no per-gate rows: the contract stays
 * opaque-by-default, the field only ADDS the ability to carry names when a play has them.
 */
export type GateVerdict =
  | { readonly status: "clear"; readonly cleared?: readonly string[] }
  | { readonly status: "stop"; readonly gate: string; readonly unit: string; readonly reason: string };

// ── The cast context ────────────────────────────────────────────────────────────────

/**
 * The environment the cast loop (T-007-02) assembles once and passes to BOTH `gates` and
 * `effect`. `inputs` is the play's own typed input — the gate context is derived from it,
 * not stored separately (DecomposeEpic's gates read `inputs.epic`/`inputs.charter`).
 * `projectRoot` is the repo root the effect writes lisa files under and validates.
 */
export interface CastContext<I> {
  readonly inputs: I;
  readonly projectRoot: string;
}

// ── The effect result ───────────────────────────────────────────────────────────────

/**
 * What a play's `effect` reports back to the cast loop after touching the world. `ok` is
 * whether the effect landed; `outcome` optionally RELABELS the run outcome (e.g. an
 * id-collision refusal → `"id-collision"`) so the loop logs it without the effect having
 * to throw across the orchestration boundary (the house "returned data, not exception"
 * rule). `artifacts` are the files written (materialize's story/ticket paths).
 */
export interface EffectResult {
  readonly ok: boolean;
  readonly outcome?: RunOutcome;
  readonly detail?: string;
  readonly artifacts?: readonly string[];
}

// ── The Play contract ─────────────────────────────────────────────────────────────────

/**
 * A named, castable play — the six per-play variation points the cast loop plugs into a
 * fixed orchestration. Authored once, cast forever (P1). For DecomposeEpic the referents
 * are: `render` ≈ `b.request.DecomposeEpic(...)` → `extractPromptText`; `parse` ≈
 * `b.parse.DecomposeEpic(text)`; `gates` ≈ `clear(plan, {epic, charter})`; `effect` ≈
 * `materialize(...)` + `lisaValidate(...)`; `budget` ≈ the warranted envelope; `card` ≈
 * the Azorius (WU) permanent metadata.
 *
 * @typeParam I the play's typed inputs (assembled context)
 * @typeParam O the play's typed output (the SAP-parsed model reply)
 */
export interface Play<I, O> {
  /** Stable name — the registry key and the value stamped on every run-log record. */
  readonly name: string;
  /** Render the typed inputs into the prompt string the seam dispenses. */
  readonly render: (inputs: I) => string;
  /** SAP-parse the model's reply text into the typed output. */
  readonly parse: (text: string) => O;
  /** Clear the output against the play's gates — the contract that nothing unworthy lands. */
  readonly gates: (out: O, ctx: CastContext<I>) => GateVerdict;
  /** Land the cleared output in the world (the one async, impure member). */
  readonly effect: (out: O, ctx: CastContext<I>) => Promise<EffectResult>;
  /** The default mana cost — the warranted budget envelope (overridable at the counter). */
  readonly budget: Budget;
  /** Classification metadata (color / type / rarity). */
  readonly card: Card;
}

/**
 * The type-erased element the registry stores. `any` (not `unknown`) is deliberate and
 * required: a `name → Play` map is heterogeneous — it holds plays with different `I`/`O`,
 * so their type parameters cannot be preserved through the map. `unknown` would make
 * `play.render(inputs)` uncallable at the call site. Type safety lives at REGISTRATION
 * (each `Play<I, O>` is internally consistent) and where the cast loop re-narrows per call.
 */
// The two `any`s here are intentional and unavoidable (see the doc-comment above): a
// heterogeneous map cannot preserve each play's type parameters.
export type AnyPlay = Play<any, any>;

// ── Registry errors ───────────────────────────────────────────────────────────────────

/**
 * Returned (inside {@link PlayLookup}) when a name resolves to no registered play — the
 * registry analogue of an expected andon (AC#2: "a typed error, never undefined-deref").
 * Carries `requested` (the missing name — NOT `name`, which would clash with `Error.name`)
 * and `available` (the registered names) so a caller can throw it or surface it usefully.
 */
export class PlayNotFoundError extends Error {
  readonly requested: string;
  readonly available: readonly string[];
  constructor(requested: string, available: readonly string[]) {
    super(
      `play "${requested}" is not registered` +
        (available.length ? ` — available: ${available.join(", ")}` : " — the registry is empty"),
    );
    this.name = "PlayNotFoundError";
    this.requested = requested;
    this.available = available;
  }
}

/**
 * Thrown by {@link PlayRegistry.register} when a name is already taken. Re-registering a
 * name is a PROGRAMMER error (a wiring bug), not an expected runtime state — so it throws,
 * per the house rule (budget.ts: a malformed call throws; an expected miss is data).
 */
export class DuplicatePlayError extends Error {
  readonly playName: string;
  constructor(playName: string) {
    super(`play "${playName}" is already registered — names must be unique`);
    this.name = "DuplicatePlayError";
    this.playName = playName;
  }
}

// ── The lookup result ─────────────────────────────────────────────────────────────────

/** The result of a {@link PlayRegistry.get} — a discriminated union, never a bare
 *  `undefined`, so a caller must handle the not-found case before dereferencing. */
export type PlayLookup =
  | { readonly found: true; readonly play: AnyPlay }
  | { readonly found: false; readonly error: PlayNotFoundError };

// ── The registry ──────────────────────────────────────────────────────────────────────

/**
 * The `name → Play` map — what makes the engine play-agnostic. PURE: a Map and four
 * total methods, no fs/clock/process. `register` throws on a duplicate name (programmer
 * error); `get` returns a typed {@link PlayLookup} on a miss (expected data). Iteration
 * order is registration order (Map preserves insertion).
 */
export class PlayRegistry {
  readonly #plays = new Map<string, AnyPlay>();

  /** Register a play under its `name`. Throws {@link DuplicatePlayError} if taken. */
  register(play: AnyPlay): void {
    if (this.#plays.has(play.name)) throw new DuplicatePlayError(play.name);
    this.#plays.set(play.name, play);
  }

  /** Look up a play by name. Returns `{ found: true, play }` or `{ found: false, error }`
   *  — never a bare `undefined` (AC#2). */
  get(name: string): PlayLookup {
    const play = this.#plays.get(name);
    if (play === undefined) return { found: false, error: new PlayNotFoundError(name, this.names()) };
    return { found: true, play };
  }

  /** Whether a play is registered under `name`. */
  has(name: string): boolean {
    return this.#plays.has(name);
  }

  /** The registered names, in registration order. */
  names(): readonly string[] {
    return [...this.#plays.keys()];
  }
}

/** The default shelf-wide registry. The cast loop (T-007-02) and dispatch (T-007-03) use
 *  this singleton; tests build fresh {@link PlayRegistry} instances for isolation. */
export const registry = new PlayRegistry();
