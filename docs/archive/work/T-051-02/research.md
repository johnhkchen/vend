# T-051-02 — Research

Route an `AskUserQuestion` denylist through the **autonomous-cast path only** (propose-epic,
decompose-epic, work) so a piped `claude -p` agent finds the interactive tool unavailable and
proceeds, while interactive/TUI casts stay byte-for-byte unchanged.

Descriptive only — what exists and how it connects. T-051-01 (done, `66fc58e`) already built the
`disallowedTools → --disallowedTools` plumbing in the seam; this ticket WIRES it to the autonomous
plays.

## The tool-scoping path, end to end

A play's tool needs flow from a per-play declaration to a `claude -p` argv through five pure hops:

```
Play.tools: PlayTools            (src/engine/play.ts:130)         — the per-play declaration
  → resolveTools(declared, available)   (src/engine/cast-core.ts:87)  → ResolvedTools (pure decision)
  → toolFlags(resolved, mcpPath)        (src/engine/cast-core.ts:124) → ToolFlags  (argv-shaped projection)
  → ...tflags spread into dispense()    (src/engine/cast.ts:214)      — castPlay, the impure shell
  → buildArgs({...})                    (src/executor/claude.ts:142)  → string[] argv
```

Key fact: **`castPlay` already spreads `...tflags` into `dispense`** (cast.ts:214) and `dispense`
already destructures + forwards `disallowedTools` to `buildArgs` (claude.ts:311), and `buildArgs`
already emits `--disallowedTools <comma-joined>` under the empty-omitted rule (claude.ts:173, T-051-01).
So if `toolFlags` learns to emit `disallowedTools`, the value reaches the argv with **no change to
`castPlay`, `dispense`, or `buildArgs`** — the seam is finished. The gap is purely: `PlayTools` carries
no `deny`, and `resolveTools`/`toolFlags` neither read nor project one.

## The three resolution outcomes (cast-core.ts:71-94)

`resolveTools` returns a discriminated `ResolvedTools`:

- **passthrough** `{ ok:true, passthrough:true }` — play declared NO `tools` (field undefined) ⇒
  inherit the global MCP set, emit NO scoping flags (byte-identical back-compat).
- **strict** `{ ok:true, mcp, allowedTools, strict:true }` — play declared `tools` and every required
  `mcp` id is present ⇒ emit `--mcp-config` / `--allowedTools` / `--strict-mcp-config`.
- **andon** `{ ok:false, missing }` — declared `tools` but a required `mcp` id is absent ⇒ the
  missing-capability refusal `castPlay` halts on (cast.ts:148) BEFORE rendering/dispensing.

The discriminator today is **`declared === undefined`** → passthrough; **anything else** → strict.
`toolFlags` maps passthrough/`!ok` → `{}` (no flags) and strict → the three flags. `ToolFlags`
(cast-core.ts:99) has `mcpConfig?`, `allowedTools?`, `strictMcp?` — **no `disallowedTools`**.

Existing tests pin `tools: {}` → strict-empty and `tools:{skills:[...]}` → strict-empty
(cast-core.test.ts:177, 190) — i.e. "declaring the field at all opts into strict." Neither shape is
used by any real play (confirmed by grep below).

## Which plays are autonomous vs interactive

Grep `tools:` over `src/play/*.ts` (non-test): **only `decompose-epic.ts:205` (`tools: DECOMPOSE_TOOLS`)
declares tools today.** Every other play is undeclared ⇒ passthrough:

- **Autonomous (must deny AskUserQuestion):** `propose-epic` (passthrough today), `decompose-epic`
  (strict, `DECOMPOSE_TOOLS` = `{mcp:["codebase-memory-mcp"], allow:["Read","Grep","Glob"]}`,
  decompose-epic-core.ts:64). `work` is NOT a play — it drives the chain.
- **Interactive / TUI (must stay flag-free):** `steer`, `survey`, `note`, `expand` — all passthrough.

`AskUserQuestion` appears nowhere in `src/` except T-051-01's seam tests — there is no existing
constant for it.

## How `work` casts the autonomous plays (the inheritance path)

`work` does NOT call `dispense` or declare tools itself. `castWork` (work.ts:208) drives
`spendDown`, whose `castOne` calls **`castProposeDecomposeChain`** (work.ts:213). The chain
(chain-propose-decompose.ts:120-152) builds two `PlayStep`s with `play: proposeEpicPlay` and
`play: decomposeEpicPlay` and runs them via `castChain` → `castPlay`. So **`work` casts the two
plays directly through `castPlay`** — it never re-declares their tools. Therefore: **deny declared on
the plays is inherited by `work` and `vend chain` automatically**, with no edit to `work.ts` or the
chain. The single-cast verbs `castProposeEpic` (propose-epic.ts:161) and `assembleAndCast` /
`runDecomposeEpic` (decompose-epic.ts:225) likewise go through `castPlay(play, …)`, so they inherit
too. One declaration site per play covers every cast path.

## The seam already in place (T-051-01, `66fc58e`)

- `DispenseOptions.disallowedTools?: readonly string[]` (claude.ts:92) — "Empty/omitted ⇒ no flag."
- `buildArgs` destructures `disallowedTools` and emits `--disallowedTools <join(",")>` after
  `--allowedTools`, before `--strict-mcp-config` (claude.ts:173); empty array ⇒ no flag.
- `dispense` forwards it (claude.ts:311-312); `ClaudeExecutor.dispense` passes opts through.
- claude.test.ts has 5 green cases pinning the flag spelling, the comma-join-as-one-element rule,
  the allow-before-deny order, and the empty/omitted back-compat (claude.test.ts:94-145).

## Constraints & assumptions

- **Purity discipline.** The decision lives in the addon-free pure cores (`cast-core.ts`,
  `decompose-epic-core.ts`); `castPlay`/`dispense` stay the untested impure shells. The AC's
  "resolved dispense argv" test must therefore be a PURE `resolveTools → toolFlags → buildArgs`
  composition (the cast-core.test.ts:251 "live proof" precedent), no live model.
- **Deny is orthogonal to the allowlist.** `--disallowedTools` is a subtractive filter; it does NOT
  require `--strict-mcp-config` or `--allowedTools` to function. A play can deny a tool while staying
  scoping-passthrough — relevant because `propose-epic` must NOT be flipped to strict (that would
  strip its global MCP/built-ins, an E-032 concern out of scope here).
- **Back-compat.** Any play that does not declare `deny` must produce a byte-identical argv. The
  empty-omitted rule already in `buildArgs` carries this once `toolFlags` only emits the flag for a
  non-empty `deny`.
- **Single source of truth.** The denied-tool list is product policy (which built-ins a headless cast
  can't answer), not engine mechanism — it belongs on the play side, shared by both autonomous plays,
  with the engine merely plumbing a `deny` field it does not interpret.
- **Dogfood oracle (AC).** The E-049-style decompose that stalled on a mid-cast question is the live
  confirmation target; the deterministic argv test is the unit oracle.
