# T-039-02 — Structure (artifacts, mutations, ordering)

The blueprint. This ticket writes **documents** and performs **one board-hygiene deletion**; it does
not touch `src/`. Below: every file created/modified/deleted, the runtime read, and the order that
matters.

## Files CREATED (work artifacts)

```
docs/active/work/T-039-02/
  research.md   — terrain + ground-truth ledger read (done)
  design.md     — six settle decisions (done)
  structure.md  — this file
  plan.md       — ordered steps + verification
  progress.md   — execution log (Implement)
  verdict.md    — THE DELIVERABLE: the honest settle (AC #3)
  review.md     — handoff self-assessment
```

## Files MODIFIED

```
docs/active/demand.md   — Frontier 1 crystallized honestly (AC #4):
                          · "In flight" row: E-039 re-sweep → settled (cleared 2)
                          · Frontier 1 narrative: watched CLEARING; forward 8/10 (4 cleared,
                            was 4/10 all censored); E-038 proven live; cadence to ≥10; cites updated
```

## Files DELETED

```
docs/active/epic/E-041.md   — the duplicate orphan (Decision 4). Childless, not in ledger, dup of
                              E-042's title. Verified no inbound references before deletion.
```

## Runtime READ (no mutation)

- `bun run src/cli.ts audit` — already read this session (the forward split). Reproducible; the
  verdict cites it verbatim. **No ledger append** (audit is read-only).
- `lisa validate` — re-run **after** the E-041 deletion to confirm the board stays green.

## `verdict.md` — section blueprint (the deliverable)

Title encodes the call up front (T-037-03 pattern): **watched CLEARING, provisional + forward-leaning
(8/10 sample · 4 cleared), NOT forward-confirmed.**

1. **Headline — two claims kept separate.** (a) CLEARING earned/new; (b) NOT forward-confirmed (held).
2. **Read 1 — cleared vs censored, forward-only.** The first cleared record (#30) distinguished from
   the censored prior (#28). Forward 88% (7/8); **4 cleared** (30–33). Combined 95%/21 cited once, to
   exclude (T-026-04 trap). The 4/10-all-censored → 8/10-with-4-cleared delta table.
3. **Read 2 — clear quality + E-038 effect.** E-040/E-042 sound & grounded (decomposed, validate
   green) vs self-referential. **propose FINISHED** (93 s/83 s past 72,785 ms) = E-038 live. **P7
   held**, **auth==exec held (E-025).** The E-041 orphan adjudicated (deleted).
4. **Read 3 — the call + cadence.** Provisional + forward-leaning; the two-denomination cadence
   (8/10 reports; 4→10 cleared); no over-claim. Carry-forwards: idempotent-mint guard, ranker demote.
5. **Bottom line.** One paragraph: machinery now proven *clearing*, trust claim unembellished.

## Ordering (where it matters)

1. Research → Design → Structure → Plan (planning; done/in-progress).
2. **Implement**, in this order:
   a. Re-confirm the audit read (already captured; re-runnable).
   b. **Delete `E-041.md`**, then **`lisa validate`** → confirm green. (Delete before validate so the
      board state the verdict describes is the post-cleanup truth.)
   c. Write `verdict.md` (cites the post-cleanup board + the forward read).
   d. Update `demand.md` Frontier 1.
   e. `bun run check:*` green (AC #5) — re-confirm after edits (no source touched, expected green).
3. **Review** → `review.md`.

## Invariants the structure must preserve

- **Forward-only citations** in `verdict.md` and `demand.md`. Combined pool only ever named to exclude.
- **"Cleared" = success ∧ untouched**, never just untouched.
- **No source `src/` edits** — gates stay green by construction.
- **Deletion is reversible & referenced-free** — E-041 confirmed childless before removal; `lisa
  validate` green after is the receipt.
- **No frontmatter/phase edits** — Lisa owns transitions; this ticket only writes artifacts + board.
