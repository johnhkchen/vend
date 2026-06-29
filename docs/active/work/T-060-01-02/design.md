# Design — T-060-01-02: thread-reduced-grounding-marker-onto-run-record

## Decision summary

Add a **one-way `reducedGrounding` marker** to the run record, mirroring the
`intervenedAttested` (T-028-01) pattern exactly: `true | undefined`, never `false`. Thread it
from `resolveTools`' `reducedGrounding` flag, through `castPlay`'s end-of-cast `appendRunLog`,
into `buildRunRecord` / `reviveRecord`. Prove it at two layers: pure run-log unit tests
(round-trip / absence / malformed / legacy) and the existing `cast.test.ts` integration
harness (a real degraded cast writes the marker into `runs.jsonl`; a grounded cast does not).

## Question 1 — marker shape: one-way vs three-state

`resolved.reducedGrounding` is a real `boolean` (true on degrade, false on full grounding). So
the record field could be three-state (`true|false|undefined`, like `intervened`/`turnsUsed`)
or one-way (`true|undefined`, like `intervenedAttested`).

| Option | Fully-grounded run writes | Counting predicate | Back-compat |
|---|---|---|---|
| **A. One-way `true\|undefined`** | nothing (field omitted) | `"reducedGrounding" in rec` | byte-identical to legacy |
| B. Three-state `true\|false\|undefined` | `reducedGrounding:false` | `rec.reducedGrounding === true` | grounded records grow a field |

**Chosen: A (one-way).** Three reasons, all grounded in the research:

1. **The AC demands it.** "a fully-grounded run does **not** [write the marker]." Option B
   writes `reducedGrounding:false` on every grounded strict run — that IS writing a marker
   field, contradicting the AC. Option A omits it, so "does not write" is literally true.
2. **A marker is a one-way concept.** The epic frames it as "the run record carries an honest
   reduced-grounding marker" so "a degraded clear is countable." Counting = "how many records
   carry the marker." A one-way flag makes `grep reducedGrounding runs.jsonl | wc -l` the exact
   degraded-clear count. `intervenedAttested` is the in-repo precedent for precisely this
   "mark the exceptional case, leave the normal case byte-identical" intent.
3. **Back-compat falls out for free.** A grounded run and a pre-T-060-01-02 record are
   byte-identical (no field). No ledger rewrite, no new shape on the overwhelmingly-common
   grounded path.

Rejected B: it would make every normal decompose record grow a `false` field forever, inflate
the ledger, and force the counting predicate to distinguish `false` from absent for no benefit.
The `intervened`/`turnsUsed` three-state precedents exist because `false`/`0` are *meaningful
measured values* (a clean walk-away, a zero-turn run) a consumer wants to read back; a
fully-grounded run has no analogous value worth persisting — its grounding is the default.

## Question 2 — where the marker is read off `resolved`

`castPlay`'s `resolved` (after the `!resolved.ok` early-return) is the union of the
passthrough variant (no `reducedGrounding`) and the strict variant (`reducedGrounding:boolean`).
Reading it needs a discriminant.

- **Chosen:** `const reducedGrounding = "reducedGrounding" in resolved && resolved.reducedGrounding;`
  — the `in` check narrows to the strict variant (TS discriminated-union narrowing), and the
  `&& resolved.reducedGrounding` collapses the strict-but-grounded case to `false`. Then spread
  `...(reducedGrounding ? { reducedGrounding: true } : {})` so only `true` is written. Clean,
  total, no cast.

Rejected: `(resolved as any).reducedGrounding` — defeats the typed union the whole module
guards. Rejected: checking `"strict" in resolved` then `.reducedGrounding` — equivalent, but
`"reducedGrounding" in resolved` reads as exactly the field we want and narrows identically.

## Question 3 — does the andon path get a marker? No.

The `!resolved.ok` early-return (cast.ts:148-178) is the **missing-capability andon** — a
required MCP absent, a STOP, nothing dispensed. That is a different condition from
optional-grounding degrade. Its `appendRunLog` call stays untouched: a `missing-capability`
record never carries `reducedGrounding`. Only the end-of-cast append (the cast that actually
ran) can carry it. This keeps the marker meaning crisp: "this run executed, with reduced
grounding," never conflated with "this run refused for a missing required capability."

## Question 4 — the honest stdout note: include it?

T-060-01-01's review (note #2) deferred a one-line honest reduced-grounding stdout note to
"the marker ticket" (this one), and the epic intent reads "log an honest reduced-grounding
note." Two readings:

- **Narrow:** the ticket AC is strictly the *run-record field* + read boundary.
- **Coherent:** the epic's "honest reduced-grounding note" spans both the durable record AND a
  cast-time stdout line, and the sibling explicitly handed the stdout one-liner here.

**Chosen: include the stdout note**, gated on the same `reducedGrounding` flag, as a
one-line `process.stdout.write` next to the existing `· turns:` / `· effect` lines in
`castPlay`. Rationale: it is the natural pair of the marker, the sibling deferred it here by
name, it is one line in the already-impure shell (zero new pure surface, zero test burden —
castPlay is untested by house rule), and it directly serves the epic's "honest" framing — a
designer watching the cast SEES the degrade, not only an archaeologist reading the ledger
later. Low risk, high coherence. The AC test asserts the *record* (the durable, countable
surface); the stdout line is a courtesy that does not need its own assertion.

This is a judgment call; documented here so a reviewer can veto it without re-deriving it. If
rejected, drop the single `process.stdout.write` line — the AC is unaffected.

## Question 5 — test placement

Two layers, matching the module's two-face discipline:

1. **Pure run-log units** (`src/log/run-log.test.ts`) — a new `describe` block mirroring the
   `turnsUsed` / `intervenedAttested` blocks: round-trip (true survives build→serialize→revive),
   absence (omitted ⇒ byte-for-byte back-compat), one-way (`false` is never written),
   malformed-on-revive (a junk value drops, record stays valid), legacy-line (a pre-marker line
   parses with the field undefined). This is where the **revive/normalize read-boundary**
   half of the AC is proven directly and exhaustively.

2. **Integration** (`src/engine/cast.test.ts`) — the AC's "a decompose run executed without
   codebase-memory-mcp writes the marker into its runs.jsonl record (and a fully-grounded run
   does not)". Cast a play declaring `optionalMcp:["codebase-memory-mcp"]` through the stub
   executor: once under a root with NO `.mcp.json` (degraded ⇒ marker present in the line),
   once under a root whose `.mcp.json` declares the server (grounded ⇒ marker absent). Read the
   line back with `reviveRecord` to close the loop end-to-end. This is the faithful "executed"
   proof — it exercises the real `resolveTools → castPlay → appendRunLog → revive` chain.

Splitting this way keeps the read-boundary assertion exhaustive (cheap pure tests) while the
integration test proves the wiring is actually connected — the gap a pure test alone leaves.

## What this design does NOT do (scope discipline)

- No change to `resolveTools` / `ResolvedTools` — the flag already exists (T-060-01-01).
- No new outcome value, no schema-version bump (an additive optional field needs neither — it
  is the same back-compat story as `turnsUsed`/`intervened`, which did not bump `v`).
- No deep-grounding quality work — only the honest marker (epic out-of-scope).
- No touch to the andon record, the budget calibration (S-060-02), or the live re-drive (S-060-03).
