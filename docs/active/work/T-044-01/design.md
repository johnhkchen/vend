# T-044-01 — Design: concrete-demand-ranker-recalibration

Decide the approach, grounded in Research. The defect is semantic; the fix is a prompt recalibration
plus a deterministic prompt-contract assertion.

## The decision in one line

Add one **board-authoring steering rule** — "a board signal must be concrete product demand;
self-referential / operational meta-tasks are demoted beneath it or excluded" — to the board-rules
section of **both** `steer.baml` and `survey.baml`, phrased as steering (not a schema field), and pin
it with a render-based **contract assertion** in `steer.test.ts` and `survey.test.ts`. Live
confirmation is named as deferred. This is the E-020 prompt-only recalibration shape.

## Where the rule goes (placement)

The two candidate sites, both grounded in Research:

- **(A) New `##` section** (a sibling of `## Honest-empty`), e.g. `## Concrete demand only`.
- **(B) New lead bullet** inside the existing board-rules list (`## The board …` ~78–90 in steer;
  `## Otherwise, author the board …` ~75–87 in survey).

**Chosen: (B), a lead bullet at the top of the board-rules list.** Rationale:
- The ticket names the insertion site as the board rules "~78-90" — a bullet there is the literal
  reading.
- The rule answers *"what qualifies as a board signal at all"*, which is exactly what the board-rules
  list governs; it reads naturally as the first qualifier before `ONE signal per real demand`.
- It mirrors how RANK BY LEVERAGE / GROUND IT already live as bullets in that list — consistent
  altitude and voice, no new top-level section to keep in sync across two files.
- Rejected (A): a whole new `##` section over-weights a single rule and creates more textual drift
  between the two prompts; the honest-empty block earns its own section because it has multiple
  sub-rules + calibration, this rule does not.

## Wording (the steering itself)

A single bullet, identical in both files (consistency, ticket step 2). Draft:

> - **CONCRETE DEMAND ONLY — a board signal must be concrete product demand:** a buildable
>   feature or change to *Vend itself* that **decomposes into an epic** (it changes what Vend is or
>   can do). **SELF-REFERENTIAL / OPERATIONAL META-TASKS are NOT demand** — running Vend on itself,
>   "run the sweep", settling or closing a prior run, dogfooding the loop are **process notes about
>   operating the machine**, not product demand. **Demote them beneath all concrete demand, or
>   exclude them**; NEVER rank a meta-task as a keystone. The test: does it change what Vend can *do*
>   (concrete demand), or is it just *operating* the machine (a process note, not a signal)?

This satisfies the AC literally: "must be concrete product demand (decomposes into an epic);
self-referential / operational meta-tasks demoted beneath it or excluded." It is phrased as an
instruction to the model (steering), uses the same imperative voice as the neighbouring RANK/GROUND
bullets, and names the exact meta-task examples the ticket lists (run on itself, run the sweep, settle
a prior run, dogfood the loop) so the model can generalize the category.

Why "demote beneath … or exclude" (both, not one): a meta-task is sometimes a legitimate low-priority
process note; forcing exclusion would lose it, forcing demotion would keep noise as a leaf. Leaving
the model both moves matches the ticket ("demoted beneath it or excluded") and the honest-empty
precedent's "abstain rather than manufacture" judgment latitude.

## Why a prompt fix, not a gate (re-confirmed against the code)

`steer-core.ts` gates are structural poka-yokes (Research): the self-referential signal is grounded,
keystone-ranked, well-ordered — it **passes all three**. A keyword gate ("self-referential",
"sweep", "run") would false-positive on legitimate Vend-feature demand ("improve `vend work`'s budget
handling", "run-log instrumentation"), which is the explicit anti-requirement (ticket AC#4 + the "DO
NOT add a keyword/pattern gate" note). The judgment is semantic, so it lives where semantic judgment
lives: the ranker prompt. `steer-core.ts` and `survey-core.ts` stay byte-unchanged.

## The deterministic proof (no live model)

Two layers, both offline:

1. **`baml:gen` green** — the edit is prompt **text** only (inside `prompt #" … "#`); no `class` /
   `function` / `client` change, so generation and the generated client shape are unaffected.
   `ClaudeStub` and all other functions unchanged.
2. **Contract assertion** — extend the existing render `describe` in `steer.test.ts` and
   `survey.test.ts`. The render bridge op returns the fully rendered prompt; assert it now carries the
   steering:
   - `expect(prompt).toContain("concrete product demand")`
   - `expect(prompt).toContain("self-referential")`

   These two phrases are distinctive, load-bearing, and present in both prompts, so one shared
   contract covers both rankers. This is the `render-client`/prompt-contract style the ticket cites —
   a deterministic check that the authored judgment is in the prompt, with no model call.

Rejected alternative: a separate new test file reading the raw `.baml` source text. Worse, because it
asserts on the *source* not the *rendered* prompt (a templating bug could pass source-text but break
render), and it duplicates harness the bridge already provides. The render assertion proves the
steering survives all the way into what the model actually sees.

## Live confirmation — named, deferred (not claimed)

Per the E-038→E-039 shape and AC#4: the real proof is the next `vend steer`/sweep staging a board
whose #1 is concrete demand, not "run the sweep". That cannot be produced deterministically here (it
needs a live model cast). `review.md` will **name** this as the deferred confirmation step; this
ticket does not claim it.

## Scope guard

In scope: text edits to the two `prompt` blocks; two render-test assertions. Out of scope (do not
touch): `steer-core.ts` / `survey-core.ts` gates, any `class`/`function`/`client` declaration,
`ClaudeStub`, the SAP/parse pins, and any live cast. No new output field, no new gate.
