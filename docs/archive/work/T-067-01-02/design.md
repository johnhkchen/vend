# T-067-01-02 — materialize-carries-code-text-at-cut — Design

Decisions with rationale, grounded in research.md. Rejections documented.

## D1 — What the pure render pair takes: the `CharterSnapshot`, not the raw charter string

**Decision:** `renderTicketFile(t, snapshot: CharterSnapshot)` and
`renderStoryFile(s, storyTickets, cutDate, snapshot: CharterSnapshot)`. The impure
`materialize` takes the raw `charter: string` and calls `snapshotCharterCodes` ONCE per cut.

- The snapshot IS "the settled code→one-liner contract both consumers build on" (story DAG
  rationale, T-067-01-01 review handoff verbatim: "build the snapshot once per cut … thread it
  into the render pair as a PARAMETER"). Taking the raw string would make each render call
  re-parse — trivially cheap, but it would smear the resolver call across N ticket renders and
  give the renderer two jobs (parse + format).
- The AC's "charter supplied as a render parameter" is a purity clause (the em-dash
  continuation says so: "— the pure render pair stays clock-free and addon-free"): the charter
  must arrive as DATA, not be read by the renderer. The snapshot is that data, one pure
  derivation along. This mirrors `cutDate` exactly — the impure verb does the one impure/
  costly acquisition, the pure pair receives a value.
- **Rejected:** raw `charter: string` on the render pair. Also workable and arguably more
  literal, but it duplicates parsing, buries the T-067-01-01 contract type, and gives
  T-067-01-03's guard (which needs the snapshot for its resolvability check, in `materialize`,
  before writes) no shared artifact to reuse.

## D2 — `materialize` signature: required third parameter `charter: string`

**Decision:** `materialize(plan, targets, charter: string)`. `decomposeEffect` passes
`ctx.inputs.charter` — the SAME string it already feeds `clear`'s `ClearContext` (story scope:
"the decompose runner that supplies the charter it already holds for ClearContext").

- Required, not optional: an optional charter would let a new call site silently mint
  bare-code artifacts — the exact failure this epic exists to kill. Compile-time forcing over
  runtime discipline (the `alias` house rule's spirit). The two test call sites already hold
  `CHARTER` fixtures in scope; updating them is a one-line change each.
- String, not snapshot, at this boundary: the effect holds a string; making every impure
  caller run the resolver invites drift (one forgets, passes an empty map). `materialize`
  becomes the single place cut-time resolution happens — "pay the resolution once, at the
  moment of materialization" (E-067 intent, literally).
- **Rejected:** widening `MaterializeTargets` into an options bag carrying charter. Targets
  is "where files go"; the charter is cut-time meaning. Mixing them muddies both, and a third
  positional parameter matches `renderStoryFile`'s existing `cutDate` precedent.

## D3 — The `_Advances:_` line: expand each code in place, semicolon-joined, miss degrades to the bare code

**Decision:** `` `_Advances: ${entries.join("; ")}_` `` where each entry is
`${code} — ${snapshot.get(code)}` when the snapshot resolves, else the bare `code`.

- The AC example fixes the per-entry shape: `'P4 — Autonomy by default, not supervision'`,
  code kept for traceability. The renderer owns the ` — ` assembly (T-067-01-01 review flag
  #3: the snapshot value is code-free; check it composes `${code} — ${text}`, not text alone).
- Semicolon between entries because the carried texts are prose and the em-dash construction
  makes a comma-joined list unreadable (`P4 — Autonomy by default, not supervision, P6 — …`
  parses as one run-on). Semicolons are the standard list separator when items contain commas;
  the single-entry common case is unaffected.
- Miss ⇒ bare code, no throw, no placeholder: the pair stays TOTAL (research constraint 2).
  A fabricated `(unknown)` gloss would launder absence into fake meaning — the completeness-
  gate precedent says the writer never fabricates; refusal is T-067-01-03's named andon.
- **Rejected:** one bullet per advance on its own line. More legible for 3+ codes, but it
  changes the body's line structure (every downstream `_Advances:` single-line reader, incl.
  the archive diff surface) for a case (multi-advance) the semicolon handles fine. Rejected:
  dropping the `_…_` italics — gratuitous churn, the wrapper carries no ambiguity.

## D4 — Story-body citations (and ticket prose): one shared resolver, replace only what the snapshot resolves, skip already-glossed codes

**Decision:** a private pure helper in materialize.ts —
`resolveCodesInProse(text, snapshot)` — applied to every model-authored prose field the pair
renders: ticket `purpose` and `doneSignal`; story `scope`, `storyAcceptance`,
`honestBoundary`, `waveRationale`, `outOfSlice`. It rewrites each match of
`/\b([A-Z]{1,3}\d+)\b(?! —)/g` to `${code} — ${title}` IFF `snapshot.get(code)` resolves;
every other token passes through untouched.

- "Story-body citations resolved the same way" (AC) can only mean the five section strings —
  `StoryDraft` has no `advances` field (research). Ticket prose gets the same treatment
  because S-067-01's story acceptance is a grep over WRITTEN BODIES ("a grep of the written
  bodies for a bare unexplained code comes back empty") and `purpose` routinely cites codes
  (`…full grounding (P4, P6)`); leaving ticket prose bare would fail the story bar at the
  T-067-01-03 fixture even though each code was "rendered" elsewhere.
- Snapshot-gated replacement is the safety property (research constraint 3): `E1` in
  "forward-E1", an `A3` spike label, a `K1` in a vend-repo cut all miss the vend charter and
  pass through verbatim. Only text the charter actually DEFINES is ever injected — the
  transform cannot corrupt prose it doesn't understand.
- The `(?! —)` lookahead is the idempotency/double-gloss guard (research constraint 4): a
  code the model already wrote as `P4 — its own words` is left alone — it is not BARE (it
  carries an explanation), and rewriting it would nest em-dashes. This also makes the
  transform idempotent: its own output starts `${code} — `, so re-running it is a no-op.
  JS `replace` never rescans inserted text, and no charter title contains a code, so there is
  no expansion cascade within one pass either.
- The regex is the resolver's own code shape (`[A-Z]{1,3}\d+`, charter-snapshot.ts DEFINITION)
  — one grammar, two homes, each private to its module. Not worth exporting a constant for
  until T-067-01-03 decides what ITS detector greps (its AC scopes to P/N).
- DAG block, frontmatter, footer, titles, ids: NOT passed through the helper — they carry no
  codes by construction (research), and touching frontmatter risks lisa validity.
- **Rejected:** expanding only the first occurrence per code per body (footnote style). Less
  repetitive for code-dense prose, but "grep for a bare code comes back empty" is per-
  occurrence — a second bare `P4` would fail the story bar. Repetition is the honest cost of
  every-line-standalone. **Rejected:** a separate story-only transform — two transforms drift.

## D5 — Where the helper lives: private in materialize.ts

The renderer is "the single owner of that format" (T-067-01-01 handoff). House style keeps
render helpers private (`oneLine`, `dagBlock`, `alias`); behavior is pinned through the public
pair's goldens, not by exporting internals. charter-snapshot.ts stays untouched — its module
contract is "what did the code SAY", not "how does a body spell it".

## D6 — Tests: golden-first, fabricated bold-shaped charter fixture

- A small inline `CHARTER` fixture in materialize.test.ts using the REAL bold-bullet
  definition shape (`- **P1 — Author once, run forever.** …`) covering P1/P3/P4/P6 + N1 —
  the gates.test.ts fabricated-fixture precedent, NOT a live-charter text import: these
  goldens pin the RENDERER's composition, and coupling them to live charter wording would
  make every charter amendment rewrite render goldens (the live-text pin already lives in
  charter-snapshot.test.ts — one brittle gold pin is the pattern, two is noise).
- Update the three byte goldens (ticket full-file, story contract, degraded) — the ticket
  golden's `_Advances:` line changes; the contract fixture's `scope`/`honestBoundary` gain a
  citation so the golden PROVES story-body resolution (AC: "golden bodies show …").
- Targeted tests: multi-advance semicolon join; miss-degrades-to-bare-code; prose expansion
  (parenthesized citation); non-charter token passthrough (`forward-E1`); already-glossed
  passthrough (idempotency); empty snapshot ⇒ body byte-identical to today's shape.
- The real-fs collision tests pass a charter fixture through the new third parameter; the two
  external call sites (chain-propose-decompose.test.ts, story-gate-cast.test.ts) thread the
  `CHARTER` fixtures they already hold (their non-bold shapes snapshot to empty maps —
  degrade keeps every existing assertion green, research constraint 8).

## D7 — What this ticket does NOT do (fences)

No refusal on unresolvable codes (T-067-01-03's named andon). No gates.ts edit, no BAML
prompt edit (story scope). No backfill of existing board files. No export of the prose
helper or the code regex. No `renderStoryFile`/`renderTicketFile` behavior change beyond the
snapshot parameter and the code-carrying bodies — frontmatter bytes identical.
