# T-016-01 — Design

Decisions, with rationale, grounded in Research. One choice per question; rejected options named.

## D1 — `Signal` lives in BAML (the parse output type), not a hand TS interface

**Decision:** declare `class Signal` in `baml_src/expand.baml`; `b.parse.ExpandFragment(text)`
yields it; `expand-core.ts` imports the generated `Signal` **type-only**.

**Why:** this is the propose/note precedent exactly — `EpicCard`/`Note` are BAML classes; the pure
core operates on the parsed type. BAML owns **shape** (the poka-yoke: a shapeless signal is
unrepresentable; `tier` is a closed enum), the gates own **meaning**. A hand TS interface would
duplicate the field list and lose the SAP parser + `@description` prompt scaffolding.

**Rejected:** a TS-only `Signal` interface with manual JSON parsing — re-implements what BAML's SAP
parser gives free, and breaks symmetry with the three existing plays.

## D2 — `Signal` field set

```baml
enum SignalTier { Keystone @alias("keystone")  High @alias("high")
                  Standard @alias("standard")  Leaf @alias("leaf") }

class Signal {
  what       string          // ONE line: the move. BLANK only for honest-empty abstention.
  why        string          // why it might matter (leverage), one line. Blank w/ `what` ⇒ empty.
  tier       SignalTier      // leverage tier (demand.md value ranking == ValueTier)
  budget     string          // pre-filled envelope in demand.md notation ("~1 block (≈2h)")
  advances   string[]        // charter invariant id(s)/core-feature advance it serves — value-link
  grounding  string          // WHAT real state this was READ from (PE-2 cite) — read-never-invent
  readiness  string          // "ready" | "blocked: <what it waits on>" (demand.md Status)
}
```

**Why these seven:** `what · why · tier · budget` are job-story Story-1 AC#2 verbatim; `advances` +
`readiness` are the ticket's explicit additions; **`grounding`** is added as the *pure, decidable
handle* for read-never-invent (D4). `budget` is a **string** (demand.md's Budget column is freeform
prose, e.g. "small (~1h)") — a rough model default; the measured E-013 pre-fill refines it
downstream (T-016-02 effect), so the core stays addon/ledger-free. `tier` is an enum (closed set)
so an out-of-set tier is unrepresentable, mirroring `CardRarity`.

## D3 — Three gates, value-ordered: honest-empty → read-never-invent → value-link

The ordering **is** the design — it encodes "is there anything? → is it real? → does it name its
value?", and `clear()` returns the **first** STOP (the andon), mirroring `propose-core.clear`.

1. **honest-empty (IA-4):** `what` and `why` both blank ⇒ STOP `honest-empty`. This is the
   *successful refusal* — the fragment closed no vision-distance, so nothing stages (P7: no partial
   materialization). Checked **first**: an abstaining signal must read as "honest empty," never fall
   through to a fabrication complaint.
2. **read-never-invent (PE-1/PE-2):** `what`/`why` filled **but** `grounding` blank ⇒ STOP
   `read-never-invent` — "you stated a move but cited nothing real" (speculation). The model that
   invents content cannot name what it read.
3. **value-link (PE-3/PE-4):** `advances` empty/all-blank ⇒ STOP — "names no invariant/core-feature
   advance." Additionally (reusing `propose-core.boundsGate` logic over the **charter**): an entry
   naming a non-goal (`N\d+`) or a dangling `P\d+` (absent from the live charter) ⇒ STOP — so
   value-link means "links to a **real** value," not merely "non-empty."

**Why honest-empty as a STOP** (not a third verdict): `Play.gates` returns `GateVerdict`
(`clear|stop`). A STOP means the effect never runs ⇒ nothing staged ⇒ exactly "not manufactured
busywork." The gate **name** + reason make the andon legible (it's an honest abstention, like
E-014's roadmap-level andon), without inventing a new contract member.

**Rejected:** a `groundsDemand: bool` discriminator field — redundant with blank `what`/`why`, and
asks the model to self-classify a thing the gate can decide structurally. Rejected a separate
`bounds` gate — the ticket scopes exactly three gates; folding invariant-validity into value-link
keeps that scope while still rejecting non-goals/dangling refs.

## D4 — read-never-invent is decided by `grounding` presence (a pure proxy)

A pure gate cannot semantically verify a signal against the whole project. PE-2 ("cite the source")
gives the decidable proxy: require the model to name **what it read** (`grounding`). Empty grounding
⇒ the signal traces to nothing ⇒ refused. This is the same move propose's value gate makes (it
checks presence of value-bearing fields, not semantic truth) — poka-yoke, not an oracle. The prompt
instructs the model to put a real fragment phrase / file / run-log fact in `grounding`, and to
**abstain** (blank `what`/`why`) rather than invent when it has nothing to cite.

## D5 — `ExpandClearContext = { charter }`

Only value-link needs context (the live `P#`/`N#` ids, via `matchIds`). No `existingEpicIds` — a
signal mints no id. This is a slimmed `ProposeClearContext`. T-016-02's `gates` closure passes
`{ charter: ctx.inputs.charter }`.

## D6 — A pure `renderSignalRow(signal)` belongs in the core

The ticket cites "demand.md (the signal shape)." A pure renderer that emits the demand-table **row**
(`| **{what}** — {why} | **{Tier}** | {budget} | {readiness} |`) makes the shape concrete and
round-trip testable, and is what T-016-02's staging effect will call. It mirrors
`propose-core.renderCard`/`note-core.renderNoteFile`: pure, deterministic, member→alias for the
tier. It throws `RangeError` only on tier enum/map drift (the house drift rule). Including it now
keeps the effect (T-016-02) addon-free and thin.

**Why not defer the renderer to T-016-02:** the renderer is pure and is part of "the Signal output
shape made concrete"; keeping it beside the gates (as propose keeps `renderCard` beside its gates)
avoids re-opening a reviewed core later, and gives the round-trip test a home now.

## D7 — The BAML function & bridge

`function ExpandFragment(fragment: string, charter: string, project: string) -> Signal` —
three inputs paralleling `ProposeEpic(signal, charter, project)`. The bridge
`src/baml/expand-bridge.ts` clones `propose-bridge.ts`: `ExpandBridgeOp = {mode:"render", fragment,
charter, project} | {mode:"parse", text}`, `runOp` dispatches `b.request`/`b.parse.ExpandFragment`,
`extractPromptText` **imported** from `decompose-bridge.ts` (play-agnostic, never re-implemented).
`import.meta.main` stdin/stdout JSON protocol, render-only key guard.

## D8 — Test strategy mirrors the play split

- `src/play/expand-core.test.ts` (PURE, type-only BAML imports, enum members as string-literal
  casts): a full grounded signal clears all three gates; each gate's STOP (blank what/why →
  honest-empty; filled-but-ungrounded → read-never-invent; empty/non-goal/dangling advances →
  value-link); the renderer round-trips every field + throws on tier drift.
- `src/baml/expand.test.ts` (spawns `expand-bridge.ts` in a child `bun`, one spawn): parse of a
  canned reply → typed `Signal`; SAP-reject of garbage → `ok:false` "required field"; render pins
  `fragment`/`charter`/`project` + the proposer framing into the prompt.

No `bun test` file value-imports the addon-loading shell — the discipline that keeps the suite
non-flaky (obs 20675).

## Risk / mitigation

- **baml:gen drift** — `Signal` must exist in `baml_client` before `tsc`. Mitigation: run
  `bun run baml:gen` immediately after authoring `expand.baml`, before writing TS that imports the
  type. `check` re-runs it in CI.
- **Honest-empty vs garbage conflation** — both end at a STOP; acceptable and intended (a blank
  reply, however it arose, stages nothing). The bridge test still distinguishes parse-reject
  (garbage) from parse-of-blank at the BAML layer.
