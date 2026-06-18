# T-002-03 — Design: decompose-epic-runner

Decide how to wire the convergence. The research shows every part is already
purity-split (pure core + one impure verb). The design principle here is the same:
**keep the orchestration thin and impure; push every decision into a pure core that
is unit-tested.** A live `claude`/`lisa` spawn is never the thing under test.

## The pipeline (one happy path, four stop points)

```
assemble inputs ─→ render (b.request) ─→ dispense (seam + timeoutMs) ─→
  parse (b.parse) ─→ clear (gates) ─→ materialize ─→ lisa validate ─→ success
        │                  │                              │              │
   (validation)      timed-out / budget-exhausted    gate-failed    (poka-yoke)
```

Four terminal outcomes, mapped 1:1 to `RunOutcome`:
- `timed-out` — `ClaudeTimeoutError` thrown by the seam. No result; nothing parsed.
- `budget-exhausted` — `check(budget, usage)` returns `exhausted` after the seam.
- `gate-failed` — `clear()` returns a STOP (incl. the empty-plan value STOP).
- `success` — cleared, materialized, and `lisa validate` passed.

On any non-success: **materialize nothing**, write exactly one run-log record, and
surface the andon to stdout. This is E-001's "refuses rather than emits half-cleared
work" made mechanical.

## Decision 1 — A pure outcome classifier, an impure orchestrator

The runner's *judgment* is: given (a dispense that returned-or-threw, a budget
outcome, a gate result, a validate result), what `RunOutcome` is this and do we
materialize? That judgment is pure. The *actions* (spawn claude, write files, spawn
lisa, append log) are impure.

**Chosen:** split `decompose-epic.ts` into a pure `classify(...)` →
`{ outcome, materialize: boolean, gateResults }` and an impure
`runDecomposeEpic(...)` that calls the seam/fs/lisa and uses `classify` to branch.
`classify` is unit-tested exhaustively (every terminal state + ordering);
`runDecomposeEpic` is the single untested verb (mirrors `dispense`/`appendRunLog`).

**Rejected — one monolithic async function with inline branching.** It would be
honest but untestable without a live `claude`, repeating the anti-pattern the whole
house style avoids. We'd be unable to pin "budget beats gate" with a fast test.

## Decision 2 — Budget exhaustion outranks a clean plan

If the run blew its token ceiling, the outcome is `budget-exhausted` **even if the
plan would have cleared**. P7 is a hard contract both ways — you didn't get what you
paid for, so nothing settles. So `classify` checks budget **before** the gate
verdict matters, and `budget-exhausted` ⇒ `materialize: false`.

Ordering of checks in `classify` (first match wins):
1. seam threw timeout → `timed-out`
2. `budgetOutcome.status === "exhausted"` → `budget-exhausted`
3. `isStop(gateResult)` → `gate-failed`
4. else → `success`

**Rejected — gate-first.** A sound plan from an over-budget run would materialize,
silently honoring a broken budget contract. That contradicts E-001 ("budget
exhaustion is a clean hard stop") and P7.

Note: an **error subtype** from `claude -p` (e.g. `error_max_turns`) needs no
special branch. Its (empty/garbage) result text SAP-degrades to an empty `WorkPlan`,
which the **value gate** stops as malformed → `gate-failed`. We let the existing
machinery absorb it (T-002-02 handoff #2: don't special-case empty), and merely log
`result.subtype` for diagnosis.

## Decision 3 — BAML called directly in-process (no bridge on the runner path)

The runner is a plain `bun` process, where the one-call-per-process addon limit
**does not apply** (memory 20232). So `runDecomposeEpic` calls
`b.request.DecomposeEpic(...)` then `b.parse.DecomposeEpic(...)` directly, reusing
`extractPromptText` from `decompose-bridge.ts` for the rendered text. The subprocess
bridge stays a **test-only** artifact.

**Rejected — drive BAML through the bridge subprocess in production.** Pure
overhead and a lost `onMessage` stream for no benefit outside `bun test`.

**Sync vs async client:** use `sync_client` (what the bridge already proved), since
render and parse are synchronous CPU work around the one live async call (the seam),
keeping the data flow legible. The seam is the only awaited I/O.

## Decision 4 — "Both surfaces" = live stdout + a durable transcript sink, the countable record is separate

AC#4 has two halves that the modules keep distinct:
- **"Every message streams to stdout AND the run log"** → the seam's `onMessage`
  hook fans each stream-json message to (a) a human line on **stdout** (live) and
  (b) an append to a **per-run transcript file** `.vend/transcripts/<runId>.jsonl`
  (durable). Both are the *transcript* surface.
- **"The run's outcome is logged once, countably"** → exactly one `appendRunLog`
  call to `.vend/runs.jsonl` at the end. T-001-04's ledger stays pristine (one
  record per run); we do **not** widen its schema to hold a transcript.

**Chosen:** a small `makeStreamSink({ runId, transcriptDir, write })` returning an
`onMessage` callback. Pure formatting (`formatMessage(msg) → string`) is unit-tested;
the file append + `process.stdout.write` are the impure edges, injected so the
classifier/formatter stay pure and the sink is testable with a fake writer.

**Rejected — only stdout, fold the transcript into the outcome record.** Loses the
"every message ... the run log" durability half of AC#4, and bloats the countable
ledger. **Rejected — a new transcript module/ticket.** Over-build; a 1-function sink
in the play layer suffices for this slice.

## Decision 5 — Materialize takes an output root; lisa validate is the impure tail

`materialize(plan, { storiesDir, ticketsDir })` writes files; `runDecomposeEpic`
composes those paths from a `projectRoot` (default repo root → `docs/active/…`,
redirectable so tests and T-002-04 never clobber the live board). Member→alias maps
and frontmatter/body rendering are **pure** (`renderTicketFile`, `renderStoryFile`,
`MEMBER_TO_ALIAS`) and unit-tested on fabricated `WorkPlan`s. The actual `writeFile`
+ `mkdir` is the impure verb. `lisaValidate({ projectRoot })` spawns
`lisa validate --path` and returns `{ ok, output }`; it is the **final** step on the
success path (AC#6) and a thin untested verb. A non-zero validate is a hard failure
the runner surfaces (defensive: a cleared plan that won't validate is a bug, logged).

**Rejected — materialize straight into `docs/active/` with no override.** Untestable
without mutating the live project; unsafe alongside a running `lisa loop`.

**Rejected — skip `lisa validate` (trust the structural gate).** AC#6 is explicit,
and the structural gate checks *field presence on drafts*, not the *written files'*
DAG/cross-file validity — `lisa validate` is a genuinely different, last poka-yoke.

## Decision 6 — CLI is a thin arg-parser over the runner

`src/cli.ts` parses `vend run decompose-epic <epic.md> --budget <ms>,<tokens>`,
reads/assembles via `project-context`, builds a `Budget`, calls `runDecomposeEpic`,
and exits non-zero on a non-`success` outcome (so a shell/CI sees the andon).
`--budget` parsing (`"<ms>,<tokens>"` → two positive ints) is a **pure** helper
(`parseBudgetArg`) — unit-tested for the malformed cases (`assertPositiveInt` in
budget then enforces the contract). Unknown subcommands print usage and exit 2.

**Rejected — a CLI framework dependency.** P5/charter favor a tiny local-first
surface; `Bun.argv` + a switch is enough for one hardcoded play. The v1 TUI (E-003)
is a separate epic.

## What stays out (honest scope)

- No retry/backoff, no multi-node DAG, no model selection UI — E-001 says build only
  the single lever (those generalize later).
- `runDecomposeEpic`, `materialize`'s write, `lisaValidate`, `appendRunLog`,
  `dispense` are **not** unit-tested — by design, their logic lives in the pure
  cores. The live end-to-end proof is **T-002-04**.
- The `model` logged: a runner option (default a constant id), passed to the seam
  (omitted ⇒ CLI default) and logged verbatim — the log requires a non-empty model.
