# Expected outcome — the gold master (captured from a real live drive)

> ✅ **CAPTURED, NOT A TARGET.** These are the real numbers from a live metered drive of this seed
> (T-060-03-01, **2026-06-29**). Host: macOS (darwin). Executor: `claude` (model `claude-opus-4-8`).
> Throwaway sandbox (the committed template was not mutated). Total real spend: **$1.08** across 3
> metered casts. The drive is **honest-on-outcome**: it records what the *shipped* seed + `vend init
> --template hackathon` actually produce today — including the one place the cleared slice still falls
> short (the populated SVG render).

This file is the **re-runnable consistency bar**: drive the seed again and the outcome should be
*comparable* to what's captured here. The exact commands are in the re-run block at the bottom.

> 📈 **This replaces the E-058 negative gold master.** The earlier capture (T-058-05, 2026-06-21)
> recorded an **honest-empty steer** (the A3 finding) — the shipped flow rendered no board. The three
> follow-ups it raised have since landed (E-059, T-060-01, T-060-02), and this drive is the closing
> re-drive that proves the round-trip: **the board renders AND a slice clears.**

---

## Headline verdict (the round-trip is whole)

The **shipped** flow — copy the seed → `lisa init` → `vend init --template hackathon` → `vend steer`
→ `vend work` — now drives **end-to-end on a fresh seed with no MCP present**. `vend steer` reads the
seed's intent and stages a **coherent ranked board + genuine forks**; `vend work` (funded by the
calibrated cold-start default, no `--budget` needed) clears **≥1 real slice**: propose-epic mints the
epic and decompose-epic **degrades-and-clears** it into stories + tickets.

The **A3 finding is closed.** `vend init --template hackathon` now overlays the tuned charter at
`docs/knowledge/charter.md` (where steer reads) and `assembleSteerInputs` reads `SEED.md` tolerantly
into the project snapshot (E-059) — so steer finds a real demand gradient instead of abstaining. The
E-044 self-referential-demotion fix still **held** (the board ranks the seed's idea, not the
template's scaffolding).

One honest caveat, recorded below: decompose ran with **reduced grounding** — the optional
`codebase-memory-mcp` is absent on a fresh seed, so the cast **degraded (proceeded) rather than
andoned** (T-060-01) and the run record carries a `reducedGrounding` marker. The slice cleared; the
**populated** `vend svg` render does not yet draw it (a decompose story-numbering issue — see below).

---

## What the drive actually yielded

| What | Target | Actual (live) |
| --- | --- | --- |
| Board items off the seed (**shipped** flow) | a coherent ranked set | **4** (Keystone→High→Standard→Leaf), all grounded in `SEED.md` — **no diagnostic hack needed** (A3 closed) |
| Forks framed | a handful of genuine ones | **2 genuine forks**, each 2–3 options + a recommendation |
| Slices cleared | ≥ 1 | **1 full slice** — E-001 minted, decomposed into **2 stories + 4 tickets** (decompose degraded-and-cleared) |
| Budget (the clear) | within the funded envelope; no instant exhaustion | omit-`--budget` ⇒ **calibrated cold-start default**; **no instant budget-exhausted** — cleared 1, then the cold-start wallet exhausted (203.8k actual vs the 50k cold-start quote) |
| Budget spent (ms, tokens, $) | within envelope | steer **$0.50 / 5 turns**; propose-epic **$0.33 / 5 turns**; decompose-epic **$0.24 / 5 turns**; total **$1.08** |
| Forward-E1 records accrued | yes | **yes — 2**: propose-epic + decompose-epic both carry live **`intervened: false`** (decompose also `reducedGrounding: true`) |
| Populated `vend svg` render | a board off the slice | ⚠️ **andons** — `GraphIntegrityError` on the decomposed story numbering (see "residual imperfections") |

### The coherent board (shipped steer)

A ranked, leverage-ordered board, every signal grounded in a `SEED.md` quote about the team-finder:

1. **Keystone** — Build the team-finder page: load attendee profiles (skills + idea), rank+render the
   people whose skills and idea overlap most with a reference attendee, replacing the placeholder
   counter island. (the whole demo; nothing showable exists today)
2. **High** — Add an attendee self-entry form that recomputes and re-ranks matches live. (closes the
   seed's "find a team in minutes" promise; blocked on the keystone)
3. **Standard** — Author a legible inline ~8–12 attendee dataset so the ranking reads clearly.
4. **Leaf** — Persist an entered profile to localStorage / a shareable URL.

### The genuine forks (verbatim sample)

> **Fork — What does a 'match' mean — shared overlap on both skills and idea, or complementary skills
> around a shared idea?** Options: (1) shared overlap (literal SEED wording); (2) complementary skills
> + shared idea (a dev surfaces designers who want the same idea); (3) hybrid: gate on a shared idea,
> then rank by complementarity. *Vend recommends:* shared overlap for the first slice — it matches the
> seed's literal phrasing and ships a showable demo fastest.

(The second fork: _demo centerpiece — a static ranked list first, or the interactive self-entry
experience first?_ — recommends static-first for a guaranteed showable slice.)

### The cleared slice (`vend work`)

Omitting `--budget`, `vend work` funded the first clear at the **calibrated cold-start quote**
(`◇ 50k ⏱ 2h`, tagged "estimate (cold start — no history yet)"), pulled the keystone, and cast the
propose→decompose chain. **propose-epic cleared** — minting **`E-001 team-finder-overlap-ranking`**
(advances charter H2/H1), with a forward-E1 record (`intervened: false`). **decompose-epic then
cleared with reduced grounding**: the fresh seed has no `.mcp.json` wiring `codebase-memory-mcp`, so
the cast printed `· reduced grounding — optional codebase-memory MCP absent; proceeding (degraded,
recorded)`, dropped the optional MCP, and proceeded — minting **2 stories (S-001, S-002) + 4
tickets** and passing `lisa validate ✓`. Its run record carries both `intervened: false` (forward-E1)
**and** `reducedGrounding: true`.

This is a **successful degrade** (the negative gold master's decompose *andon* is gone), and the
cold-start wallet behaved as designed: the slice cleared under the per-cast funding floor even though
the chain's 203.8k actual overshot the 50k cold-start quote — **no instant budget-exhausted**; the
wallet only stopped *after* the clear, when it could not afford the next of the 3 remaining pulls.

### The SVG board (the designer's view)

`vend svg` renders the **honest-empty** board correctly (pre-drive, 0 cards). The **populated** render
currently **andons** with `GraphIntegrityError: story 'S-002' has no epic 'E-002'`. vend's graph
model links stories to epics purely by id convention (`src/graph/model.ts:148` — `S-NNN[-MM]` belongs
to `E-NNN`; there is no `epic:` field). decompose minted the two stories as flat-sequential `S-001`
(→ E-001 ✓) and `S-002` (→ E-002, which does not exist) instead of nesting both under E-001. The
slice is on disk and the decompose cast succeeded; the populated picture just can't draw until the
story numbering matches vend's id-convention. See the follow-up below.

---

## What this means for the seed/seam — the three E-058 findings, now closed

1. **Input wiring (the A3 fix) — CLOSED by E-059.** `vend init --template hackathon` overlays the
   tuned charter at `docs/knowledge/charter.md` and `assembleSteerInputs` reads `SEED.md` into the
   project snapshot, so the **shipped** steer renders a coherent board (no diagnostic hack).
2. **Budget shape — CLOSED by T-060-02.** Omitting `--budget` funds the **calibrated cold-start
   envelope** (the p90 per-clear price, measured from the run-log tails), so the cold-start chain is
   funded and **no instant budget-exhausted** — the slice clears, then the wallet settles.
3. **MCP capability — CLOSED by T-060-01.** The clearing chain no longer *requires*
   `codebase-memory-mcp`: decompose declares it **optional**, so an absent MCP **degrades** (reduced
   grounding, recorded on the run record) instead of andoning. A fresh seed clears a slice.

### Residual imperfections (honest — the bar is "clears", not "perfect")

- **Populated `vend svg` andons on the decomposed story numbering.** decompose minted `S-001`/`S-002`
  (flat) rather than nesting both under E-001 (e.g. `S-001`/`S-001-01`), so vend's graph id-convention
  can't resolve S-002's parent. Newly surfaced (decompose only now *runs* on the seed). Carried as a
  follow-up; it does not block the slice clear or the forward-E1 accrual. *(Plausibly not reduced-
  grounding-specific — a fresh-board id-minting issue — but unconfirmed without a grounded comparison.)*
- **Cold-start wallet overshoots, by design.** On a fresh ledger the omit-`--budget` default is the
  summed standard prior (`◇ 50k`); a real chain burns ~204k. The slice still clears (per-cast funding
  floor, E-053); the wallet reconciles to accurate once the ledger has a few successes per leg. The
  displayed **quote stays the p90 price** (IA-8) — the funding headroom is never folded in.

---

## Re-run block (reproduce a comparable drive)

```bash
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/vend-seed-drive-XXXX")
cp -R examples/templates/hackathon-seed/. "$SANDBOX/"
rm -rf "$SANDBOX/node_modules" "$SANDBOX/.astro" "$SANDBOX/.vend"
VEND=$PWD/src/cli.ts
( cd "$SANDBOX" && lisa init )
( cd "$SANDBOX" && bun run "$VEND" init --template hackathon )   # 11 created / 7 skipped
( cd "$SANDBOX" && bun run "$VEND" doctor )                      # green: 4/4
( cd "$SANDBOX" && bun run "$VEND" svg )                         # honest-empty SVG
( cd "$SANDBOX" && bun run "$VEND" steer --budget 600000,400000 ) # SHIPPED → coherent board + forks
( cd "$SANDBOX" && bun run "$VEND" work --no-intervened )        # omit --budget → calibrated cold-start
#   → propose-epic clears (E-001); decompose-epic clears WITH reduced grounding (MCP absent);
#     1 slice cleared (2 stories + 4 tickets); forward-E1 records carry intervened:false.
( cd "$SANDBOX" && bun run "$VEND" svg )                         # populated render currently andons (see above)
```

---

## Why this exists

A hackathon demo is a one-shot; the point of vend is that the *clearing* is repeatable. This gold
master is how that consistency is checked — and it now reads **green across the shipped flow**: a
coherent board off the seed, real forks, and a cleared slice with an honest reduced-grounding marker.
The one open edge (the populated SVG render) is recorded, not hidden — re-run after the decompose
story-numbering follow-up lands and that last row fills green too.
