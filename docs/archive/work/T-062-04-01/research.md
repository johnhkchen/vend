# T-062-04-01 — Research

**Ticket:** `capture-expected-outcome-gold-master` (S-062-04, E-062 kitchen-emdash-dress-rehearsal).
**Goal (from the card):** freeze the clean drive into a committed `EXPECTED-OUTCOME.md` gold-master —
the re-runnable consistency bar the later untouched clean-room (forward-E1) drive is measured against.
**AC:** `EXPECTED-OUTCOME.md` is committed in the epic work dir capturing the **cleared board**, the
**rendered menu**, and the **budget envelope** of the clean drive, in a form a later drive can be
diffed against.

Descriptive only. What exists, where, how it connects. No solution proposed here.

## 1. Where this card sits in E-062

E-062 is the **kitchen dress rehearsal** (memory: *"Kitchen: Dress Rehearsal then Clean-Room"* — two
phases: harden the bootstrap here, then a hands-off untouched fresh-repo drive is the real forward-E1
proof, a separate downstream epic). This card is the **final card of story S-062-04** and `depends_on:
[T-062-03-04]` (the bootstrap-hardening close). Its job is **synthesis, not new code**: roll the
component captures the predecessors produced into one frozen gold-master.

The predecessor cards each captured one component of the drive and **explicitly deferred the live,
metered budget line to this card**:

- **T-062-03-01** (`drive-steer-ranks-menu-render`) → `expected-board.md` + `steer-input.proof.txt` +
  `src/kitchen/seed-steer-seam.test.ts`. The **board** component. Seed-intent + tuned charter reach
  steer is proven free/deterministically; the live *ranking* is `⟪…⟫`.
- **T-062-03-02** (`graceful-degrade confirm`) → `EXPECTED-OUTCOME.degrade.md` +
  `src/kitchen/kitchen-degrade.test.ts`. The **degrade** component (MCP-absent → reduced grounding,
  not andon). Deterministic half captured; live line `⟪…⟫`.
- **T-062-03-03** (`drive-work-clears-menu-render-slice`) → `EXPECTED-OUTCOME.menu-render.md` +
  `menu-render.index.astro` + `build.proof.txt` + `src/kitchen/menu-render.{ts,test.ts}`. The
  **rendered menu** component. Clauses 1+2 (render contract; green `astro build`) captured as fact;
  clause 3 (the live `vend work` budget line) `⟪…⟫`.
- **T-062-03-04** (`harden-bootstrap-friction-fix-at-source`) → `friction-ledger.md` +
  `src/kitchen/cold-start-redrive.test.ts`. The **whole path as one composition**, gated; every
  friction fixed-at-source with a guard; metered half `⟪…⟫`.

Each predecessor's review/footer says verbatim that **T-062-04-01 freezes the full
`EXPECTED-OUTCOME.md`** and fills clause 3's `⟪…⟫`. So this card is the named consolidation point.

## 2. The established gold-master pattern (the precedent to mirror)

`examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` is the **shipped precedent** — the
hackathon-seed gold master, captured from a real live drive (T-060-03-01, 2026-06-29; total real
spend $1.08). Its shape:

1. A **header banner** marking it CAPTURED-not-a-target, with host/executor/sandbox provenance.
2. A **headline verdict** (the round-trip is whole).
3. A **"What the drive actually yielded"** table (target vs actual-live).
4. The **coherent board** (the ranked slices), the **genuine forks**, the **cleared slice**, the
   **SVG board**.
5. A **residual-imperfections** section (honest — the bar is "clears", not "perfect").
6. A **re-run block** (the exact commands to reproduce a comparable drive).
7. A **why-this-exists** footer.

It lives **in the seed template** — so it travels with the seed and a later drive that *copies* the
seed carries its own consistency bar. The three E-062 component files mirror its table/`⟪…⟫`/footer
idiom precisely (degrade + menu-render). This card's output is the kitchen analogue of that single
file, assembled from the component captures.

The pattern's discipline (memory: *EXPECTED-OUTCOME Gold-Master Pattern*; *Honest-On-Outcome
Discipline*): **a number that was not observed must stay `⟪…⟫`** — never a fabricated Actual.

## 3. What is CAPTURED (fact) vs PENDING (the live metered cast)

The drive splits into a **deterministic/free half** and a **metered/human-authorized half** (P7).

**Captured, free, offline — verifiable now:**
- `vend init --template kitchen` scaffolds the seed. **Re-ran during this research** in a throwaway
  sandbox (`src/cli.ts`): `scaffolded --template kitchen — 31 created, 0 skipped`, exit 0.
- `vend doctor` (cwd in the workspace): `ok — 3 check(s) passed` — `✓ bun on PATH`, `✓ Astro
  storefront config present`, `✓ EmDash Dish seed valid`, exit 0.
- `vend svg` (pre-drive): honest-empty — `0 groups, 0 cards, 0 links`, exit 0.
- The **materialized** workspace carries `SEED.md` at root + the **kitchen-tuned**
  `docs/knowledge/charter.md` (overlaid, confirmed) + the `index.astro` "coming soon" stub →
  seed-intent reaches steer (gated by `seed-steer-seam.test.ts`; `steer-input.proof.txt`).
- The **render contract**: `menu-render.test.ts` (8 tests) over `menu-render.ts`; the real
  `.emdash/seed.json` example → exactly one matching card; honest-empty on zero; HTML-escaped.
- The **green build**: `build.proof.txt` — astro 6.4.8 + @astrojs/cloudflare → exit 0, `dist/{server,
  client}` emitted (the gold-master reference page `menu-render.index.astro`).
- The **degrade**: `kitchen-degrade.test.ts` — MCP absent → `reducedGrounding:true`, not andon.
- The **whole-path composition**: `cold-start-redrive.test.ts` — init→scaffold→doctor→steer-inputs→
  degrade→idempotent re-init, one workspace, 25 expects, green.
- Full gate (predecessor record): `bun run check` → 1488 pass / 1 skip / 0 fail.

**Pending — the live, metered, human-authorized cast (cannot be filled honestly here):**
- `vend steer` actually **ranking** the menu-render slice on top (no offline path; metered).
- `vend work` actually **clearing** the slice and writing a `runs.jsonl` line with
  `outcome:"success"`, `totalTokens ≤ envelope.tokens`, `wallClockMs ≤ envelope.timeMs`.
- The literal **budget-envelope values** + spend ($, tokens, ms) of that run.

**There are no live kitchen numbers anywhere in the tree.** The repo's own `.vend/runs.jsonl` (9
lines) holds vend's *self* propose/decompose casts (E-060/E-061/E-062) — **not** a kitchen sandbox
drive. No kitchen `vend work` cast has been run. So the metered half **must** stay `⟪…⟫`.

## 4. The budget-envelope mechanism (the "budget envelope" the AC names)

`coldStartEnvelope(plays, records, tier, prior)` (`src/ledger/recalibrate.ts:380`) derives the
cold-start macro budget: per-denomination Σ of the drive plays' recalibrated envelopes, **measured
from the run-log tails**, falling back to the hand `prior` on a fresh ledger (`source:"prior"`). The
`vend work` arm defaults to it when `--budget` is omitted (`src/cli.ts:816`; `src/play/work.ts:189`).
The **envelope** is the p90 PRICE quote (IA-8); funding headroom is a separate per-cast guard. The
*captured* envelope value lands on the metered `runs.jsonl` line as `envelope:{timeMs,tokens}` — so
it is part of the metered `⟪…⟫`, not a hand-pickable constant.

## 5. Constraints / assumptions surfaced

- **Honest-on-outcome is binding.** This card must not invent the live numbers. The legitimate
  deliverable is a gold-master that captures every deterministic component as fact and records the
  single live metered line as explicit `⟪…⟫` for the human-authorized drive — exactly the state the
  hackathon gold-master was in *before* T-060-03-01's live drive filled it.
- **The committed template tree stays untouched** (the stub is the cook's slice; the clean-room drive
  re-derives the menu). The gold-master is *reference*, not code, so it can live with the seed.
- **Tickets are materialized by `decompose-epic`, not hand-authored** (T-062-03-04 friction ledger) —
  irrelevant here (no new tickets), but it's why the friction overflow was escalated as a proposed
  follow-up epic rather than hand-written.
- **"Epic work dir" vs the seed template** is a placement question for Design: the precedent
  (hackathon) lives in the seed; the diffable form the AC wants is the seed-side copy a clean-room
  drive carries.
