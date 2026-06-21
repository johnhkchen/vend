# T-051-01 — Design

Decide how to add the `disallowedTools` option. Grounded in the Research map of the
`allowedTools` precedent. The work is small; the design value is in choosing the
emission discipline and ordering so the result is byte-for-byte symmetric with the
allowlist it mirrors.

## The decision in one line

Mirror `allowedTools` exactly: a `readonly string[]` option on both `DispenseOptions`
and `buildArgs`' inline param type, a two-part present-AND-non-empty guard that
comma-joins into ONE argv element, emitted as `--disallowedTools`, placed
immediately after `--allowedTools`, and forwarded through `dispense`. No new
abstraction.

## Options considered

### Option A — Mirror `allowedTools` verbatim (CHOSEN)

Add `disallowedTools?: readonly string[]` in the four places `allowedTools` lives,
with the identical guard `if (disallowedTools && disallowedTools.length > 0)
args.push("--disallowedTools", disallowedTools.join(","))`, positioned right after
the `--allowedTools` push.

- **Pros:** Zero conceptual novelty — a reviewer who understands E-032 understands
  this instantly. Preserves the comma-join-into-one-element invariant that the
  variadic flag requires (verified in Research against `--help`). Back-compat is
  free: same two-part guard means empty/omitted emits nothing, so `buildArgs({})`
  and `buildArgs({ disallowedTools: [] })` stay byte-identical. The pure/impure
  split is untouched; the entire feature is unit-testable with no live spawn.
- **Cons:** The four-edit-points duplication (DispenseOptions type, buildArgs
  destructure, buildArgs inline type, dispense forward) is repeated once more. This
  is an existing smell, not one this ticket introduces.
- **Verdict:** This is the design. It is what the ticket asks for and what the
  codebase reality rewards.

### Option B — Factor allow/deny into a shared `toolList(flag, names)` helper

Extract the present-AND-non-empty + comma-join logic into one helper and call it for
both allow and deny.

- **Pros:** Removes the duplicated guard body.
- **Cons:** Premature abstraction over two call sites. It would touch the existing
  `allowedTools` line (a working, tested path) for no behavioral gain, widening the
  diff and risking the byte-identical guarantee the existing E-032 tests pin. The
  duplication is two lines; a helper is not cheaper to read than the inline guard.
  Rejected — out of proportion to a plumbing ticket, and it mutates code outside
  this ticket's intent.

### Option C — Accept `string | string[]` and normalize

Let callers pass either a single tool name or a list.

- **Rejected.** `allowedTools` is `readonly string[]` only; introducing an asymmetric
  shape for its twin breaks the symmetry that is the whole point and invites a
  normalize branch with its own edge cases. Callers (T-051-02) will pass an array.

### Option D — Emit one argv element per tool (no comma-join)

`args.push("--disallowedTools", ...disallowedTools)`.

- **Rejected.** The flag is variadic (`<tools...>`); a trailing-element spread lets
  it greedily swallow whatever flag comes next in the argv. The comma-join into ONE
  element is precisely the defense E-032 documented. Mirroring it is mandatory.

## Ordering decision

Place `--disallowedTools` **immediately after `--allowedTools`** and before
`--strict-mcp-config`. Rationale: reads as "allow these, deny those, then close the
firehose" — the natural allow→deny→strict progression. It also keeps the two
tool-name lists adjacent in the argv, which makes the composition test read clearly.
This is an internal argv-ordering choice with no behavioral consequence (the CLI
parses flags order-independently), chosen for readability.

## Empty-omitted discipline (the back-compat contract)

The guard is two-part on purpose:

```ts
if (disallowedTools && disallowedTools.length > 0)
  args.push("--disallowedTools", disallowedTools.join(","));
```

- `disallowedTools === undefined` → falsy → no flag.
- `disallowedTools === []` → length 0 → no flag.
- `disallowedTools === ["AskUserQuestion"]` → `--disallowedTools AskUserQuestion`
  as one element.

This makes the byte-identical guarantee hold for both the omitted and the
empty-array shapes, exactly as `allowedTools` does. The new back-compat assertion
extends the existing "no tool options ⇒ byte-identical" test to also assert the argv
contains no `--disallowedTools`.

## Flag-spelling provenance

Verified in Research against `claude -p --help`:
`--disallowedTools, --disallowed-tools <tools...>`. The camelCase `--disallowedTools`
mirrors `--allowedTools`. A short in-code comment will record this (E-032 set the
precedent of noting `--help`-verified spellings beside the push), satisfying the AC's
"exact flag spelling confirmed and noted in-code" requirement.

## What stays out of scope

No cast/play routing. No decision about WHICH plays get the `AskUserQuestion`
denylist — that is T-051-02. This ticket delivers only the capability: the seam can
now emit `--disallowedTools` when handed a list, and emits nothing when not. The
`ClaudeExecutor` delegate needs no change beyond inheriting the widened
`DispenseOptions`.
