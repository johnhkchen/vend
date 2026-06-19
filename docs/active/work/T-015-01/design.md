# T-015-01 Design — max-turns mechanism through the seam

Decisions, grounded in `research.md`. One mechanism (R3/R12): an optional turn cap that
reaches `claude -p` as `--max-turns <n>`, threaded cast → dispense → buildArgs.

## Decision summary

1. Add `maxTurns?: number` to `buildArgs`'s inline parameter type; emit `--max-turns
   <String(n)>` with a guarded push **after** the existing flags.
2. Add `maxTurns?: number` to `DispenseOptions`; destructure it in `dispense` and pass
   it into the `buildArgs({ model, effort, system, maxTurns })` call.
3. Add `readonly maxTurns?: number` to `CastOptions`; forward it at the `dispense({…})`
   call site as `maxTurns: opts.maxTurns`.
4. No validation in the seam — emit whatever truthy value is supplied (mirrors
   `model`/`effort`). The guard is `if (maxTurns != null)` semantics — see §Guard.
5. Unit tests extend the `buildArgs` block only. No cast-level unit test (castPlay is
   the untested impure shell, matching `intervened`/`skipGates`).

## The guard condition — the one real design choice

The existing flags guard on truthiness: `if (model)`, `if (effort)`, `if (system)`.
For strings, truthiness is the right test — empty string means "not supplied". But
`maxTurns` is a **number**, and `0` is falsy. Three options:

- **(A) `if (maxTurns)`** — copies the existing pattern verbatim. Treats `0` as
  "absent". Simplest, visually consistent with the neighbours.
- **(B) `if (maxTurns != null)`** — emits the flag for any supplied number including
  `0` and negatives, only omitting for `undefined`/`null`.
- **(C) `if (typeof maxTurns === "number" && maxTurns > 0)`** — validates: only a
  positive cap emits a flag.

**Chosen: (A) `if (maxTurns)`.**

Rationale grounded in research:
- The ticket's hard requirement is "absent ⇒ argv identical to today; present ⇒ flag +
  value." (A) satisfies both: `undefined` omits, a real cap (any positive integer)
  emits.
- A `--max-turns 0` cap is meaningless (a run with zero turns does nothing), so folding
  `0` into "absent" under (A) is harmless and arguably correct — there is no legitimate
  caller intent to emit `--max-turns 0`.
- (A) keeps the four flag-guards visually identical (`if (model)`, `if (effort)`,
  `if (system)`, `if (maxTurns)`), which is the house style the research flagged. A
  reader scanning `buildArgs` sees one uniform pattern, not a special case.
- (B) buys the ability to emit `0`/negative, which no caller wants and the CLI would
  likely reject anyway — surface area with no use.
- (C) adds validation the ticket did not ask for and the precedent does not do. The
  seam is deliberately a thin, dumb argv builder; pushing validation here violates the
  "thin executor" boundary. If turn-cap validation is ever wanted, it belongs upstream
  (at the cast command / config layer), not in the pure argv builder. Documented as a
  rejected option, not a gap.

## Type: `number`, stringified at the push

`--max-turns` takes an integer. The option type is `number` so callers pass `5`, not
`"5"`. The argv array is `string[]`, so the push stringifies: `args.push("--max-turns",
String(maxTurns))` — exactly mirroring `effort`'s `String(effort)` coercion (research
§seam). This keeps the typed surface honest (a turn count is a number) while satisfying
the string argv contract.

## Placement in the argv — append after existing flags

The push lands **after** `--system-prompt` (i.e. last among the optional flags). Why:
- The AC requires that when `maxTurns` is absent the argv is "the existing flags +
  order unchanged." Appending a new flag at the end never perturbs the existing
  ordering for any combination that omits `maxTurns`.
- CLI flag order is not significant to `claude -p`, so position is a readability choice,
  not a correctness one. Last-among-optionals reads as "newest addition," and keeps the
  base+model+effort+system prefix byte-identical to today for every existing test.

## Threading: copy the `model` precedent exactly

Research established `model` as the cleanest analogue (declared on both option types,
destructured in `dispense`, forwarded at the castPlay call site, guarded in
`buildArgs`, unit-tested). `maxTurns` walks the identical path. Rejected alternative:
threading via `DispenseOptions` reuse in `buildArgs` — rejected because `buildArgs`
deliberately takes a narrow inline type (not `DispenseOptions`), so it only learns the
flag-relevant fields. Preserving that narrowness keeps the pure builder decoupled from
the dispense surface; we add one field to the inline type, nothing more.

## castPlay forwarding — mirror `model: opts.model`

At the `dispense({…})` call (cast.ts ~line 120) add `maxTurns: opts.maxTurns`. Like
`model`, `undefined` flows straight through to `buildArgs` and omits the flag — no
branch, no default. The existing comment style (`// undefined ⇒ no --model flag`) gets a
sibling note. A cast with no `maxTurns` therefore dispenses with byte-identical argv,
satisfying AC #3.

## Why this does not touch the stream-parse / budget / gate paths

`--max-turns` is purely an argv addition consumed by the `claude` binary. The seam's
stream consumer, the timeout latch, `check`/budget metering, and the play gate phase
all operate on what the process *emits*, not on how it was launched. A turn-capped run
that hits its cap simply terminates and emits its terminal `result` like any other run;
the existing classify/meter/gate path handles it unchanged. So AC #4 ("existing casts
and the stream-parse path unaffected") holds by construction — we add a launch flag and
touch nothing downstream of spawn.

## Confidence

High. This is a textbook clone of the `model` threading, the smallest of the four
optional-flag patterns already in the file. The only non-mechanical decision (the
number guard) is settled above with a documented rationale and two rejected options.
