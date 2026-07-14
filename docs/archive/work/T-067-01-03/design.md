# T-067-01-03 — bare-code-write-guard — Design

Options, tradeoffs, decision. Grounded in research.md.

## D1 — What the guard judges: cited inputs vs rendered outputs

**Options.**

- **A. Input-side**: before rendering, collect every cited code (each `t.advances` entry
  plus P/N-shaped tokens in `purpose`/`doneSignal`/the five story sections) and refuse
  any the snapshot misses.
- **B. Output-side**: render every file first (the pure pair is already total), then run
  one detector over the rendered bodies for a bare unglossed code; refuse on any hit.

**Decision: B, output-side.** The story acceptance IS an output-side property ("a grep
of the written bodies for a bare unexplained code comes back empty"), and the -02
handoff names the empty-snapshot golden — a RENDERED shape — as "the exact
counterexample your guard must make unreachable." Judging the bytes about to land makes
the contract structural: any surface a future renderer change adds (a new section, a new
line) is covered without the guard knowing it exists, whereas input-side must enumerate
prose fields and drifts the moment one is added. Output-side also collapses the
advances-vs-prose split (research: bounds gate sees only `advances`; prose is hole #1) —
after rendering, a bare code is a bare code regardless of where it came from. Rejected A:
it re-implements the renderers' resolution logic in parallel (which codes resolve, which
gloss-skip applies) and can disagree with them; B cannot disagree with the renderer by
construction.

## D2 — Which codes count as "bare": the policed prefix set

The full resolver shape `[A-Z]{1,3}\d+` is too wide — the -02 tests PIN that `forward-E1`
and `A3` pass through verbatim, and refusing them would false-andon legitimate prose.
The AC scopes the grep bar to "bare unexplained **P/N** codes".

**Options.**

- **A. Hardcode `{P, N}`** — exactly the AC.
- **B. Derive prefixes from the snapshot's keys** — police whatever families this
  charter defines. FAILS the handoff bar: an empty snapshot (prose-shaped charter)
  derives NO prefixes and would let `_Advances: P1_` write bare — the exact case the
  guard exists to make unreachable. Rejected outright.
- **C. Union: `{P, N}` floor ∪ snapshot-key prefixes** — the AC floor always holds, and
  a kitchen charter defining `K1..K3` in bold gets its K-family policed for free (the
  resolver is deliberately prefix-generic; the guard matching that stance keeps the two
  coherent).

**Decision: C.** Cost over A is one derived Set; benefit is that the honey-kitchen
driver (bare codes in kitchen artifacts, K-coded charters) is covered by the same
mechanism instead of a future ticket. The false-andon surface it adds is principled: a
charter that OWNS a prefix family makes an unresolvable code of that family a detectable
defect — the same rule the charter states for retired invariants. Foreign prefixes
(`E1`, `A3` against the vend charter) stay unpoliced and pass through, preserving the
pinned -02 behavior.

"Bare" keeps the renderers' own definition: not followed by ` — ` (the `(?! —)`
lookahead). A model-authored gloss (`P4 — its own words`) is explained, not bare — it
passes, exactly as `resolveCodesInProse` leaves it alone. The known degenerate trailing
`"P4 — "` (gloss-shaped, no gloss text) passes as before — accepted in -02's review,
unchanged here; the lookahead is the single shared definition of "glossed".

## D3 — Where the pure judgment lives

**Decision: exported pure function in materialize.ts** (`findBareCodes(files,
snapshot)`), beside `PROSE_CODE`/`resolveCodesInProse`. A separate id-guard-style module
was considered (the T-004-01 precedent) and rejected: the guard's regex must stay in
lockstep with `PROSE_CODE`'s shape and gloss-skip — same file, same constant, zero drift
surface. It takes the already-rendered `RenderedFile[]` + the snapshot, returns per-file
hits (deduped codes, render order), never throws, empty = clear — `detectCollisions`'
contract shape. materialize.test.ts unit-tests it directly (pure, addon-free).

## D4 — The typed refusal and the materialize reorder

**Decision:** new `BareCodeError extends Error` in materialize.ts, `IdCollisionError`'s
exact pattern: `name` set, structured payload (`hits: ReadonlyArray<{file, codes}>`),
message naming every file and its unresolved codes. Thrown by `materialize` when
`findBareCodes` returns hits.

`materialize`'s internal order changes to: gather ids → collision guard → build snapshot
→ **render ALL files into memory** → **bare-code guard (throw)** → mkdir × 2 → write
loop. Two consequences, both improvements: (a) the snapshot build and renders move ahead
of `mkdir`, so a bare-code refusal leaves not even an empty directory (the collision
test's ENOENT bar, now held by both guards); (b) render-then-write replaces the
interleaved render/write loop — the pure renders are cheap, and "zero partial output"
becomes structural for ANY future pre-write guard. Guard order (collisions first, then
bare codes) preserves the existing andon priority: identity before content.

## D5 — The named andon at the orchestration boundary

**Decision:** add **`"bare-code"`** to `RUN_OUTCOMES` (run-log.ts), document it in the
tuple's provenance comment, and have `decomposeEffect` catch `BareCodeError` and relabel
`{ok: false, outcome: "bare-code", detail: ...}` — the `IdCollisionError` branch's exact
shape, one more `instanceof` arm. Any other throw still propagates. Alternatives
rejected: reusing `graph-invalid` (lies — the graph is fine, the charter is short) or
`gate-failed` (it is not a gate STOP; gates.ts is fenced by story scope). Research
confirmed no exhaustive-switch consumer breaks: `OutcomeMix`, `test.each(RUN_OUTCOMES)`,
and read-side validation all derive from the tuple; `CENSORED_OUTCOMES` correctly
excludes a refusal outcome.

## D6 — The cast-level fixture proof

**Decision: new test file `src/play/bare-code-cast.test.ts`**, the
story-gate-cast.test.ts pattern verbatim (stub executor dispensing a canned WorkPlan
JSON, decompose-shaped fixture play wiring the REAL `clear` + REAL `materialize`, real
`castPlay`, tmp dirs, run-log assertions). Not appended to story-gate-cast.test.ts —
that file is T-066's story-gate proof; this is a different contract.

Two casts:

1. **Refusal**: a plan whose ticket PROSE cites a code the charter never defines (e.g.
   purpose "…aligns with P9…"), advances all resolvable — so the REAL bounds gate
   passes (it checks only `advances`) and the refusal provably belongs to the write
   guard, covering exactly the hole gates cannot see (research hole #1, the -02 concern
   #4 decision: **yes, prose is policed**). Asserts: outcome `bare-code`,
   `materialized: false`, both target dirs ENOENT (zero partial output), run-log record
   carries the outcome.
2. **Grep-clean pass** (the AC's second clause): a full plan — story with all five
   contract sections, multiple tickets, advances and prose citations — casts to
   `success`, then every written body is read back and
   `/\b[PN]\d+\b(?! —)/` finds nothing. The assertion IS the story-acceptance grep.

## D7 — Fixture fallout in existing tests (known, deliberate)

Both non-production `materialize` call sites hold PROSE-shaped charters (empty snapshot)
whose plans cite P-codes in `advances` — under the guard they now correctly refuse.
Fix at the fixture, not the guard:

- `story-gate-cast.test.ts` `CHARTER` → bold-shaped (`**P1 — Author once, run
  forever.** …`), same codes. The shell-refusal test never reaches materialize
  (unchanged); the contrast cast then writes glossed bodies — its `toContain`
  assertions are substring-safe.
- `chain-propose-decompose.test.ts` `CHARTER` → bold-shaped, same codes. It is written
  to `docs/knowledge/charter.md` by `seedRoot` and asserted `toBe` on pass-through —
  both survive a wording change.

materialize.test.ts's pure-render goldens (including the empty-snapshot degrade golden)
are untouched: the renderers stay total; the guard lives in the verb. The real-fs guard
section gains bare-code cases beside the collision ones.

## D8 — Rejected: policing at other layers

- **In the renderers** (throw on miss): breaks their documented totality and the
  empty-snapshot golden; refusal is the verb's job (the -02 comment already says so).
- **A sixth gate**: gates.ts is fenced by story scope, gates judge the PLAN (pre-render)
  and cannot see rendered bytes, and the story explicitly leaves the bounds gate
  untouched.
- **Read-side stripping in lisa/kitchen tooling**: fenced by Out-of-this-slice; the
  write-side fix is the point (P3 — refusal at source).
