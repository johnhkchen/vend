# T-033-01 — Design: precommit-policy-core

*Options, tradeoffs, decisions — each grounded in the research, not assumptions. Five
decisions, each with what was rejected and why.*

## D1 — The input shape for `classifyPrecommit`

**Options**

- **(A) Flat record** `{ ran: boolean; exitCode: number | null; stderr?: string }` — the ticket's
  primary suggestion.
- **(B) Tagged union** `{ tag: "ran"; exitCode } | { tag: "skipped"; reason }` — the ticket's
  "equivalent tagged shape" allowance.

**Decision: (A) the flat record.** It mirrors `head-build-core.ts`'s `BuildOutcome` precisely — a
plain DATA bag the impure verb fills with raw facts (`failedStep`, `detail` there; `ran`, `exitCode`,
`stderr` here), leaving all judgment to the classifier. T-033-02's runner will do
`const p = Bun.spawnSync(["bun","run","check:test"])` and map directly: `ran` = it spawned, `exitCode`
= `p.exitCode`, `stderr` = `p.stderr.toString()`. A flat record is the most frictionless surface for
that call site.

**Rejected:** (B) the tagged union is more "correct" (it makes `exitCode` un-representable when
`!ran`), but it forces the impure caller to branch *before* calling the classifier — pushing judgment
upstream into the shell/verb, which is exactly the inversion `ci-strategy.md` warns against. The flat
record keeps the verb dumb. We accept the modeling looseness (`exitCode` present-but-meaningless when
`!ran`) and neutralize it by checking `ran` *first* in the classifier. We type the input as a named
exported `interface PrecommitRun` so T-033-02 and the test share one contract (the R12 discipline).

## D2 — The output shape for `classifyPrecommit`

**Decision:** `interface PrecommitVerdict { block: boolean; reason: PrecommitReason; message: string }`
where `type PrecommitReason = "green" | "tests-failed" | "could-not-run"`.

This matches the ticket AC verbatim. Unlike `HeadVerdict` (which derives `ok` from `exitCode`), here
`block` and `reason` are **not** mutually derivable: `green` and `could-not-run` both yield
`block:false` but for opposite disciplines (pass vs. fail-open). So both fields are load-bearing and
neither is redundant — keep both. `message` is always present (even on `green`, a short ok-line) so the
invoker never has to synthesize text; this mirrors `HeadVerdict.message` always being set.

**Rejected:** collapsing to `{ block, message }` and inferring reason from block — loses the
green/could-not-run distinction the hook needs to render a *dim skip note* vs. *silent pass*. Rejected:
an `exitCode`-style numeric — the pre-commit hook only needs block/allow, not a 0/1/2 vocabulary
(that's the invoker's concern in T-033-02; the core speaks intent, the verb translates to an exit code).

## D3 — How to satisfy "exhaustively switched, no `default` on `reason`, tsc proves it"

**Options**

- **(A) If/return chain that narrows the input** (the `classifyBuildOutcome` idiom): check `!ran` →
  return could-not-run; then `exitCode === 0` → green; else tests-failed. No switch at all.
- **(B) Decision computes `reason` first, then a `switch (reason)` with no `default` builds the
  message, plus a `const _exhaustive: never = reason` guard in an unreachable trailing branch** so
  adding a fourth reason fails `tsc`.

**Decision: (B), layered on (A).** The classification *branches* on the input (A-style, three arms),
but the **message** is produced by a `switch (reason)` with one arm per reason and **no `default`**,
closed by an `assertNever(reason)` helper typed `(x: never) => never`. This is the literal reading of
the ticket ("exhaustively switched … no `default` branch on `reason` … `tsc` proves every case") and
gives the strongest compile-time guarantee: a future `reason` addition breaks the build at the switch,
not silently at a forgotten `default`.

**Rejected:** pure (A) — it's the existing codebase idiom and would be *acceptable*, but it proves
exhaustiveness only implicitly (via the final un-narrowed branch) and does NOT mechanically force a
future fourth reason to be handled. The ticket asks specifically for the switch-with-no-default
guarantee, so (B) honors intent. We introduce a tiny local `assertNever` (the codebase has none today,
confirmed by grep) — it stays **module-private**, is pure (throws only on a TS-impossible value), and
does not violate the "no throw on expected data" house rule because reaching it is a *programmer error*
(a new reason added without a switch arm), never a runtime data condition. This is the same posture as
`committed-core.ts`'s "malformed call is a programmer error."

## D4 — The committed-hooks-dir contract for `hookInstallState`

**Options**

- **(A) Inline string literal** `".githooks"` compared inside the function.
- **(B) Exported `as const` constant** `HOOKS_DIR = ".githooks"` — the single source of truth, mirroring
  `SOURCE_PREFIXES`.

**Decision: (B).** The R12 SHARED CONTRACT discipline: T-033-02's `.githooks/pre-commit`, its
`git config core.hooksPath .githooks` install step, and `check:hooks` must all agree on this path.
Exporting `HOOKS_DIR` lets T-033-02 derive it instead of re-typing the literal — widening or renaming
later is a one-line edit here. The test asserts the constant equals `".githooks"` (the
`SOURCE_PREFIXES` test precedent).

**Match leniency.** git stores `core.hooksPath` verbatim as configured. A real install runs
`git config core.hooksPath .githooks`, so the stored value is exactly `.githooks`. But a hand-edit or
a trailing slash (`.githooks/`) should still count as active — failing the gate when hooks *are* wired
would be a false andon. **Decision:** normalize by stripping one trailing `/` from the input before an
exact compare against `HOOKS_DIR`. We do NOT attempt fs-relative resolution (that would need I/O, which
purity forbids) — descriptive note carried from research: any absolute/`./`-prefixed exotic form is
treated as "not the committed dir" and yields the install message, which fails safe (it nudges toward
the canonical install, never falsely claims active).

## D5 — `hookInstallState` return shape and the absent/empty case

**Decision:** `interface HookState { active: boolean; message: string }`, with input typed
`string | null | undefined` (git returns no value when the key is unset). Cases:

- input is `null`/`undefined`/`""` → `{ active:false }`, message: *"git hook not installed — run
  `bun run hooks:install`"* (the E-012 "can't be silently absent" nudge).
- input (trailing-slash-normalized) `=== HOOKS_DIR` → `{ active:true }`, message: *"git pre-commit gate
  active (core.hooksPath = .githooks)"*.
- any other non-empty string → `{ active:false }`, message names the unexpected value and points at
  `hooks:install` so a mis-set path is visible, not mistaken for active.

`message` is always present so `check:hooks` can print it on both the pass and fail path (visibility is
the whole point — E-012 spirit). `active` and the message are independent enough that we keep both;
there is no exit-code vocabulary here because `check:hooks` is a fresh script T-033-02 authors and can
choose its own 0/1.

## Cross-cutting: purity and test posture (inherited, not re-decided)

Settled by the `src/ci/` precedent, restated so Implement doesn't relitigate:

- **Pure/total.** No `Bun.spawn`, `readFile`, git, clock, or network. Every export takes plain data,
  returns fresh values. tsc under `strict` enforces the call contract; no runtime type asserts.
- **Returned data, never thrown** — except the `assertNever` guard, which is unreachable on valid data
  and exists solely to make `tsc` reject an unhandled future `reason` (D3).
- **Test = ordinary pure-function test** (`bun:test`, imports only the core), one `describe` per export,
  `// AC:` fixtures called out, exact-value assertions. All three `classifyPrecommit` cases + both
  `hookInstallState` branches (plus the trailing-slash and unexpected-value edges) + a `HOOKS_DIR`
  contract test.

## What this design deliberately does NOT do

- No `.githooks/pre-commit`, no `package.json` script, no `git config` — all T-033-02.
- No spawning of `bun test` — the core only classifies a *reported* outcome.
- No reading of `.git/config` — `hookInstallState` receives the configured value as a string argument.
