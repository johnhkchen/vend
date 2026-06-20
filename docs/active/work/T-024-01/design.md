# T-024-01 Design — depleting-wallet

Decisions, with rationale, grounded in the research. One choice per question; rejected
alternatives recorded.

## D1 — Where the module lives

**Decision: `src/budget/wallet.ts`** (+ `src/budget/wallet.test.ts`).

The wallet reuses `Budget`, `Usage`, `countTokens` from `budget.ts` and is the *macro*
analogue of the per-cast budget: same two denominations, same purity contract, same test
shape (`budget.test.ts` is right next door as the gate). Co-locating keeps the
denomination types and the depleting algebra in one package.

- *Rejected: `src/ledger/wallet.ts`.* The ledger is about *measured history*
  (recalibrate/calibrate read the run log). The wallet holds *no history* — it is a
  live, depleting value. It belongs with the budget primitive, not the recalibration
  consumer. (It will be *fed* by the ledger's `recalibrate` output via T-024-02, but
  that composition happens at the loop, not inside the wallet.)
- *Rejected: new `src/wallet/` package.* Overkill for one pure module that is a thin
  extension of `budget.ts`; would force a cross-package import of `Budget`/`countTokens`
  for no isolation benefit.

## D2 — The Wallet representation

**Decision: a `Wallet` is exactly a remaining `Budget` plus its original allocation.**

```ts
interface Wallet {
  readonly funded: Budget;     // the macro allocation made once (immutable record)
  readonly remaining: Budget;  // what is left to spend, per denomination
}
```

`remaining` is the live, depleting half; `funded` is kept so `formatWallet` can show
"spent / funded" and so a "spent" fraction is derivable without the caller threading the
original total. Both are `Budget` (positive-int dimensions; remaining floors at 0 —
note 0 violates `assertPositiveInt`, so the *wallet* uses its own non-negative coercion
for `remaining`, not budget's positive-int guard — see D5).

- *Rejected: Wallet = just a `Budget` (remaining only).* Loses the denominator;
  `formatWallet` could not show "spent of funded" and the loop could not report a
  burn-down fraction without re-passing the original. Cheap to keep `funded`; keep it.
- *Rejected: track cumulative `spent` instead of `remaining`.* Equivalent information,
  but `canAfford`/`remaining` want the *remaining* number directly and far more often
  than the spent number; storing remaining makes the hot path a comparison, not a
  subtraction. `spent = funded − remaining` is a trivial derivation for the readout.

## D3 — `canAfford` honesty (per denomination)

**Decision: `canAfford(wallet, predicted: Budget): boolean` returns
`predicted.tokens <= remaining.tokens && predicted.timeMs <= remaining.timeMs`.**

A cast fits **only if it fits on both denominations** (IA-8: the two are never
conflated; the ticket's "fits on tokens but not wall-clock does **not** fit"). `<=` not
`<`: spending exactly what remains is affordable (mirrors `check`'s `spent === ceiling`
is `ok`, budget.ts lines 99–108).

- *Rejected: returning a richer per-denomination verdict object from `canAfford`.* The
  ticket types it as `boolean`. A structured "why it doesn't fit" belongs to T-024-02's
  decision core (`fitNext`/`shouldContinue`), not the primitive. Keep `canAfford` a
  boolean; expose `remaining` for callers that want the detail.

## D4 — `debit` input: `Usage | Budget`

**Decision: `debit(wallet, actual: Usage | Budget): DebitResult`** accepts both shapes.

- A **`Budget`** actual (`{ timeMs, tokens }`) debits both denominations directly.
- A **`Usage`** actual (seam's `result.usage` duck-type) carries only tokens; its token
  cost is `countTokens(actual)` (reuse — one source of truth) and it debits **tokens
  only**, leaving wall-clock untouched (Usage has no time field). This is the path the
  loop uses when it has the seam's usage but threads wall-clock separately, OR the loop
  composes a `Budget` actual from measured ms + usage and passes that.

Discrimination: a `Budget` has a `timeMs` number; a `Usage` does not. Narrow on
`"timeMs" in actual` (and `"tokens" in actual`). Document that `{ timeMs, tokens }`
is treated as a Budget; the four-field token shape is a Usage.

- *Rejected: two functions `debitBudget` / `debitUsage`.* The ticket names a single
  `debit` taking `Usage | Budget`. A union with an internal narrow keeps the call site
  uniform for the loop. (Internally it normalizes to a `{ tokens, timeMs? }` delta.)

## D5 — Flooring & overshoot (the IA-8 core)

**Decision: `debit` floors each remaining denomination at 0 and returns the wallet plus
a per-denomination overshoot report.**

```ts
interface DebitResult {
  readonly wallet: Wallet;        // remaining floored at 0 on both denominations
  readonly overshoot: Budget;     // { tokens, timeMs } by which actual exceeded remaining
}                                  //   (0 when the cast fit; > 0 = detect-after overrun)
```

Per denomination: `newRemaining = max(0, remaining − actual)`;
`overshoot = max(0, actual − remaining)`. Exactly one of the two is non-trivial.

Rationale (IA-8, research §5):

- **Tokens are detect-after.** A cleared cast's actual tokens can exceed what remained
  (the burn is sunk — the cast already ran). Floor remaining at 0 *and* surface the
  overshoot so the loop/readout can report the overrun honestly (echoes `check`'s
  `overage`, budget.ts lines 110–116). This is the load-bearing case the ticket calls
  out: "an actual that overshoots the remaining tokens floors and reports the overshoot."
- **Wall-clock is a hard wall.** In honest operation the loop won't *start* a cast it
  can't afford on time, and the seam halts at the wall — so a time overshoot should be
  rare/zero. But the algebra floors and reports it symmetrically rather than trusting the
  caller: an honest meter never silently goes negative on *either* denomination.

`overshoot` as a `Budget`-shaped pair keeps "never one bar" (IA-8) — both denominations
reported separately, never summed.

- *Rejected: throw on token overshoot.* Budget treats token exhaustion as a *returned*
  andon, not an exception (budget.ts lines 11–14, 44–57): "token exhaustion is the
  expected terminal state… a returned andon, not a thrown error." A spent wallet
  overshooting is the *expected* end of a depleting budget (IA-9/10 — a successful
  refusal, not a failure). Return data; never throw on depletion.
- *Rejected: `debit` returns just a `Wallet` and drops the overshoot.* Then the
  detect-after overrun is lost — the meter would lie by omission (IA-8). The ticket
  explicitly requires the overshoot be "honestly surfaced." Return both.
- *Rejected: clamp the overshoot into a signed remaining (let remaining go negative).*
  "Never goes negative-silently, floors at zero" (ticket). A negative remaining would
  also break `formatWallet`'s burn-down and any positive-int contract. Floor + separate
  overshoot is the honest split.

## D6 — `remaining` and `formatWallet`

**Decision:**

- **`remaining(wallet): Budget`** — returns `wallet.remaining` (a trivial accessor, but
  named per the ticket so callers don't reach into the struct; keeps the field private in
  spirit and gives a stable surface).
- **`formatWallet(wallet): string`** — a single honest line showing **both
  denominations**, each as `spent / funded` with what remains, never collapsed to one
  bar (IA-8). Shape mirrors `formatEnvelopeLabel` (recalibrate.ts 173–180): terse,
  truthful, distinct glyphs for the two denominations (⏱ time, ◇ tokens — the IA-8
  symbols). Example: `◇ 40k/100k spent · 60k left   ⏱ 12m/30m spent · 18m left`.
  Exact formatting (k-suffixing, ms→human) decided in Structure; the *contract* is: two
  denominations, truthful at every step, never one bar.

- *Rejected: `formatWallet` returns structured data.* It is a *readout* (the name says
  format); T-024-03 renders it in the production line. A string is the right surface;
  callers wanting numbers use `remaining`.

## D7 — `allocate` and validation

**Decision: `allocate(macro: Budget): Wallet`** validates each dimension as a positive
finite integer (reuse budget's `assertPositiveInt` contract — a zero/negative macro
allocation is a caller error, surfaced loudly with `RangeError`), then returns
`{ funded: macro, remaining: macro }`.

After allocation, `remaining` *may* legitimately reach 0 via debit — so the **non-zero**
guard applies only to `allocate` (the initial fund), never to `remaining` mid-life. The
wallet uses a local `nonNegative`/`floor` coercion for debited remainings (0 allowed),
distinct from budget's `assertPositiveInt` (0 forbidden). This is the one deliberate
divergence from budget.ts and is documented in the module header.

- *Rejected: re-export / call `timeoutMsFor`/`check`.* Not needed — the wallet is the
  macro layer; per-cast time enforcement is the seam's job, per-cast token check is
  `check`'s. The wallet only does macro algebra.

## D8 — Purity & imports

**Decision:** no fs/clock/network/process. Import `Budget`, `Usage` **type-only** from
`./budget.ts`; import `countTokens` as a value (it is pure). Mirror the module-header
comment style of budget.ts/recalibrate.ts stating the purity contract and the one
deliberate `assertPositiveInt`-vs-floor divergence (D7). This preserves the zero-coupling
discipline and makes `bun run check:*` green by construction (pure module, fully unit
tested).
