# T-037-03 — Plan (settle-the-evidence-and-verdict)

Ordered, independently-verifiable steps. Free + deterministic — every input is a file already on
disk or a pure read of the ledger. No source change, no live cast (T-037-02 already spent the
wallet; this only *reads* what it wrote). Steps 1–2 are pre-completed during Research/Structure
(captured below for reproducibility); steps 3–5 are the Implement phase.

## Testing strategy

There is **no new code**, so no new unit tests. Verification is:
- **Reproducibility of the number** — `vend audit` re-read yields the same forward 3/4 (it reads an
  append-only ledger; deterministic).
- **Citation audit** — grep the verdict for any bare combined figure (16/17, 94%, "14/15",
  "forward-confirmed") used as a *forward* claim → must be **zero** such uses.
- **Deterministic gate** — `bun run check:*` green (typecheck + lint + tests), proving the docs edits
  broke nothing and the repo stays shippable.

## Step 0 — Inputs confirmed (Research/Structure) ✅

- `work/T-037-02/sweep-log.md` read: honest 0-clear, twin `andon: timed-out`, nothing minted,
  auth==exec held, ledger 25→28 (#27/#28 forward-censored).
- `src/ledger/walk-away.ts:160` `auditWalkAway` + forward/attested split (E-028) confirmed via
  codebase-memory `search_code` (not raw grep) — coordinates match the ticket.
- `work/T-026-04/verdict.md` read: the over-count correction (combined ≠ forward) — the standard.
- `demand.md` Frontier 1 read: the In-flight row + signal to update.

## Step 1 — Re-run `vend audit`, capture forward-only ✅

```
$ bun run src/cli.ts audit
    └ forward (live): 75% (3/4 untouched) · attested back-fill: 100% (13/13 untouched)
```

Record: forward **1/2 → 3/4** (50% → 75%); sample **2/10 → 4/10**; **+2** genuine forward records
(#27, #28), **both censored** (`timed-out`), **0 cleared**. Combined 16/17 noted only to *exclude*
it from any forward claim.

## Step 2 — Verify the ledger classification ✅

`tail -6 .vend/runs.jsonl` confirms #27/#28 = `propose-epic outcome=timed-out intervened=false
attested=undefined` ⇒ forward (live), untouched, censored. Matches `auditWalkAway`'s 3/4.

## Step 3 — Write `verdict.md` (the deliverable)

Render the five-part shape from `structure.md`. Hard rules enforced inline:
- forward-only citations (3/4, 4/10); the combined number appears **once**, explicitly labelled "do
  not cite as forward."
- "watched" (live P4/P7) and "confirmed" (≥10 bar) kept as **separate** claims; only the first is
  earned.
- the call: **go provisional + forward-leaning**, named cadence to ≥10, the `propose-epic`
  time-censor named as the gating blocker.
- Verify after write: `grep -nE "forward-confirmed|14/15|16/17|94%"` returns only the explicitly
  quarantined mention(s), never a forward claim.

## Step 4 — Update `demand.md` Frontier 1 (honest crystallize)

Two surgical edits — the **In-flight** table row and the **Frontier 1 signal** bullet:
- mark the keystone **watched** (feature demonstrated live, P4/P7) — not cleared.
- move the forward evidence: **1/2 → 3/4 (sample 2/10 → 4/10)**, flagging the +2 are **censored**.
- name what remains to ungate: the **≥10 cadence** + clear the `propose-epic` per-step time-censor.
- keep board discipline (lean; do not balloon the row).
- Verify: `lisa validate` still green (board parses, DAG valid).

## Step 5 — Deterministic gate + progress

```
$ bun run check:*          # typecheck + lint + tests — must be green
$ lisa validate            # board/DAG sanity after the demand.md edit
```

Update `progress.md` with each step's outcome and any deviation (notably: the authoring-vs-reality
0-clear pivot, already absorbed in Structure). Then Review.

## Rollback / risk

- **Risk:** none to runtime — docs only. Worst case a wording fix to `verdict.md`/`demand.md`.
- **The one real hazard is rhetorical** — over-claiming. Mitigated by Step 3's grep gate and the
  T-026-04 standard quoted in the verdict.
- **Reproducibility:** the audit reads an append-only ledger; re-running yields the same 3/4. If a
  later cast appends records the number will move — the verdict cites the ledger state *as of
  2026-06-20*, stamped.
