# Design — T-069-01-05

## Decision summary

Extend the two relevant `ParsedCommand` variants with `agent?: string`. Parse `--agent <seat>` in
the existing per-gesture scans, retaining the value as an unvalidated string and conditionally
including it in the result. Add the same optional property to the chain and run dispatch option
objects. Update the two usage lines and add focused pure parser assertions.

No shared flag parser, seat import, validation step, or new module is warranted.

## Goals

- Make `--agent codex` parse on both board-writing gestures.
- Preserve the raw seat string through dispatch.
- Produce the exact usage error for a dangling flag.
- Keep omitted-flag object shapes unchanged.
- Keep the canonical unknown-seat refusal at the materializer.
- Avoid changing unrelated command parsing.
- Make the counter surface self-documenting through `USAGE`.
- Stay within the story's CLI-only final join ticket.

## Non-goals

- Validate `claude | codex` in the CLI.
- Add a new seat type to the CLI.
- Change `--seat designer|dev`.
- Change materialization or input assembly.
- Add Lisa dispatch behavior.
- Prove a metered end-to-end cast.
- Normalize, trim, or otherwise reinterpret the supplied seat string.
- Generalize every CLI value flag behind a shared parser.

## Option A — local parsing in each gesture

Add one local `agent` variable to `parseChainArgs` and `parseRunArgs`. Recognize the flag within each
function's existing scan, apply the same missing-value check used by `--after`, and conditionally
spread the field into the returned command.

Advantages:

- Matches the current parser organization.
- Keeps command-specific accepted flags explicit.
- Requires no new dependency or abstraction.
- Makes missing-value ordering behavior easy to see.
- Preserves omission with the repository's established conditional-spread idiom.
- Minimizes regression surface.

Costs:

- Repeats a small value-flag check in two functions.
- The run parser remains structurally different from the chain parser.

The repetition is small and intentional. Existing comments describe a local-copy idiom for command
parsers where coupling otherwise unrelated command shapes would cost more than the shared lines.

## Option B — shared optional-string flag helper

Introduce a helper that finds and validates `--agent`, then call it from both parsers.

Advantages:

- Centralizes the missing-value message.
- Removes a few repeated lines.

Costs:

- A helper would need to encode scan/index semantics for two differently structured parsers.
- It could accidentally accept or consume flags outside each command's intended grammar.
- It adds abstraction for only two call sites and one simple flag.
- It obscures the chain requirement that recognized flags must not become signal words.

Rejected. The helper does not own meaningful domain judgment; it would mostly hide local control
flow.

## Option C — import the seat contract and validate while parsing

Import `KNOWN_SEATS` or `assertKnownSeat` and reject unknown values before dispatch.

Advantages:

- Gives immediate CLI feedback for typos.
- Could narrow the parsed field type.

Costs:

- Violates the story's single write-side validation authority.
- Prevents unknown strings from reaching the materializer and becoming the named `unknown-seat`
  run-log outcome.
- Duplicates or relocates the boundary proven by dependency tickets.
- Changes the contract from parse-and-dispatch to parse-and-prevalidate.

Rejected. The raw string is deliberate input to a downstream andon, not an oversight.

## Option D — generic run/chain flag map

Refactor both commands into a generic flag scanner that returns a map of values and presence flags.

Advantages:

- Could standardize parsing across budget, after, and agent.
- May simplify future flags.

Costs:

- Broadens a small feature into parser architecture work.
- Risks changing mature behavior for budgets, repeated `--after`, boolean flags, and positional text.
- Makes command-specific error messages less direct.
- Is not required by the ticket or story.

Rejected as scope expansion.

## D1 — parsed types remain raw and optional

Add `readonly agent?: string` to both relevant `ParsedCommand` variants.

`string` is the correct type because:

- argv values are runtime strings;
- the CLI does not validate membership;
- unknown strings must travel to the write guard;
- both receiving option interfaces use `string` for the same reason.

Optionality preserves current callers and accurately represents flag omission.

The field documentation will name it as Lisa executor-routing metadata and distinguish it from the
present-layer seat.

## D2 — chain parsing

Add `let agent: string | undefined` beside the chain parser's other accumulated optional values.

Within the existing scan:

```ts
} else if (a === "--agent") {
  const val = argv[++i];
  if (val === undefined || val.startsWith("--")) {
    return { cmd: "usage", error: "missing --agent <seat>" };
  }
  agent = val;
```

This branch must appear before the positional fallback. It consumes both tokens so neither becomes
part of the signal.

Return the property with:

```ts
...(agent !== undefined ? { agent } : {})
```

The explicit undefined comparison is preferable to a truthiness check because argv is plain input.
Although an empty string is unusual from a shell, parsing should carry a supplied token rather than
silently erase it. The missing check already handles absent and flag-shaped values.

If `--agent` is repeated, the last supplied value wins, matching the existing single-value budget
behavior. Repetition semantics are not part of acceptance and do not warrant a new refusal.

## D3 — run parsing

Use the existing scan beginning at argv index 3, which already recognizes `--after`. Add an
`agent` variable and an `--agent` branch in the same loop.

The scan should switch from an `if (token !== "--after") continue` shape to explicit branches:

- `--after`: preserve all current behavior;
- `--agent`: consume one value and validate presence;
- everything else: continue unchanged.

Budget remains located and parsed by the existing earlier `indexOf` logic. Boolean flags remain
presence-based. The new scan must not reinterpret `--agent` or its value as any other field.

The result conditionally spreads `agent` after `after`, keeping all prior keys and behavior intact.

## D4 — missing-value behavior

Both parsers reject either:

- end of argv immediately after `--agent`;
- another flag immediately after `--agent`.

Both return exactly:

```ts
{ cmd: "usage", error: "missing --agent <seat>" }
```

This mirrors `--after` and avoids treating `--budget` or `--after` as a seat value.

No membership or nonempty-string guard is added here.

## D5 — dispatch transport

Add `agent: parsed.agent` to:

- the object passed to `castProposeDecomposeChain`;
- the object passed to `runPlay`.

The receiving types are already dependency-provided contracts. TypeScript will catch a misspelled
field or incompatible type.

The dispatch objects currently include some optional properties with `undefined`, so matching that
style is behavior-preserving at this shell boundary. Omission sensitivity applies to parser output
and downstream materialized files; the receiving adapters already conditionally preserve absence
when building inputs.

No new dispatch wrapper is needed.

## D6 — usage surface

Append `[--agent <seat>]` to both board-writing gesture lines:

- the `vend run` line;
- the `vend chain` line.

Use the generic `<seat>` placeholder required by the ticket rather than listing known values. This
matches the fact that validation is downstream and avoids duplicating the vocabulary in CLI help.

The unrelated `--seat <designer|dev>` help remains unchanged.

## D7 — tests

Add focused assertions to `src/cli.test.ts` near the existing chain/run and `--after` tests.

Required cases:

1. `parseArgs(["chain", "sig", "--agent", "codex"])` returns exactly the chain shape with
   `agent: "codex"`.
2. A direct decompose run with budget and `--agent codex` carries the raw field.
3. Both gestures with a terminal `--agent` return the exact missing-value usage object.
4. At least one flag-shaped following token also proves it is not consumed as a seat.
5. Split `USAGE` into lines and assert both gesture lines contain `[--agent <seat>]`.
6. Existing no-flag tests continue proving omission through exact equality.

No effect integration test is added here. T-069-01-03 and T-069-01-04 already pin the two
downstream transports, while this ticket owns the pure CLI join.

## Verification decision

Run in increasing scope:

1. `bun test src/cli.test.ts`;
2. `bun run build` if needed for dispatch option assignability;
3. `bun run check` as the mandatory repository gate.

If the full gate exposes failures unrelated to the changed files, investigate and report honestly;
do not weaken tests or bypass hooks.

## Chosen approach

Choose Option A: two local parse branches, two typed dispatch properties, two usage edits, and
focused pure tests.

It is the smallest design aligned with the current code, preserves the story's downstream
validation contract, and makes each board-writing gesture's accepted grammar explicit.
