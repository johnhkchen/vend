# T-057-03 — Design

_Options, tradeoffs, decisions — grounded in Research. One choice per question, with what was
rejected and why._

## The shape of the decision

The gesture is mechanically a mirror of `parseExpandArgs` + the expand dispatch arm. The real design
questions are four, all small: (1) how to split node-id from feedback, (2) how to type/validate the
seat, (3) whether to carry `--budget`, (4) how the AC's "end-to-end stages … touches nothing" clause
is actually pinned. Each is decided below.

## D1 — Positional split: peel-first vs two-strict-positionals

The signature is `vend annotate <node-id> "<feedback>" [--seat <seat>]`: TWO positionals where
`expand` had one. Options:

- **(A) Peel-first, join-rest (CHOSEN).** First non-flag token → `nodeId`; the remaining non-flag
  tokens joined with a space → `feedback`. So `annotate T-055-01 "this is rough"` and `annotate
  T-055-01 this is rough` both yield `nodeId:"T-055-01", feedback:"this is rough"`.
- (B) Strict two-positional. Require exactly two tokens; reject 3+. Rejected: it breaks the unquoted
  multi-word feedback that every sibling gesture (`chain`, `expand`) deliberately supports, and
  surprises a user who forgets quotes. The whole point of the join idiom (parseChainArgs header,
  :308–:312) is that quoting is optional.

**Why A:** it is the exact `parseExpandArgs` join idiom with the first token peeled — minimal
divergence, maximal consistency. A node-id is a single shell token by nature (`T-055-01`), so peeling
exactly one token for it is unambiguous; everything after is the human's sentence.

Missing-subject errors fall out cleanly: no first token → `usage "missing <node-id>"`; first token
but nothing after → `usage "missing <feedback>"`. This satisfies the AC's "rejects a missing
node-id/feedback with the usage error, mirroring parseExpandArgs."

## D2 — Seat type & validation: reuse `SVG_SEATS`/`Seat` vs free string

`Annotation.seat` is `string` (T-057-01, deliberately general). The CLI flag could be:

- **(A) Reuse `SVG_SEATS` + `Seat`, default `"designer"` (CHOSEN).** Membership-check `--seat` against
  `["designer","dev"]` exactly as `parseSvgArgs` does; the parsed command carries `seat: Seat`.
- (B) Accept any non-empty string. Rejected: gives no usage error for a typo'd seat (the AC wants a
  usage error for bad input), and there is no rendered work-graph for a seat without a preset — only
  `designer`/`dev` have one (presets.ts :36–:39), so a `founder` literally has no view to annotate.
- (C) New `ANNOTATE_SEATS` tuple. Rejected: it would be identical to `SVG_SEATS` today; a second
  copy is drift waiting to happen for no gain. If annotation seats ever diverge from render seats,
  split then.

**Why A:** the seat is "the seat the work-graph was rendered for," whose domain IS `designer|dev`.
Reusing `SVG_SEATS` gives the same clean error string (`--seat must be one of designer | dev, got …`)
and the same default (`designer`, the non-dev seat — the round-trip's protagonist) the user already
knows from `vend svg`. `Seat` is assignable to `Annotation.seat: string`, so the dispatch passes it
straight through. The wider `string` type stays correct for future non-CLI callers (the E-057 MCP
follow-on), with no constraint lost — the type is general, this one entry point is specific.

## D3 — `--budget`: carry it or not

- **(A) No `--budget` flag; dispatch defaults to `expandFragmentPlay.budget` (CHOSEN).** The ticket
  signature omits it. The arm becomes `castExpandFragment({ fragment, budget: expandFragmentPlay.budget,
  annotation })` — simpler than expand's `parsed.budget ?? play.budget`.
- (B) Mirror expand's optional `--budget`. Rejected: scope creep beyond the ticket's explicit
  signature, and the ticket calls this the *thin* gesture. The warranted envelope (250k tokens,
  recalibrated from real use — expand-fragment.ts :97–:101) is the right default; a power user who
  needs a different budget can still `vend expand` directly. Keep the new mouth small.

## D4 — How the "end-to-end" AC clause is pinned

The AC bundles three things: (i) parse, (ii) usage banner, (iii) "running it end-to-end stages a
provenance-bearing signal and touches nothing on the board." (i) and (ii) are pinned directly in
`cli.test.ts`. (iii) cannot be a live test there — the dispatch arm is unexported, inside
`import.meta.main`, and the cast spawns BAML. So (iii) is pinned by **composition**:

- The parse test proves the arm receives `{ nodeId, feedback, seat }`.
- The dispatch (a 4-line thin shell, the house "untested shell" — cli.ts :1–:14) constructs
  `annotation: { text: feedback, nodeId, seat }` and calls the **already-annotation-capable**
  `castExpandFragment` (T-057-02).
- `expand-effect.test.ts` (T-057-02 AC#1) ALREADY asserts, against a real temp-dir root, that an
  annotated cast stages a file carrying `Provenance:` + the seat + the nodeId + the back-link, AND
  writes nothing to `demand.md`/`epic`/`stories`/`tickets`, AND that `STAGING_DIR` exists.

So "stages a provenance-bearing signal and touches nothing on the board" is a property of the
inherited effect, proven once at the layer that owns it. Re-asserting it through a (impossible) live
CLI cast would duplicate the T-057-02 test. **Decision:** do NOT add a redundant effect test; cite
the T-057-02 coverage in `review.md` and keep `cli.test.ts` to the parse + banner contract. This is
the same discipline every other dispatch arm follows — none of them has a live end-to-end CLI test.

## D5 — Union member & routing placement

Add `{ readonly cmd: "annotate"; readonly nodeId: string; readonly feedback: string; readonly seat:
Seat }` to `ParsedCommand`, route `argv[0] === "annotate"` in `parseArgs` right after `expand` (its
sibling), and place the dispatch arm right after the expand arm. Grouping the round-trip's two halves
(`expand` extracts demand from a fragment; `annotate` extracts it from feedback-on-a-node) keeps the
file's narrative order. No exhaustive `switch` over `parsed.cmd` exists (the dispatch is an if-chain),
so no other site needs updating.

## Rejected wholesale

- **A shared `parsePositionalThenBudget` util across chain/expand/annotate.** Rejected per the
  standing no-shared-util rule the parsers cite repeatedly (parseSteerArgs header :417–:424: "copy
  the five lines rather than couple two commands' parsers"). Copy the loop; do not couple.
- **A new effect / staging path for annotations.** Rejected: T-057-02 made the existing effect
  annotation-capable precisely so this ticket builds NO new effect. The gesture reuses the clearing,
  gates, pricing, and one-way-authority staging whole.
