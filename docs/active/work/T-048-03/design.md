# T-048-03 — Design: How to run the audit and what (if anything) to add

> The "decision" here is small but real: (a) what the audit's coverage verdict is, and
> (b) whether to exercise the optional test-only characterization the ticket permits, or
> deliver the note alone. Grounded in the research, not assumptions.

## The verdict, decided up front

The gate is **green** and the IA-8 two-denomination contract is **fully covered**,
including the single-node back-compat anchor T-048-01 depends on. The audit therefore
delivers a coverage note with a green-with-no-gaps headline. The only behavior that is
*documented but not directly asserted* is `canAfford`'s non-finite "safe-refuse" — a
defensive edge tangential to the core IA-8 contract.

## Option space for the deliverable

**Option A — Note only (audit-pure).** Write `audit.md` mapping each IA-8 behavior to
its covering test plus the `bun run check` result. Touch no `.ts`.
- *Pro:* Maximally faithful to "keep the slice to an audit"; zero risk to a green tree.
- *Con:* Leaves the one documented-but-untested behavior (`canAfford` non-finite
  safe-refuse) uncharacterized — the exact kind of gap an audit exists to surface.

**Option B — Note + one trivial additive characterization test.** Same note, plus a
single test pinning `canAfford(w, {timeMs: Infinity/NaN, ...}) === false` (and the token
mirror). Test-only, additive, no production change.
- *Pro:* Closes the lone documented gap with a 4-line test; demonstrates the audit's
  value concretely; the ticket explicitly permits "a genuinely missing characterization
  test that is trivial and additive."
- *Con:* Changes the green test count; strictly beyond the minimum deliverable.

**Option C — Add a redundant explicit "sum-both" anchor test.** Add a test named for
the T-048-01 back-compat contract even though the behavior is already pinned.
- *Rejected:* The behavior is already asserted (block 4, "depletes both denominations by
  the exact amount"). A second assertion of the same fact is noise, not coverage. The
  right move is to *name* the existing test as the anchor in the note, not duplicate it.

## Decision: **Option B**

Deliver the note as the primary artifact AND add the single trivial characterization
test for `canAfford`'s non-finite safe-refuse. Rationale:

1. It is squarely within the latitude the ticket grants ("MAY be added … trivial and
   additive"), and it is **test-only** — no production code moves, so the audit's
   read-only-on-production constraint holds.
2. The safe-refuse is a *documented* behavior of the hard wall (`canAfford`'s banner
   comment: "A non-finite predicted naturally fails the comparison → false"). A
   documented behavior with no test is precisely a characterization gap. Closing it
   strengthens the IA-8 hard-wall denomination that T-048-01's `authorizeWave` will
   lean on (each-node-time ≤ remaining must safely refuse a non-finite predicted price).
3. It is genuinely trivial (the behavior already works — the test only pins it), so it
   cannot turn the tree red unless the documented behavior is false, in which case
   surfacing that *is* the audit's job.

If, in Implement, the test does not pass cleanly first try (i.e. the documented
behavior is NOT actually true), the fallback is **Option A**: drop the test, and report
the discrepancy as a real finding in the note rather than touching production code to
"fix" it (out of scope for an audit).

## Coverage mapping (the decided verdict, detailed in audit.md)

| IA-8 behavior | Covering test | Status |
|---|---|---|
| wall-clock HARD WALL (`canAfford` refuses over-time) | `canAfford` block: "refuses over on wall-clock", "fits tokens not time (IA-8)", "exact fit `<=` boundary", "depleted affords nothing" | ✅ pinned |
| tokens DETECT-AFTER (`debit` floors at 0 + overshoot) | `debit — token overshoot (IA-8 detect-after)`; `debit — sequence … then floor` | ✅ pinned |
| `debit` applies BOTH denominations per cast (back-compat anchor) | `debit — fitting Budget actual`: "depletes both denominations by the exact amount" | ✅ pinned |
| immutability / funded carried through | `debit — fitting Budget actual`: "carries funded … never mutates" | ✅ pinned |
| `canAfford` non-finite safe-refuse | *(none today)* | ⚠ documented, untested → close via Option B |

## Why this is grounded, not invented

Every row above maps to a `describe`/`test` read directly from `wallet.test.ts` in
Research, and the `bun run check` result (1127 pass / 0 fail) was observed, not assumed.
The one ⚠ row is the only behavior in the source banner with no matching assertion —
which is why it, and only it, is the candidate for the optional additive test.

## Non-goals (held from the epic/story)

- No generalization to waves (`authorizeWave`/`debitWave` are T-048-01).
- No production-code edits to `wallet.ts`.
- No live cast. No new dependencies. No format/`fmtMs` audit beyond noting it is covered.
