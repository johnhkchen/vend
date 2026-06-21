# T-057-03 — Research

_Descriptive map of the terrain `vend annotate` lands in. What exists, where, how it connects.
No solutions — those are Design's job._

## The ticket in one line

Add the thin, MCP-independent gesture `vend annotate <node-id> "<feedback>" [--seat <seat>]` — a
PURE arg parser plus a lazy-import dispatch arm — that casts the feedback as an `Annotation`-bearing
`expand-fragment`, so a cleared annotation STAGES a provenance-bearing signal and touches nothing on
the board. This is the OUTBOUND gesture half of E-057's round-trip; the inbound staging plumbing
(`Annotation` type + provenance render + cast threading) already shipped in T-057-01 / T-057-02.

## The CLI surface (`src/cli.ts`)

The whole CLI is one file with a strict, well-established two-layer shape (header, :1–:14):

1. **PURE parse layer.** `parseArgs(argv)` (:136) dispatches the first token to a per-verb
   `parse<Verb>Args` helper, each returning a `ParsedCommand` (a discriminated union, :42–:95) or a
   `{ cmd: "usage", error }`. NEVER reads fs, never exits, never imports a play / the BAML addon.
   This is the only layer `cli.test.ts` touches.
2. **Impure dispatch shell.** Guarded by `if (import.meta.main)` (:596–:881): a chain of
   `if (parsed.cmd === …)` arms, each doing a **lazy** `await import(...)` of the effectful module,
   running it, printing a one-line receipt, and `process.exit`-ing. The lazy import is load-bearing:
   it keeps the BAML native addon (and every play's transitive deps) OFF the pure-parse path so the
   test never loads the addon.

### The two parsers I mirror

- **`parseExpandArgs` (:352–:381)** — the closest sibling. Collects every non-`--budget` token into
  `positional`, joins with a space into one `fragment` (so quoted and unquoted multi-word inputs
  round-trip identically), `--budget` optional. `positional.length === 0 → usage "missing
  <fragment>"`. Returns `{ cmd: "expand", fragment, budget? }`.
- **`parseSvgArgs` (:176–:195)** — the `--seat` idiom. `let seat: Seat = "designer"` default; on
  `--seat`, reads the next word and membership-checks it against `SVG_SEATS` (:39, an as-const tuple
  `["designer","dev"]`); a miss → `usage` error `--seat must be one of designer | dev, got …`.

`annotate` is a HYBRID of the two: positional subject (peel the **first** token as `node-id`, join
the **rest** as feedback) PLUS the `--seat` flag. Unlike expand it carries no `--budget` (the ticket
signature omits it; the dispatch defaults to the play's warranted envelope, as the expand arm does).

### The expand dispatch arm (:656–:667), the mirror target

```
const { castExpandFragment, expandFragmentPlay } = await import("./play/expand-fragment.ts");
const budget = parsed.budget ?? expandFragmentPlay.budget;
const summary = await castExpandFragment({ fragment: parsed.fragment, budget });
process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
process.exit(summary.outcome === "success" ? 0 : 1);
```

The annotate arm is this PLUS an `annotation: { text, nodeId, seat }` field on the cast options.

## The inbound plumbing this gesture sits on top of (already shipped)

- **`Annotation` (expand-effect.ts :128–:132, T-057-01).** `{ readonly text; readonly nodeId;
  readonly seat: string }`. The raw fragment + provenance; mints no id, carries no Signal fields.
  Note `seat` is typed `string` (general — a future MCP caller could pass a github handle), wider
  than the CLI's designer|dev.
- **`renderAnnotationProvenance` (expand-effect.ts :160–:166, T-057-01).** Pure; renders the
  provenance trailer + back-link. Already unit-pinned.
- **`ExpandFragmentOptions.annotation?` (expand-fragment.ts :128) + `assembleExpandFragmentInputs`
  copying it (:147), T-057-02.** The cast is annotation-capable END TO END: pass `annotation` and it
  threads `inputs.annotation` → `expandFragmentEffect` → `renderStagedSignal(signal, annotation)`.
- **`expandFragmentEffect` (expand-effect.ts :180, T-057-02).** Writes ONE file under
  `STAGING_DIR = "docs/active/pm/staged"` (:36). NEVER `demand.md` / `epic/` / `stories/` /
  `tickets/`. The one-way-authority invariant is asserted directly in `expand-effect.test.ts`.

So the entire staging behavior the AC names ("stages a provenance-bearing signal and touches
nothing on the board") is ALREADY built and tested at the effect level (T-057-02 AC#1 effect test).
This ticket only adds the CLI mouth that calls it with an annotation.

## The test surface (`src/cli.test.ts`)

PURE-only: imports `{ parseArgs, parseBudgetArg, USAGE }` (:2) — never the dispatch, never BAML
(header :4–:6). Per-verb `describe` blocks of `expect(parseArgs([...])).toEqual({...})` cases. The
expand block (:148–:171) and svg block (:410–:447) are the exact templates: happy parse, multi-vs-
single-token join, missing-subject usage, bad-seat usage, `USAGE.toContain` for the banner line.

## Constraints / assumptions surfaced

- **No fs/BAML in the parser.** Hard house rule; the parser stays a pure string→union function.
- **`cli.test.ts` cannot test the live cast.** The dispatch arm is unexported, inside
  `import.meta.main`, and the cast spawns BAML/Claude. The "end-to-end" guarantee is therefore
  delivered by COMPOSITION: parse (tested here) + the annotation-capable cast/effect (tested in
  T-057-02). The dispatch arm itself is the thin untested shell, exactly like every other arm.
- **Seat domain.** The work-graph is rendered per seat, and only `designer`/`dev` have presets
  (presets.ts :36–:39); a founder has no view to annotate. So the CLI flag's domain is `SVG_SEATS`
  even though `Annotation.seat` is the wider `string`. Design decides whether to reuse `SVG_SEATS`.
- **Budget.** Ticket signature has no `--budget`; the dispatch defaults to `expandFragmentPlay.budget`.
- **`Seat` is already imported** into cli.ts (:14, for svg) — no new import needed for the type.
