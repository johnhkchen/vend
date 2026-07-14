# Design — T-079-01-02

## Goal

Add a bare `vend settle` command that observes current local repository facts, delegates all verdict
judgment to `computeSettleVerdict`, prints the complete result compactly, atomically advances the
last-settle frontier, and exits without any executor, token budget, or run-log operation.

The implementation must stay honest about current gate state and structured review state. It must
not infer open concerns from arbitrary prose, claim a stale gate result is current, or turn settle
into a watcher or mutating sweep.

## Option 1 — implement everything inside `src/cli.ts`

The dispatch arm could load the graph, run commands, scan artifacts, compute, format, and write.

### Advantages

- Only the two CLI files change.
- The subprocess test exercises all behavior in one place.
- There is no new public effect module.

### Rejection

- `cli.ts` is already a large routing surface.
- Filesystem policy and terminal rendering would become untestable except through subprocesses.
- It would obscure the pure-core/impure-shell boundary established by T-079-01-01.
- Future event-triggered settle would have to call a CLI or duplicate its effects.
- Marker publication and review artifact parsing deserve named, reusable boundaries.

## Option 2 — make `settle.ts` a second verdict judge

The shell could bypass `computeSettleVerdict` and directly build printable lines from filesystem
facts.

### Advantages

- Fewer translations between observed facts and output.
- Presentation could be optimized directly for the one screen.

### Rejection

- It would duplicate delta, ordering, exception, and marker policy.
- The committed dependency would cease to be authoritative.
- Gate/presweep/review ordering could drift from future sweep consumers.
- The story's wave rationale explicitly freezes the core shape before this consumer.

## Option 3 — a thin settle effect shell plus a pure renderer

### Chosen

Create `src/settle/settle.ts` with:

- narrow observation helpers for the gate, Git porcelain, review dispositions, and marker;
- `runSettle({ root })`, which loads all facts and calls `computeSettleVerdict` once;
- atomic marker publication after a successful verdict;
- `renderSettleResult`, a deterministic pure terminal formatter.

The CLI parser and dispatch table recognize the new free verb and lazily call this shell.

### Rationale

- Judgment remains in the committed pure core.
- Effects are localized and individually understandable.
- The renderer can be tested without spawning commands.
- The shell is callable later from the event-triggered story without importing the CLI.
- The acceptance subprocess still proves the real composed path.

## Decision 1 — inline current `bun run check`

Run `bun run check` inside the target repository and capture its output. Do not stream the full gate
to the terminal; reduce it to `SettleGateResult`:

- exit 0 with a detected Bun `<n> pass` count: `green — <n> tests`;
- exit 0 without a count: `green — bun run check passed`;
- nonzero: `red — bun run check exited <code>: <last useful output line>`;
- spawn failure: a red detail naming the inability to run the command.

A failed result carries the exact action:

```text
Run `bun run check` and repair the reported failure, then rerun `vend settle`.
```

### Alternatives rejected

#### Read the latest `review.md`

The result may apply to a prior commit and prose has no stable schema. Calling it current would be
false precision.

#### Read `.vend/runs.jsonl`

Those gate rows belong to individual casts, not the current repository. Reading the ledger would
also weaken the acceptance claim that settle is independent of run state.

#### Run only typecheck or a subset

The product's repository gate is `bun run check`; silently narrowing it would add a competing
definition of green.

Inline execution costs wall time but no tokens. That is within “free” as the story defines it and
provides current truth rather than a fast stale claim.

## Decision 2 — reuse presweep core over one Git snapshot

After the repository gate completes, execute `git status --porcelain` in the root. Then call:

```ts
classifySweep({
  doneIds: donePhaseIds(graph.tickets),
  porcelain,
})
```

This reuses both canonical phase-done semantics and canonical path classification. Running Git after
the gate avoids observing transient files while BAML generation or tests are active.

A Git command environment failure is not a normal presweep exception because `SweepVerdict` cannot
honestly represent “not observed.” `runSettle` will throw a concise named error that the CLI catches
and prints as an operational failure with exit 1. It will not fabricate green or an offender path.

## Decision 3 — disposition JSON is the concern authority

Scan immediate subdirectories of `docs/active/work`, looking only for present
`review-disposition.json` files.

Valid shapes are strict:

```json
{"disposition":"pass","reason":null}
{"disposition":"block","reason":"specific concern name"}
```

- pass yields no concern;
- block yields a `ReviewConcern` whose `ticketId` is the directory name and `name` is the trimmed
  reason;
- malformed present JSON yields a named concern rather than silently passing;
- missing files are ignored for legacy compatibility.

The exact next action for a valid block is:

```text
Resolve <reason> for <ticket>, then record a passing disposition in <path>.
```

The exact next action for a malformed file is:

```text
Repair <path> to a valid pass or reasoned block disposition, then rerun `vend settle`.
```

### Why not parse `review.md`

Review prose deliberately mixes blockers, limitations, future ideas, and honest boundaries. Heading
and bullet conventions vary. Promoting prose to machine exceptions would be a new classifier with no
authored schema, contradicting the epic's “adds no new judgment” constraint.

## Decision 4 — one stable terminal grammar

`renderSettleResult(result, { color?: boolean })` returns a complete newline-terminated string.
Production defaults to color; tests may disable color for exact structural assertions.

Successful verdict lines are:

1. `settle` header;
2. delta line;
3. one `epic:` line per epic;
4. gate line;
5. presweep line;
6. review concerns line(s);
7. exception line(s), or `exceptions: none`.

Delta wording distinguishes:

- first settle with ids;
- first settle with no completed tickets;
- repeat with newly done ids;
- repeat with empty delta (`none since last settle`).

Epic lines use `<id>: <cleared>/<total> cleared` and append `— sweep ready` when `allDone`.

Review concerns are named as `<ticketId> — <name>`. No concern remains explicit as
`review concerns: none`.

Every exception line is rendered as:

```text
exception [<kind>] <name>: <message> — next: <nextAction>
```

The entire line is wrapped with ANSI red (`\x1b[31m`) and reset (`\x1b[0m`). The formatter does not
invent, shorten, or reorder next actions.

## Decision 5 — refusal rendering and exit behavior

A core marker refusal renders two red lines naming the marker/reason and its exact next action. The
marker is not rewritten. The CLI exits 1.

A valid `SettleVerdict` exits 0 even when it contains gate, presweep, or review exceptions. This is a
status/verdict command: it successfully observed and reported exceptions. Making every exception a
process failure would contradict the acceptance fixture's explicit exit-0 requirement and conflate
“inspection succeeded” with “everything is green.”

An operational observation error (graph/Git/fs/spawn boundary failure outside typed verdict data)
prints `settle: could not observe repository — <reason>` to stderr and exits 1. It never advances
the marker.

## Decision 6 — atomic marker publication

For a successful verdict:

1. serialize `nextMarker` with `serializeLastSettleMarker`;
2. create `.vend/` recursively;
3. write a unique sibling temporary file with exclusive creation;
4. rename it over `.vend/last-settle.json`;
5. remove the temporary file on failure.

The marker is written after verdict computation and before returning the result to the CLI. The
returned output therefore corresponds to an advanced durable frontier. A crash cannot expose a
partial JSON marker.

Gate/presweep/review exceptions do not prevent publication because they do not invalidate the board
delta. Malformed prior marker does prevent it because the delta basis is untrustworthy.

## Decision 7 — free CLI grammar

Add `{ cmd: "settle" }` to `ParsedCommand` and a no-argument `parseSettleArgs` function.

- `vend settle` parses successfully.
- `vend settle --budget 1,2` is usage.
- Any other trailing token is usage.
- `settle` joins `COMMAND_VERBS` for suggestions.
- `vend settle` appears once in the free help group.
- The complete inventory expectation increases from 17 to 18.

The dispatch arm is placed before the generic run path and lazily imports only
`./settle/settle.ts`. No play registry, executor selector, funding counter, or run logger appears on
that path.

## Decision 8 — testing strategy

### Focused settle tests

Test pure helpers for:

- pass disposition -> no concern;
- reasoned block -> named concern and exact action;
- malformed present disposition -> named repair concern;
- successful render with delta, epic counts, gate, presweep, concerns, and red exceptions;
- empty repeat delta wording;
- refusal rendering.

### CLI parser tests

Prove:

- bare settle parses to `{ cmd: "settle" }`;
- `--budget` and positional arguments are rejected;
- usage and free-command inventory include settle.

### Fixture subprocess acceptance

Create an isolated Git repository containing:

- a minimal canonical board;
- at least one phase-done ticket;
- a deterministic local `check` script printing a known pass count;
- one blocked review disposition;
- an executor sentinel script.

Commit the fixture before invoking settle so presweep is green. Then prove:

- first invocation exits 0;
- output contains every required line and ANSI-red exception/action;
- executor sentinel is absent;
- `.vend/runs.jsonl` is absent;
- marker contains the done frontier;
- second invocation exits 0 with `delta: none since last settle`;
- the run log and sentinel remain absent.

### Repository verification

Run focused tests, typecheck, `git diff --check`, then full `bun run check`. Commit exactly the four
ticket-owned source/test files using `lisa commit-ticket`.

## Scope boundary

This ticket does not modify the pure settle contract, board lifecycle, presweep policy, review
workflow schema, executor interface, run ledger, sweep behavior, Lisa hook, or loop-settled seam.
No live loop observation is claimed; all end-to-end evidence is fixture-local as required.
