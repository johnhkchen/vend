# T-044-01 — Structure: concrete-demand-ranker-recalibration

The blueprint: file-level changes, exact edit sites, and ordering. Not code — the shape of the code.

## Files touched (4 modified, 0 created, 0 deleted)

| File | Change | Why |
|------|--------|-----|
| `baml_src/steer.baml` | Add CONCRETE-DEMAND lead bullet to `## The board` rules (~line 79) | The ranker prompt — primary recalibration |
| `baml_src/survey.baml` | Add the SAME bullet to `## Otherwise, author the board` rules (~line 76) | Keep the two rankers consistent (ticket step 2) |
| `src/baml/steer.test.ts` | Add contract assertion in the render `describe` | Deterministic proof the steer prompt carries the steering |
| `src/baml/survey.test.ts` | Add contract assertion in the render `describe` | Deterministic proof the survey prompt carries the steering |

No new files. No bridge change (the render op already returns the full prompt). No `steer-core.ts` /
`survey-core.ts` change (structural gates unchanged — AC#4).

## Edit 1 — `baml_src/steer.baml`

Section `## The board — author it by these rules (the *what*)` (currently lines 78–90). Insert a new
first bullet immediately after the section heading (line 78) and before the existing
`- ONE signal per real demand …` bullet (line 79). The bullet:

```
    - CONCRETE DEMAND ONLY — a board signal must be CONCRETE PRODUCT DEMAND: a buildable
      feature or change to Vend ITSELF that DECOMPOSES INTO AN EPIC (it changes what Vend is or
      can do). SELF-REFERENTIAL / OPERATIONAL META-TASKS are NOT demand signals — running Vend on
      itself, "run the sweep", settling or closing a prior run, dogfooding the loop are PROCESS
      NOTES about operating the machine, not product demand. DEMOTE them beneath ALL concrete
      demand, or EXCLUDE them; NEVER rank a meta-task as a keystone. The test: does it change what
      Vend can DO (concrete demand), or is it just OPERATING the machine (a process note)?
```

Indentation: 4 spaces + `- ` to match the surrounding bullets in the `prompt #" … "#` block.
No other line in the file changes. The `class Fork` / `class Steer` / `function SteerProject`
signatures, `client ClaudeStub`, and the `{{ charter }}` / `{{ project }}` / `{{ ctx.output_format }}`
template slots are untouched.

## Edit 2 — `baml_src/survey.baml`

Section `## Otherwise, author the board by these rules` (currently lines 75–87). Insert the **same**
bullet (verbatim wording, same indentation) immediately after the section heading (line 75) and before
the existing `- ONE signal per real demand …` bullet (line 76). The `class Board` /
`function Survey` / `client ClaudeStub` and template slots are untouched.

Consistency requirement: the bullet text must be byte-identical between the two files (so a single
shared contract phrase asserts both). The contract test keys on the substrings `concrete product
demand` and `self-referential`, both present in this wording.

## Edit 3 — `src/baml/steer.test.ts`

In the existing `describe("SteerProject — render (b.request, offline, render-only key)", …)` block
(currently lines 130–141), add a new `test` (or extend the existing render test with two assertions).
Preferred: a dedicated test for clarity:

```
test("the prompt carries the concrete-demand / anti-self-referential steering (T-044-01)", async () => {
  const r = (await RESULTS)[3]!;            // the render op (index 3, already in RESULTS)
  expect(r.ok).toBe(true);
  const { prompt } = r as { prompt: string };
  expect(prompt).toContain("concrete product demand");
  expect(prompt).toContain("self-referential");
});
```

No change to `RESULTS` / `runBridge` / the canned fixtures — the render op at index 3 already produces
the rendered prompt; the new test reads the same result. Type-only BAML imports unchanged (no native
addon loaded into the test process).

## Edit 4 — `src/baml/survey.test.ts`

Same addition in the existing `describe("Survey — render (b.request, offline, render-only key)", …)`
block (currently lines 111–121). The render op is also index 3 in survey's `RESULTS`:

```
test("the prompt carries the concrete-demand / anti-self-referential steering (T-044-01)", async () => {
  const r = (await RESULTS)[3]!;
  expect(r.ok).toBe(true);
  const { prompt } = r as { prompt: string };
  expect(prompt).toContain("concrete product demand");
  expect(prompt).toContain("self-referential");
});
```

## Ordering of changes

1. Edit the two `.baml` prompts (Edits 1, 2) — the substantive change.
2. `bun run baml:gen` — regenerate the client; must stay green (proves the prompt edits are valid
   BAML and the client shape is unchanged).
3. Add the two test assertions (Edits 3, 4).
4. `bun run check` (= `baml:gen && check:typecheck && check:test`) — full green.

Edits 1–2 before 3–4 because the tests assert on the rendered prompt; the prompt must carry the text
first or the new tests fail. `baml:gen` between them confirms the prompts are well-formed before the
test run consumes the regenerated client.

## Interfaces / boundaries (unchanged)

- Public BAML surface: `Steer`, `Board`, `Fork`, `Signal`, `SteerProject`, `Survey`, `ClaudeStub` —
  all unchanged. The edit is prompt **text**; no type, function, or client declaration moves.
- `src/play/steer-core.ts` (gates) and `src/baml/steer-bridge.ts` / `survey-bridge.ts` — unchanged.
- The contract lives in the test layer (render assertion) + the prompt text; no production code path
  (`castPlay`, the gates, the effects) changes behavior.

## Risk notes

- Render-text drift: if BAML's template renderer alters whitespace, the `toContain` substring checks
  are whitespace-tolerant within the phrase (the asserted phrases contain no internal newlines). Safe.
- Two-file consistency: the only maintenance hazard is the two bullets drifting apart. Mitigated by
  the shared contract phrases — if one file loses the wording, that file's render test goes red.
