# Design — T-075-03-02 plain-empty-board-line

## Decision summary

Render a truly empty board as:

```text
No work on the board yet.
```

Keep the existing all-hidden guidance unchanged. Pin the new sentence directly in
both the pure menu test and the composed Home test, and add an explicit negative
assertion for the legacy phrase in both outputs. Refresh the Home shell's stale
module comment without changing its behavior.

## Design goals

1. Make the empty bare-`vend` board understandable without Vend-specific jargon.
2. Preserve the honest meaning of the empty input.
3. Preserve the separate meaning of a non-empty board whose rows are hidden.
4. Keep the pure-core/impure-shell boundary intact.
5. Leave menu cache and press-selection semantics byte-for-byte unchanged.
6. Turn the wording into an enforceable contract in both named test surfaces.
7. Avoid new API, type, schema, or shared-copy machinery for one local sentence.
8. Stay disjoint from sibling ticket `T-075-03-01`.

## Copy requirements derived from the contract

The ticket does not prescribe an exact replacement, but it does prescribe the
properties the replacement must have:

- It is a single plain line.
- It appears for `renderMenu([])`.
- It appears at the top of the empty-board Home composite.
- It does not contain `"(no actions)"`.
- It communicates no board demand without introducing another internal term.
- It remains honest about the data actually known by `renderMenu`.
- It does not imply that hidden actions do not exist in the all-hidden branch.

The function knows only that its `actions` input is empty. It does not know that
the entire project is complete, that no useful work exists, or that no future work
will be staged. The line should therefore describe the board rather than make a
global claim about the project.

## Copy options

### Option A — `No work on the board yet.`

Advantages:

- Plain sentence rather than a parenthetical status token.
- “Work” is ordinary language and matches what the board represents.
- “On the board” scopes the claim to the staged surface the function renders.
- “Yet” keeps the empty state non-final without promising that work must appear.
- It does not confuse an empty action list with project completion.
- It reads naturally as the first line of the three-region Home screen.
- It contains no CLI syntax or internal ranking vocabulary.

Costs:

- “Board” is still a product surface noun, though it is common non-technical
  language and describes the visible context directly.
- The sentence is slightly longer than the current parenthetical token.

Assessment: best fit for plainness plus honesty.

### Option B — `Nothing to do right now.`

Advantages:

- Very conversational.
- Short and immediately understandable.
- Avoids all product nouns.

Costs:

- Overstates what the renderer knows.
- An empty staged board can coexist with un-staged project work.
- It can read as project completion rather than an honest empty local surface.
- “Right now” implies a readiness judgment that an empty input cannot substantiate.

Assessment: rejected because smoother copy would weaken the honest boundary.

### Option C — `No work is ready.`

Advantages:

- Short.
- Connects to the idea of actionable work.

Costs:

- `actions.length === 0` does not reveal whether work exists but is blocked.
- Readiness is a typed internal property only when an action exists.
- The separate all-hidden branch is the branch that actually knows rows exist but
  are filtered.
- It risks collapsing the empty and hidden states the current conditional keeps
  distinct.

Assessment: rejected as semantically unsupported.

### Option D — `The board is empty.`

Advantages:

- Exactly true of the renderer input.
- Plain and concise.
- No product-internal ranking language.

Costs:

- Sounds like a diagnostic label rather than useful interface copy.
- “Empty” is accurate but colder and less orienting than the selected sentence.
- It provides no sense that an empty initial state is ordinary.

Assessment: viable, but less human than Option A.

### Option E — `No demand on the board yet.`

Advantages:

- Closely matches the implementation's demand-side semantics.
- Accurately describes why the action list is empty.

Costs:

- “Demand” is part of Vend's information-architecture vocabulary.
- The epic explicitly targets tokens that require a reader to learn Vend's model.
- It is less kitchen-table plain than “work.”

Assessment: rejected because it replaces one internal label with another.

## Chosen wording

Choose Option A:

```text
No work on the board yet.
```

This sentence preserves the narrow evidence available to `renderMenu`: there are
no action rows on this board. It does not claim the repository is finished or that
no blocked/unparsed work exists. It also reads as prose rather than metadata,
removing the “header leak” quality called out by the ticket.

## Behavior branch design

Keep the existing conditional shape:

```ts
if (shown.length === 0) {
  return actions.length === 0
    ? "No work on the board yet."
    : "(no salient actions — vend --all)";
}
```

Only the true empty-input literal changes. The non-empty/all-hidden branch retains
its current command guidance because:

- It has a different factual basis.
- It tells the operator how to reveal real rows.
- The story and ticket name only the empty-board leak.
- Changing it would broaden this ticket into a second vocabulary decision.

The implementation can remain on one line if the formatter keeps it readable;
the structural point is that the predicate and branch boundaries do not move.

## Test contract design

### Direct menu contract

In `src/shelf/menu.test.ts`, replace the legacy empty-input test with a plain-copy
contract:

```ts
const out = renderMenu([]);
expect(out).toBe("No work on the board yet.");
expect(out).not.toContain("(no actions)");
```

The exact equality proves the entire one-line output. The explicit negative
assertion is logically redundant with exact equality but valuable because the
acceptance criterion names legacy-copy absence as an independent regression gate.
It makes reviewer intent immediate and preserves the defect's language in the test
contract.

Keep the all-hidden test unchanged so the state distinction remains covered.

### Composed Home contract

In `src/shelf/home.test.ts`, continue constructing the board through
`renderMenu([])` and then passing it to `renderHome`. Do not hard-wire a board
string directly into the composer fixture; using the real pure menu function proves
the intended path.

Pin the first Home region exactly:

```ts
const out = renderHome({ boardMenu: renderMenu([]), shelfRows: rows, ledger });
expect(out.split("\n\n")[0]).toBe("No work on the board yet.");
expect(out).not.toContain("(no actions)");
```

This is stronger than a generic `toContain` because the contract is specifically
about the bare-`vend` header/leading region. The existing fixture's shelf and ledger
content remains populated, so the proof isolates only the empty board.

## Literal duplication in tests

The exact sentence will appear in production and in two independent tests. Do not
export a `EMPTY_BOARD_LINE` constant for the tests to import.

Reasons:

- Tests that compare an implementation to its own exported constant do not pin
  user-visible copy independently.
- This ticket has one localized sentence, not a shared domain value used by
  multiple production modules.
- Home receives the rendered board string and does not need the literal.
- Three direct literals are easier to audit than an API added solely to avoid test
  duplication.

The duplication is intentional contract duplication, not divergent production
logic.

## Source comment design

`src/shelf/home-shell.ts` currently says the no-demand degrade path prints the
legacy phrase. That comment would be false after the behavior change.

Refresh it to describe the behavior generically, for example:

```text
no demand.md → the board's plain empty-state guidance line
```

Do not duplicate the selected sentence in the comment. `renderMenu` remains the
single production owner of the copy, while the comment stays accurate if the exact
wording is polished later under an explicit ticket.

No `home-shell.ts` executable line changes.

## Rejected implementation approaches

### Change `renderHome` instead of `renderMenu`

Rejected. `renderHome` receives an opaque pre-rendered board string and intentionally
passes it through. Rewriting it there would duplicate menu semantics, miss direct
`renderMenu([])` callers, and weaken the board-region boundary.

### Change `browseShelf` or `homeText`

Rejected. Both are effect orchestration layers. The copy decision is pure and
already has a pure owner. Conditional rewriting in an impure shell would create two
possible render contracts and require unnecessary I/O-path tests.

### Introduce a general empty-state formatter

Rejected. Other empty states have distinct meanings: no playbooks, no runs, no
visible actions, and no board actions are not interchangeable. A generic helper
would erase domain distinctions or add abstraction without reuse.

### Rewrite every historical occurrence

Rejected. Prior work artifacts record the behavior that existed when those tickets
landed. The current ticket and story also quote the legacy text to define the bug.
Runtime output and current contract tests are the meaningful absence boundary.

### Add an impure Home-shell integration test

Rejected. The existing architecture keeps BAML-bearing play imports off pure test
paths. The behavior is fully determined by `renderMenu` plus `renderHome`, both
fixture-tested directly. No new I/O decision is introduced.

## Risk analysis

- Copy regression risk: controlled by exact assertions in two suites.
- Legacy phrase recurrence risk: controlled by explicit negative assertions.
- Hidden-state regression risk: controlled by the unchanged all-hidden golden test.
- Home placement risk: controlled by exact first-region assertion.
- Cache/press risk: no structured data or cache code changes.
- Type risk: no type surface changes; full typecheck still runs.
- Concurrent-ticket risk: no `shelf-row` files are touched.
- Comment drift risk: refresh the one current source comment that quotes old output.
- Scope-creep risk: leave all other parenthetical empty states unchanged.

## Design decision

Implement the selected line at the existing pure branch, strengthen the two named
tests with exact positive and explicit negative assertions, update the stale Home
shell comment, run focused tests and the full repository gate, then commit only the
four exact ticket-owned source/test paths through Lisa.
