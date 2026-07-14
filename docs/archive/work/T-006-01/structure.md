# T-006-01 — Structure: the shape of `roadmap-plan.md`

The blueprint for the deliverable — not its content, its *shape*. For a code ticket
this phase names files created/modified/deleted and module boundaries. For a planning
sorcery the only "file" is one markdown artifact, so this phase specifies **that
document's section layout and the schema of a planned-story record**. (That Structure
collapses to "define a doc's headings" is friction F4 — surfaced in Review.)

---

## Files

| Action | Path | Role |
|---|---|---|
| **create** | `docs/active/work/T-006-01/roadmap-plan.md` | **the deliverable** — the AC artifact (Implement phase writes it) |
| create | `docs/active/work/T-006-01/{research,design,structure,plan,progress,review}.md` | the RDSPI trail (this is `structure.md`) |
| append | `.vend/decisions.jsonl` | one steering decision record for this survey (per `steering-data-model.md`) |
| — | *no other writes* | **no** `tickets/` or `stories/` files — stories only, not materialized |

**Boundary the survey must not cross:** it reads the whole KB + board and writes
*one plan* + *one decision record*. It materializes no tickets, mutates no epic card,
sweeps no stale `demand.md` row (those frictions are *reported*, not fixed — fixing
them is later, pulled work). This keeps the spike a pure read→plan, honoring scope.

## `roadmap-plan.md` — section layout

```
# Vend — Roadmap Plan: the next wave of stories            (title + 1-line frame)

## How to read this            value+budget legend; cite-don't-invent; stories-only
## The recommended pull order  the ranked spine (the headline answer, up top)
## The fork                    shelf ⟂ CI — recommendation + alternative, escalated
## Planned stories             one subsection per epic-track, each a story-record set
   ### E-004 — cross-board-id-guard            [recommended next pull]
   ### E-005 — thread-real-model-id
   ### E-003 — vend-cli-shelf                  [the fork — core-feature side]
   ### E-002 — CI structural backstop          [the fork — enabler side; needs card]
   ### E-007 — casting-engine (sorcery)         [last; readiness-gated]
## Bounds check                F1–F4 as contradictions found (or "none")
## Future signals (not planned)  one-liners; deliberately un-elaborated (anti-rot)
## Provenance                   what this cites; the decisions.jsonl record id
```

Headline-first: the recommended pull order and the fork sit **above** the per-story
detail, so a human reading top-down gets the decision before the justification —
`project-steering.md` move 3 ("recommendation first").

## The planned-story record (the atomic unit)

Each planned story is a fixed-field block — the minimum that satisfies the ACs
("cites the knowledge doc(s)", "value tier + budget envelope", "sequenced by
leverage + readiness"). Schema:

```
- **S-<epic>-<n> — <kebab-title>**            (epic-scoped id; Decision 2)
  - **Outcome:** what this story makes true (purpose first — charter criterion 1)
  - **Value tier:** Keystone | High | Standard | Leaf      (demand.md ranking)
  - **Budget envelope:** <wall-clock>, <token ceiling note>  (demand.md; bounded)
  - **Readiness:** ready | unblocked | blocked-on <x>       (the sequencing input)
  - **Cites:** <KB doc(s) + board refs that drive it>       (cross-ref, not invention)
  - **Advances:** <P-invariant / epic outcome>              (charter recompute)
  - **Known-done by:** the observable that says it landed    (criterion 5: verifiable)
```

Note: `Known-done by` mirrors the AC checkboxes pattern and the charter's "verifiable"
criterion — every planned story carries how we'll know it cleared, so the later cast
that materializes it inherits a gate, not a vibe.

## Per-track story sets (the blueprint the Implement phase fills)

Counts fixed by Decision 4 (one wave, no over-build):

| Track | Story id(s) | Count | Shape |
|---|---|---|---|
| E-004 id-guard | `S-004-01` | 1 | collision-refuse in `materialize.ts`, fed by `project-context.ts` ids; colliding-fixture test = the gate |
| E-005 model-id | `S-005-01` | 1 | thread real model id off the terminal `result` into `runs.jsonl`; sentinel fallback |
| E-003 shelf | `S-003-01`, `S-003-02` | 2 | (01) deterministic ranked menu → `.vend/menu.json`; (02) selection mini-language + budgeted dispatch + run-log append |
| E-002 CI | `S-002-01` | 1 | the "first gate honest" slice (`check:test` via Dagger `v0.21.4`, Node runtime, thin router) — **+ prerequisite: author `epic/E-002.md`** |
| casting-engine | `S-007-01` | 1 | a **spike** story: spec the BAML sorcery engine from E-006's recorded friction (F4); not an implement story |

**Ordering that matters (within the doc, top to bottom = recommended pull order):**
E-004 → E-005 → [fork: E-003 ⟂ E-002] → E-007. The two E-003 stories are internally
ordered `S-003-01` → `S-003-02` (menu must exist before selection resolves against
it, per `E-003.md`: "`vend <sel>` resolves indices against the same list just
shown").

## Id-collision guard (the structural poka-yoke for this artifact)

Before the deliverable is written, every proposed id is checked against the live set
{`S-001`,`S-002`,`S-006`; `T-001-*`,`T-002-*`,`T-006-01`; `E-001/003/004/005/006`}:
- Story ids: all epic-scoped `S-NNN-nn` → **0 collisions** (none of that shape exist).
- New epic id for casting-engine: `E-007` — `E-002`(signal-only) and `E-007` are the
  free epic slots; `E-007` chosen so it can't be confused with the existing CI signal.
- **No ticket ids minted at all** (stories-only) → the `T-*` space is untouched.

This is the same {generate ids → check against existing → refuse on collision} shape
as `playbook-decompose-epic.md`'s structural gate and E-004 — run by hand here, which
is precisely why F1/E-004 matter.

## What Structure does *not* decide

Not the prose, not the exact budget numbers (Implement reads them off `demand.md`),
not the F1–F4 wording (Plan sequences the bounds check; Implement writes it). This
phase fixes only the *containers*: sections, the story-record schema, the per-track
counts, and the collision check. The Plan phase orders the steps to fill them.
