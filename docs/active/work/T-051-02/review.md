# T-051-02 — Review

Handoff doc. What changed, how it's tested, what a reviewer should check, and the one open concern.

## What changed

Routed an `AskUserQuestion` denylist through the **autonomous-cast path only** so a headless
`claude -p` agent finds the unanswerable interactive tool UNAVAILABLE and proceeds, rather than
hanging until the wall-clock latch kills the pane (E-049's stalled decompose). Two atomic commits:

**Commit 1 — `a2d9a44` — pure plumbing (no behavior change for any existing play):**

- `src/play/autonomous-deny.ts` *(new)* — `AUTONOMOUS_DENY = ["AskUserQuestion"] as const`, the single
  source of truth. Addon-free; shared by both autonomous plays; keeps the specific tool name off the
  generic engine.
- `src/engine/play.ts` — `PlayTools.deny?: readonly string[]` added (the subtractive sibling of
  `allow`/`mcp`; documented as orthogonal — deny-only does not opt into strict scoping).
- `src/engine/cast-core.ts`:
  - `ResolvedTools` carries `deny` on both ok-variants.
  - `resolveTools` — undefined → passthrough+`deny:[]`; **strict iff the play declares `mcp` or
    `allow`** (the `scopes` discriminator), else passthrough; both carry `deny`.
  - `ToolFlags.disallowedTools?` added; `toolFlags` emits it from a non-empty `resolved.deny` on
    passthrough AND strict.

**Commit 2 — `a249836` — wire the autonomous plays:**

- `src/play/decompose-epic-core.ts` — `DECOMPOSE_TOOLS` gains `deny: AUTONOMOUS_DENY` (strict + deny).
- `src/play/propose-epic.ts` — `proposeEpicPlay` gains `tools: { deny: AUTONOMOUS_DENY }` (deny-only ⇒
  stays scoping-passthrough, keeps its global MCP set).

**Deliberately unchanged:** `src/engine/cast.ts` (`castPlay` already spreads `...tflags` into
`dispense`), `src/executor/claude.ts` (T-051-01 already forwards `disallowedTools` and emits the flag),
`src/play/work.ts`, `src/play/chain-propose-decompose.ts` — `work`/`chain` inherit the denylist because
they cast the two plays through `castPlay`. One declaration per play covers every cast path.

## How it works end to end

`Play.tools.deny` → `resolveTools` (carries deny) → `toolFlags` (`disallowedTools`) → `...tflags` spread
in `castPlay` → `dispense` (forwards) → `buildArgs` (`--disallowedTools AskUserQuestion`, comma-joined as
one argv element, emitted after `--allowedTools`, before `--strict-mcp-config`). For propose-epic
(deny-only passthrough) the argv gains exactly `--disallowedTools AskUserQuestion` and nothing else.

## Test coverage

Full suite: **1188 pass / 0 fail** (77 files); `tsc --noEmit` clean; `check:precommit` green on both
commits.

- **AC oracle (PURE, no live model)** — cast-core.test.ts "autonomous-deny LIVE PROOF":
  - autonomous STRICT (mcp+allow+deny) ⇒ argv carries `--disallowedTools AskUserQuestion`, ordered
    after `--allowedTools` and before `--strict-mcp-config`.
  - autonomous DENY-ONLY (passthrough) ⇒ `--disallowedTools` WITHOUT `--allowedTools`/`--strict-mcp-config`/`--mcp-config`.
  - interactive/TUI (undeclared) ⇒ NO `--disallowedTools`, argv byte-identical to the base.
- **Wiring guard** — `AUTONOMOUS_DENY === ["AskUserQuestion"]`; `DECOMPOSE_TOOLS.deny` contains it; the
  real DECOMPOSE_TOOLS resolves to an argv carrying the flag. Prevents a silent drop on future edits.
- **Resolution/projection** — deny carried on passthrough and strict; empty deny ⇒ no flag
  (empty-omitted discipline); fresh-array (non-alias) guarantee extended to `deny`.
- **Regression** — the strict-discriminator sharpening (`{}` and skills-only → passthrough) touched
  only those two unit cases; both updated with rationale. No real play uses either shape.
- **Seam (T-051-01)** — claude.test.ts's 5 `disallowedTools` cases still green (untouched).

## Open concerns / handoff

- **Live dogfood NOT executed (the one AC gap).** The AC's "E-049-style decompose that previously
  stalled now completes unattended" needs a real `claude -p` subscription cast (spends tokens). I did
  not run it autonomously. The deterministic argv proof is green and the flag provably reaches every
  autonomous cast; the remaining confirmation is a manual `vend chain "<signal>"` / `vend run
  decompose-epic`, then inspect `.vend/transcripts/<run>.jsonl` for an AskUserQuestion-unavailable
  proceed (no hang). **Recommend a human run this once before closing the epic.**
- **Behavior change scope.** Only `{}`/skills-only `tools` declarations change semantics (now
  passthrough, were strict-empty). Confirmed unused by any play via grep; flagged for awareness.
- **propose-epic stays passthrough by design.** It now denies AskUserQuestion but is NOT otherwise
  scoped (still inherits the global MCP set). Tightening propose-epic to a strict allowlist is E-032
  territory, intentionally out of scope here.
- **No new flag spelling risk.** `--disallowedTools` was verified against `claude -p --help` and pinned
  in T-051-01; this ticket only routes a value into it.
