# Expected outcome — the gold master (captured from a real live drive)

> ✅ **CAPTURED, NOT A TARGET.** These are the real numbers from the first live metered drive of this
> seed (T-058-05, **2026-06-21**). Host: macOS (darwin). Executor: `claude` (model
> `claude-opus-4-8`). Throwaway sandbox (the committed template was not mutated). Total real spend:
> **$0.91** across 4 metered casts. The drive is **honest-on-outcome**: it records what the *shipped*
> seed + `vend init --template hackathon` actually produce today — including where they fall short.

This file is the **re-runnable consistency bar**: drive the seed again and the outcome should be
*comparable* to what's captured here. The exact commands are in the re-run block at the bottom.

---

## Headline verdict (the A3 finding)

The **shipped** flow — copy the seed → `lisa init` → `vend init --template hackathon` → `vend steer`
— produces an **honest-empty steer** (no board, no forks), **not** a coherent board. The A3 risk
**materialized**: `vend steer` is wired to read its intent from `docs/knowledge/charter.md` + the
board snapshot, and the seed's `SEED.md` is **never in steer's input path** — so steer correctly
finds "no demand gradient" and abstains. The seed's own docs promise "_`vend steer` reads [the seed]
to propose a ranked board_," but the implementation (`assembleSteerInputs` in `src/play/steer.ts`)
does not read `SEED.md`.

The good news: the **machinery is sound**. A diagnostic re-steer with the seed's intent placed where
steer reads it produced a genuinely coherent board + real forks (below), and `vend work` then minted
a real grounded epic. The E-044 self-referential-demotion fix **held** — steer abstained honestly
rather than ranking the template's own scaffolding as junk. The gap is **input wiring**, not the
articulation engine.

---

## What the drive actually yielded

| What | Target | Actual (live) |
| --- | --- | --- |
| Board items off the seed (shipped flow) | a coherent ranked set | **0 — honest-empty steer** (A3 finding) |
| Board items off the seed (intent wired — diagnostic) | a coherent ranked set | **4** (Keystone→High→Standard→Leaf), all grounded in `SEED.md` |
| Forks framed (diagnostic) | a handful of genuine ones | **2 genuine forks**, each 2–3 options + a recommendation |
| Slices cleared | ≥ 1 | **1 epic minted (E-001), decompose refused** (MCP gap — see below) |
| Budget spent (ms, tokens) | within the funded envelope | steer **12.4k tok / ~31 s**; propose-epic **~110k tok / 42 s**; total **$0.91** |
| Forward-E1 record accrued | yes | **yes** — propose-epic + decompose-epic records carry live `intervened: false` |

### The coherent board (diagnostic re-steer)

A ranked, leverage-ordered board, every signal grounded in a `SEED.md` quote about the team-finder:

1. **Keystone** — Build the team-finder page: rank+render the people who overlap most with a
   reference attendee from a few inline sample profiles. (the whole demo; nothing to show without it)
2. **High** — Add an attendee self-entry form that recomputes matches live. (closes the seed's "find
   a team in minutes" promise; blocked on the keystone)
3. **Standard** — Author a richer ~8–12 attendee dataset so the ranking is legible in the demo.
4. **Leaf** — Persist an entered profile to localStorage / a shareable URL.

### The genuine forks (verbatim sample)

> **Fork — What does a 'match' mean — shared overlap on both skills and idea, or complementary skills
> around a shared idea?** Options: (1) shared overlap; (2) complementary skills + shared idea (a dev
> finds a designer); (3) hybrid: require a shared idea, then rank by complementarity. *Vend
> recommends:* shared overlap for the first slice — it matches the seed's literal wording and ships
> fastest.

(The second fork: _demo centerpiece — a static ranked list first, or the interactive self-entry
experience first?_ — recommends static-first for a guaranteed showable slice.)

### The cleared cast (`vend work`)

With an adequate budget, `vend work` priced the board, pulled the keystone, and cast the
propose→decompose chain. **propose-epic cleared** — all three gates (value / bounds / structural)
passed and it minted **`E-001 team-finder-match-page`** (advances charter H1/H2), with a forward-E1
record. **decompose-epic then refused** with a clean amber andon: **`missing-capability — required
MCP absent from project registry: codebase-memory-mcp`** — the freshly-`lisa init`'d sandbox has no
`.mcp.json` wiring that MCP, which the clearing chain requires. A *successful* refusal (exit 0),
not a crash; the epic was proposed but not decomposed into stories/tickets.

### The SVG board (the designer's view)

`vend svg` renders correctly end-to-end: on the empty board it writes a valid honest-empty SVG; it
loads the live graph (it sees E-001). It shows **0 cards** here because the work-graph view renders
decomposed *slices* (stories/tickets) and the decompose step was refused — so there is nothing
populated to draw. The visual path is confirmed; it had no decomposed work to show.

---

## What this means for the seed/seam — three follow-ups

1. **Wire the seed's intent into steer's input path (the A3 fix).** `vend init --template hackathon`
   must place the tuned charter + the seed idea at `docs/knowledge/charter.md` (the path steer
   reads), or `steer`/`survey` must read `SEED.md`. Today the overlay registry writes only a stub
   `SEED.md` (`src/init/init-core.ts`), and the rich tuned `charter.md` lands at the project root
   where steer never reads it. **Without this fix the shipped two-gesture drive yields an empty
   steer.**
2. **Fund time generously (the budget-shape finding).** The cold-start propose→decompose chain
   prices at **~120 min on the time axis**; the denomination-separate wallet (IA-8) refuses to fund a
   pull whose price exceeds *either* axis. A tight `--budget … ,<small-ms>` funds **nothing**. The
   seed's drive script should use the 2 h default (or document the cold-start price).
3. **Wire `codebase-memory-mcp` into the seed (the capability finding).** The clearing chain requires
   it; a fresh seed/lisa-init project lacks it, so a pull proposes an epic but cannot decompose. The
   template needs a `.mcp.json` (or the chain must degrade for non-vend projects).

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
( cd "$SANDBOX" && bun run "$VEND" steer --budget 600000,150000 ) # → honest-empty steer (A3)
# Diagnostic — prove the machinery once the intent is where steer reads it:
( cd "$SANDBOX" && cat charter.md SEED.md > docs/knowledge/charter.md \
                && bun run "$VEND" steer --budget 600000,150000 )  # → coherent board + forks
( cd "$SANDBOX" && bun run "$VEND" work --budget 7300000,500000 --no-intervened --stale-ok )
#   → propose-epic clears (E-001), decompose andon: missing codebase-memory-mcp
```

---

## Why this exists

A hackathon demo is a one-shot; the point of vend is that the *clearing* is repeatable. This gold
master is how that consistency is checked — and the first honest measurement says the seed isn't yet
fully drivable end-to-end on the shipped path. The articulation engine is proven (a coherent board,
real forks, a grounded epic). Three small wiring fixes (above) close the gap between what the seed
*promises* and what it *delivers*. Re-run after those land and this table should fill green across the
shipped flow.
