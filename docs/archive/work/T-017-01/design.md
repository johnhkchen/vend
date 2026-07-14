# T-017-01 — Design: Survey pure core

Decisions grounded in Research. Survey = ExpandFragment one scale up: a whole-project read → a ranked
`Signal[]` board. The work splits into the same three modules (core / baml / bridge); the open
questions are the **output type**, the **three gate semantics over a board**, and the **empty-board
polarity**. Each decision below names what was rejected and why.

## D1 — Output type: `Board { signals Signal[] }` wrapper (not bare `Signal[]`)

**Decision:** add a `Board` class wrapping a single `signals Signal[]` field; `Survey(...) -> Board`.

**Why:** The proven array-output precedent is `WorkPlan` (`decompose.baml:84-87`) — a named class
wrapping arrays, whose SAP all-array degrade lands a garbage reply on an EMPTY instance rather than
throwing (Research §SAP-degrade). That degrade IS the honest-empty handle we want: a degraded reply →
`{ signals: [] }` → an honest empty board, no coercion closure needed.

**Rejected — bare `-> Signal[]`:** leaner and the ticket phrases the output as "ranked `Signal[]`,"
but (a) no existing play uses a bare list return type, so BAML 0.222 list-return support is unproven
here, and (b) a named anchor mirrors `WorkPlan` exactly and gives the degrade a clean home. The core's
`clear`/renderer still operate on `board.signals` (a `Signal[]`), so the ticket's "ranked Signal[]"
intent holds — `Board` is just the BAML envelope, invisible past parse. Low risk beats marginal lean.

## D2 — Survey reads two inputs: `(project, charter)`, no fragment

**Decision:** `Survey(project: string, charter: string) -> Board`. Bridge render op carries both.

**Why:** Survey reads the WHOLE project for its latent demand gradient (the ticket: "reads the whole
rough project"); there is no single fragment. `charter` is the value function the candidates must
advance and rank against. This is expand's three inputs (`fragment, charter, project`) minus the
fragment — the project IS the subject. Render-op arg order `(project, charter)` matches the ticket's
`b.request.Survey(project, charter)`.

## D3 — Three gates over a board, value-ordered: honest-empty → read-never-invent → leverage-rank

The ticket names exactly three (read-never-invent, honest-empty, leverage-rank) — note **value-link is
dropped** vs expand. Each operates over the board (`Signal[]`), first-stop-wins, returns `GateVerdict`.
Ordering mirrors expand's honest-empty-first discipline (an abstention reads as honest, never as a
fabrication complaint).

### honest-empty (IA-4) — the board-stocker's signature discipline

**Decision:** an EMPTY board (`signals.length === 0`) → **CLEAR** (the honest abstention is correct).
The gate STOPs only when the board contains a **blank/filler** signal — `what` AND `why` both blank —
i.e. manufactured padding masquerading as a stocked board (or an SAP-degraded partial entry). "A
board-stocker that fabricates demand is explicitly worse than none": empty is honest; a board padded
with empty filler is the dishonest non-empty this gate refuses.

**Why this polarity flips from expand:** in expand a blank signal IS the whole output, so blank → STOP
(nothing to stage). In Survey the board is the output, so an empty board is the SUCCESS abstention,
while a blank ENTRY among real ones is the dishonesty. Same discipline (IA-4), inverted container.

**Rejected — empty board → STOP (expand's polarity):** would make an honest no-gradient project a
failure, contradicting the ticket AC ("a no-gradient project yields the empty board"). Wrong.

### read-never-invent (PE-1) — every candidate cites real state

**Decision:** for each non-blank signal, `grounding` must be non-blank; the FIRST ungrounded signal →
STOP naming that candidate. A board where one candidate is fabricated (content, no citation) is
refused whole (the andon stops the line). Mirrors `readNeverInventGate` per-signal, lifted to the board.

**Why:** PE-1 — demand is read, never invented; the citation is the pure, decidable proxy. A pure gate
cannot verify groundedness against the whole project, but it CAN refuse a candidate that names nothing
it read. This is the ticket's "a fabricated one is refused."

### leverage-rank — the board is ordered highest-leverage first

**Decision:** the signals must be in non-increasing leverage order by tier rank
(`Keystone=0 < High=1 < Standard=2 < Leaf=3`). The first adjacent pair where `rank(i) > rank(i+1)` →
STOP naming the inversion. An empty or single-element board trivially passes. Ties (equal tier) are
allowed (stable). This needs a NEW `TIER_RANK` map (expand-core has only `TIER_ALIAS`, no rank).

**Why:** demand.md ranks by leverage (keystone unblocks most → leaf nothing). The board's ORDER carries
that ranking — leverage-rank makes the ordering a checkable contract, not a hope. This replaces expand's
`value-link` because at board scale the new failure mode is mis-ordering, not a single dangling ref.

**Rejected — sort the board inside the gate:** a gate MUTATES nothing and decides nothing it can't see;
sorting would silently "fix" a model that mis-ranked, hiding the signal that it mis-ranked. The gate
REFUSES a mis-ordered board so the andon is visible (consistent with the no-mutation gate discipline).

## D4 — `clear(board)` takes no external context (unlike expand)

**Decision:** `clear(board: Board): GateVerdict` — no `ctx`. None of the three gates needs the charter:
honest-empty and leverage-rank are intrinsic to the board; read-never-invent checks only `grounding`.

**Why:** expand's `ExpandClearContext` existed solely for `value-link`'s charter grep — dropped here, so
the context vanishes. The Play.gates closure (T-017-02) becomes `(board, _ctx) => clear(board)`,
ignoring `CastContext`. An empty-interface context would be dead weight (and an anti-pattern).

**Rejected — keep a `charter` context for a future value-link:** speculative; YAGNI. If a board-level
value-link is wanted later it is an additive gate + context, cheaply added then.

## D5 — Renderer: `renderBoard` reuses `renderSignalRow` from expand-core

**Decision:** `renderBoard(board): string` maps each signal through `renderSignalRow` (imported from
`expand-core.ts`) and joins with newlines — the demand-board body, N rows.

**Why:** the demand row is a genuine SHARED CONTRACT (both plays write the identical row to the
identical `demand.md`), not an incidental util — so reusing it is correct DRY, and `expand-core.ts` is
PURE (type-only BAML imports), so importing it keeps survey-core addon-free. This threads the
no-shared-util idiom precisely: SHARE the real output-format contract (`renderSignalRow`), COPY the
incidental predicates (`nonEmpty`) for self-contained gate logic.

**Rejected — re-implement the row in survey-core:** would duplicate `TIER_ALIAS` + `aliasTier` +
the row format, inviting drift between two plays writing the same board. The no-shared-util idiom
guards against UTIL coupling, not against reusing a published output-format function.

**Rejected — defer the renderer to T-017-02:** the renderer is pure and its natural home is the core;
including it keeps T-017-02 to wiring only (effect/CLI). It is small and within this ticket's "composes
into the Play contract shape" AC.

## D6 — Throw vs return: only enum/map drift throws

Same house rule as expand-core: a STOP (empty-filler, ungrounded, mis-ordered) is RETURNED `GateVerdict`
data. The single throw is `RangeError` on an out-of-map tier member inside the rank/alias lookup — a
programmer error meaning the BAML enum drifted from the map, surfaced loudly, never a silent mis-rank.

## Surface summary (carried into Structure)

- `baml_src/survey.baml` — `Board { signals Signal[] }` + `Survey(project, charter) -> Board`,
  referencing the shared `Signal`/`SignalTier`.
- `src/play/survey-core.ts` — `SURVEY_GATE_NAMES`, `TIER_RANK`, three gates, `clear(board)`,
  `renderBoard(board)` (reusing `renderSignalRow`).
- `src/baml/survey-bridge.ts` — render/parse child harness, `extractPromptText` imported.
- `src/play/survey-core.test.ts` + `src/baml/survey.test.ts` — pure gate/renderer pins + offline
  BAML parse/degrade/render pins.
