# Design — T-072-01-02

## Decision summary

Add a small exported pure Levenshtein suggester in `src/cli.ts`, backed by an
explicit canonical verb tuple and a distance threshold of two. The unknown-command
branch will append a suggestion only when the helper returns one and will mark that
parse result as targeted so the direct shell prints only the error line, not `USAGE`.

## Candidate-inventory options

### Option A — derive candidates from the usage banner

The grouped banner could be scanned for `vend <word>` lines.

Advantages:

- one presentation string appears to be the source of truth;
- newly advertised commands could enter suggestions automatically.

Costs:

- the banner contains syntax placeholders and global flags;
- `vend <selection>` is not a literal verb;
- aliases are intentionally not all advertised;
- parser behavior would depend on presentation formatting;
- a future wording/layout edit could silently change routing assistance.

Rejected because presentation text is not a reliable typed command inventory.

### Option B — derive candidates from `ParsedCommand` discriminants

Type-level command kinds could conceptually define the set.

Advantages:

- it appears exhaustive over parser outcomes;
- it avoids a separately maintained tuple.

Costs:

- TypeScript types do not exist at runtime;
- discriminants include `usage`, `browse`, `select`, and `version`, which are not
  literal canonical verb tokens;
- deriving a runtime value would still require a manually maintained structure.

Rejected because command kinds and user-typed verb candidates are different sets.

### Option C — explicit canonical verb tuple

Define the literal first-token verbs routed by `parseArgs` in a local readonly tuple.

Advantages:

- explicit and deterministic;
- independent of banner formatting;
- easy to inspect beside the routing table;
- excludes flags, parser outcome kinds, and aliases deliberately;
- provides a straightforward future test/update seam.

Cost:

- a new canonical verb must update both routing and the tuple.

Chosen. This small duplication is honest and test-visible, and it models exactly
what the suggestion feature needs rather than conflating other inventories.

## Distance algorithm options

### Option A — prefix or substring heuristics

Prefix matching and character overlap would be very small.

Rejected because insertions in the middle, substitutions, and transpositions are not
modeled consistently. It would not satisfy the ticket's explicit edit-distance ask.

### Option B — external fuzzy-match dependency

A package could supply ranking and configurable similarity.

Rejected because the inventory and strings are tiny, the behavior must remain cheap
and local, and adding a dependency would exceed the problem size.

### Option C — Levenshtein dynamic programming

Compute insert/delete/substitute distance with two numeric rows.

Chosen because it is conventional, pure, deterministic, Unicode-code-point safe when
using `Array.from`, and `O(token length × candidate length)` over only fourteen verbs.
Two rows keep space proportional to the candidate length.

## Public helper shape

Export:

```ts
suggestCommand(token: string, candidates: readonly string[], maxDistance = 2):
  string | undefined
```

This is preferable to exporting raw distance alone because acceptance names a pure
“suggester,” and tests should pin candidate selection plus threshold behavior. Keeping
the candidate list injectable lets unit tests exercise ranking and silence directly.
Production passes the local canonical verb tuple.

The helper will:

1. compute Levenshtein distance from the token to every candidate;
2. retain the lowest-distance candidate;
3. preserve input order on ties by replacing only for a strictly smaller distance;
4. return it only when the best distance is at most `maxDistance`;
5. return `undefined` for an empty candidate list or no in-threshold candidate.

## Threshold options

### Fixed threshold one

Very conservative, but misses common two-edit mistakes such as a substitution plus an
extra letter.

### Length-scaled threshold

Can accommodate longer commands, but introduces policy complexity and risks suggesting
semantically unrelated short commands for distant inputs.

### Fixed threshold two

Chosen. It catches ordinary one- and two-character mistakes across this small CLI while
keeping `frobnicate` silent. It is explicit, stable, and directly testable. Callers can
override it in pure tests or future reuse without changing the default contract.

## Unknown result representation

### Recognize unknown errors by string prefix in the shell

The shell could skip the banner when `error.startsWith("unknown command:")`.

Rejected because rendering behavior should not depend on parsing human-readable text.

### Add a new `error` command discriminant

This would cleanly distinguish targeted failures from usage failures.

Viable, but it expands the union and all consumers for one presentation bit. Existing
tests and semantics already treat unknown commands as parse failures.

### Add `showUsage?: boolean` to the `usage` result

Chosen. Unknown verbs return `showUsage: false`; all existing syntax errors omit the
property and retain the current default of showing usage. The shell checks
`parsed.showUsage !== false`. This is structured, backward-compatible for every other
parse result, and local to the relevant union member.

## Message construction

The base is `unknown command: <token>`. When a suggestion exists, append the exact
Unicode-em-dash form ` — did you mean <candidate>?`. Do not add quoting that the
acceptance template does not request.

For the acceptance examples:

- `steeer` becomes `unknown command: steeer — did you mean steer?`;
- `frobnicate` becomes `unknown command: frobnicate` with no false suggestion;
- both are one stderr line, exit 2, with no usage banner.

The ticket wording lists both examples beside the suggestion template, but its explicit
silence clause requires the distant example to omit the suffix. This design treats
`frobnicate` as the negative threshold proof and `steeer` as the positive proof.

## Test design

- Unit-test `suggestCommand` with insertion, deletion, and substitution near misses.
- Pin `steeer -> steer` against the real candidate set through `parseArgs`.
- Pin a nearest-candidate choice independent of candidate order where distances differ.
- Pin stable order on a tie if useful to define determinism.
- Pin `frobnicate -> undefined` under the default threshold.
- Update existing exact unknown-command parser assertions for `showUsage: false`.
- Preserve the retired `work` command as unknown and suggestion-free.
- Add subprocess coverage for `frobnicate` and `steeer`: stdout empty, exit 2, stderr
  exactly one targeted line.
- Run focused CLI tests before the full repository gate.

## Rejected scope

- No spelling correction for command-specific flags or arguments.
- No fuzzy correction for playbook names after `run`.
- No case-insensitive command routing.
- No automatic execution of the suggested command.
- No interactive prompt or confirmation.
- No changes outside `src/cli.ts` and `src/cli.test.ts`.

## Final rationale

The selected design keeps the decision logic pure and the side-effect shell thin. It
adds a bounded, conservative recovery hint and changes only unknown-verb rendering,
while retaining the complete usage banner for errors where syntax help is relevant.
