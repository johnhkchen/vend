# T-007-01 — Design: play-registry-and-interface

Decide the shape of the `Play<I, O>` contract and the registry. The research
shows the per-play variation is exactly six points and every contract they hang
on is already a pure type. The design principle: **the interface is pure types
only; it imports no BAML and no impure verb, so its test is an ordinary
pure-function test.** Every decision below is a choice the cast loop (T-007-02)
will have to live with, so each is justified against the welded runner.

## The contract at a glance

```ts
interface Play<I, O> {
  name:   string;
  render: (inputs: I) => string;
  parse:  (text: string) => O;
  gates:  (out: O, ctx: CastContext<I>) => GateVerdict;
  effect: (out: O, ctx: CastContext<I>) => Promise<EffectResult>;
  budget: Budget;          // default mana cost (warranted envelope)
  card:   Card;            // color / type / rarity
}
```

## Decision 1 — Two type parameters `<I, O>`; context is derived, not a third param

The AC names `Play<I, O>`. `gates`/`effect` need a context (DecomposeEpic's gates
read `epic`+`charter`; its effect reads `projectRoot`). Three ways to supply it:

- **(a) third type param `Play<I, O, C>`** — maximally flexible, but diverges
  from the AC's two-param signature and pushes a `C` onto every call site for no
  proven need this slice.
- **(b) loosely typed `ctx: unknown`** — matches two params but throws away the
  type safety the house style prizes; `gates` would cast internally.
- **(c, chosen) a concrete `CastContext<I>` derived from `I`.** The gate context
  *is* the play's own inputs (research: `ClearContext` = two of DecomposeEpic's
  three inputs), plus the environment the cast loop assembles once. So:

```ts
interface CastContext<I> { readonly inputs: I; readonly projectRoot: string; }
```

`Play<I, O>` stays two-param (the AC), `CastContext<I>` is a derived alias, and
both `gates` and `effect` receive the same `ctx` — the cast loop builds it once.
DecomposeEpic's `gates` reads `ctx.inputs.epic/charter`; its `effect` reads
`ctx.projectRoot` to compose `storiesDir`/`ticketsDir` and run `lisaValidate`.

**Rejected (a):** no second axis of variation yet justifies a third param —
adding it now is speculative generality (the value gate's own lesson). It can be
introduced later without breaking `Play<I, O>` if a play needs a context not
derivable from its inputs.

## Decision 2 — A play-generic `GateVerdict`, not gates.ts's `GateResult` verbatim

`gates.ts` already exports `GateResult = GateClear | GateStop`. Reusing it
verbatim is tempting (AC#1 literally says `-> GateResult`) but **`GateStop.gate`
is typed `GateName`** — the four DecomposeEpic gate names. A play-agnostic
contract (the whole point of S-007-01, proven by T-007-04's second play) cannot
hard-bind every play's gate vocabulary to DecomposeEpic's four names.

**Chosen:** define a generic verdict in `engine/play.ts` with `gate: string`:

```ts
type GateVerdict =
  | { readonly status: "clear" }
  | { readonly status: "stop"; readonly gate: string; readonly unit: string; readonly reason: string };
```

Because `GateName ⊂ string` and a value with extra properties is assignable to a
narrower shape, **gates.ts's `GateResult` is structurally assignable to
`GateVerdict`** — DecomposeEpic's existing `clear()` return drops straight into a
`Play.gates` with zero adaptation. The AC's intent ("a clearing verdict") is met;
the name `GateVerdict` avoids a *third* `GateResult` in the tree (gates.ts has
the whole-plan one, run-log the per-gate one — adding a third symbol named
`GateResult` would be a readability trap).

**Rejected — reuse gates.ts `GateResult`:** binds the contract to four
decompose-specific names. **Rejected — generalize `GateName` to `string` in
gates.ts itself:** edits a file outside this ticket's ownership (R4) and weakens
DecomposeEpic's own exhaustiveness for no benefit here.

## Decision 3 — `EffectResult` carries `ok` + an optional outcome relabel

The effect is the one async, world-touching member (`materialize` + `lisaValidate`
for DecomposeEpic). The welded runner shows the effect must be able to (a) report
success/failure, (b) **relabel** the outcome (an `IdCollisionError` becomes
`id-collision`, L178–181), and (c) name the artifacts it wrote.

```ts
interface EffectResult {
  readonly ok: boolean;                  // did the effect land
  readonly outcome?: RunOutcome;         // optional relabel (e.g. "id-collision")
  readonly detail?: string;              // human note for stdout / the andon
  readonly artifacts?: readonly string[]; // files written (materialize result)
}
```

`RunOutcome` is imported **type-only** from `run-log.ts` (a pure leaf, no addon).
This lets the cast loop log the relabeled outcome without the effect throwing
across the orchestration boundary — the house "returned data, not exception" rule
applied to the effect seam.

**Rejected — `effect` returns `void` and throws to signal failure:** loses the
id-collision relabel as data and forces the loop into try/catch control flow.
**Rejected — a bare `code: string` instead of `RunOutcome`:** unties the effect
from the log's vocabulary, costing the cast loop a type-checked switch.

## Decision 4 — `card` carries MTG-native `color`/`type`/`rarity`; engine stays shelf-free

The AC asks for `color / type / rarity`. The card-model.md vocabulary:

```ts
type Color  = "white" | "blue" | "black" | "red" | "green";    // WUBRG pie
type CardType = "sorcery" | "permanent" | "instant";           // single-use axis
type Rarity = "common" | "uncommon" | "rare" | "mythic";       // ≈ value tier
interface Card { readonly color: readonly Color[]; readonly type: CardType; readonly rarity: Rarity; }
```

`color` is an array — multi-color is normal (DecomposeEpic = WU). `rarity` uses
the **MTG-native** four, not menu.ts's `ValueTier`, deliberately: importing
`ValueTier` from `src/shelf/menu.ts` would point the engine's contract at the
*shelf*, an upward dependency that muddies the layering. card-model.md states
rarity↔tier are the same axis in two vocabularies; the `Rarity → ValueTier`
mapping is a one-liner the **shelf-integration ticket (T-007-03)** owns when it
feeds `Action.tier`. Keeping it out of T-007-01 honors "types + the map only."

**Rejected — `rarity: ValueTier` (reuse menu.ts):** creates an engine→shelf
dependency for a mapping that belongs at the shelf boundary. **Rejected — model
the full `card = {name, manaCost, text, …}`:** `name` and `budget` already live
on `Play`; `text` is the effect+gates (the play itself). The card metadata is
*only* the three classification axes the AC names.

## Decision 5 — Registry: `get` returns a discriminated lookup; duplicate-register throws

AC#2: "register/get; an unknown name returns a typed error, never
undefined-deref." Two regimes per the house rule:

- **Lookup miss is expected → returned data.** `get(name)` returns a
  discriminated union, never a bare `undefined`:

```ts
type PlayLookup =
  | { readonly found: true;  readonly play: AnyPlay }
  | { readonly found: false; readonly error: PlayNotFoundError };
```

  `PlayNotFoundError extends Error` carries `requested: string` (field named
  `requested`, not `name`, to avoid clashing with `Error.name`) and
  `available: readonly string[]` — the caller can throw it or surface it. Mirrors
  `IdCollisionError`'s evidence-carrying shape.

- **Duplicate registration is a programmer error → throw.** `register(play)`
  throws `DuplicatePlayError` if the name is already taken. Re-registering a name
  is a wiring bug, not an expected runtime state (cf. budget.ts: a malformed call
  throws).

`AnyPlay = Play<any, any>` is the stored element type. `any` (not `unknown`) is
deliberate and documented: the registry is **type-erased** — a heterogeneous map
cannot preserve each play's `I`/`O`; `unknown` would make `play.render(inputs)`
uncallable at the call site. Safety lives at registration (each `Play<I,O>` is
internally consistent) and where the cast loop re-narrows.

`PlayRegistry` is a class wrapping a private `Map`; the module also exports a
default singleton `registry` (the AC's "a registry"). Tests build fresh
instances for isolation; the cast loop + dispatch (T-007-02/03) use the singleton.
Convenience reads: `has(name): boolean`, `names(): readonly string[]`.

**Rejected — `get` returns `Play | undefined`:** the exact undefined-deref AC#2
forbids. **Rejected — `get` throws on miss:** a lookup driven by user input
(`vend <name>`) makes "not found" an *expected* path, so it is returned data, not
an exception.

## What stays out (honest scope)

- No `dispense`, `classify`, stream sink, `check`, or fs — all T-007-02.
- No `Rarity → ValueTier` mapping, no `Action` construction — T-007-03.
- No registration of DecomposeEpic — T-007-03 (it owns the `decompose-epic.ts`
  edit, R4).
- No BAML import in `engine/play.ts` — a concrete play's `render`/`parse` load
  the addon; the *interface* must not, so its test stays addon-free.
