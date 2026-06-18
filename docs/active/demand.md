# Vend — Demand (the pull board)

Thin demand **signals**, not epics. A signal is a *request for clearing*, not
work — one line of "what + why it might matter." Epics are **pulled** from here
only when there's capacity to execute them; clearing (signal → epic →
stories/tickets) happens just-in-time on pull, never ahead of demand.

Keep this lean. Overproduced plans are inventory that rots; signals are cheap and
stay un-elaborated until pulled. Pulling, grounded in the codebase *at the
moment*, is what prioritizes — a signal blocked on something that doesn't exist
yet surfaces its own dependency (an andon), which reorders the work for us.

**Sources of demand:** feature requests, friction surfaced in `go-and-see.md`,
gaps against `charter.md`, and (later, auto-fed) CI structural failures.

## Signals

| Signal | Value (charter) | Status |
|---|---|---|
| **Dispense slice** — the single metered lever: one hardcoded play (`DecomposeEpic`) dispensing real work via `claude -p`, gated · budgeted · streamed · countably logged | core feature; P1, P3, P7 | **pulled → E-001** |
| **CI/CD structural backstop** (Dagger, Node-orchestrator) — independent inspection for the *structural* defect class only, running the same `bun run check:*` scripts the play invokes as andon gates | P3 (gates); jidoka backstop | **blocked on E-001** (needs the scaffold + check surface). Steering: `ci-strategy.md`. → next pull, E-002. **Tooling:** dagger CLI `v0.21.4` ✓ (pin this in `/ci/dagger.json`); Docker installed — **daemon must be running** for the engine. |

## Not yet pulled

Friction from `go-and-see.md` and gaps against `charter.md` accumulate here as
one-liners *as they're surfaced* — deliberately not pre-elaborated into epics.
(none recorded yet)
