# Structure — T-075-03-02 plain-empty-board-line

## Structural summary

This ticket is one localized pure-copy unit with a downstream composition proof.
No new module, export, type, schema, dependency, or effect seam is introduced.

Ticket-owned repository files:

| File | Change kind | Responsibility |
|---|---|---|
| `src/shelf/menu.ts` | modify | Own the new true-empty board sentence. |
| `src/shelf/menu.test.ts` | modify | Pin direct `renderMenu([])` output and legacy absence. |
| `src/shelf/home.test.ts` | modify | Pin the leading empty-board Home region and legacy absence. |
| `src/shelf/home-shell.ts` | comment-only modify | Keep graceful-degradation documentation accurate. |

Attempt artifacts created under the private Lisa directory:

| File | Phase |
|---|---|
| `.lisa/attempts/T-075-03-02/1/work/research.md` | Research |
| `.lisa/attempts/T-075-03-02/1/work/design.md` | Design |
| `.lisa/attempts/T-075-03-02/1/work/structure.md` | Structure |
| `.lisa/attempts/T-075-03-02/1/work/plan.md` | Plan |
| `.lisa/attempts/T-075-03-02/1/work/progress.md` | Implement |
| `.lisa/attempts/T-075-03-02/1/work/review.md` | Review |

Lisa publishes admitted phase artifacts later. None are written directly to
`docs/active/work/T-075-03-02/`.

## Existing component boundary

The relevant flow remains:

```text
local demand + lisa state
        |
        v
gather()                         impure read shell
        |
        v
rankActions()                    pure ordering
        |
        +------------------------------+
        |                              |
        v                              v
visibleActions()                renderMenu()
        |                              |
        v                              v
MenuCache.actions               BrowseResult.menu
        |                              |
        |                              v
        |                        homeText()
        |                              |
        |                              v
        |                        renderHome()
        |                              |
        v                              v
vend <sel> resolution           bare-vend text
```

The ticket changes only the string emitted by the true-empty branch inside
`renderMenu`. The structured cache branch remains untouched.

## `src/shelf/menu.ts`

### Existing public interface

No signature changes:

```ts
export function renderMenu(
  actions: readonly Action[],
  opts?: RenderOpts,
): string
```

No new exports.

No change to:

- `Action`.
- `ValueTier`.
- `Readiness`.
- `MenuCache`.
- `MENU_CACHE_VERSION`.
- `RenderOpts`.
- `rankActions`.
- `visibleActions`.
- `formatBudget`.
- Row formatting.
- Hidden footer formatting.

### Internal branch

The current branch retains its predicate and two-way distinction:

```ts
if (shown.length === 0) {
  return actions.length === 0
    ? <plain empty-board line>
    : "(no salient actions — vend --all)";
}
```

The selected true-empty string is:

```text
No work on the board yet.
```

The false branch remains exactly as it is.

### Purity and totality

- Inputs remain plain readonly values.
- Output remains a fresh string.
- No I/O is added.
- No throw path is added.
- Empty input remains a normal successful render.
- `opts.all` remains irrelevant when `actions` is empty.

## `src/shelf/menu.test.ts`

### Existing suite boundary

Retain the `renderMenu — numbered rows, hidden behavior, render format` describe
block. Do not add a new fixture helper or import.

### Empty-input test shape

Rename the test so its name records behavior rather than the removed string.

Suggested name:

```text
empty input → plain board line, no legacy jargon
```

Test body structure:

```ts
const out = renderMenu([]);
expect(out).toBe("No work on the board yet.");
expect(out).not.toContain("(no actions)");
```

This test provides:

- Exact line content.
- Single-line output by implication of exact equality.
- Direct pure function coverage.
- Explicit regression refusal for the named legacy phrase.

### Neighboring contract

Leave the next all-hidden test unchanged:

```ts
expect(renderMenu(allHidden)).toBe(
  "(no salient actions — vend --all)",
);
```

That adjacency documents the distinction between empty input and filtered input.

## `src/shelf/home.test.ts`

### Existing suite boundary

Retain the `renderHome — composes the three DL-6 regions` describe block and its
existing `board`, `rows`, and `ledger` fixtures.

### Empty-board test shape

Continue using the actual pure render path:

```ts
const out = renderHome({
  boardMenu: renderMenu([]),
  shelfRows: rows,
  ledger,
});
```

Then assert:

```ts
expect(out.split("\n\n")[0]).toBe("No work on the board yet.");
expect(out).not.toContain("(no actions)");
```

The first assertion scopes the positive check to the leading board region instead
of merely finding the sentence somewhere in Home. The second checks the entire
composed output for legacy leakage.

### Unchanged Home contracts

No change to:

- Populated board/shelf/ledger order.
- Board byte-for-byte pass-through test.
- Empty ledger output.
- Empty shelf output.
- No-card-chrome assertion.
- Ledger percentage or provenance tests.
- Shelf confidence fixtures.

The sibling ticket may change the concrete `ShelfConfidence` fixture shape in this
file's dependencies while this ticket runs. This ticket does not edit those types
or their tests; it will operate against the current working tree and rely on the
full gate to catch integration drift.

## `src/shelf/home-shell.ts`

### Comment-only boundary

Change the module-header degradation note from a quoted legacy output to a generic
description:

```text
no demand.md → the board's plain empty-state guidance line
```

No executable statement, import, export, option, or function changes.

This keeps `renderMenu` as the sole production owner of the exact copy.

## Files explicitly not modified

- `src/shelf/home.ts`: pass-through composition already has the right boundary.
- `src/shelf/gather.ts`: already delegates rendering to `renderMenu`.
- `src/shelf/shelf-row.ts`: sibling ticket ownership.
- `src/shelf/shelf-row.test.ts`: sibling ticket ownership.
- `src/ledger/recalibrate.ts`: out of story slice.
- `src/cli.ts`: bare-`vend` already delegates to `homeText`.
- Any menu-cache or press module: display text is not parsed for selection.
- Ticket frontmatter: Lisa owns phase/status transitions.
- Historical `docs/active/work/*` artifacts: immutable context, not current behavior.

## Dependency direction

Dependency direction remains acyclic:

```text
home-shell.ts
  -> gather.ts
       -> menu.ts
  -> home.ts
       -> shelf-row.ts

home.test.ts
  -> menu.ts
  -> home.ts
```

`menu.ts` gains no dependency on Home or any shell. Tests continue to import the
production units they verify, never the other way around.

## Commit structure

One meaningful ticket-owned source unit:

```text
plain empty-board copy + direct/composed contract + accurate shell comment
```

Commit it through:

```text
lisa commit-ticket
  --ticket-id T-075-03-02
  --message "plain empty-board guidance"
  --include src/shelf/menu.ts
  --include src/shelf/menu.test.ts
  --include src/shelf/home.test.ts
  --include src/shelf/home-shell.ts
```

The exact command will be passed as one shell invocation with repeated include
arguments. No `git add`, `git commit`, or ordinary-index operation is permitted.

## Verification structure

Fast feedback:

```text
bun test src/shelf/menu.test.ts src/shelf/home.test.ts
```

Literal audit on current source surface:

```text
rg -n --fixed-strings "(no actions)" src/shelf
```

Expected after implementation: the legacy phrase appears only in explicit negative
test assertions, not production output or positive expectations. Those negative
assertions are required by the acceptance criterion.

Full repository gate:

```text
bun run check
```

Final ownership audit:

- Inspect `git status --short`.
- Confirm the four ticket-owned source paths are not staged, modified, or untracked
  after `lisa commit-ticket`.
- Leave unrelated Lisa/sibling changes untouched.

## Resulting architecture

The resulting architecture is identical to the current architecture. The pure menu
model owns board wording, Home composes that string verbatim, the effect shell only
gathers data, and tests gate both the leaf output and the user-visible composition.
