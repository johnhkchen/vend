# T-021-01 — Design: read-only-graph-model-loader

_Options, tradeoffs, decisions — grounded in `research.md`._

## What we are deciding

Five decisions: (D1) module shape, (D2) the typed graph model, (D3) YAML/frontmatter
parsing, (D4) the epic↔story edge, (D5) deep-immutability + integrity-on-load policy.

---

## D1 — Module shape: pure core + impure verb (house pattern)

**Chosen.** Split exactly like `materialize.ts` / `survey-*.ts`:

- **Pure core** (`src/graph/model.ts`): the types + the pure builder `buildGraph(rawEpics,
  rawStories, rawTickets)` that validates, links, freezes, and returns a `WorkGraph`. Also
  the pure `parseFrontmatter(text, file)` and `epicIdForStory(storyId)`. No fs/clock/network.
- **Impure verb** (`src/graph/load.ts`): `loadWorkGraph(opts?)` — the one async function that
  `readdir`s the three dirs, `readFile`s each, and hands raw text to the pure core.

**Why.** The whole judgment (parsing, linking, integrity, freezing) becomes an ordinary
pure-function test with hand-authored string fixtures — no temp dirs needed for the hard
logic. The verb stays thin (a directory walk), covered by one real-fs fixture test plus a
live-board smoke test. Rejected: a single impure module (would force every model test through
the filesystem — slower, and re-opens the no-fs-in-core discipline the codebase keeps).

`Bun.YAML.parse` in the pure core is fine: it is deterministic, no fs/clock/addon — unlike
the BAML native addon the plays keep out of their cores, it is a plain runtime global.

---

## D2 — The typed graph model

Containment edges are **object references** (traversable); back-references and cross-edges are
**ids** (strings) — so the object graph is a tree with no cycles, making deep-freeze trivial.

```ts
interface TicketNode {
  readonly kind: "ticket";
  readonly id: string;
  readonly storyId: string;            // authored back-ref (the `story:` field)
  readonly title: string;
  readonly type: string;               // NOT enum-narrowed — faithful mirror (chore/feature exist)
  readonly status: string;
  readonly priority: string;
  readonly phase: string;
  readonly dependsOn: readonly string[];
  readonly blocks: readonly string[];  // DERIVED inverse of dependsOn across the board
  readonly body: string;               // raw markdown after frontmatter (Context, ACs)
}
interface StoryNode {
  readonly kind: "story";
  readonly id: string;
  readonly epicId: string | null;      // resolved via convention; null only if epic absent (see D5)
  readonly title: string;
  readonly status: string;
  readonly priority: string;
  readonly tickets: readonly TicketNode[];  // ordered child objects (story `tickets:` order)
  readonly body: string;
}
interface EpicNode {
  readonly kind: "epic";
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly advances: readonly string[];
  readonly serves: string;
  readonly kindLabel: string | null;   // the optional `kind:` field (permanent…); null if absent
  readonly stories: readonly StoryNode[];
  readonly body: string;
}
interface WorkGraph {
  readonly epics: readonly EpicNode[];
  readonly stories: readonly StoryNode[];
  readonly tickets: readonly TicketNode[];
  readonly byId: Readonly<Record<string, AnyNode>>;  // flat index for O(1) lookup
}
```

- **`kind` discriminant** on each node so the projection can switch on node type without
  guessing from id prefixes.
- **`type/status/priority/phase` stay `string`**, not unions — the loader mirrors the board
  faithfully (research: live values exceed the documented enums). Vocabulary validation is the
  projection's job, not the loader's. (Decision: structure + referential integrity are
  validated; *enum membership is not*.)
- **`byId` is a frozen plain `Record`, not a `Map`.** A frozen `Map` still permits `.set()`
  at runtime (freeze guards properties, not internal slots) — it would only be type-rejected,
  not throw. A frozen plain object **throws** on property assignment in strict mode, giving
  the stronger guarantee the AC's "mutation attempts throw" wants. Lookup stays O(1).
- **Body retained** (D1 research): the projection reads Context/ACs from the body.

Rejected: storing children as id arrays only (forces the projection to re-join through `byId`
on every traversal — the graph exists precisely to pre-resolve those joins).

---

## D3 — Frontmatter parsing

**Chosen:** `Bun.YAML.parse` on the text between the leading `---` fences, then **coerce**
each field through small typed helpers that throw a named `GraphParseError(file, reason)` on
malformed input (missing/blank `id`, non-string title, non-array `tickets`, etc.).

- Verified: `Bun.YAML.parse` strips inline `#` comments (`status: active   # …` → `"active"`)
  and handles folded `serves: >` blocks and flow arrays `[T-…]`. No hand-rolled parser.
- The fence regex is `^---\n([\s\S]*?)\n---`; the body is everything after the closing fence
  (trimmed of one leading newline) → `body`.
- **Coercion at the boundary** turns `unknown` YAML into the typed record honestly: a file
  that is missing `id` is a corrupt node and must fail loudly (named error with the filename),
  not silently produce `{id: undefined}`. Mirrors `materialize.ts`'s typed-error discipline.

Rejected: trusting `Bun.YAML.parse` output shape directly (`any`) — it would let a malformed
file poison the graph with `undefined` ids that then "resolve" to nothing.

---

## D4 — The epic↔story edge (derived by id convention)

**Chosen:** `epicIdForStory(storyId)` = `"E-" + storyId.split("-")[1]` (the first numeric
group after `S-`). `S-001`→`E-001`, `S-021-01`→`E-021`. A pure, test-pinned function. Stories
group under the matching epic; `StoryNode.epicId` records the resolved id.

**Why convention, not a field:** research confirmed there is no `epic:` field anywhere and no
story-list in epics — the convention is the *only* signal. Encoding it in one named pure
function (not inline) makes it the single source of the rule and trivially testable.

Rejected: inferring from `story.tickets` or any other field (none carries the epic); adding an
`epic:` field to the canonical files (out of scope — this ticket is read-only, and would
require a write path the AC forbids).

---

## D5 — Deep immutability + integrity-on-load

**Immutability — chosen:** a pure `deepFreeze` that recursively `Object.freeze`s every node,
every array, and the `byId` record, then returns the `WorkGraph` (itself frozen). Because the
object graph is a tree (containment = objects, cross-refs = ids), recursion terminates with no
cycle handling needed. At the **type** level, every field is `readonly`/`ReadonlyArray`. So
both arms of the AC hold: runtime mutation **throws** (frozen) and illegal writes are
**type-rejected** (`readonly`). The loader exports no setter/writer — read-only by
construction.

**Integrity-on-load — chosen:** the builder validates **every authored edge resolves**, and
throws a single `GraphIntegrityError` listing *all* violations (not just the first) when any
fail:
1. every `ticket.storyId` names an existing story;
2. every id in `story.tickets` names an existing ticket;
3. every id in `ticket.dependsOn` names an existing ticket;
4. every story's derived `epicIdForStory` names an existing epic.

Plus a duplicate-id check (two files claiming one id = corrupt board).

- Why throw, not return diagnostics: a canonical board with a dangling edge is **corrupt
  data**, the same class as `materialize.ts`'s `IdCollisionError` — an expected, typed refusal
  the caller can catch, distinct from a generic fs error. The projection must never render a
  half-resolved graph. The live board is clean (research), so this loads green today; the test
  proves both a clean fixture loads and a broken fixture throws.
- Why include the *derived* epic edge (4) in the strict set: the convention resolves for
  every live story, and a story whose epic vanished is exactly the corruption the invariant
  should catch. `epicId` is therefore effectively always non-null on a valid board; it is
  typed `string | null` only to make the "no epic" case representable to the error path before
  the throw (it is never handed back null in a successful load).

**`blocks` derivation:** computed as the inverse of all `dependsOn` edges across the board
(ticket B `blocks` A iff A `dependsOn` B), sorted for determinism. Matches Lisa's documented
auto-computation; gives the projection the "what does this unblock" arrows for free without a
file field.

**TEMPLATE / non-node files:** the impure verb skips `TEMPLATE.md` by name and skips any file
whose frontmatter lacks an `id`. (Decision lives in the verb, not the core, so the pure
builder only ever sees real records.)

---

## Summary of decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Pure `model.ts` + impure `load.ts` | House pattern; pure logic testable without fs |
| D2 | Object-ref containment, id cross-refs, frozen `Record` index, bodies retained, `string` enums | Traversable tree, no cycles, faithful mirror, projection's needs |
| D3 | `Bun.YAML.parse` + boundary coercion → `GraphParseError` | No new dep; fail loud on corrupt frontmatter |
| D4 | `epicIdForStory` pure convention fn | The only signal that exists; single source of the rule |
| D5 | `deepFreeze` + strict integrity throw (`GraphIntegrityError`) + derived `blocks` | AC's frozen + edges-resolve; corrupt board = typed refusal |
