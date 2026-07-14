# Design — T-079-02-02

## Goal

Add `vend sweep` as a free repository gesture that observes one board snapshot, presents the exact
core-assembled commit, accepts one deliberate keystroke, and only then flips and commits the exact
eligible epic cards.

The command must make refusal and decline visibly distinct: refusal is a named nonzero andon;
decline is successful human non-consent with no mutation.

## Option 1 — mutate cards, show Git diff, then confirm

The shell could apply core flips to the working tree first, render `git diff --cached`, and ask the
operator whether to commit.

### Advantages

- Presentation exactly matches physical working-tree bytes.
- Git itself supplies the diff and file list.
- Confirmation is directly over staged state.

### Rejection

- A decline would require restoring files and index state.
- While the prompt is open, the tree is already changed, contradicting “commits only after” and
  weakening “declining leaves the tree untouched.”
- Rollback could overwrite concurrent edits or disturb preexisting index entries.
- The core already supplies an exact file list and provenance message; mutation is unnecessary to
  present the assembled commit.

## Option 2 — invoke an external interactive Git command

The shell could generate files and call `git commit --interactive` or a platform prompt utility.

### Advantages

- Delegates terminal input behavior.
- Git provides familiar interaction.

### Rejection

- Interactive Git is multi-step and not the story's one-keystroke gesture.
- It exposes staging choices the machine has already settled, reopening specification at run time.
- Output and fixture automation become platform/version dependent.
- It makes exact decline semantics harder to control.

## Option 3 — present from the core, then apply and pathspec-commit

### Chosen

Create a thin `src/sweep/sweep.ts` shell. It loads graph/Git facts, delegates to `computeSweep`,
renders successful assembly or refusal, reads one byte, and calls a narrowly path-limited commit
effect only after `y`/`Y`.

### Rationale

- The pure core stays the sole assembly authority.
- Decline is trivially mutation-free.
- Output is deterministic and fixture-testable.
- Exact Git pathspecs flow from computation to staging and commit without reinterpretation.
- The command remains a single consent gesture rather than a Git conversation.

## Decision 1 — public sweep shell result

`runSweep({ root?, confirm? })` returns a discriminated result:

- `{ kind: "refusal", refusal }` for any `computeSweep` refusal;
- `{ kind: "declined", plan }` when confirmation is not `y`/`Y`;
- `{ kind: "committed", plan, commit }` after a successful exact commit.

`commit` is the resulting HEAD SHA read from `git rev-parse HEAD`. Returning it makes the terminal
receipt and tests explicit without parsing commit output.

The optional `confirm` callback is an effect seam. Production CLI supplies the one-keystroke reader;
focused tests can supply a resolved boolean if needed. The shell itself never assumes consent.

## Decision 2 — two-stage presentation API

The CLI must present before it waits. `runSweep` therefore should not hide confirmation behind an
opaque callback with no plan access.

Use two public operations:

1. `prepareSweep({ root? })` returns the pure core result after graph/Git observation;
2. `commitSweep(plan, { root? })` applies and commits a successful plan.

The CLI composes them:

```text
prepare → refusal render/exit
        → plan render → read keystroke → decline/exit
                                      → commitSweep → receipt/exit
```

This ordering is simple, testable, and makes accidental pre-confirm mutation structurally difficult.

## Decision 3 — pure status rewrite

Export:

```ts
renderEpicStatusFlip(contents, flip): string
```

The function:

1. requires a leading fenced frontmatter block;
2. parses it with the existing `parseFrontmatter` helper;
3. verifies parsed `id` matches `flip.epicId`;
4. verifies parsed `status` equals `flip.from`;
5. requires exactly one top-level `status:` line in the frontmatter;
6. replaces only that line's scalar with `done`;
7. preserves all other bytes and the original newline style.

Missing/mismatched/duplicate fields throw a named `SweepApplyError` before any write.

Parsing plus exact line replacement avoids reconstructing YAML, which could reorder keys or rewrite
comments/body unrelated to the sweep.

## Decision 4 — prepare every byte before writing

`commitSweep` first reads all plan paths and calls `renderEpicStatusFlip` for all flips. It stores
original and replacement bodies in memory.

Only after every card validates does it write replacements. This prevents a malformed later card
from leaving an earlier card changed.

The plan invariant is also checked: `plan.pathspec` must exactly equal `plan.flips.map(path)`. Though
the core guarantees this, the effect boundary rejects a fabricated or drifted caller before writes.

## Decision 5 — Git operations

Use a local `runGit(root, args)` helper based on `Bun.spawn`, never a shell.

The sequence after writes is:

```text
git add -- <plan.pathspec...>
git commit --only -m <plan.message> -- <plan.pathspec...>
git rev-parse HEAD
```

`--` terminates Git options. `--only` ensures unrelated index entries cannot enter the sweep commit.
The provenance message is passed as one argument and is not shell-interpreted.

On Git failure after writes, the shell attempts best-effort rollback:

- rewrite each selected file to its original bytes;
- `git reset --quiet HEAD -- <pathspec>` to restore selected index entries to HEAD.

Rollback errors are appended to the operational error. This is not used for ordinary decline or
refusal, which happen before writes. It protects the local-first boundary from a failed commit.

The rollback command is programmatic scoped cleanup, not the prohibited destructive
`git reset --hard`; it addresses only the selected paths after this function staged them.

## Decision 6 — one-keystroke confirmation

Export `readSweepConfirmation(stdin = process.stdin): Promise<boolean>`.

- If `stdin.isTTY` and `setRawMode` exists, enable raw mode.
- Resume input and await the first data chunk or end/error.
- Treat the first character as consent only when `y` or `Y`.
- Pause input and restore its prior raw-mode state in `finally`.
- Do not require Enter.

The CLI writes the full plan plus `commit? [y/N] ` before calling the reader. It writes a newline
afterward because raw terminal input is not echoed consistently.

Piped fixture input uses the identical path and proves a single byte suffices.

## Decision 7 — rendering grammar

Successful plan presentation is newline-terminated except for the prompt:

```text
sweep
files:
  docs/active/epic/E-100.md
message:
sweep: close E-100

E-100 cleared by T-100-01, T-100-02
commit? [y/N] 
```

The renderer consumes only `SweepFlipSet` and preserves the core message verbatim.

Refusal rendering is:

```text
sweep refusal [<code>]: <reason>
<offender lines when present>
next: <nextAction>
```

The named code, offender paths, and recovery action remain visible. Refusals go to stderr and exit 1.

Decline prints `sweep declined — no files changed` and exits 0.

Commit success prints `sweep committed <sha>` and exits 0.

Operational errors print `sweep: could not commit — <reason>` or `sweep: could not prepare —
<reason>` and exit 1.

## Decision 8 — free CLI grammar

Add `{ cmd: "sweep" }` to `ParsedCommand` and a no-argument `parseSweepArgs` sibling of settle.

- bare `vend sweep` parses;
- every trailing positional/flag, including `--budget`, is usage;
- `sweep` joins `COMMAND_VERBS`;
- `vend sweep` appears in the free help group;
- help inventory expectations include the new verb.

The dispatch arm lazily imports `sweep.ts`. It does not import or touch play, budget, executor,
funding, or run-log modules.

## Decision 9 — testing strategy

### Focused sweep shell tests

Test `renderEpicStatusFlip` for:

- only the status line changes;
- comments/body/newline style remain;
- wrong epic ID refuses;
- stale `from` status refuses;
- duplicate/missing status refuses.

Test successful/refusal renderers for exact file list, provenance, named code, offenders, and action.

### CLI parser tests

Prove bare sweep, trailing-argument rejection, budget rejection, help placement, and suggestion
inventory behavior.

### Fixture acceptance

Create an isolated repo with a fully done epic and a partial epic. Commit the baseline.

Run three scenarios from clean baselines:

1. decline with `n`: exit 0, plan presented, HEAD unchanged, status empty, both cards unchanged;
2. confirm with `y`: exit 0, HEAD advances, message carries cleared IDs, only the done epic card is
   in `diff-tree`, its status is done, partial epic remains open, status empty;
3. presweep offender: dirty an in-scope board path, run with no consent requirement, exit nonzero,
   named `presweep-offenders` plus offender path, HEAD unchanged, offender remains as it was.

Use separate fixture repositories or reset by recreating a fixture per scenario. Separate fixtures
avoid cross-test rollback complexity.

### Repository verification

Run focused tests, typecheck, `git diff --check`, then full `bun run check`. Commit exactly the four
ticket-owned source/test paths via Lisa. Re-run focused tests post-commit.

## Scope boundary

This ticket does not alter sweep-core policy, settle behavior, presweep classification, board schema,
archiving, ticket/story state, executor interfaces, budget logic, run ledger, or Lisa phase handling.

