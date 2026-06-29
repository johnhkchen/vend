# T-060-02-02 — Plan

Ordered, independently-verifiable steps. Gate after each: `bun run check` (baml:gen + `tsc --noEmit`
+ `bun test`). One atomic commit at the end (the four code files + two docs are one coherent wiring).

## Step 1 — Pure resolver + quote renderer (`work-core.ts`)
Add `WorkBudgetPlan`, `makeWorkBudgetPlan`, `planWorkBudget`, `renderBudgetQuote` + the three imports.
- `makeWorkBudgetPlan(quote, source, override?)`: `{ funded: override ?? quote, quote, source, usedDefault: override === undefined }`.
- `planWorkBudget(...)`: `const { envelope, source } = coldStartEnvelope(drivePlays, records, tier, prior); return makeWorkBudgetPlan(envelope, source, override);`.
- `renderBudgetQuote(plan, opts?)`: `funding the first clear · <fmtCost(plan.quote)> · <provenance>`,
  provenance = `measured` | `estimate (cold start — no history yet)`.
- **Verify:** `tsc --noEmit` clean; nothing imports it yet, so no behavior change.

## Step 2 — Test the resolver, quote, and the driven loop (`work-core.test.ts`)
Add the `describe` from structure §Tests (5 cases). Local `recordOf` (over `buildRunRecord`) + a stub
`castOne`.
- The driven-loop case uses the real `spendDown` (addon-free) + `allocate` with `plan.funded` and
  `priceOf: () => plan.quote`, asserting `cleared >= 1` and first step success.
- **Verify:** `bun test src/play/work-core.test.ts` green. This is the executable AC.

## Step 3 — Wire the default into the shell (`work.ts`)
Reorder `loadRunLog`/`prior` above the allocation; compute `cold = coldStartEnvelope(...)` once;
`price = cold.envelope`; `funded = makeWorkBudgetPlan(cold.envelope, cold.source, opts.budget).funded`;
funding legs from `cold.perPlay`; add `onPlan`; emit it before the loop. Delete `DEFAULT_MACRO_BUDGET`,
`sumBudgets`, the `recalibrate` import.
- **Verify:** `tsc --noEmit` clean (catches the removed-symbol references in cli.ts at step 4).

## Step 4 — Wire the CLI (`cli.ts`)
Drop `DEFAULT_MACRO_BUDGET` from the lazy import; add `renderBudgetQuote`; mutable `funded`; pass
`budget` only when present; `onPlan` prints the quote (when `usedDefault`) + captures `funded`; final
wallet from `result.funded`.
- **Verify:** `bun test src/cli.test.ts` green (parse surface unchanged); `tsc --noEmit` clean.

## Step 5 — Correct the seed docs (`README.md`, `shelf-note.md`)
Replace the "defaults to 2h/2M" claims with the calibrated-cold-start-clear framing. Do NOT touch
`EXPECTED-OUTCOME.md` (T-060-03-01).
- **Verify:** grep shows no remaining "2 hours / 2M" / `DEFAULT_MACRO_BUDGET` in the two files.

## Step 6 — Full gate + commit
- **Verify:** `bun run check` → all green, typecheck clean. Then one commit:
  `feat(work): default vend work budget to the calibrated cold-start envelope (T-060-02-02)`.

## Testing strategy

- **Unit (pure):** `makeWorkBudgetPlan` / `planWorkBudget` over fabricated ledgers — the resolution +
  provenance + `usedDefault`; `renderBudgetQuote` text.
- **Integration (addon-free):** `spendDown` with `allocate(plan.funded)` + a stub `castOne` —
  the literal "drives vend work on the seed with that default → ≥1 clears, no instant
  budget-exhausted." `work.ts`/`cli.ts` are NOT value-imported (BAML addon) — their wiring is covered
  by the pure units they delegate to + `tsc`, the house pattern (`castWork` is proven live, here at
  T-060-03-01).
- **Verification criteria (AC):** (1) the driven-loop test clears ≥1 with `plan.funded` and no
  budget-exhausted-before-clear; (2) `plan.quote` deep-equals `coldStartEnvelope().envelope` and is <
  the funding envelope when censored tails inflate it (p90 price, no headroom).

## Rollback / blast radius
All changes are additive (work-core) or local rewires (work.ts default line, cli.ts arm, two doc
lines). `DEFAULT_MACRO_BUDGET` removal touches only the two files that referenced it. Reverting the
single commit restores the hand-picked default with no schema/ledger migration.
