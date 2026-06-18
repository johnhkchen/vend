# Vend — The Card Model (the Magic: The Gathering lens for the shelf)

The shelf's buyable products are **cards.** This lens is structural, not flavor: it
gives *budget*, the *single-use vs. reusable* axis, and a *play taxonomy* a precise,
intuitive shape. Read with `charter.md` (the rules each card obeys) and `demand.md`
(value + budget).

## The one insight that makes it click

**Budget is mana. Your Claude subscription is your land pool.** A big subscription is
a big mana base — you can tap more mana per turn and cast more, or bigger, plays. The
fat-tailed token cost we measured (a tiny fixture burning 119k tokens) is simply
*spells that cost more to resolve than their printed cost* (X-spells, hidden costs).
The 2-hour envelope is the mana you've decided to tap for a cast; hitting the budget
andon is **tapping out.**

## The mapping

| Magic | Vend |
|---|---|
| Mana | Budget (time / tokens) |
| Lands / mana base | Your Claude subscription capacity |
| Tapping lands | Spending budget on a run |
| Tapping out | Exhausting the envelope (the budget andon) |
| A card | A shelf item (a play) |
| Mana cost | The play's warranted budget envelope |
| **Sorcery** | A **single-use play** — cast once, for the moment, then gone |
| **Permanent** (artifact / enchantment) | A **reusable playbook** — stays in play, recast every turn |
| Instant | A reactive one-shot (an andon / interrupt play) |
| Color (WUBRG) | The play's discipline (see the pie) |
| Card text / rules | The play's effect **+ its gates** (the contract) |
| The color pie (rules a color obeys) | The **charter** — what each kind of play may/may not do |
| Rarity (common → mythic) | Value tier (leaf → keystone) |
| Your deck | Your shelf (the plays authored for a project) |
| Casting a spell | **Vending** — pick + pay mana + resolve against the rules |
| Reprinting a staple | **Graduating** a recurring sorcery into a permanent (`playbooks/`) |

## The color pie → play taxonomy

- **White** — order, gates, validation, CI. Jidoka. *AddGate.*
- **Blue** — knowledge, planning, foresight, card draw. Research, decomposition,
  roadmap survey. *DecomposeEpic, Survey the Roadmap.* (Our dominant color so far.)
- **Black** — ambition at a cost, tutoring, raw power. High-mana plays that fetch a
  specific outcome / "do whatever it takes."
- **Red** — speed, impulse, haste. Fast spikes, quick momentum dispenses.
- **Green** — growth, ramp, mana acceleration. Scaffolding, codegen, infra — plays
  that make *future* plays cheaper to cast.

Multi-color is normal: `DecomposeEpic` is Blue planning with White gates → Azorius (WU).

## Sorcery vs. Permanent — the axis we're now adding

A **sorcery** is authored for a specific moment and cast once — cheap to author
(it needn't generalize). A **permanent** must generalize, costs more to author, and
pays back across every recast. **Graduation:** a sorcery you keep recasting across
projects (e.g. *bootstrap a fresh lisa project*) is the signal to **reprint it as a
permanent** — exactly the `playbooks/` standardized-work bridge, in card terms.

## What adopting this buys

A shared vocabulary for the shelf; budget intuition that's actually correct
(mana/lands); a taxonomy (colors); the single-use/reusable axis made first-class; and
a concrete **target representation for a shelf item** —

```
card = { name, manaCost (budget envelope), color (discipline),
         typeLine (Sorcery=single-use | Permanent=reusable),
         text (effect + gates), rarity (value tier) }
```

The **casting engine** — authoring a single-use BAML play, paying its mana, resolving
it against its gates — is the *"build the BAML layer harder"* direction. The first
sorcery we cast (`E-006 — Survey the Roadmap`) is the probe that tells us what that
engine must do.
