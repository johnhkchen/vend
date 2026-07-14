# T-045-01 — Structure: the shape of the sweep

This ticket creates **no source files** and modifies **no source code**. The "structure" is the set
of artifacts the operation produces, the commands that produce them, and the order/gates between them.

## Files created (work artifacts)

```
docs/active/work/T-045-01/
  research.md      (done)  — spend path, seams, board state, the self-referential irony
  design.md        (done)  — staged execution, human gate on the irreversible tranche
  structure.md     (this)  — artifact/command blueprint
  plan.md                  — ordered, verifiable steps
  progress.md              — execution record, deviations, the authorization gate
  sweep-log.md             — THE deliverable: verbatim #1 + receipt + cleared ids + ledger delta
  review.md                — handoff
```

## Files mutated by a live run (NOT source — live state)

Only if a tranche actually casts:
- `docs/active/pm/staged/steer.md` — **overwritten** by `vend steer` (Tranche 1). Fresh ranked board.
- `docs/active/epic/E-0XX.md` (+ stories/tickets) — **minted** by `vend work` spend-down (Tranche 2).
- `.vend/runs.jsonl` — **appended** one record per cast (steer, then each propose/decompose).
- `.vend/transcripts/` — appended per cast.

None of these are touched by the planning phases; they move only when a cast fires.

## Command sequence (the blueprint)

```
# Tranche 1 — cheap, runnable (≈$0.76, ~2 min, 1 cast)
bun run src/cli.ts steer            # re-stage fresh board → staged/steer.md
#   read new #1 signal; this is the E-044 test + clears the freshness gate

# --- HUMAN GO/NO-GO GATE (Decision 3) ---

# Tranche 2 — expensive, irreversible, GATED (~$5–10, ~1h)
bun run src/cli.ts work --no-intervened --budget 3600000,1000000
#   spend-down to a clean P7 stop; mints epics, appends forward-E1 records

# Post-sweep confirmations
ls docs/active/epic/                # E-043: no duplicate-title / orphan epic
lisa validate                       # cleared chain(s) DAG-valid, green
tail .vend/runs.jsonl               # forward-E1 records (intervened:false + success)
```

## Boundaries & invariants (what must hold)

- **Freshness gate is the entry invariant.** Tranche 2 must run against a board newer than the live
  state. Tranche 1's re-stage establishes this. If Tranche 2 ran against the stale 17:07 board it
  would (correctly) refuse with `stale-board` — proving the gate, but clearing nothing.
- **Budget is the only bound on spend (P7).** `--budget 3600000,1000000` = ~1h / ~1M tokens, the
  E-039 envelope that cleared 2. The wallet debits actuals; a clean stop is `wallet-exhausted` or
  `board-cleared` (never partial, never overspent).
- **auth == exec (E-025).** The price recalibrated from the ledger must equal the envelope the chain
  runs under. No silent fall-back to a static default.
- **`--no-intervened` ⇒ `intervened:false`** on every appended record — that bit is what makes the
  records *forward* E1 evidence.
- **No orphan (E-043).** Post-sweep, `findExistingByTitle`'s adopt-before-mint must have held: zero
  same-title epic pairs, every minted epic decomposed.

## The decision gate, structurally

The single irreversible commitment is isolated to one boundary (between Tranche 1 and Tranche 2).
Everything before it is cheap and reversible (a staged markdown overwrite); everything after it is
real spend and minted state. The gate is where the human authorization is obtained. The progress.md
records which branch was taken and on whose authority.

## Ordering that matters

1. `steer` **before** any `work` — otherwise the freshness gate refuses (stale board).
2. Human gate **after** reading the fresh #1 — the #1 signal (E-044 verdict) informs the go/no-go.
3. Post-sweep checks **after** the sweep settles — orphan/validate/ledger only meaningful once casts
   have landed.
4. `sweep-log.md` **last** among operational artifacts — it transcribes the real outputs verbatim.
