# T-067-01-01 — charter-code-snapshot-resolver — Design

Decisions grounded in research.md. Each names the options weighed and why the winner won.

## D1 — Module home & name: new `src/play/charter-snapshot.ts`

**Options**
a) New pure module `src/play/charter-snapshot.ts`.
b) New module under `src/gate/` (beside the only existing code-matcher, `matchIds`).
c) Export the parser from `materialize.ts` (its eventual consumer).

**Decision: (a).** Both settled consumers live in `src/play/` (materialize.ts's render pair,
decompose-epic.ts's effect — T-067-01-02), and the play layer already hosts the purity exemplar
this module imitates (`id-guard.ts`). (b) is fenced off: the story declares gates.ts untouched,
and parking the resolver in the gate layer invites exactly the gates⊥play import questions the
tree polices — the resolver answers a *render* question ("what did this code say?"), not a
*clearing* question ("is this code known?"). (c) would force T-067-01-02's overlapping-file work
to start now and make the "pure module with zero imports" standard impossible (materialize
imports fs). Name follows the ticket title (`charter-code-snapshot-resolver`) and the story's
noun ("snapshot"): `charter-snapshot.ts`.

## D2 — Parse target: the charter's bold DEFINITION pattern, prefix-generic

The resolver keys on `**<CODE> — <one-liner>.**` — the bold bullet shape every charter in the
repo uses for code definitions (live charter P1..P7/N1..N4; kitchen charter K1..K3). Matching
is anchored to the bold span, so prose mentions of a code (`advances: [P…]`, examples in
running text) can neither shadow nor duplicate a definition — research pinned why matchIds'
any-occurrence semantics is the wrong tool here.

**Code shape: prefix-generic** — `[A-Z]{1,3}` + digits — not hardcoded P/N.

Rationale: the AC pins P1..P7 + N1..N4 (the live charter), but the epic's intent line names
"P/N/PE" and the kitchen charter already defines K-codes in the identical shape. A generic
parse costs one character class and means kitchen-cut artifacts can carry snapshots without a
resolver edit when T-067-01-02/03 thread whatever charter the cast holds. Rejected: `"P" | "N"`
prefixes mirroring matchIds — that coupling is the bounds gate's contract (which codes may be
*advanced*), not the snapshot's (which codes the charter *explains*); the two answer different
questions and the story keeps them apart deliberately.

Concretely: match `\*\*([A-Z]{1,3}\d+) — (.+?)\*\*` with a non-greedy, non-`*` body; take the
title up to the closing bold, strip ONE trailing period, collapse internal whitespace (a
wrapped bold span still resolves to one line). A bold span with an empty/blank title parses to
NO entry — a malformed definition must not mint a `""` value (the AC's "never a silent empty
string" made structural, not checked at the call site).

## D3 — The one-liner is the bold TITLE, period stripped, code not repeated in the value

The sources disagree (research constraint #1): story acceptance + T-067-01-02's AC show
title-only (`P4 — Autonomy by default, not supervision`); the epic's done-looks-like shows
title+gloss (`P3 — Gates are the contract: quality lives inside the work`).

**Decision: title-only — the value for `P4` is `Autonomy by default, not supervision`.**

- The story is the ratified contract at this layer (the epic is upstream intent); when they
  disagree, the story + the consuming ticket's AC win — and both show title-only.
- It is literally the charter's own one-line unit: the bold span IS one line; the body prose
  wraps and runs to multiple sentences (not "one-line text" by any reading).
- The charter's own header rule agrees: "stable IDs — reference, don't restate". The snapshot
  carries the *name* of the invariant, not a fork of its full prose (S-067-01 out-of-slice:
  "snapshots capture, they don't fork").

The VALUE does not repeat the code; the KEY carries it. `P4 — <text>` assembly (code kept for
traceability) is the renderer's formatting, owned by T-067-01-02 where its AC lives. Keeping
the value code-free means exactly one owner of that format and no `P4 — P4 — …` hazard.

## D4 — Contract shape: `snapshotCharterCodes(charter: string): CharterSnapshot`, a `ReadonlyMap<string, string>`

**Options for the typed absence**
a) `ReadonlyMap<string, string>` — `.get()` is `string | undefined`; strict tsc forces the
   caller to narrow before use.
b) A resolve function returning a discriminated union
   (`{resolved: true, text} | {resolved: false}`).
c) `Readonly<Record<string, string>>` like materialize's alias tables.

**Decision: (a).** `undefined`/`null` *is* the house's typed absence for expected misses
(`findExistingByTitle` → `string | null`; research). A Map's `.get()` can never yield `""`
because D2 refuses to mint empty values — absence and emptiness are structurally the same
non-case. (b) adds ceremony no caller needs: both consumers do the same thing with an absence
(T-067-01-02/03 refuse the cut), and a union member carrying no data is `undefined` with extra
steps. (c) is typed-equivalent — this repo's tsconfig sets `noUncheckedIndexedAccess`, so
`Record` indexing also yields `string | undefined` — but rejected on semantics: a Map is the
natural shape for a runtime-built keyed collection (`.has` for membership, no
prototype-key/`Object.keys` edge cases), whereas the alias-table `Record`s are hand-authored
literals whose misses THROW as programmer errors. Here a miss is EXPECTED data (a retired code
is a charter feature, amendment rule), so per house rule it must return, not throw.

Exported surface (whole of it):
- `type CharterSnapshot = ReadonlyMap<string, string>` — the settled contract the story says
  both siblings build on.
- `snapshotCharterCodes(charter: string): CharterSnapshot` — PURE, TOTAL, never throws; a
  charter with no definitions yields an EMPTY map (honest empty — whether that refuses a cut
  is the write guard's judgment, T-067-01-03, not the parser's).

No `resolveCode` helper, no `unresolvedCodes(cited, snapshot)` convenience: T-067-01-03 owns
the refusal's shape and can compose `Map.get` directly (the `detectCollisions` precedent shows
how thin that check is). Adding it now would be speculative — the worst waste.

## D5 — Duplicate definitions: first wins, deterministically

A charter defining the same code twice is an authoring error no current tool detects
(research #4). The resolver is not its detector — it has no refusal channel (total function)
and the story fences charter policing out of this slice. **First definition wins**, matching
the tree's only precedent for ambiguous matches (`findExistingByTitle`: "First-match (input
order) is deterministic"). Pinned by a test so the behavior is contractual, not accidental.
Rejected: last-wins (no precedent, same arbitrariness); throwing (violates total/expected-data
house rule); returning absence for duplicated codes (punishes every consumer for an error the
bounds gate/write guard will surface in review anyway).

## D6 — Purity: the `id-guard.ts` standard — zero imports

No fs, no clock, no process, no BAML import (not even type-only — the module sees only
strings). This exceeds gates.ts's discipline and matches id-guard's, which the AC demands
("no fs, no BAML addon") and which keeps the test an ordinary bun pure-function test.

## D7 — Test strategy: `src/play/charter-snapshot.test.ts`, live charter via text import

The AC's "fed the live charter text … no fs" pair has exactly one mechanism in the tree
(research): Bun-native text imports, already tsc-typed by `seed-text-modules.d.ts`'s `*.md`
wildcard. The test imports BOTH real charters at module load — zero fs calls in test bodies:

- `import liveCharter from "../../docs/knowledge/charter.md" with { type: "text" }`
- `import kitchenCharter from "../../../examples/templates/kitchen-seed/charter.md" …`
  (kitchen-overlay.ts already imports this exact file this way).

Suites:
1. **Live-charter gold pin (the AC's core):** full map equality — exactly the 11 codes
   P1..P7 + N1..N4, each mapped to its literal title (e.g. `P4` →
   `Autonomy by default, not supervision`, `N1` → `Not a chat copilot`). Deliberately a
   gold-master (EXPECTED-OUTCOME house pattern): amending the charter fails this test and
   forces the snapshot contract to be re-ratified consciously.
2. **Typed absence:** unknown code (`P9`, `PE1`) → `.get` is `undefined` / `.has` false;
   RETIRED code — a fabricated charter minus P3 → `P3` absent while its neighbors resolve.
3. **Never `""`:** malformed fixtures (`**P8 — .**`, `**P8 —**`, blank title) mint no entry;
   walk every value of both real-charter snapshots asserting non-blank.
4. **Anchoring:** a prose mention (`advances P1` outside bold) neither creates nor shadows;
   first-wins duplicate pin (D5).
5. **Shape robustness:** wrapped bold span → whitespace-collapsed one line; period stripped
   exactly once; kitchen charter yields K1..K3 (D2's generality, proven not asserted).

## D8 — Out of scope (fences)

materialize.ts, gates.ts, decompose-epic.ts and every runner (T-067-01-02); any refusal/andon
(T-067-01-03); prompt/BAML changes; charter edits; backfills; read-side tooling. This ticket
lands exactly two files: the module and its test.
