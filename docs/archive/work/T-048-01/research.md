# T-048-01 Research — wave-budget pure core

**Ticket:** T-048-01 (story S-048-01, epic E-048 cross-branch-budget-wallet)
**Phase:** Research — map the codebase the wave-budget algebra generalizes. Descriptive, not prescriptive.
**HEAD:** `1b2fb6a`

## The problem this ticket lives inside

E-046 gave `castGraph` (`src/engine/graph.ts`) a real concurrent **wave dispatcher**: each topological
ready-set is run together via `Promise.all`. E-047 proved it live (survey → [propose×2] → capture-note
diamond, two casts overlapping). But the macro-budget machinery — the **wallet** + the **spend loop** —
is still **single-chain**: it assumes a *linear sequence* of casts threaded through one wallet. Inside a
concurrent wave, each node authorizes against its own static per-node budget; there is **no shared
accounting**, so two parallel casts both pass affordability against the pre-wave balance and both spend.
The P7 ceiling leaks across branches exactly where concurrency now lives (obs 23279).

T-048-01 is the **pure half** of the fix: the wave-budget *algebra*. T-048-02 threads it into the
impure `castGraph` shell. This ticket adds **no live model, no seam wiring** — only pure functions and
their unit tests.

## The existing per-cast / sequential algebra (what we generalize)

### `src/budget/budget.ts` — the per-cast contract (PURE)
- `interface Budget { readonly timeMs: number; readonly tokens: number }` — the two IA-8 denominations.
- `interface Usage { input_tokens?, output_tokens?, cache_read_input_tokens?, cache_creation_input_tokens? }`
  — the seam's `result.usage` duck-type; all optional, coerced `undefined → 0`.
- `countTokens(usage): number` — the **single definition of "spent"**: sum of all four sub-counts.
  Exported; the one source of truth. (line 117)
- `check`, `timeoutMsFor`, `TIMEOUT_HEADROOM` — per-cast token check + kill-switch headroom. Not in scope
  here but confirm budget stays seam-agnostic and clock-free.

### `src/budget/wallet.ts` — the depleting macro-wallet (PURE)
- `interface Wallet { readonly funded: Budget; readonly remaining: Budget }` — `funded` set once, never
  mutated; `remaining` floors at 0 per denomination.
- `interface DebitResult { readonly wallet: Wallet; readonly overshoot: Budget }` — a debit's outcome:
  the new wallet + per-denomination overshoot (how much actual exceeded remaining; 0 when it fit). (line 54)
- `allocate(macro): Wallet` (line 100) — funds remaining = funded; positive-int guard on each dimension.
- `canAfford(wallet, predicted): boolean` (line 113) — honest **per-denomination**: fits iff
  `predicted.tokens <= remaining.tokens` **AND** `predicted.timeMs <= remaining.timeMs`. `<=` boundary is
  affordable. A non-finite predicted naturally fails → `false` (safe-refuse).
- `debit(wallet, actual: Usage | Budget): DebitResult` (line 126) — subtracts a **single** cleared cast's
  actual; **sums BOTH denominations**; floors each at 0 via `floorNonNeg`; surfaces overshoot via `overBy`.
- **Private helpers** (not exported): `floorNonNeg(n) = Math.max(0, n)` (line 70); `overBy(actual, rem)
  = Math.max(0, actual - rem)` (line 75); `actualToBudget(actual)` (line 86) — normalizes `Usage | Budget`
  to `{tokens, timeMs}` (a `Budget` debits both; a `Usage` debits `countTokens` tokens + `timeMs: 0`),
  discriminated on the presence of a numeric `timeMs`.
- IA-8 (lines 13–20): the meter must not lie about its **two denominations**, never conflated. ⏱ wall-clock
  is a **hard wall** (`canAfford` refuses on time even if tokens fit); ◇ tokens are **detect-after**
  (`debit` floors + surfaces overshoot rather than going negative or throwing).

### `src/engine/spend-core.ts` — the sequential spend decision core (PURE)
- `fitNext<C>(wallet, candidates, priceOf): C | null` (line 93) — the **linear selector**: walks the
  pre-ranked board IN ORDER, returns the FIRST candidate whose predicted price `canAfford`s the wallet;
  **skips an unaffordable head** to reach an affordable tail ("spend the wallet down"); `null` only when
  nothing fits. Generic over `C` (never inspects a candidate, only prices/affords it). Returning a
  candidate **is** the P7 authorization — only an affordable cast is ever offered.
- `shouldContinue(wallet, board, lastOutcome): Continuation` — the three clean stops (andon / board-cleared
  / wallet-exhausted). Not generalized here but the **wallet-exhausted** stop is the conceptual analog of
  a wave whose nodes don't fit.
- Purity discipline (lines 11–18): every import is a TYPE except `canAfford` (itself pure). No fs, clock,
  network, process, seam, or `src/play/`. The whole branching lives here so it is unit-tested as ordinary
  pure functions.

## The concurrent consumer (context only — wired in T-048-02, not here)

### `src/engine/graph.ts` — `castGraph` wave dispatcher
- The **WAVE LOOP** (lines 161–187): each pass computes `wave = order.filter(...)` — the currently-runnable
  ready nodes, **in topo `order`** (which `topoSort` emits in **declaration order**, the deterministic
  tie-break). It partitions into `toSkip` (a halted upstream) and `toRun`, then `await Promise.all(toRun…)`.
- Key fact for this ticket: **the ready-set handed to a wave is already ordered** (topo/declaration order).
  So the pure `authorizeWave` only needs to *walk the set in the given order* — it does not re-sort.
- `castGraph` carries **no shared wallet** today (obs 23279) — each node's budget is independent. Threading
  the shared wallet is T-048-02; this ticket only supplies the algebra it will call.

### `src/engine/dag-core.ts` — `topoSort` (the tie-break authority)
- Kahn's algorithm with a **min-declaration-index** ready-pick (lines 134–150): a fan-out's ready siblings
  emit lowest-declaration-index first → byte-identical order per spec (obs 23133). This is the
  "deterministic order" the ticket references; the wave's ready-set inherits it.

## The two IA-8 denominations DIVERGE under concurrency (the load-bearing fact)

The whole epic turns on this (E-048 lines 39–47):
- **wall-clock** — a wave's branches run **overlapping**, so the wave's elapsed ≈ **MAX(branch times)**, not
  their sum. Concurrency *stretches* the wall-clock budget. ⇒ for a wave to fit wall-clock, **each**
  dispatched node's predicted time ≤ remaining (**each-fits / max-fits**).
- **tokens** — every branch's burn is real and summed (detect-after, IA-8). ⇒ a wave fits tokens only if the
  **cumulative** predicted tokens of the dispatched set ≤ remaining (**collective sum**).

The existing `debit` (sums BOTH) is correct **sequentially** but **over-charges wall-clock** for a
concurrent wave — that is the bug `debitWave` must avoid.

## Test conventions (the gate)

- `src/budget/wallet.test.ts` and `src/engine/spend-core.test.ts`: `import { describe, expect, test } from
  "bun:test"`. **Fabricated inputs only** — no spawn, no fs, no clock. Fixture builders `macro(timeMs,
  tokens)`, `fund(...) = allocate(macro(...))`, `priceTable(table)(c) = table[c]!`.
- Every export and branch is covered; these files are part of `bun run check:test`.
- `bun run check` = `baml:gen && check:typecheck (tsc --noEmit) && check:test (bun test)`. The ticket's
  `bun run check:*` green = typecheck + tests.
- `tsconfig` uses `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (type-only imports must be `import
  type`).

## Constraints & assumptions surfaced

1. **Pure / total / type-only imports**, no fs/clock/seam — same discipline as wallet.ts / spend-core.ts.
   The only runtime import permitted is another pure function (`canAfford`, `debit`, `countTokens`).
2. **Back-compat is asserted:** a **single-element wave must equal the existing `debit`** (max-of-one = that
   one; sum-of-one = that one). And an **empty wave is a no-op**.
3. **Overshoot surfaced once, not double-counted** — the collective token overshoot is reported a single
   time against the one wallet, not per branch.
4. **Reuse, do not duplicate:** `floorNonNeg` / `overBy` / `actualToBudget` are **private** to wallet.ts.
   Any placement that needs them must either live in wallet.ts or delegate to the public `debit` /
   `countTokens`. (This is a real placement constraint, resolved in Design.)
5. **Determinism:** `authorizeWave` walks the ready-set in the **given** order (already topo/declaration
   order from the caller); it must not re-sort.
6. **`canAfford`'s `<=` boundary and safe-refuse-on-non-finite** are the single affordability definition —
   the wave selector should not re-derive a second comparison.
