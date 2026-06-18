# T-002-01 — Design: decisions and rationale

Grounded in `research.md`. Each decision names the options, the choice, and what was
rejected and why.

---

## D1 — Transport: render-only client, mirror the proven pattern

**Options.** (a) Mirror mc-design-eval's `ClaudeStub` verbatim (render-only,
never called). (b) Define a fuller client with retries/fallbacks. (c) Skip the client
and hand-build requests.

**Choice: (a).** The pattern is *verified on this exact stack* (E-001, BAML 0.222.0 /
Bun 1.3.9). BAML requires a client to render `.request`; `ClaudeStub` is the minimal one.
A header comment states it is never called — the executable contract that BAML is
authoring-only here, not transport.

**Rejected.** (b) adds transport semantics to a client we never call — dead config that
invites someone to wire a live metered path, violating the boundary. (c) throws away
BAML's request-building, which is the whole point of `b.request`.

```baml
client<llm> ClaudeStub {
  provider anthropic
  options { model "claude-opus-4-8"  api_key env.ANTHROPIC_API_KEY  max_tokens 32000 }
}
```

---

## D2 — `WorkPlan` schema: enums for closed sets, strings elsewhere

This is the **poka-yoke** decision — "shapeless work impossible by construction."

**Options.**
- (a) All fields `string` / `string[]`; let the gates (T-002-02) validate every value.
- (b) **BAML `enum`s for the four closed lisa sets** (`type`, `status`, `priority`,
  `phase`), strings for open fields (`id`, `story`, `title`, `depends_on`, `purpose`,
  `advances`, `doneSignal`).
- (c) Enums plus regex/constraints on ids, depends_on referential checks in BAML.

**Choice: (b).** The ticket's explicit goal is that *shapeless work is impossible by
construction*. A `phase` of `"halfway"` or a `type` of `"epic"` is shapeless; a BAML enum
makes those **unrepresentable** in the parsed type — the strongest poka-yoke available at
the schema layer, and it costs nothing. Open fields (ids, titles, the value triplet) are
free-text by nature and cannot be a closed set.

**Rejected.**
- (a) pushes *all* shape enforcement onto the gates, discarding the type system's
  free guarantee. The charter says structure is the *final* poka-yoke, but that is about
  judging **worth** by value — it does not argue against typing the shape.
- (c) over-reaches: referential integrity (do `depends_on` ids resolve? is the graph a
  DAG?) and grounding (does `advances` hold?) are **semantic** — they are the
  allocation/value/bounds gates' job (T-002-02), not the type's. Keeping them out of BAML
  preserves a clean seam: **BAML owns shape, gates own semantics.**

**Schema (final).**

```
enum DraftType     { task  bug  spike }
enum DraftStatus   { open  in_progress  review  done  blocked }   // see D4 on hyphen→underscore
enum DraftPriority { critical  high  medium  low }
enum DraftPhase    { ready  research  design  structure  plan  implement  review  done }

class TicketDraft {
  id string  story string  title string
  type DraftType  status DraftStatus  priority DraftPriority  phase DraftPhase
  depends_on string[]
  purpose string       // one line: what this advances
  advances string[]    // charter invariants / epic outcomes it serves (P1..P7, epic ids)
  doneSignal string    // how we'll know it landed (a check/test/observable)
}
class StoryDraft {
  id string  title string  type DraftType  status DraftStatus  priority DraftPriority
  tickets string[]     // ordered ticket ids
}
class WorkPlan { stories StoryDraft[]  tickets TicketDraft[] }
```

(`StoryDraft.type` is included for symmetry; lisa stories are `type: story`. See D4.)

---

## D3 — Ordering carried positionally, not by an index field

**Options.** (a) Rely on **array order** of `stories[]` / `tickets[]` for "ordered."
(b) Add an `order: int` field per draft.

**Choice: (a).** The ticket says "ordered `StoryDraft`/`TicketDraft`." Array order is the
natural, un-falsifiable encoding — there is no way for an index field to *disagree* with
the array, which is a class of bug avoided. The allocation gate (T-002-02) checks the
*dependency* ordering (DAG) anyway; presentation order is just the array.

**Rejected.** (b) duplicates information (array position vs. field), inviting drift, and
SAP would happily parse `order: 7` on a 3-item list.

---

## D4 — Enum spelling: BAML identifiers can't hold hyphens

lisa's `status` uses `in-progress`; BAML enum members are identifiers (no hyphen). Two
options: (a) `@alias("in-progress")` on member `in_progress`; (b) member `in_progress`,
map at materialize time (T-002-03).

**Choice: (a) where it matters, but defer the mapping.** For T-002-01 the *type* is what
matters; the value-↔-frontmatter string mapping (`in_progress` → `in-progress`) is the
**materializer's** job (T-002-03), which serializes drafts to frontmatter. I will use
`@alias("in-progress")` on the one hyphenated member so BAML's own rendered
`{{ ctx.output_format }}` shows the model the real lisa token, keeping the prompt honest.
The remaining members are already valid identifiers. **Documented as a hand-off note** so
T-002-03 knows the enum-name↔frontmatter-token boundary.

---

## D5 — The prompt: steer by the charter's five criteria + the four gates

**Options.** (a) Terse "decompose this epic into tickets." (b) A prompt that encodes the
charter value function (Purposeful/Grounded/Allocatable/In-bounds/Verifiable) and the
four clearing gates as authoring guidance, ending in `{{ ctx.output_format }}`.

**Choice: (b).** P1 (author once) means the judgment lives in the authored prompt, paid
once. The model should *produce gate-passing work*, not lean on the gates to reject — the
gates are the contract, not the author. The prompt will: frame the model as the clearing
function between intent and capacity; require every ticket to name `advances` + a
`doneSignal`; demand right-sizing for one autonomous session and a dependency order that
never stalls; forbid non-goal violations (`N1–N4`); ground every unit in the supplied
project snapshot. It interpolates `{{ epic }}`, `{{ charter }}`, `{{ project }}` and ends
with `{{ ctx.output_format }}` (BAML injects the schema).

**Rejected.** (a) re-pays specification at run time (the exact waste vend exists to kill)
and produces valid-but-worthless work the gates then bounce — wasted dispense tokens.

---

## D6 — `generators.baml`: client at repo root, pinned version

Mirror mc exactly: `output_type "typescript"`, `output_dir "../"` (relative to
`baml_src/` → repo root `baml_client/`), `version "0.222.0"` (matches the installed CLI;
a mismatch makes `baml-cli generate` warn/fail). `.gitignore` already ignores
`baml_client/`, so the artifact is regenerated, never committed — consistent with treating
it as a build product.

---

## D7 — `baml:gen` wiring: regenerate before checks

**Problem.** `baml_client/` is gitignored; the test imports it; `tsc` and `bun test` both
need it to exist. **Options.** (a) Bun `pretest` lifecycle hook. (b) Prepend
`bun run baml:gen` to the `check` aggregate. (c) Document a manual `baml:gen` step.

**Choice: (b).** `"baml:gen": "baml-cli generate --from baml_src"` plus
`"check": "bun run baml:gen && bun run check:typecheck && bun run check:test"`. This
guarantees the generated client exists before *both* gates, in one place, and satisfies AC3
("`bun run baml:gen` regenerates `baml_client/`"). (a) Bun's pre/post script support is
less load-bearing than npm's and only covers `test`, not `typecheck`. (c) is a footgun —
a fresh clone's `check` would fail.

**Shared-file note.** This edits `package.json` (scripts only). It is the single
non-`baml_src/` touch; lisa serializes the commit. S-001's parallel tickets edit `src/`
modules, not scripts — low collision risk, named here per the concurrency rule.

---

## D8 — Test strategy: one parse pin, one render pin, no live call

**Options.** (a) Live `claude -p` round-trip. (b) Offline: a **canned** reply through
`b.parse`, and a render assertion over `b.request`.

**Choice: (b)** — exactly the AC, and the project's test rule (fabricated inputs, no spawn,
no network; mirrors mc's `fixtures.test`).

- **Parse pin.** A canned model reply (a JSON object matching `WorkPlan` with one story +
  two ordered tickets, valid enum values, full value triplet) → `b.parse.DecomposeEpic(text)`
  → assert a typed `WorkPlan`: stories/tickets lengths, a ticket's `advances`/`doneSignal`
  populated, enum fields equal their expected tokens, ordering preserved.
- **Render pin.** Set a dummy `ANTHROPIC_API_KEY` (render-only guard), `await
  b.request.DecomposeEpic(epicSentinel, charterSentinel, projectSentinel)`, extract the
  prompt text from `req.body.json().messages` (the bridge.mts shape), assert each sentinel
  appears in the rendered prompt. Restore/delete the key in a `finally`.
- **Empty-degradation note (not a failing test):** because `WorkPlan` is all-array, a
  malformed reply parses to empty arrays rather than throwing. I will add a short asserting
  test that a junk reply yields **empty** stories/tickets — pinning the SAP leniency as a
  *known, documented* behavior so T-002-02/03 build their malformed-detection on a verified
  fact, not an assumption.

**Rejected.** (a) is metered, flaky, and out of scope for an authoring ticket; the live
proof is T-002-04's job.

---

## What this design deliberately does **not** do

- No gate logic (T-002-02), no runner/materializer (T-002-03), no live dispense (T-002-04).
- No `depends_on` referential or DAG checks in BAML (semantic → gates).
- No commit by the agent — files are left for lisa to commit (project convention from
  T-001-02/03).
