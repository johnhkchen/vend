# T-032-02 — Research

Descriptive map of the cast path, the seam, and the project-MCP binding surface T-032-02
threads through. T-032-01 already shipped the *pure* foundation (`PlayTools`, the extended
`buildArgs`, the pure `resolveTools`); this ticket wires the *impure* half — the `.mcp.json`
read, the cast-time resolution + flag threading, the missing-capability andon, and the proof
play's declaration. No solutions proposed here, only what exists and where.

## The four parts (from the ticket)

1. A committed, portable project `.mcp.json` + a reader yielding the `available` server-id set.
2. Cast-time resolution in `castPlay` → `resolveTools` → thread flags into `dispense`.
3. The missing-capability andon (IA-9 amber) *before* dispensing.
4. `decompose-epic` declares its `tools` as the proof play.

## What T-032-01 delivered (the foundation this builds on)

- `src/engine/play.ts` — `PlayTools { mcp?, allow?, skills? }` (all `readonly`, optional) and
  `Play.tools?: PlayTools` (the sibling of `maxTurns?`, ~line 187). Undeclared ⇒ passthrough.
- `src/engine/cast-core.ts` — `ResolvedTools` (3-variant tagged union) + the pure `resolveTools(declared, available)`:
  - `undefined` declared → `{ ok:true, passthrough:true }`
  - declared, all required `mcp` present → `{ ok:true, mcp, allowedTools, strict:true }` (fresh arrays)
  - declared, a required `mcp` absent → `{ ok:false, missing }` (declared order)
  - `skills` carried, never emitted (scope cut). Empty `{}` declaration → strict with empty arrays.
- `src/executor/claude.ts` — `buildArgs` widened with `mcpConfig?`/`allowedTools?`/`strictMcp?`,
  appended **after** `--max-turns`, each guarded (truthy / `length>0` / boolean) so the no-tools
  argv is byte-identical. Flag spellings verified against `claude -p --help`:
  `--mcp-config <path>`, `--allowedTools <comma-joined>`, `--strict-mcp-config`.
- Tests: `claude.test.ts` (buildArgs tool-scoping cases ~L75+), `cast-core.test.ts`
  (`resolveTools` 7 cases, L153+).

**Gap T-032-01 left open (its own design D-NOT):** `DispenseOptions` / `dispense` were *not*
touched — `dispense` still calls `buildArgs({ model, effort, system, maxTurns })` (claude.ts:288),
dropping the three new keys. `castPlay` does not resolve tools or read any registry. Closing
this is exactly T-032-02.

## The cast path (where resolution + threading land)

`src/engine/cast.ts` — `castPlay<I,O>(play, inputs, budget, opts)` (L111), the single impure
orchestrator (NOT unit-tested by house pattern; its logic is the pure core). Shape today:

1. L117–121: compute `root = opts.projectRoot ?? cwd()`, `project`, `startedAt`, `runId`.
2. L124: `prompt = play.render(inputs)` (BAML in-process for decompose).
3. L127–134: transcript path + `makeStreamSink`.
4. L140: `maxTurns = resolveMaxTurns(opts.maxTurns, play.maxTurns)` — **the precedent**: a
   per-cast resolver call, sibling to where `resolveTools` belongs.
5. L145–151: `dispense({ prompt, model, maxTurns, onMessage, timeoutMs })` — **the seam call to
   thread tool flags into**.
6. L167–176: meter → parse → gates → `classify`.
7. L184–197: effect on clear, else `· andon: ${verdict.outcome}` to stdout (L196) — **the
   existing andon stdout path** to mirror.
8. L214–241: the single `appendRunLog(record, opts.runLogPath ? {path} : {})`.

`CastOptions` (L34–72) carries `subject`, `projectRoot`, `project`, `model`, `maxTurns`,
`runId`, `transcriptDir`, `runLogPath`, `intervened`, `skipGates`. No tools field — and per the
design intent, the tools come off `play.tools`, not opts (mirrors `maxTurns` which prefers the
play default), so no new `CastOptions` field is strictly required.

`cast.ts` re-exports the pure core: `export * from "./cast-core.ts"` (L31) — so any new pure
helper added to `cast-core.ts` is reachable via `cast.ts` too.

## The seam (`src/executor/claude.ts`)

- `DispenseOptions` (L70–92): `prompt`, `model?`, `effort?`, `system?`, `maxTurns?`, `onMessage?`,
  `timeoutMs?`. **No** `mcpConfig`/`allowedTools`/`strictMcp` — must be added.
- `dispense` (L287): `const args = buildArgs({ model, effort, system, maxTurns })` (L288) — the
  one line that must forward the three new keys. `dispense` is the single untested impure verb;
  `buildArgs` (pure) already accepts them.
- `dispense` has exactly **one** caller in `src/`: `castPlay` (cast.ts:145). (chain.ts casts via
  `castPlay`, not `dispense` directly.) So threading lands at one seam.

## The dispatch / entry chain (back-compat surface)

`runDecomposeEpic` / `runPlay` → `assembleAndCast(play, opts)` (decompose-epic.ts:203) →
`castPlay(play, inputs, budget, castOpts)`. `assembleAndCast` passes `projectRoot: root`, so
`castPlay` already knows the repo root the `.mcp.json` lives under. No change needed in
`dispatch.ts` or `assembleAndCast` for the registry read — `castPlay` owns `root`.

CLI exit mapping (obs 20416): any non-`success` `RunOutcome` exits 1. A `missing-capability`
outcome therefore surfaces as a non-zero exit automatically — no `cli.ts` change needed.

## The proof play (`src/play/decompose-epic.ts`)

`decomposeEpicPlay: Play<DecomposeInputs, WorkPlan>` (L165) declares `name`, `summary`,
`render`/`parse`/`gates`/`effect`, `budget`, `maxTurns: DECOMPOSE_MAX_TURNS`, `card`. **No
`tools`** today ⇒ currently passthrough. The play *value-imports BAML* (`b` from
`baml_client/sync_client`), so it cannot be imported into a `bun test` process.

`src/play/decompose-epic-core.ts` — the addon-free pure core that DOES get imported by tests.
Already hosts `DECOMPOSE_MAX_TURNS` (L47, the maxTurns precedent). It imports only types + pure
modules. This is the natural home for a `DECOMPOSE_TOOLS: PlayTools` constant so the proof can
be unit-tested without loading BAML (mirrors `DECOMPOSE_MAX_TURNS` exactly; obs 22259).

## The project MCP registry source

No `.mcp.json` exists at the repo root today. The `codebase-memory-mcp` server is **global** in
`~/.claude.json`:

```json
"codebase-memory-mcp": { "type":"stdio", "command":"/Users/johnchen/.local/bin/codebase-memory-mcp", "args":[], "env":{} }
```

The `command` is an absolute machine path — **not portable**, must not be committed verbatim.
Claude Code's `.mcp.json` supports `${VAR}` / `${VAR:-default}` expansion, the indirection the
ticket calls for. The project-scoped entry for `/Volumes/ext1/swe/repos/vend` in `~/.claude.json`
is `{}` (empty `mcpServers`), confirming the binding is global today.

`.mcp.json` is Claude Code's native convention — the same file `claude -p --mcp-config` reads,
top-level shape `{ "mcpServers": { "<id>": {...} } }`. The reader's job is only to return
`Object.keys(mcpServers)` — the `available` id set `resolveTools` consumes.

## The andon precedent + design-language

`design-language.md`: **DL-5** — the andon is a *successful refusal* (IA-9), rendered amber,
never red, calm/protective voice; **DL-2** — amber is the single reserved saturated color, red
forbidden; **IA-10** — an andon rate is "gates working," not a defect count. `amber()` is a
*present-layer* helper (TUI); `castPlay` itself prints plain `· andon: <outcome>` to stdout
(L196) — the backend orchestrator's andon channel. The honest refusals already logged to the
ledger: `gate-failed`, `budget-exhausted`, `timed-out`, `id-collision`.

`RUN_OUTCOMES` (`src/log/run-log.ts`:46) = `["success","gate-failed","timed-out","budget-exhausted","id-collision"]`.
A `missing-capability` outcome is **not** yet in the vocabulary. Downstream consumers of
`RunOutcome` (surveyed): `walk-away.ts` builds `OutcomeMix` by seeding *every* `RUN_OUTCOMES`
key to 0 (`Object.fromEntries(RUN_OUTCOMES.map(...))`, L167) — a new key is auto-included, no
break; its summary line (L266) names specific outcomes but is additive/non-exhaustive.
`recalibrate.ts` `CENSORED_OUTCOMES = ["budget-exhausted","timed-out"]` (L60) — a missing-cap
refusal is correctly **not** a finishing-cost (like `gate-failed`/`id-collision`), so it should
*not* be censored. No exhaustive `switch` over `RunOutcome` exists that would fail to compile on
a new member (`assertOutcome` validates by membership, run-log.ts:196).

## Constraints / assumptions

- **Byte-identical back-compat:** undeclared plays must emit no tool flags. The argv for a
  passthrough cast must be exactly today's. Existing cast tests stay green.
- **Purity discipline:** `castPlay` is the untested impure shell; any new *decision* (resolved
  flags mapping, andon classification) belongs in pure `cast-core.ts` to stay testable. The
  `.mcp.json` *read* is impure → a thin reader, its parse half pure.
- **No live cast in the proof:** the AC's "live proof" is argv inspection via
  `buildArgs`/`resolveTools`, no LLM spawn — so the resolved-flags mapping must be exercisable
  without BAML and without spawning `claude`.
- **Scope cuts:** no `.vend/menu.json`/press changes; no skills injection; strict never flipped
  on for undeclared plays.
- **Portability:** the committed `.mcp.json` carries no secrets and no absolute machine paths.
- **`--allowedTools` is an allowlist:** in headless `-p`, specifying it gates *all* tools incl.
  MCP tools (named `mcp__<server>__*`). To let the play use a declared server's tools the
  allowlist must include an `mcp__<server>` entry — a fact the threading must honor to achieve
  "only its servers."
</content>
</invoke>
