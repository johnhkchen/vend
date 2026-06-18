---
id: E-000
title: kebab-case-name
status: open            # open | clearing | active | done
advances: [P1]         # charter invariant IDs this epic moves forward (see charter.md)
serves: >              # ONE line: the value this realizes for the product. Forces the
                       # articulation; kept short on purpose. Not a restatement of the charter.
  …
---

<!--
An epic is the artifact you throw at the clearing-house playbook. It is a
*statement of intent and value*, NOT a plan. You write the bigger-picture play;
the playbook clears it into allocatable work (stories/tickets) against this
project. Lead with purpose and value — never with a ticket breakdown, and never
by restating the charter (the `advances` IDs do that).

We can afford context up front to steer. Give the decomposer enough to produce
*valuable* work independently, not just *valid* work. Aim for substance over
length, but do not starve it.
-->

## Intent — the bigger-picture play

What someone wants done, and why it matters to the product *now*. The problem or
opportunity in plain terms. Enough context that an agent clears it the way you
would, without you in the loop.

## Value to the design

What capability or quality this realizes, and how it advances the core feature
(better clearing / better allocation) or the invariant(s) in `advances`. This is
the steering: what "worth allocating" means for *this* epic.

## Done looks like

What is observably true when this epic is cleared and executed — at the epic
level, not a ticket checklist. How we'll know it landed (the verifiable outcome),
so the clearing guarantee can be honored rather than asserted.

## Context & constraints

The project reality to ground against (point to code, the knowledge docs, prior
epics). Boundaries, non-goals to respect, dependencies on other epics. What is
deliberately *out* of scope.
