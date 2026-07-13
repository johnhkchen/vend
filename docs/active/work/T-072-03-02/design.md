# Design — T-072-03-02

## Decision summary

Add one small funding-line formatter in `src/cli.ts`, built directly on the
existing `formatBudget`, and call it from every dispatch arm that has an explicit
parsed budget. Print the resulting line once immediately before the arm hands
control to its dispatch/cast function. Prove canonicalization and ordering with
two subprocess invocations of the `run` path using an unknown play.

## Design goals

1. Confirm the effective user-entered envelope before any cast begins.
2. Reuse the shelf's humane vocabulary without duplicating formatting rules.
3. Canonicalize raw and humane input through the parsed numeric `Budget`.
4. Emit exactly one confirmation per explicit funding gesture.
5. Avoid spending tokens or mutating project state in tests.
6. Preserve all downstream budget values and enforcement behavior.
7. Keep pure formatting in the pure core and output in the impure shell.

## Option A — inline the string in only the `run` arm

Shape:

```ts
process.stdout.write(`funding ~${formatBudget(parsed.budget)}\n`);
const res = await runPlay(...);
```

### Advantages

- Smallest possible diff for the literal acceptance example.
- `run` always has a parsed budget, so no optionality is involved.
- Ordering is visually obvious at the call site.

### Disadvantages

- The parent story says “funding dispatch arms,” plural.
- Other CLI gestures expose the same `--budget` syntax and would remain silent.
- The counter would acknowledge funding inconsistently depending on which
  metered verb the operator chose.
- Future copy changes could require multiple hand-edited inline literals.

### Assessment

Rejected as too narrow for the story contract, even though it satisfies the
single ticket example mechanically.

## Option B — echo every resolved default and override

Shape:

- Resolve the actual budget for every metered gesture.
- Print a funding line even when the operator did not pass `--budget`.
- For chains or selections, print either a combined line or one line per cast.

### Advantages

- Makes every metered dispatch's envelope visible.
- Extends P7 legibility to default-funded gestures.
- Could eventually align with a broader “show the actual funding” contract.

### Disadvantages

- The ticket specifically says `formatBudget(parsed budget)`.
- Optional defaults are resolved in several downstream modules, not uniformly in
  the CLI shell.
- A chain can have two different measurement-funded defaults, so one line cannot
  truthfully represent the gesture without a new combined grammar.
- A selection can contain multiple actions with different warranted envelopes.
- Moving resolution into the CLI would couple it to ledger and menu internals.
- Printing multiple lines violates the ticket's “one line” language.
- This would expand scope from echoing input into redesigning default-funding
  presentation.

### Assessment

Rejected. It is valuable adjacent work but is outside the parsed-input loop this
story closes.

## Option C — one shared explicit-budget echo across dispatch arms

Shape:

- Import `formatBudget` from `src/shelf/menu.ts`.
- Define a pure `formatFundingLine(budget)` helper returning
  `funding ~${formatBudget(budget)}`.
- In each arm with `parsed.budget`, write that line once before dispatch.
- `run` writes unconditionally because its parsed budget is required.
- Optional-budget arms guard the write with `if (parsed.budget)`.
- `annotate` does not write because it has no parsed budget.

### Advantages

- Matches the story's plural dispatch-arm language.
- Uses the parsed numeric value as the single canonical source.
- Produces exactly one line per explicit funding gesture.
- Leaves heterogeneous/default funding untouched.
- The helper is pure and directly testable if useful.
- Output remains in the thin shell.
- No additional module or effect abstraction is needed.

### Disadvantages

- Repeats a small guarded write at several call sites.
- A `select` line can appear before menu validation, because the actual casts are
  encapsulated inside `pressShelf`.
- Default-funded gestures remain unconfirmed.

### Assessment

Chosen. It is the smallest design that covers the actual shared CLI surface
without claiming more than the parsed-input contract proves.

## Helper visibility

Two choices are viable:

1. keep `formatFundingLine` private and prove it only through subprocess output;
2. export it and add a direct pure test in addition to the subprocess proof.

The helper is a stable presentation seam: it composes an existing public
formatter with ticket-owned copy. Exporting it would enlarge the module's public
API solely for tests. The subprocess test already asserts the exact line and the
formatter itself has direct tests. Therefore the helper should remain private.

## Import strategy

### Static import

```ts
import { formatBudget } from "./shelf/menu.ts";
```

This is safe because `menu.ts` is deliberately pure and addon-free. It makes the
dependency explicit, keeps the helper synchronous, and ensures direct imports of
`cli.ts` remain cheap.

### Lazy import in every arm

This would preserve the current value-import pattern but duplicate imports or
require an async helper for a pure string operation. It offers no meaningful
isolation because the target module has no heavy dependencies.

Static import is chosen.

## Output timing

The output must be written after parsing succeeds and before calling the arm's
dispatch function.

For `run` the sequence becomes:

1. parse argv into a numeric budget;
2. lazy-import the dispatcher;
3. write `funding ~...`;
4. call `runPlay`;
5. print typed error or run summary.

The import itself does not cast. Printing after the import but before the call
still satisfies “before the cast begins” and means an import failure does not
claim funding for a dispatch that could not be loaded.

The same placement applies to `chain`, `expand`, `survey`, and `steer`. For
`select`, the print occurs before `pressShelf`, the only available CLI-level
dispatch seam.

## Optional arms

Optional arms should echo only when `parsed.budget !== undefined`.

- `chain --budget`: one uniform override, one line.
- `expand --budget`: one override, one line.
- `survey --budget`: one override, one line.
- `steer --budget`: one override, one line.
- `<selection> --budget`: one uniform override, one line.
- no flag: no parsed input, no line added by this ticket.

An explicit object is always truthy, but checking against `undefined` makes the
semantic condition precise and resilient.

## Test strategy options

### Mock the cast module in-process

Bun module mocks could intercept `runPlay`, but the `import.meta.main` shell does
not run when `cli.ts` is imported. Exercising it would require refactoring the
entire shell into an exported runner or manipulating module execution.

Rejected as disproportionate and likely to widen the diff.

### Start a real successful cast

This would prove output before live executor work but requires credentials,
tokens, time, writable board fixtures, and nondeterministic external behavior.

Rejected as contrary to the ticket's FREE and fully tested boundary.

### Spawn an unknown play

Invoke:

```text
bun src/cli.ts no-such-play ignored.md --budget <value>
```

The parser accepts the generic play name. The dispatcher loads, finds no registry
entry, and returns a typed error before any cast. This creates a deterministic
boundary probe:

- stdout must be exactly the funding line;
- stderr must be the registry refusal;
- exit status must be 2;
- no run summary or artifacts can exist.

Chosen.

## Raw versus humane proof

Run the same subprocess harness twice:

- `--budget 40m,350k`;
- `--budget 2400000,350000`.

Collect stdout for both and assert:

```ts
expect(humane.stdout).toBe("funding ~40m/350k\n");
expect(raw.stdout).toBe(humane.stdout);
```

This proves exact canonical equality after parsing, not merely two separately
hardcoded expected values.

## Ordering proof

The unknown-play refusal is written to stderr after `runPlay` returns. Exact
stdout does not establish cross-stream byte ordering by itself, but the source
placement and control flow establish that the stdout write occurs before the
dispatch call. The harness proves the line exists at the dispatch boundary even
when dispatch refuses before casting.

No stronger deterministic test is warranted without extracting the whole shell
or starting a real cast.

## Error behavior

- Parse errors remain usage errors and print no funding line.
- Unknown plays print the funding line, then the existing typed refusal, because
  the operator did successfully fund an attempted run.
- Downstream thrown errors occur after the funding acknowledgement.
- Exit codes remain unchanged.
- stderr copy remains unchanged.

## Scope controls

This design does not:

- change parsing grammar;
- alter `Budget` values;
- change formatter behavior;
- resolve or display implicit defaults;
- redesign chain funding copy;
- alter live spend progress;
- add TUI state;
- update help notation;
- change executor, gate, or wallet behavior.

## Final rationale

The chosen design closes exactly the loop the story opened: user text becomes a
numeric budget, the same existing shelf formatter turns that value back into a
canonical humane envelope, and the impure CLI shell confirms it before handing
off to work. It is consistent across every explicit-budget dispatch arm and
keeps all hard-contract semantics downstream and unchanged.
