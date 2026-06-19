# Vend — The Propose-Epic Playbook (the play above decompose)

The clearing function one level up: **clear a demand signal into an epic card.** It
is the membrane between the pull board (`demand.md` signals) and `DecomposeEpic`.

```
demand signal ──► ProposeEpic ──► epic card ──► DecomposeEpic ──► stories/tickets ──► lisa
```

Like `DecomposeEpic` (`../playbook-decompose-epic.md`), it is **extracted from the
hand-drafting record**, not invented: E-004 / E-005 (from kaizen signals), E-002's
card (from `ci-strategy.md`, the F3 fix).

## The pull-discipline guard (read first)

Generating epics is where **overproduction** — the worst waste — sneaks in. An
auto-generator that elaborates *every* signal is the push-inventory anti-pattern the
whole demand board exists to prevent. **ProposeEpic fires on a *pull*, gated by
capacity (the shelf) — never to drain the board.** Under pull it's powerful; ungated
it's a garbage factory. This guard is not optional.

## What it does

Given a thin demand signal (one line: *what* + *why it might matter* + a value tier),
plus the charter and project state, produce an **epic card** — the `E-XXX.md`:
frontmatter (`advances`, `serves`, `kind`), the card stat-block (mana / color / type),
and *Intent / Value / Done-looks-like / Context*. It states **intent and value**, not
the decomposition (that's `DecomposeEpic`'s job).

## Shape

```
ProposeEpic(signal: DemandSignal, charter: Charter, project: ProjectContext) -> EpicCard
```

Same substrate as `DecomposeEpic`: BAML render + parse, `claude -p` dispense, budgeted
and logged. Cheaper, though — a card is a page, not a DAG.

## The rule-set (from the hand demonstrations) — `PE-1…PE-7`

- **PE-1 — Pull-only.** Fire on a pulled signal, never speculatively (the guard).
- **PE-2 — Cite the source.** The card traces to the demand signal *and* the
  KB/charter value it serves. *(E-002 cited `ci-strategy.md`; E-004 the proof's
  kaizen #4.)*
- **PE-3 — Assign a card.** mana cost = the warranted budget envelope; color = the
  discipline (W/U/B/R/G); type = **Sorcery** (single-use) | **Permanent** (reusable);
  `advances` = the charter invariant. *(`card-model.md`.)*
- **PE-4 — State value + an epic-level done-signal.** `serves` (one line) + a
  *Done-looks-like* that is observable at the epic level, not a ticket checklist.
- **PE-5 — Respect non-goals; flag prerequisites.** Bounds-check against `N1–N4`;
  name any prerequisite *as* a prerequisite, not hidden scope. *(E-002's card named
  the F3 prereq.)*
- **PE-6 — Intent, not decomposition.** Stop at the bigger-picture play; the stories
  are `DecomposeEpic`'s output. *(E-003.md deliberately stopped at intent.)*
- **PE-7 — Right-size to a feature block.** One epic ≈ one ~2-hour macro-budget. If a
  signal is bigger, it is *several* epics — say so, don't inflate one card.

*(`PE-` is local to this play — not the charter's `P1–P7` invariants.)*

## The gates (mirror `DecomposeEpic`, one level up)

1. **Value gate** — the card traces to a real signal and names a charter value it
   serves; advances-nothing-nameable is refused.
2. **Bounds gate** — no non-goal violated; prerequisites named; the `advances` holds.
3. **Structural poka-yoke** — valid card frontmatter (`id`, `advances`, `serves`,
   `kind`) and the `id` is **disjoint from the live board** (the same R6 discipline,
   at epic granularity).

A failed gate stops the line and says why — the same jidoka.

## The pipeline payoff

`ProposeEpic` + `DecomposeEpic` compose: `vend <n>` on a *raw demand signal* can clear
it **end to end** — signal → card → tickets → lisa — from one press. The shelf (E-003)
already dispatches `DecomposeEpic` on epics; extended, it dispatches `ProposeEpic` on
signals. That's the path from "vend an epic" to **vend the whole roadmap** — and it's
the vision's "typed, graph-structured orchestration" made literal: a chain of typed
clearing functions over the demand board.

## v0 scope — and where it stops

Build it only when the board has signals worth pulling *and* `DecomposeEpic` is real.
Do **not** build the auto-drainer (it violates PE-1). First cut: one hardcoded play,
dispensed + gated + logged; the chaining and the shelf dispatch come after.

## Graduation note

`ProposeEpic` is itself a graduation candidate: proposing epics from signals recurs
here and across every lisa project — a **Permanent** in card terms, walking the same
`playbooks/` bridge `DecomposeEpic` is on.
