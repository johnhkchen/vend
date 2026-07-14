# T-024-03 Structure — `vend work` counter gesture

The blueprint: files, interfaces, boundaries, ordering. Not code — the shape of the code.

## Files

| File | Action | Purity | Tested by |
|------|--------|--------|-----------|
| `src/play/work-core.ts` | **create** (~120 lines) | PURE, addon-free | `work-core.test.ts` |
| `src/play/work-core.test.ts` | **create** (~110 lines) | test | — |
| `src/play/work.ts` | **create** (~110 lines) | IMPURE shell | live (AC#3), not unit |
| `src/cli.ts` | **modify** | PURE parser + impure arm | `cli.test.ts` (parser) |
| `src/cli.test.ts` | **modify** (+~30 lines) | test | — |

No deletions. No engine/wallet changes — T-024-02 confirmed all seams are in place.

## `src/play/work-core.ts` — the pure core

Imports: `type Budget` (budget.ts); `type Wallet`, `formatWallet` (wallet.ts — value import, pure);
`type SessionResult, type StepSignal` (engine/spend-core.ts, type-only). No addon, no fs.

```ts
/** Parse the staged board's ranked `vend chain "<signal>"` lines into signal strings, in file
 *  order (already ranked highest-leverage-first, IA-1). Matches lines of the form
 *  `vend chain "…"` with an optional trailing ` # comment`; the inner text never contains a
 *  literal `"`, so the wrapping quotes are unambiguous. A board with none → []. PURE/TOTAL. */
export function parseBoardSignals(md: string): string[]

/** The production-line label (IA-7) for a signal: its "what" half (text before the first ` — `),
 *  trimmed, truncated to `max` with `…`. No separator ⇒ the whole signal, truncated. PURE/TOTAL. */
export function labelForSignal(signal: string, max?: number): string  // max default 80

/** One IA-7 production-line line: an arrow (`▶` start / `✓` done) + the candidate label + the
 *  two-denomination wallet meter (IA-8) via `formatWallet({ funded, remaining: s.remaining })`.
 *  `funded` is threaded in (not on StepSignal). PURE. */
export function formatStepSignal(s: StepSignal, funded: Budget): string

/** The Settle receipt (IA-6): header · one line per cleared/andon'd cast with its cost · the final
 *  wallet (formatWallet) · the stop reason (amber when `andon`, IA-9, never red). `opts.color`
 *  (default false) gates ANSI so the text is asserted plainly in tests. PURE. */
export function renderReceipt(result: SessionResult, wallet: Wallet, opts?: { color?: boolean }): string
```

Internal pure helpers (module-private): `amber(s, on)` (ANSI 33 when `on`, else identity);
`fmtCost(b: Budget)` (compact `◇<tokens> ⏱<ms>` for a per-cast cost line — small, local; does not
need wallet's k/h suffixing, raw is fine for a cost line, but may reuse the same shape for parity).

`parseBoardSignals` regex: `/^vend chain "(.*)"(?:\s+#.*)?$/` applied per trimmed line. Greedy `.*`
to the last `"` (the closing quote — comments carry no `"`). Returns the capture group per match.

## `src/play/work.ts` — the impure shell

Imports (value): `allocate` (wallet.ts); `spendDown`, `type SessionResult`, `type StepSignal`
(engine/spend.ts); `castProposeDecomposeChain` (chain-propose-decompose.ts — pulls the addon);
`proposeEpicPlay` (propose-epic.ts), `decomposeEpicPlay` (decompose-epic.ts); `recalibrate`
(ledger/recalibrate.ts); `budgetForTier` (shelf/gather.ts); `loadRunLog` (log/run-log.ts);
`parseBoardSignals`, `labelForSignal` (work-core.ts); `type Budget` (budget.ts); `readFile`
(node:fs/promises), `join` (node:path).

```ts
/** The "fund it, walk away for two hours" default macro budget when `--budget` is omitted (D6). */
export const DEFAULT_MACRO_BUDGET: Budget = { timeMs: 7_200_000, tokens: 2_000_000 }

/** Staged boards tried in order when no explicit `--board` is given (steer first, then survey). */
const DEFAULT_BOARDS = ["docs/active/pm/staged/steer.md", "docs/active/pm/staged/survey-board.md"]

export interface WorkOptions {
  readonly budget?: Budget           // omitted ⇒ DEFAULT_MACRO_BUDGET
  readonly boardPath?: string        // omitted ⇒ DEFAULT_BOARDS fallback
  readonly projectRoot?: string      // default process.cwd()
  readonly model?: string
  readonly onStep?: (s: StepSignal) => void
}

/** The result `castWork` reports back as DATA (the CLI renders it). Tagged: a missing/empty board
 *  is a clean precondition outcome (CLI → stderr, exit 1), a settled session is the receipt. */
export type WorkResult =
  | { readonly kind: "no-board"; readonly tried: readonly string[] }
  | { readonly kind: "empty-board"; readonly boardPath: string }
  | { readonly kind: "spent"; readonly session: SessionResult; readonly funded: Budget }

/** Read the staged board, build the four injected edges, drive `spendDown`, return the session.
 *  IMPURE (fs + ledger + casts). Not unit-tested — its parse/render is work-core (tested), its
 *  loop is spend.ts (the tested core + wallet), its cast is the tested chain; proven LIVE (AC#3). */
export async function castWork(opts?: WorkOptions): Promise<WorkResult>
```

`castWork` body (the wiring, in order):
1. `root = opts?.projectRoot ?? process.cwd()`; resolve the board: if `opts.boardPath`, try it
   only; else try `DEFAULT_BOARDS` (joined under `root`) in order. First that reads → its text;
   none readable (ENOENT) → `{ kind: "no-board", tried }`.
2. `candidates = parseBoardSignals(text)`; empty → `{ kind: "empty-board", boardPath }`.
3. `funded = opts?.budget ?? DEFAULT_MACRO_BUDGET`; `wallet = allocate(funded)`.
4. `{ records } = await loadRunLog()`; `price = sum(recalibrate(proposeEpicPlay.name,…).envelope,
   recalibrate(decomposeEpicPlay.name,…).envelope)` at tier `"standard"` with `budgetForTier`.
5. `session = await spendDown({ wallet, candidates, priceOf: () => price, castOne: (signal) =>
   castProposeDecomposeChain({ signal, projectRoot: root, model: opts?.model }), labelOf:
   labelForSignal, ...(opts?.onStep ? { onStep: opts.onStep } : {}) })`.
6. `return { kind: "spent", session, funded }`.

Private helper `sumBudgets(a, b): Budget` = `{ timeMs: a.timeMs + b.timeMs, tokens: a.tokens +
b.tokens }`.

## `src/cli.ts` — parser + dispatch arm

**USAGE** — add a line after the `steer` line:
`"       vend work [--budget <ms>,<tokens>] [--board <path>]\n" +`

**`ParsedCommand`** — add a union member:
```ts
| { readonly cmd: "work"; readonly budget?: Budget; readonly board?: string }
```

**`parseArgs`** — add a route before `parseSelectOrBrowse`:
`if (argv[0] === "work") return parseWorkArgs(argv);`

**`parseWorkArgs(argv): ParsedCommand`** (PURE) — flags-only, modeled on `parseSurveyArgs` but with
two flags: walk `argv` from i=1; `--budget` → capture next (track `sawBudgetFlag`); `--board` →
capture next, missing/`--`-led ⇒ `usage: missing --board <path>`; any other token ⇒ `usage:
unexpected work argument: <a>`. After the loop: parse `budgetVal` via `parseBudgetArg` in try/catch
(error → usage); `sawBudgetFlag && undefined` ⇒ `usage: missing --budget …`. Return
`{ cmd: "work", ...(budget ? { budget } : {}), ...(board ? { board } : {}) }`.

**Dispatch arm** (in `import.meta.main`, alongside the other verbs):
```ts
if (parsed.cmd === "work") {
  const { castWork, DEFAULT_MACRO_BUDGET } = await import("./play/work.ts");
  const { renderReceipt, formatStepSignal } = await import("./play/work-core.ts");
  const funded = parsed.budget ?? DEFAULT_MACRO_BUDGET;
  const result = await castWork({
    budget: funded,
    ...(parsed.board ? { boardPath: parsed.board } : {}),
    onStep: (s) => process.stdout.write(`${formatStepSignal(s, funded)}\n`),
  });
  if (result.kind === "no-board") { stderr(`no staged board found (tried ${result.tried.join(", ")}) — run \`vend steer\` or \`vend survey\` first`); exit 1 }
  if (result.kind === "empty-board") { stderr(`staged board ${result.boardPath} has no signals to spend on`); exit 1 }
  process.stdout.write(`${renderReceipt(result.session, { funded, remaining: result.session.remaining }, { color: true })}\n`);
  process.exit(0);  // a settled session is success — an andon is a refusal, not a crash (IA-9/D7)
}
```
Lazy imports keep `work.ts` (and its addon) off the pure-parse path, exactly as every other arm.

## `src/cli.test.ts` — parser tests

A `describe("parseArgs work")` block: optional/absent `--budget` (defaults — absent ⇒ no `budget`
key); valid `--budget`; malformed `--budget` → `{ cmd: "usage", error: /integers|<ms>,<tokens>/ }`;
`--board <path>`; `--board` with no value → usage; an unexpected positional → usage. Imports only
the pure `parseArgs`/`parseBudgetArg` (no dispatch, no addon).

## Boundaries preserved

- **Engine ⊥ play (E-007):** `work.ts` is the composition layer — the one site importing BOTH the
  engine (`spendDown`) and the plays (the chain). The engine still imports nothing from `src/play/`.
- **Addon containment:** only `work.ts` + the `cli.ts` dispatch arm value-import the chain. `work-
  core.ts` and `cli.ts`'s parser stay addon-free → both unit-tested.
- **Single source of two-denomination truth (IA-8):** every meter goes through `formatWallet`.

## Ordering of changes

`work-core.ts` + its test → `work.ts` → `cli.ts` parser + `cli.test.ts` → `cli.ts` dispatch arm →
live `vend work` (AC#3). Each step (except the live cast) is independently `bun test`-green.
