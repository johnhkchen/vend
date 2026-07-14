# T-057-03 — Review

_Handoff document. What changed, how it's tested, what a reviewer should know — without reading every
diff._

## What this ticket did

Added the thin, MCP-independent CLI gesture `vend annotate <node-id> "<feedback>" [--seat <seat>]` —
the OUTBOUND mouth of E-057's annotation→demand round-trip. It casts the feedback text as an
`Annotation`-bearing `expand-fragment`, so a cleared annotation STAGES one provenance-bearing signal
under `docs/active/pm/staged/` and touches nothing on the board. The gesture reuses T-057-01's
`Annotation`/`renderAnnotationProvenance` and T-057-02's annotation-capable cast/effect WHOLE —
it builds no new staging path, gate, or effect. Live comment FETCH (the E-057 follow-on) stays
deferred behind this seam; feedback arrives as plain CLI text.

## Files changed

| File | Change |
|---|---|
| `src/cli.ts` | USAGE line for `vend annotate`; new `annotate` member on `ParsedCommand` (`nodeId`, `feedback`, `seat: Seat`); `parseArgs` route; new pure `parseAnnotateArgs`; new lazy-import dispatch arm after the expand arm. |
| `src/cli.test.ts` | New `describe("parseArgs — annotate …")` block, 8 cases. |

One atomic commit (`abc3dfc`). +117 lines src, no deletions, no new imports (`Seat` was already
imported for `svg`; the cast is lazy-imported in the arm as for `expand`).

## How it works

`parseAnnotateArgs` is a HYBRID of `parseExpandArgs` and `parseSvgArgs`: it peels the FIRST non-flag
token as `nodeId` and joins the REST into `feedback` (so quoted and unquoted multi-word notes
round-trip identically — the expand join with the head removed), while its `--seat` block is the
`parseSvgArgs` idiom verbatim (default `designer`, validated against `SVG_SEATS`). It carries no
`--budget` — the dispatch arm casts at the play's warranted envelope (`expandFragmentPlay.budget`).

The dispatch arm builds `annotation: { text: feedback, nodeId, seat }` (text === fragment, per the
Annotation reuse contract) and calls `castExpandFragment`. Because T-057-02 already threads
`annotation` → `inputs.annotation` → `expandFragmentEffect` → `renderStagedSignal(signal,
annotation)`, the staged file gains the provenance trailer + back-link with NO new code here. The
parser stays pure (no fs/BAML); the dispatch arm stays the thin untested shell (house pattern).

## Test coverage

- **Parse (new, `cli.test.ts`, 8 cases):**
  - happy path `annotate T-055-01 "this is rough" --seat designer` → full parse (AC: "parses node id,
    feedback, and seat");
  - `--seat` omitted → defaults to `designer`; `--seat dev` selects dev;
  - multi-token vs single-token feedback join to the same string with the node-id peeled;
  - `annotate` alone → `usage "missing <node-id>"`; `annotate T-055-01` → `usage "missing <feedback>"`
    (AC: "rejects a missing node-id/feedback with the usage error, mirroring parseExpandArgs");
  - `--seat founder` → `usage` naming `designer | dev`;
  - `USAGE` contains `vend annotate` (AC: "the usage banner lists `vend annotate`").
- **End-to-end staging / board-untouched (inherited, NOT re-tested):** the AC clause "running it
  end-to-end stages a provenance-bearing signal and touches nothing on the board" is a property of
  the inherited effect, owned and asserted by `expand-effect.test.ts` (T-057-02 AC#1): against a real
  temp-dir root it pins the staged file's `Provenance:` line + seat + nodeId + back-link AND that
  nothing is written to `demand.md`/`epic`/`stories`/`tickets`. The annotate dispatch reaches that
  exact path by composition over `castExpandFragment(annotation)`. Re-asserting it through a (live,
  BAML-spawning, unexported) CLI cast is impossible in `cli.test.ts` and would duplicate T-057-02 —
  so it is cited, not copied (design.md D4).
- **Gate:** `bun run check` — `baml:gen` ok, `tsc --noEmit` clean, `bun test` **1295 pass / 0 fail**
  across 81 files (1287 prior + 8 new). The correct green gate is `bun run check` (there is no `lint`
  script). Precommit hook green on commit.

### Coverage gaps (intentional)

- The dispatch arm itself has no unit test — it is the thin impure shell every CLI verb shares
  (`cli.test.ts` deliberately imports only `parseArgs`/`USAGE`, never the dispatch or BAML). Its
  logic is the pure parser (tested) + the tested cast/effect; it is type-checked by `tsc`.

## Open concerns / notes for the reviewer

- **Seat domain narrower than the type.** The CLI validates `--seat` to `designer|dev` (`SVG_SEATS`)
  while `Annotation.seat` is the wider `string`. Deliberate: the work-graph renders only for seats
  with a preset, so those are the only seats with a view to annotate; the wider type stays correct
  for a future programmatic caller (the MCP follow-on may pass a github handle). `Seat` is assignable
  to `string`, so the dispatch passes it through unchanged.
- **No `--budget`.** Matches the ticket signature; the warranted envelope is the right default and a
  power user can still `vend expand` for a custom budget. Easy to add later if demanded.
- **Feedback beginning with `--`** is collected as positional feedback (only `--seat` is a recognized
  flag) — mirrors `expand`, which collects any non-`--budget` token as fragment. Content judgment is
  the downstream honest-empty/value-link gates' job, not the parser's.
- **Nothing for a human to unblock.** Self-contained and green; the inbound half (T-057-01/02) and
  this outbound mouth now complete the CLI-text round-trip. The live comment FETCH is the named
  E-057 follow-on, out of scope by design.
