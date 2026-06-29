# Research — T-060-01-02: thread-reduced-grounding-marker-onto-run-record

## The ticket in one line

Carry the `reducedGrounding` signal (produced by `resolveTools` in T-060-01-01) onto the
`runs.jsonl` run record, so a decompose clear that ran without `codebase-memory-mcp` is
**countable**, not invisible. AC: a test proves a degraded run writes the marker, a
fully-grounded run does not, and the marker survives the revive/normalize read boundary.

## Where the signal is born (upstream, already shipped — T-060-01-01)

`src/engine/cast-core.ts` — `resolveTools(declared, available)` returns a tagged
`ResolvedTools`. The strict success variant gained a `reducedGrounding: boolean` field
(cast-core.ts:80-90, computed at :122-137):

- `optionalMcp` ids that are PRESENT in `available` are scoped in like required ones.
- An ABSENT `optionalMcp` id is **dropped** (not andon'd) and flips `reducedGrounding` to
  `true` (`presentOptional.length < optional.length`, cast-core.ts:123-124).
- `reducedGrounding` is `false` on every fully-grounded strict result (including plays that
  declare no optional MCP at all).
- The flag exists ONLY on the strict variant `{ ok:true, …, strict:true, reducedGrounding }`.
  The passthrough variant `{ ok:true, passthrough:true, deny }` and the andon variant
  `{ ok:false, missing }` have **no** `reducedGrounding` field.

`src/play/decompose-epic-core.ts:72-76` — `DECOMPOSE_TOOLS` declares
`optionalMcp: ["codebase-memory-mcp"]`, `allow: ["Read","Grep","Glob"]`, `deny`. So a fresh
seed whose `.mcp.json` lacks `codebase-memory-mcp` resolves to
`{ strict:true, mcp:[], allowedTools:[…], reducedGrounding:true }`.

`src/engine/cast-core.test.ts` already pins this (lines 181-233, 321-, 385-): the "ABSENT
optional MCP … ⇒ DEGRADE w/ reduced grounding, NOT andon" test asserts
`reducedGrounding:true`, with the inline comment "the honest flag the run record
(T-060-01-02) threads" — that is this ticket's hand-off marker.

## Where the signal must land (the run record — the surface this ticket owns)

`src/log/run-log.ts` is the single home of the record shape. It is deliberately DECOUPLED
(imports nothing from `src/executor/` or `src/budget/`; shapes are local structural
contracts). It has a strict two-face / two-boundary discipline:

**Write face (asserts loudly):**
- `RunRecordInput` (run-log.ts:100-140) — what the runner hands in (pre-normalization).
- `RunRecord` (run-log.ts:142-178) — the normalized, frozen record serialized to one line.
- Per-field normalizers: `normalizeEnvelope`, `normalizeProject`, `normalizeIntervened`,
  `normalizeIntervenedAttested`, `normalizeTurnsUsed` (run-log.ts:216-257).
- `buildRunRecord` (run-log.ts:273-309) — asserts required strings, coerces optional data,
  spreads each optional field ONLY when present, returns `Object.freeze`.
- `serializeRunRecord` (run-log.ts:318-320) — one JSONL line, the countability invariant.

**Read face (degrades quietly, never throws):**
- `reviveRecord` (run-log.ts:353-430) — structurally revives one parsed value into a
  `RunRecord` or `null`. Re-runs the same normalizers; tolerates absent newer fields
  (back-compat) and drops malformed ones without rejecting the whole record.
- `readRuns` (run-log.ts:440-460) — splits JSONL, skips+counts torn lines.
- `loadRunLog` (run-log.ts:539-549) — the one impure read verb (ENOENT ⇒ empty).

**Impure write verb:** `appendRunLog` (run-log.ts:524-529) — composes the pure pair + fs.

### The established pattern for an optional one-way marker field

There are THREE precedents for an optional run-record field, and one is an exact structural
match for a one-way marker: **`intervenedAttested`** (T-028-01). It is a one-way flag —
`true | undefined`, never `false`. Its full pattern, which this ticket mirrors:

- `RunRecordInput.intervenedAttested?: boolean` (run-log.ts:131) and
  `RunRecord.intervenedAttested?: boolean` (run-log.ts:171) — both optional, documented.
- `normalizeIntervenedAttested(v) => v === true ? true : undefined` (run-log.ts:247-249) —
  only `true` is meaningful; `false`/absent ⇒ omitted (byte-identical to a legacy record).
- `buildRunRecord` spread: `...(intervenedAttested ? { intervenedAttested } : {})`
  (run-log.ts:304).
- `reviveRecord` derives it on read and spreads with the same one-way guard (run-log.ts:403-405,
  425).

The `turnsUsed` (three-state numeric) and `intervened` (three-state boolean) fields are the
other two precedents; both are tested with a dedicated `describe` block in run-log.test.ts
(turnsUsed at :459-508, intervened at :359-406) covering round-trip / absence / malformed /
legacy-line. Those tests are the template for this ticket's run-log unit coverage.

## Where the runner stitches signal → record (the wiring this ticket adds)

`src/engine/cast.ts` — `castPlay` is the single IMPURE orchestrator (NOT unit-tested by
design; its logic is the pure core). The relevant facts:

- `const resolved = resolveTools(play.tools, available)` (cast.ts:147).
- If `!resolved.ok` → the **missing-capability andon** early-return at cast.ts:148-178, which
  has its OWN `appendRunLog` call. This path is a STOP (required MCP missing); it is NOT the
  reduced-grounding degrade and carries no marker.
- Otherwise the cast proceeds; `resolved` here is the union of the passthrough and strict
  variants. The `reducedGrounding` field is present only on the strict variant — so reading
  it needs an `"reducedGrounding" in resolved` discriminant.
- The end-of-cast `appendRunLog` call is at cast.ts:282-309. It already spreads optional
  fields conditionally (`...(opts.intervened !== undefined ? …)`, `...(turnsUsed !== undefined
  ? …)`). The marker spread slots in alongside these.
- `stdout` honesty: the andon path writes a `· andon: …` line (cast.ts:150). T-060-01-01's
  review (note #2) flagged a one-line `process.stdout.write` honest reduced-grounding note,
  gated on `resolved.strict && resolved.reducedGrounding`, as the natural pair for THIS
  ticket. The epic intent ("log an honest reduced-grounding note") covers both surfaces.

## The integration boundary (how the AC's "a decompose run executed" is provable)

`src/engine/cast.test.ts` is the existing integration proof for `castPlay` via an injected
**stub executor** (the T-035-01 seam, `CastOptions.executor`). It casts a play end-to-end
WITHOUT spawning `claude`, writes a real `runs.jsonl` under a tmp dir, and reads the line back
with `JSON.parse`. This is the faithful home for "a decompose run executed without
codebase-memory-mcp writes a marker into runs.jsonl":

- A play fixture declaring `tools: { optionalMcp: ["codebase-memory-mcp"], allow: [...] }`.
- Cast under a tmp `projectRoot` whose `.mcp.json` is absent (or lacks the server) ⇒
  `readProjectMcpServers` returns `available: []` ⇒ `resolveTools` ⇒ `reducedGrounding:true`.
- Cast under a tmp root whose `.mcp.json` DOES declare the server ⇒ fully grounded ⇒ no marker.
- Read the line back via `reviveRecord` to prove the read boundary preserves the marker.

`src/engine/mcp-registry.ts` — `readProjectMcpServers(root)` reads `<root>/.mcp.json` shaped
`{ "mcpServers": { "<id>": {...} } }`; absent/malformed ⇒ `available: []`. This is the lever
the integration test pulls to make the same play resolve grounded vs degraded.

## Constraints & assumptions

1. **One-way marker** is the right shape (mirrors `intervenedAttested`): the AC says a
   fully-grounded run "does not" write the marker, so `false` must NOT be written — a marker
   present ⇔ degraded, a counting predicate. `true | undefined`, never `false`.
2. **Zero-coupling invariant** of run-log.ts must hold — no import from cast-core/executor;
   the field is a plain `boolean` on the input contract, duck-typed from `resolved`.
3. **Back-compat**: every pre-T-060-01-02 record (no marker) must still revive unchanged, and
   a fully-grounded record must be byte-identical to today — both fall out of the one-way spread.
4. **castPlay stays untested** (house rule); coverage lands on the pure run-log pair + the
   existing cast.test.ts integration harness (which already exercises castPlay through the stub).
5. The andon early-return path must NOT grow a marker (different condition).
6. Naming: the run-record field should be `reducedGrounding` to match `resolved.reducedGrounding`
   — one name from resolution to ledger.
