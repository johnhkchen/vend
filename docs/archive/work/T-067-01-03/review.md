# T-067-01-03 — bare-code-write-guard — Review

Handoff self-assessment. Two commits (`0859156`, `9f4b208`), seven files (six modified,
one new test file), +482/−25 total. Story S-067-01 closes with this ticket.

## What changed

- **`src/play/materialize.ts`** — the ticket's core:
  - `findBareCodes(files, snapshot)` — exported PURE detector: scans rendered bodies for
    bare (un-glossed) codes in the policed prefix families. Policed = `{P, N}` always
    (the AC's grep bar — holds even against an empty snapshot) ∪ any prefix family the
    charter defines codes for (a `**K1 — …**` kitchen charter polices K for free; the
    snapshot is consulted ONLY for prefixes — post-render, a bare policed code is a
    defect regardless of resolvability). Per-file hits, codes deduped in body order.
  - `BareCodeError` — `IdCollisionError`'s exact sibling: typed, named, carries
    `hits: {file, codes}[]`, message names every file with its codes.
  - `materialize` reordered: collision guard → snapshot/cutDate → **render ALL files
    into memory** → **bare-code guard (throw)** → mkdir ×2 → write from the rendered
    arrays. Both guards now precede even `mkdir`, so a refused cut leaves not even an
    empty directory; render-then-write makes zero-partial-output structural for any
    future pre-write guard. Bytes written on the pass path are unchanged (goldens pin
    this).
  - `BARE_CODE` regex beside `PROSE_CODE` with a lockstep comment — same ` — `
    gloss-skip, one deliberate widening (see Deviation, below).
- **`src/log/run-log.ts`** — `"bare-code"` minted into `RUN_OUTCOMES` (before
  `errored`), provenance doc line added. Everything downstream derives from the tuple
  (`OutcomeMix`, validation, `test.each`); no exhaustive switch existed to break.
- **`src/play/decompose-epic.ts`** — `decomposeEffect` catches `BareCodeError` and
  relabels to `{ok:false, outcome:"bare-code", detail:"bare-code — charter cannot
  resolve cited code(s): <file: codes; …>"}` — the id-collision arm's shape; genuine
  throws still propagate.
- **`src/play/bare-code-cast.test.ts`** (new) — the AC's cast-level fixture proof (see
  coverage).
- **`src/play/materialize.test.ts`** — 8-case pure judgment matrix for `findBareCodes`
  + real-fs refusal / guard-order / pass tests (10 new tests; 31 total in file).
- **`src/play/story-gate-cast.test.ts`, `src/play/chain-propose-decompose.test.ts`** —
  `CHARTER` fixtures converted prose→bold DEFINITION shape (same codes): their plans
  cite `advances: [P1]`, and a prose-shaped charter yields an empty snapshot the guard
  now correctly refuses. One-const change each, why-comment added.

## AC → proof

| AC clause | Proof |
| --- | --- |
| cast with unresolvable cited code refused with a named andon | bare-code-cast.test.ts test 1: prose-cited `P9` clears all five REAL gates (bounds sees only `advances` — the hole only this guard covers), outcome `bare-code`, run-log record pinned |
| before any writeFile, zero partial output | Both target dirs ENOENT after refusal (cast test + real-fs test — throw precedes even mkdir, the collision tests' bar) |
| IdCollisionError-style typed refusal | `BareCodeError`: typed, `name` set, structured `hits`, caught by `instanceof` and relabeled as data at the effect boundary |
| cast-level fixture through stub executor writes a full plan | bare-code-cast.test.ts test 2: five-section story + two tickets → `success`, 3 files written |
| bodies grep clean of bare unexplained P/N codes | Every written body matched against `/\b[PN]\d+(?![0-9A-Za-z])(?! —)/` → null, with positive glossed-line asserts so the grep is not vacuous |

Verification: `bun run check` (baml:gen + tsc --noEmit + lint + full suite) — **1567
pass, 1 skip (pre-existing), 0 fail** across 106 files, at both commits.

## Test coverage assessment

Covered: the full pure judgment matrix (clear / hit / dedupe+order / gloss-skip /
foreign-prefix passthrough / snapshot-derived K-prefix / empty-snapshot {P,N} floor /
multi-file keying); on-disk refusal semantics; guard ordering (identity before content —
a colliding+bare plan refuses as `id-collision`); the production relabel path via a
fixture effect that copies `decomposeEffect`'s arm verbatim; the story-acceptance grep
over real cast output.

Gaps, deliberate and known:

- **`decomposeEffect`'s own arm is not directly executed by a test** (the effect is the
  impure verb, per house pattern — decompose-epic.ts is never value-imported under bun
  test because of the BAML addon one-call limit). The cast test's fixture effect is a
  line-for-line copy; drift between them is possible. Same standing risk as the
  id-collision arm before it.
- **Prose expansion inside backticks** — inherited from -02, unchanged: a `` `P4` `` in
  code spans would be glossed (or flagged if unresolvable). No draft prose does this.
- **The pathological trailing `"P9 — "` (gloss-shaped, no gloss text)** still passes as
  "explained" — the ` — ` lookahead is the single shared definition of glossed,
  inherited from -02 and accepted there.

## Open concerns / flags for a human

1. **The guard can false-andon legitimate prose** that happens to match a policed shape
   — e.g. "P99 latency" against the vend charter, or `A3` against a charter that defines
   A-codes. Deliberate (design D2): a charter that owns a prefix family makes an
   unresolvable code of that family a detectable defect, and a conservative refusal
   names itself. If the counter sees false refusals in the field, the policed-prefix
   rule is one function (`policedPrefixes`).
2. **`BARE_CODE`'s trailing boundary deviates from `PROSE_CODE`'s `\b`** —
  `(?![0-9A-Za-z])` instead, found by a failing test: `_Advances: P1_` ends in an italic
   underscore (`_` is a word char, so `\b` never fires) and the exact -02 handoff
   counterexample escaped a `\b`-based guard. Consequence: the renderer won't gloss
   `_P4_`-style italic-wrapped codes (its `\b` misses them) but the guard WILL flag
   them — divergence in the safe direction (refuse rather than write bare), noted on
   the const.
3. **`bare-code` is a new run-log outcome** — downstream ledger consumers that bucket
   outcomes by hand (dashboards, kitchen sweeps outside this repo) will see an
   unfamiliar label. In-repo consumers all derive from `RUN_OUTCOMES`.
4. **`--no-gates` casts are now guarded anyway**: the write guard sits in `materialize`,
   after gate skipping — a `skipGates` cast with an unresolvable code refuses at the
   write. Arguably exactly right (the guard is a write-side contract, not a gate), but
   it does narrow what "no gates" bypasses.

## TODOs / limitations

No code TODOs in any touched file. Retroactive board patching, read-side stripping, and
the live metered gold-master cast remain deferred per the story's honest boundary; the
live cast is the story-acceptance sweep's to authorize. Lisa's frontmatter/provenance
edits left uncommitted per the working agreement.
