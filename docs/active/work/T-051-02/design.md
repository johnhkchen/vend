# T-051-02 — Design

Decide HOW the `AskUserQuestion` denylist reaches the autonomous plays' argv, grounded in the
research. One choice, with the rejected alternatives and why.

## The decision

**Carry a `deny` list on `PlayTools`, thread it orthogonally through `resolveTools` → `toolFlags` →
(the already-built) `disallowedTools` seam, and declare it on the two autonomous plays via a single
shared `AUTONOMOUS_DENY` constant. Make `deny` independent of the strict/passthrough decision: a
deny-only declaration stays scoping-passthrough.**

Concretely:

1. **`src/play/autonomous-deny.ts` (new, addon-free):** `export const AUTONOMOUS_DENY = ["AskUserQuestion"] as const`
   — the single source of truth for "interactive tools an autonomous (headless `claude -p`) cast
   denies." Product policy, play-side, so the engine stays value-agnostic.
2. **`PlayTools` gains `deny?: readonly string[]`** (play.ts) — the sibling of `mcp`/`allow`, "tools
   to make UNAVAILABLE," documented as orthogonal to the strict allowlist.
3. **`resolveTools` carries `deny` on BOTH ok-variants** and keys strict-vs-passthrough on whether the
   play scopes an allowlist/MCP (`mcp` or `allow` declared), NOT merely on "declared ≠ undefined." A
   declaration with only `deny` → passthrough + deny.
4. **`toolFlags` emits `disallowedTools: deny` when `deny` is non-empty**, on both passthrough and
   strict results; ToolFlags gains `disallowedTools?`.
5. **`decomposeEpicPlay`** keeps strict `DECOMPOSE_TOOLS`, now with `deny: AUTONOMOUS_DENY`;
   **`proposeEpicPlay`** gains `tools: { deny: AUTONOMOUS_DENY }` (stays passthrough for scoping).
6. **No change to `castPlay`, `dispense`, `buildArgs`, `work.ts`, or the chain** — they already spread
   `tflags`/forward `disallowedTools`, and `work`/chain inherit the plays' declarations (research).

This makes the AC's pure proof natural:
`buildArgs(toolFlags(resolveTools(DECOMPOSE_TOOLS, avail), path))` contains `--disallowedTools
AskUserQuestion`; the same composition over `resolveTools(undefined, avail)` (an interactive play)
does not.

## Why these moves

- **Through `toolFlags`, not `CastOptions`.** The AC demands a PURE test of the *resolved dispense
  argv*. The resolution pipeline `resolveTools → toolFlags → buildArgs` is entirely pure and is the
  exact path cast-core.test.ts:251 already proves. Routing `deny` through it means the AC test is a
  pure composition with no `castPlay` (impure) involvement. A `CastOptions.disallowedTools` would only
  be observable by exercising the impure shell.
- **Play-keyed, single source of truth.** The epic scopes by PLAY ("propose-epic, decompose-epic,
  work"). Declaring `deny` on the two plays means *every* cast path inherits it — single verbs, the
  chain, and `work` — from ONE site per play. A cast-site approach would repeat the constant at four
  call sites (the two verbs + two chain steps) and risk drift.
- **Engine plumbs, play decides.** The engine merges a `deny` field it never interprets; the specific
  tool name (`AskUserQuestion`, a Claude Code built-in) lives play-side. Keeps `src/engine` generic.
- **Deny orthogonal to strict.** `--disallowedTools` is subtractive and needs neither `--allowedTools`
  nor `--strict-mcp-config`. Modelling it as independent lets `propose-epic` deny one tool while
  keeping its global-MCP passthrough — no accidental least-privilege lockdown.

## The one non-trivial sub-decision: the strict discriminator

Today `resolveTools` treats *any* declared `tools` object as strict (`{}` → strict-empty,
cast-core.test.ts:177). If left as-is, `proposeEpicPlay.tools = { deny: […] }` would flip propose-epic
to **strict with an empty allowlist** — stripping its built-ins and global MCP. That is a behavior
regression and out-of-scope E-032 territory.

**Resolution:** strict iff the declaration scopes an allowlist/MCP — `declared.mcp !== undefined ||
declared.allow !== undefined`. Otherwise passthrough (carrying any `deny`). Consequences:

- `{mcp, allow, …}` and `{allow:[…]}` → strict (unchanged — every real strict play).
- `{}` and `{skills:[…]}` → now **passthrough** (were strict-empty). Neither shape is used by any play
  (research grep); only two cast-core unit cases pin them. They are updated with rationale.
- `{deny:[…]}` → **passthrough + deny** (propose-epic) — exactly the goal.

This is a principled sharpening, not a regression: "declaring nothing to scope constrains nothing;
only `mcp`/`allow` opt into least-privilege; `deny` rides orthogonally." Documented in the
`resolveTools`/`ResolvedTools` doc-comments.

## Alternatives rejected

- **A — `CastOptions.disallowedTools`, set at the autonomous cast sites.** Threads `deny` via
  `castPlay` opts at `castProposeEpic`, `assembleAndCast`, and both chain steps. Rejected: four sites
  to keep in sync, cast-keyed rather than play-keyed (drifts from the epic's play scoping), and the AC
  proof would need the impure shell rather than a pure `toolFlags` composition.
- **B — global default in `buildArgs`/`dispense` (deny AskUserQuestion always).** Smallest diff, but
  violates the ticket: interactive/TUI casts would no longer be byte-for-byte unchanged, and the seam
  is meant to stay policy-free (E-051 "not a tool-policy redesign"). Rejected.
- **C — flip `propose-epic` to a full strict allowlist (Read/Grep/Glob + codebase-memory) plus deny.**
  Gives symmetry with decompose, but is an E-032 tool-provisioning change: it alters propose-epic's
  available tools, risks under-provisioning the propose agent, and exceeds this ticket's "denylist
  only" scope. Rejected — keep propose-epic's scoping untouched; add only the deny flag.
- **D — keep `{}`/skills-only → strict and special-case "deny-only → passthrough."** Preserves an
  unused quirk at the cost of a convoluted discriminator ("strict unless it has deny and only deny").
  Rejected for the cleaner, principled mcp/allow rule.
- **E — put `AUTONOMOUS_DENY` in `cast-core.ts` (engine).** Rejected: the engine must not name a
  specific Claude built-in; the value is play-side product policy.

## Risk & back-compat

- Plays without `deny` ⇒ `toolFlags` emits no `disallowedTools` ⇒ argv byte-identical. The two
  changed unit cases (`{}`, skills-only) are unused-in-production shapes.
- `decompose-epic`'s argv gains exactly one flag pair (`--disallowedTools AskUserQuestion`), inserted
  by `buildArgs` after `--allowedTools` and before `--strict-mcp-config` — its strict scoping is
  otherwise unchanged.
- `propose-epic` gains exactly `--disallowedTools AskUserQuestion` and nothing else (no `--allowedTools`,
  no `--strict-mcp-config`) — passthrough preserved.
