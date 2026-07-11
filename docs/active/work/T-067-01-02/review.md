# T-067-01-02 — materialize-carries-code-text-at-cut — Review

Self-assessment and handoff. What changed, how it is proven, what a human should look at.

## What changed

Five files, all modified, one commit (`f55cae0`, +217/−42). No new files, nothing deleted;
every fenced surface (gates.ts, decompose.baml, project-context.ts, charter-snapshot.ts, the
charter, existing board files) untouched, per story scope.

- **`src/play/materialize.ts`** — the integration this ticket IS:
  - Three new private helpers: `PROSE_CODE` (`/\b([A-Z]{1,3}\d+)\b(?! —)/g` — the resolver's
    code shape met in prose, with an idempotency lookahead), `resolveCodesInProse` (rewrites a
    cited code to `code — carried text` IFF the snapshot resolves it; everything else passes
    through verbatim), and `advancesLine` (the single owner of the `_Advances:_` format —
    per-code expansion, `; `-joined, miss degrades to the bare code).
  - `renderTicketFile(t, snapshot)` / `renderStoryFile(s, tickets, cutDate, snapshot)` — the
    pure pair takes the T-067-01-01 `CharterSnapshot` as a required parameter (the `cutDate`
    precedent: cut-time data arrives as data). Ticket purpose/doneSignal and the five story
    sections resolve citations; frontmatter, DAG block, and footer are byte-untouched.
  - `materialize(plan, targets, charter)` — required third parameter; resolves the charter
    into a snapshot exactly ONCE per cut, after the collision guard, beside the single clock
    read. Guard ordering unchanged (refuse before mkdir).
- **`src/play/decompose-epic.ts`** — `decomposeEffect` passes `ctx.inputs.charter`, the same
  string it already feeds `clear`'s `ClearContext` (the story's "supplies the charter it
  already holds").
- **`src/play/materialize.test.ts`** — fabricated bold-shaped `CHARTER` fixture (built through
  the real resolver, addon-safe), all goldens updated, eight new targeted tests (below).
- **`src/play/chain-propose-decompose.test.ts` / `src/play/story-gate-cast.test.ts`** — the
  two non-production `materialize` call sites thread the charter fixtures they already held;
  story-gate-cast's fixture effect now takes `(plan, ctx)`, mirroring the real effect.

## AC → proof

| AC clause | Proof |
| --- | --- |
| golden bodies show advances as code plus carried text, code kept | Ticket full-file golden: `_Advances: P1 — Author once, run forever_`; multi-advance test pins the `; ` join |
| story-body citations resolved the same way | Contract golden: `(P3 — Gates are the contract)` in Scope, `(P4 — …)` in Honest boundary; waveRationale/outOfSlice spot-check test |
| charter supplied as a render parameter | Both render signatures take `CharterSnapshot`; `materialize` derives it from its new `charter: string` parameter once per cut |
| render pair stays clock-free | `cutDate` still a parameter; no `new Date()` in the pure pair (unchanged) |
| render pair stays addon-free | Only new import is charter-snapshot.ts (zero-import pure leaf); baml imports remain type-only; the test suite value-imports only the resolver |

Verification: `bun run check` (baml:gen + tsc --noEmit + lint + full suite) — **1554 pass,
1 skip (pre-existing), 0 fail** across 105 files. materialize.test.ts alone: 21/21.

## Test coverage assessment

Covered: the full AC surface (table), plus the contract edges design ratified — semicolon
join on multi-advance; snapshot-gated replacement (`forward-E1` / `A3` pass through
untouched); already-glossed idempotency (`P4 — <model's own words>` not re-glossed); miss
degrades to bare code (`P9` renders bare — deliberately, see handoff); doneSignal as a third
prose surface; empty snapshot reproduces the pre-change bytes verbatim (a byte pin on the
degrade path); shell stories (no sections) render byte-identically with a real snapshot in
hand; real-fs collision semantics unchanged with the charter threaded.

Gaps, deliberate and known:

- **No cast-level fixture through the stub executor here.** The AC scopes to
  materialize.test.ts goldens; the end-to-end "cast writes code-carrying files" proof is
  T-067-01-03's AC (its grep-clean fixture) and the story-acceptance sweep.
- **Prose expansion inside inline code spans/backticks is not special-cased.** A purpose
  citing `` `P4` `` in backticks would expand inside the ticks. No draft prose in the tree
  does this; noting it as accepted, not handled.
- **A code at the very end of prose followed by ` — ` authored WITHOUT a gloss** (pathological
  `"P4 — "` trailing) stays bare via the lookahead. Safe-degrade; the -03 guard decides.

## Open concerns / flags for a human

1. **The multi-advance separator changed from `, ` to `; ` even when nothing resolves** (an
   empty snapshot renders `_Advances: P1; P3_`, not the old comma form — single-advance
   bodies are byte-identical). On the decompose path the charter always resolves, so this is
   invisible in production, but any downstream reader parsing the advances line by comma
   would need the semicolon. Grep found no such reader (lisa reads frontmatter, not bodies).
2. **Repetition is the honest cost**: a body citing P4 in three places carries the one-liner
   three times (design D4 rejected footnote-style first-occurrence-only because the story
   bar is a per-occurrence grep). If the counter finds real bodies too noisy, the change is
   contained in `resolveCodesInProse`.
3. **`advancesLine` misses render bare and are NOT yet refused** — by design (the render pair
   is total; the story sequences refusal into T-067-01-03). Between this landing and -03,
   a decompose cast against a charter missing a cited code would WRITE a bare-code artifact.
   The window is one ticket wide and the bounds gate already STOPs dangling P-refs upstream;
   N-refs are stripped by `stripNonGoalAdvances` before materialize. Named, not hidden.
4. **Prose misses are invisible to gates**: the bounds gate checks `advances` arrays, not
   prose; a prose citation of a code the charter doesn't define stays bare forever unless
   -03's grep-side guard covers prose too. Worth deciding explicitly in -03's design.

## TODOs / limitations

None blocking; no code TODOs in any touched file. Lisa's own frontmatter/provenance edits
(`.lisa/provenance.jsonl`, ticket phase fields) were left uncommitted per the working
agreement — Lisa owns those transitions.

## Handoff to the next ticket (T-067-01-03)

The rendered surface is now settled — build the guard against these exact facts:
- `materialize(plan, targets, charter)` builds `snapshot` AFTER the collision guard and
  before the first `mkdir`; the resolvability check slots exactly there (the doc comment on
  the verb marks the spot). Refuse IdCollisionError-style: a typed error, thrown before any
  write, relabeled by `decomposeEffect` to a named run-log outcome.
- "Cited codes" available at that point: every `t.advances` entry (post
  `stripNonGoalAdvances`, so P-codes in practice) plus any prose codes you choose to police
  (`PROSE_CODE`'s shape is `[A-Z]{1,3}\d+` with a `(?! —)` gloss-skip — private to
  materialize.ts; export it or re-derive, your design call, see concern #4).
- The grep-clean fixture bar: bodies contain no `\b[PN]\d+\b` not followed by ` — ` — the
  empty-snapshot golden in materialize.test.ts is the exact counterexample shape your guard
  must make unreachable on the cast path.
