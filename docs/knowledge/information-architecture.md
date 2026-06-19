# Vend — Information Architecture

The durable anchor for **what a user sees and how they move** through Vend. Like
`charter.md`, this is small by design and slow by design: principle-level, capped,
anti-stale. It is the spine the eventual TUI epics anchor to, so they implement a
settled shape instead of re-litigating it. Where a future surface and this file
disagree, fix one — they are not allowed to drift.

`charter.md` says *what work is worth clearing*; this file says *how the clearing
house presents itself*. Read `vision.md` for the narrative; this is the indexed
spine. Decisions here were converged in a go-and-see design session (`go-and-see.md`)
walking the literal new-user first run.

The two lenses carry over: **TPS** — the run surface is an assembly line with an
**andon** cord; a gate-stop stops the line. **MTG** — the shelf holds cards, the
budget is **mana** tapped from the subscription land pool, casting is the
transaction. See `card-model.md`, `tps.md`, `mana-economics.md`.

---

## The governing decision: recommendation-first, not browse-first

**IA-1 — The home leads with demand, not supply.** The top of the screen is *the
one thing worth doing now, and why* (the pull board, ranked by leverage). The shelf
of plays sits beneath as the inventory that *serves* the recommendation. A
browse-first catalog (scan all plays, pick one) would betray the pull principle and
turn Vend into a store you shop instead of a clearing house that tells you what to
clear. Supply is visible; demand leads.

This single decision sets the information hierarchy everywhere: context drives, the
shelf serves.

---

## The regions and how you move

**IA-2 — Four objects, three places.** The clearing house's object graph —
**Shelf** (supply: authored plays), **Board** (demand: ranked signals), **Counter**
(the transaction: a live cast), **Ledger** (the record: run history) — resolves to
*three* navigable places, not four:

```
Home  =  Board (pull-ranked)  +  Shelf (inventory beneath)
  │
  ├── pick ──▶  Counter   the live cast — full-screen, it earns its own mode
  ├──  L  ──▶  Ledger    run history; actuals feed envelope recalibration
  └──  a  ──▶  Author    the play's source — it's yours (shadcn-style), a side-door
```

Shelf and Board are the two halves of **Home** (supply beneath demand), not separate
destinations. Counter and Ledger are **drill-downs**. A terminal is narrow and a
live run wants full width, so the Counter is a focused mode, not a pane.

---

## The cold start: onboarding *is* the core loop

**IA-3 — A new user's first move is a cast, not a tour.** Vend ships with the plays
that stock Vend (`ProposeEpic`, `DecomposeEpic`, `Chain`, and the project survey).
So run-0 — a fresh install in an arbitrary repo, no charter, no board — has exactly
one honest recommended move: **cast Survey** (read this project → propose a demand
board). That move *is* the two-gesture transaction (pick + budget + run); its output
is the user's stocked board. The newcomer learns Vend by running it on itself, and
meets the budget model at second one (Survey states its envelope up front).

**IA-4 — The empty state is honest, not seeded.** The board is *truthfully* empty on
run-0; we do not manufacture fake starter signals (overproduction — `tps.md`). There
is exactly one honest thing to do, and doing it is the real product.

**IA-5 — Recommend, never auto.** Run-0 *offers* Survey and waits for the gesture; it
never auto-casts. The whole product is "you allocate the budget" — auto-spending the
user's mana on first launch would undercut the founding gesture (P2), and the cost of
honoring it is one keystroke. Pull-discipline (PE-1) holds even at onboarding.

The home screen has three states along this arc, same regions filling in:
**State 0** bare repo → orient + the Survey bootstrap · **State 1** surveyed → a board
with a recommended pull · **State 2** steady → full board + shelf + ledger feedback.

---

## The Counter — where the charter becomes visible behavior

The Counter is the only region where the invariants become *runtime behavior*: P2
(the second gesture happens here), P3 (the gate-stop renders here), P4 (you walk away
from here), P7 (the meter lives here).

**IA-6 — The spine is Confirm → Run → Settle.** Point-of-sale → the assembly line →
the receipt. At **Confirm**, the budget is pre-filled from the board's leverage tier
(Keystone → fat envelope), so the common case is *accept the default*; adjust is the
exception. At **Settle**, the actuals (what it cost, what materialized, where it
landed) feed back to recalibrate the envelope.

**IA-7 — Never tail the raw stream; show a production line.** The executor emits
low-level noise (`assistant`, `thinking_tokens`, `rate_limit_event`…). A play is a
typed graph, so node-level progress is structurally available for free: show *which
node is running* against the budget burn, plus a single distilled "what it's doing
now" line. The node list is the andon board in miniature.

**IA-8 — The meter must not lie about its two denominations.** Wall-clock is a **hard
wall** (halts mid-flight). Tokens are **detect-after** (the run can overshoot its
envelope; the andon catches it afterward — proven live at 108.9k/60k). Drawing the
two bars identically would be a lie: ⏱ is a countdown to a hard stop; ◇ is a
burn-rate-vs-envelope that *can* trip the andon late. (Bounding token exploration —
`--max-turns` — is what would eventually make ◇ a real wall.)

---

## The andon — the product's stance toward its own stops

**IA-9 — A gate-stop is a successful refusal, not a failure.** When a gate halts the
line, the user must feel *the tool just earned its keep* — it refused to hand over
garbage — **not** that something broke. This is the product's core promise made
visible (P3: gates are the contract), and it dictates the visual language:

- **Amber, not red.** "Stopped at the gate," never "ERROR/aborted/failed." The andon
  family is amber *everywhere* it appears — Counter, the Home in-flight board, the
  Ledger, notifications.
- **Voice is protective and calm.** "The budget gate held the line." "Nothing
  materialized — no half-output." Reassurance (P7), not apology.
- **Every andon carries four things:** which gate fired (the contract clause, named) ·
  what survived (nothing partial — P7) · why, in the user's terms · **the next pull**
  (the andon hands you the move — TPS: the cord stops the line *and* summons the fix).

**IA-10 — Vend has two success states.** Materialized-work *and* honest-refusal are
both wins. So an **andon rate is not a defect rate** — it is the "gates doing their
job" rate. A 0% andon rate is *suspicious* (are the gates real?), not ideal. The
Ledger counts andons as the system working; no surface red-flags that number.

**IA-11 — Andon summons; success stays quiet.** Vend is built to be left (P4). A
gate-stop is exactly the event worth interrupting the user for — it pushes a
notification; a clean Settle waits in the Ledger. (This anticipates the fleet/DAG
future: many lines running, only the stops light up.)

---

## Open threads (honestly unresolved)

Named so they don't masquerade as settled. Pull one when it's worth designing.

- **The Ledger as the recalibration loop.** Actuals → measured envelopes (the kaizen
  feedback `demand.md` keeps gesturing at). What the Ledger shows, and how Settle
  feeds it back, is undesigned.
- **The detached/notify mechanism.** *That* andon summons you is settled (IA-11);
  *how* (terminal bell, OS notification, an andon board on next launch) is not.
- **The fleet/DAG andon board.** Multiple concurrent casts → Home's "in-flight"
  becomes an andon board where only stops light up. Anticipated, not designed.
- **Confirm's budget-adjust interaction.** Slider, presets, or pure
  accept-the-default — the adjust gesture's shape is open.

---

## Index

IA-1 recommendation-first · IA-2 four-objects-three-places · IA-3 onboarding-is-the-
core-loop · IA-4 honest-empty-state · IA-5 recommend-never-auto · IA-6 Confirm→Run→
Settle · IA-7 production-line-not-raw-stream · IA-8 meter-cannot-lie · IA-9
andon-is-successful-refusal · IA-10 two-success-states · IA-11 andon-summons-success-
quiet.
