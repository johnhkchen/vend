# T-016-02 — Design

Decisions, with rationale grounded in the Research map. The shape is fixed by the
propose-epic mirror; the genuine choices are **where a staged signal lands**, **how it is
named** (no id), **what the artifact contains**, and **the gesture's budget ergonomics**.

## D1 — Three files, mirroring propose-epic (not folding into the core)

**Decision.** Add `src/play/expand-effect.ts` (addon-free impure effect + `ExpandFragmentInputs`
+ the staging-dir constant) and `src/play/expand-fragment.ts` (the BAML-loading shell: parse
closure + `expandFragmentPlay` + `registry.register` + assemble + `castExpandFragment`). Leave
`expand-core.ts` **untouched**.

**Why.** The house pattern is non-negotiable for testability (Research §constraint 1): the shell
value-imports `b`, so no `bun test` may touch it; the effect must stay BAML-free so its temp-dir
test runs addon-free. propose splits exactly this way. **Rejected:** putting the effect in
`expand-core.ts` (note-core's choice) — it would re-open a reviewed, committed T-016-01 module and
add an fs verb to a file whose header advertises "NO runtime import at all — the purest kind of
core." Keeping the new fs verb in a new `expand-effect.ts` honours that and matches propose, the
nearer sibling (same pipeline, same Inputs-carries-charter shape).

## D2 — Staging target: per-file under `docs/active/pm/staged/`

**Decision.** The effect writes one markdown file per expanded signal to
`docs/active/pm/staged/<slug>.md` (a new subdir of the PM desk). `STAGING_DIR =
"docs/active/pm/staged"`.

**Why.** The AC demands the candidate land "where a human reviews + pulls it (the
`docs/active/pm/` staging contract), never appended straight onto `demand.md`." The PM README
makes `docs/active/pm/` the upstream, un-promoted desk and forbids writing to `demand.md`/board.
A dedicated `staged/` subdir is the **machine writer's inbox** the README anticipates ("a future
play could batch-read this file directly") — distinct from the PM *agent's* hand-authored
`proposed-batch.md`, so the two writers never collide. Per-file (vs. one accumulating file)
mirrors `proposeEpicEffect`/`captureNoteEffect` (every effect writes one `<name>.md`), is atomic
under Lisa's per-file lock, and is trivially testable against a temp dir.

**Rejected:**
- *Append to `proposed-batch.md`* — that is the PM agent's synthesized, ranked artifact; a play
  appending raw rows would corrupt a human-curated file and fight the discovery/processing gate.
- *Append to a single `staged-signals.md` board* — closer to "demand.md shape" but introduces a
  read-modify-write on a shared file (parse hazard, concurrency), for no gain: a human reviews
  drafts one at a time and pulls the **signal string**, which each per-file artifact carries.
- *Write to `demand.md`* — explicitly forbidden by the AC and the README (staging ≠ promotion).

## D3 — Naming: slug of `signal.what`, idempotent overwrite (no id mint)

**Decision.** Filename stem = `slugify(signal.what)` (a local pure helper in `expand-effect.ts`:
lowercase, non-alnum→`-`, trim dashes, fallback `"signal"`). Re-expanding to the same `what`
overwrites the prior draft (idempotent staging). No uniqueness suffix, no clock, no id.

**Why.** A signal is not a board artifact — `ExpandClearContext` deliberately carries no
`existingEpicIds`, so there is no id to mint (Research §constraint 2). The slug is the only
honest name. Overwrite-by-slug means re-running `vend expand` on the same rough fragment *updates*
its draft rather than littering near-duplicates — desirable for a draft you iterate on before
pulling. Keeping the effect **clock-free and deterministic** is what lets the temp-dir test assert
an exact path (injecting `Date.now()` for a unique suffix would force a clock seam for no real
benefit at the staging layer).

**Rejected:** importing `slugify` from `note-core.ts` — cross-play core coupling, which the
gates.ts house rule warns against ("no shared-util coupling"). A five-line local copy is cheaper
than the dependency edge. **Noted divergence from propose:** `proposeEpicEffect` re-mints a
unique id to avoid clobbering live board work; a staged draft has no DAG identity, so overwrite is
safe and intended. This is documented in the effect header.

## D4 — Artifact contents: the demand row + the pull-ready signal string

**Decision.** The staged `.md` carries, in order: a `# <what>` heading; the `demand.md` table
header + the single row from `renderSignalRow(signal)`; a **"Pull this"** block quoting the exact
signal string a human hands to `vend chain` (`<what> — <why>`); and an origin trailer naming the
`expand-fragment` play + "staged, not promoted — pull to clear."

**Why.** "Structured signal in the `demand.md` shape" = the table row, which `renderSignalRow`
already produces faithfully (every Signal field round-trips). The README says the **staging unit
is a signal string** that the clearing plays take verbatim — so surfacing `<what> — <why>` as a
copy-paste pull string makes the handoff to `vend chain "<signal>"` literal. The trailer keeps the
file honest about its origin and un-promoted status (the `_Captured by …_` note-file idiom).

## D5 — The gesture is its own `expand` command (PE-1), budget-optional

**Decision.** Add `vend expand "<fragment>"` as a top-level command parsed by `parseExpandArgs`
(fragment = every non-flag token `join(" ")`; `--budget` OPTIONAL). Dispatch arm lazy-imports
`castExpandFragment` + `expandFragmentPlay` and runs with `parsed.budget ?? expandFragmentPlay.budget`.

**Why.** The headline is a one-gesture transaction with no required budget — so budget must
default to the play's warranted envelope, exactly as `chain` defaults per-step. Making it its own
command (not a `select`/press shape) encodes pull-discipline: one explicitly typed fragment, never
a board drain — the same reason `chain` is its own command (PE-1). Lazy import keeps the BAML addon
off the pure-parse path (the established `chain`/`run` arm rule). The fragment-join mirrors
`parseChainArgs` so unquoted multi-word and quoted single-token fragments both round-trip.

## D6 — Parse closure → `EMPTY_SIGNAL`; honest-empty catches the coercion

**Decision.** `parseExpandFragment(text)` = `try b.parse.ExpandFragment(text) catch → EMPTY_SIGNAL`,
where `EMPTY_SIGNAL` has blank strings, `advances: []`, and `tier: "Keystone" as Signal["tier"]`
(a placeholder enum value, never rendered).

**Why.** `castPlay` calls `play.parse` with no error channel; `Signal` has required scalars so a
garbage reply makes `b.parse` THROW (Research §the pattern; `expand.test.ts` already pins this). The
shell must catch and coerce, and the **honest-empty** gate (blank `what`+`why` ⇒ STOP) then turns a
bad reply into a clean `gate-failed` andon that stages nothing — the `parseProposeEpic`/`EMPTY_CARD`
precedent. The placeholder tier satisfies the type; honest-empty fires before any tier is read.

## D7 — Play metadata: blue/green permanent, rare; inlined ~20m/12k budget

**Decision.** `card: { color: ["blue","green"], type: "permanent", rarity: "rare" }`.
`budget: { timeMs: 1_200_000, tokens: 12_000 }` (20m / 12k), inlined on the play.

**Why.** expand-fragment is a **reusable** demand-extraction primitive cast forever (permanent,
like propose) — Blue (planning/knowledge: it reads state and articulates) + Green (ramp: demand.md
calls it "the articulation lift's *foundation*," the scaffolding the lift reuses). `rare` matches
its sibling `propose-epic` (same pipeline, comparable power; `rarity` classifies the *play*, not the
demand-board tier of the *feature*). The budget sits between `note` (10m/8k, a one-shot capture) and
`propose` (30m/16k, a full epic card): articulating one signal is lighter than minting an epic but
heavier than a note. Inlined so the play never depends UP onto the shelf (that edge would cycle) —
the propose/note rule; it is a fallback the counter overrides. `maxTurns` is **omitted** (no
warranted default yet, like propose/note) — turns bound only by wall-clock + tokens until measured.

## D8 — Test strategy: offline, addon-free (no live model in CI)

**Decision.** `expand-effect.test.ts` (type-only `Signal`): (a) the effect writes the staged file
to a temp `docs/active/pm/staged/<slug>.md`, content contains the rendered row + pull string, and
**nothing** is written to `demand.md`/board; (b) a `clear → classify` wiring block — a FULL_SIGNAL
clears → `success` + materialize (three gate rows), an honest-empty signal → `gate-failed` + no
materialize, an ungrounded signal → `gate-failed`; (c) a `slugify` pin. Plus `expand` parse tests
appended to `cli.test.ts` mirroring the `chain` block.

**Why.** AC#3 ("a fixture proves fragment → staged signal end to end; the effect writes to the
staging location, not the live board") is met **offline** — the `propose-effect.test.ts` precedent
(effect temp-dir + clear→classify, no model). AC#4's live cast is the human sweep. Keeping every
BAML import type-only (and supplying enum members as string-literal casts) keeps the addon out of
the bun-test process — the standing discipline.
