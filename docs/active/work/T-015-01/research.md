# T-015-01 Research — max-turns mechanism through the seam

Descriptive map of the code this ticket touches. No solutions proposed here.

## The ticket in one line

Add an optional turn cap that reaches the `claude -p` invocation: `--max-turns <n>`,
threaded from the cast (`CastOptions.maxTurns?`) → `dispense` → `buildArgs`, emitted
only when set. Absent ⇒ argv unchanged byte-for-byte.

## The seam: `src/executor/claude.ts`

The single metered seam. Spawns `claude -p --output-format stream-json --verbose`,
streams the JSON messages, returns the terminal `result`. Most of the module is PURE
and unit-tested; only `dispense` spawns a process and is intentionally untested.

Relevant surfaces:

- **`buildArgs({ model, effort, system })` — line 107.** The pure argv builder. Starts
  from a fixed base `["-p", "--output-format", "stream-json", "--verbose"]` and
  `push`es `--model`/`--effort`/`--system-prompt` *only when the corresponding option
  is supplied*. This is the established pattern the new flag must mirror exactly: a
  guarded `if (x) args.push("--flag", value)`. `effort` is coerced with `String(effort)`
  before pushing; the others are pushed as-is (already strings).
  - Signature is a single destructured options object with a `= {}` default, so
    `buildArgs()` and `buildArgs({})` both yield the base argv (tested, line 21–24).
- **`DispenseOptions` — line 65.** The options interface for `dispense`. Carries
  `prompt`, `model?`, `effort?`, `system?`, `onMessage?`, `timeoutMs?`. Each optional
  flag has a doc comment of the form "Omitted ⇒ no flag". This is where a new
  `maxTurns?` field would sit alongside the other CLI-flag options.
- **`dispense(opts)` — line 248.** The impure orchestrator. Destructures its options,
  calls `buildArgs({ model, effort, system })` (line 249), spawns, writes the prompt to
  stdin, consumes the stream, returns the terminal `result`. The `buildArgs` call site
  is the one place argv is assembled — anything new must be passed through here.

`buildArgs`'s parameter type is an *inline* structural type
(`{ model?: string; effort?: string; system?: string }`), NOT a reference to
`DispenseOptions`. So the function signature and the dispense call site are the two
spots that must learn about `maxTurns`; they are not coupled by a shared named type.

## The CLI flag itself

`claude -p` accepts `--max-turns <n>` to cap the number of agentic turns the headless
run takes before it stops. It is the mid-flight bound IA-8 calls for: a way to stop a
run from spinning past a turn ceiling independent of the wall-clock `timeoutMs` latch
(`awaitChildClose`) and independent of the token/cost budget (the runner's meter).
The seam stays budget-agnostic; `--max-turns` is an executor-level cap on turns, not a
token budget — it lives naturally next to `--model`/`--effort` as an argv flag.

## The cast loop: `src/engine/cast.ts`

The play-agnostic spine. `castPlay(play, inputs, budget, opts)` renders the prompt,
calls `dispense`, meters, parses, gates, classifies, lands the effect, and appends one
run-log record.

Relevant surfaces:

- **`CastOptions` — line 34.** The per-cast runtime options bag. Already carries
  `subject`, `projectRoot?`, `project?`, `model?`, `runId?`, `transcriptDir?`,
  `runLogPath?`, `intervened?`, `skipGates?`. Each field is `readonly` and most carry a
  doc comment explaining the threading. This is where `maxTurns?` belongs — it is "a
  per-cast runtime value the play itself does not carry," exactly the bag's stated
  purpose.
- **The `dispense({…})` call — line 120.** Inside `castPlay`'s `try`. Currently passes
  `prompt`, `model: opts.model`, `onMessage`, `timeoutMs: timeoutMsFor(budget)`. Note
  the existing comment on `model`: `// undefined ⇒ no --model flag ⇒ CLI default`. This
  is the single call site that must forward `opts.maxTurns` into `dispense`.
  - Note: `effort` and `system` are part of `DispenseOptions` but castPlay does **not**
    currently pass them — only `model` is threaded from the cast today. So `maxTurns`
    threading mirrors `model`'s precedent specifically.

## How the threading precedent looks (model)

`model` is the cleanest analogue and the one to copy:
1. Declared on `DispenseOptions` (`model?: string`, line 68) with "Omitted ⇒ no flag".
2. Declared on `CastOptions` (`model?: string`, line 47) with its own doc comment.
3. Destructured in `dispense` and passed to `buildArgs` (line 248–249).
4. Forwarded at the castPlay call site as `model: opts.model` (line 120).
5. `buildArgs` guards it: `if (model) args.push("--model", model)` (line 109).
6. Unit-tested in `claude.test.ts`: present-appends, absent-omits, composes.

`maxTurns` follows the identical five-spot path, with one wrinkle: it is a **number**,
not a string, so the argv push must stringify (`String(maxTurns)`), mirroring how
`effort` is coerced.

## Tests: `src/executor/claude.test.ts`

The `buildArgs` block lives at lines 19–51. Three existing tests establish the pattern:
- "base flags with no options" — `buildArgs()` and `buildArgs({})` both → base argv.
- "appends model/effort/system when supplied" — all three flags in order.
- "omits each flag independently" — one flag at a time.

`dispense` has no unit test (it spawns); the in-line comment at the top of the file
(lines 14–17 of the test) states `dispense` is intentionally not unit-tested. New
coverage therefore lands entirely in the `buildArgs` block — no new test file needed.

`src/engine/cast-core.test.ts` tests the pure core of the cast (`classify`, the stream
sink, the model resolver). `castPlay` itself is the untested impure shell, so the
`CastOptions` change carries no direct cast-level unit test — it is type-checked and
proven via the existing live path. This matches how `intervened`/`skipGates` were added.

## Constraints & assumptions

- **Byte-for-byte invariance when absent.** The base argv and the existing flag order
  must not change. The guarded-push pattern guarantees this if `maxTurns` is pushed
  *after* the existing flags (or the test asserts the exact array either way).
- **Number vs string.** `--max-turns` takes an integer; the option type should be
  `number`. Argv entries are strings, so stringify at the push.
- **Zero new dependencies / no coupling.** The change is confined to two files plus the
  test. `cast.ts` already imports from `claude.ts`; no new import edges.
- **`bun run check`** = baml:gen + typecheck + `bun test`. Must stay green.
- **Validation scope.** The ticket does not ask the seam to validate `n` (e.g. reject
  0 / negative). Open question for Design: emit whatever is passed, or guard? The
  precedent (`model`/`effort`) does no validation — they emit whatever truthy value
  they receive.
