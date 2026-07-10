# T-067-01-01 — charter-code-snapshot-resolver — Review

Self-assessment and handoff. What changed, how it is proven, what a human should look at.

## What changed

Two files, both new, one commit (`23469d9`). Nothing modified, nothing deleted; every fenced
file (materialize.ts, gates.ts, decompose-epic.ts, project-context.ts, the charter, all docs)
untouched, per story scope.

- **`src/play/charter-snapshot.ts`** (new, ~70 lines) — the pure resolver:
  - `type CharterSnapshot = ReadonlyMap<string, string>` — the settled contract both sibling
    tickets (T-067-01-02 render integration, T-067-01-03 write guard) build on. Key: code as
    written (`"P4"`). Value: the definition's one-line title, trailing period stripped,
    whitespace collapsed, guaranteed non-blank. Miss: `.get()` → `undefined` — the typed
    absence strict tsc forces callers to narrow.
  - `snapshotCharterCodes(charter: string): CharterSnapshot` — PURE (zero imports, the
    id-guard standard: no fs/clock/process/BAML) and TOTAL (never throws; codeless charter →
    empty map). Parses only the bold DEFINITION shape (`**P4 — Autonomy by default, not
    supervision.** …`); prose mentions neither create nor shadow; first definition of a code
    wins; a blank-titled definition mints no entry.
  - Code shape is prefix-generic (`[A-Z]{1,3}\d+`): P/N (live charter), K (kitchen-seed
    charter), PE if ever minted — kitchen cuts can carry snapshots with no resolver edit.
- **`src/play/charter-snapshot.test.ts`** (new, 13 tests / 63 expects) — see coverage below.

## AC → proof

| AC clause | Proof |
| --- | --- |
| Pure unit tests, no fs | Both charters arrive as Bun text imports (`with { type: "text" }`, typed by the existing `*.md` wildcard in seed-text-modules.d.ts); no test body touches fs |
| no BAML addon | Zero BAML imports in module or test (not even type-only — the module sees only strings) |
| fed the live charter text, maps every P1..P7 + N1..N4 to its one-line text | "live charter gold pin": size 11, entry-by-entry equality, key-set equality against `LIVE_EXPECTED` |
| unknown or retired code → typed absence the caller must handle | "typed absence": unknown codes (`P9`, `PE1`, `K1`-against-live…) and a retired-P3 fixture all `.get()` → `undefined` / `.has()` → false; `ReadonlyMap.get`'s `string \| undefined` return makes handling compile-enforced |
| never a silent empty string | Structural: `oneLine`-blank definitions mint NO entry (pinned on `.`-only / whitespace / tab titles), plus a non-blank sweep over every value of both real-charter snapshots |

Verification run: new suite 13/13 green; `bun run check` (baml:gen + tsc --noEmit + full
suite) **1546 pass, 1 skip (pre-existing), 0 fail** across 105 files.

## Test coverage assessment

Covered: the full AC surface (table above), plus contract edges the design ratified —
definition-anchoring (prose can't shadow), first-wins duplicates, wrapped bold spans,
strip-exactly-one-period (interior periods survive), no-period definitions, honest-empty
charters, and K-code generality proven on the real kitchen charter.

Gaps, deliberate and known:
- **Separator variants untested/unsupported.** The parse requires the literal
  `<space>—<space>` em-dash every repo charter uses. A charter authored with a hyphen, double
  space, or non-breaking space parses to NO entry. The failure mode is safe-loud downstream
  (absence → T-067-01-03 refuses the cut, named andon) rather than silently wrong text, but
  nothing pins that behavior here.
- **No property/fuzz coverage** of the regex — fixtures only. The input space is one-page,
  human-authored charters; fuzzing felt like speculative weight.
- **Punctuation-quality is not policed**: `**P8 — ...**` resolves to `..` (present, ugly) —
  the strip-one-period contract, honestly kept. Only *blank* is refused (progress.md
  deviation #1).

## Open concerns / flags for a human

1. **The gold pin is intentionally brittle** (EXPECTED-OUTCOME house pattern): the next
   charter amendment fails `charter-snapshot.test.ts` and must update `LIVE_EXPECTED` in the
   same change. That is the snapshot contract being re-ratified consciously — worth knowing
   before it surprises someone mid-amendment.
2. **The one-liner is TITLE-ONLY** (`P3` → `Gates are the contract`), per the story
   acceptance + T-067-01-02's AC example. The epic's done-looks-like sketches title+gloss
   (`Gates are the contract: quality lives inside the work`); design D3 documents why the
   story won. If the human counter prefers the gloss, the change is one regex/normalizer
   edit + gold-pin update, before T-067-01-02 freezes the rendered form.
3. **The snapshot value is code-free**; `P4 — <text>` assembly (code kept for traceability)
   is deliberately left to T-067-01-02's renderer — the single owner of that format. A
   reviewer of that ticket should check it composes `${code} — ${text}`, not `text` alone.
4. **Duplicate charter definitions resolve first-wins and are not reported.** No tool in the
   tree detects the authoring error; this module has no refusal channel (total by design).
   If that ever matters, it belongs in a gate, not here.
5. **Bounds-gate asymmetry, pre-existing:** gates.ts validates only P/N advances, so a
   kitchen ticket claiming `advances: K1` passes bounds unchecked while this resolver WILL
   resolve it. Out of this slice (gates.ts fenced), just made more visible by the generic
   parse.

## TODOs / limitations

None blocking. No code TODOs left in either file. The module is a leaf — nothing imports it
yet; it goes live in T-067-01-02 (materialize render pair + runner threading) and gains its
refusal semantics in T-067-01-03.

## Handoff to the next ticket (T-067-01-02)

The settled contract to build on: `import { snapshotCharterCodes, type CharterSnapshot } from
"./charter-snapshot.ts"` — build the snapshot once per cut from the charter the runner already
holds (`ctx.inputs.charter`), thread it into the render pair as a PARAMETER (keeps them
clock-free and addon-free), render `advances` entries as `${code} — ${snapshot.get(code)}`,
and treat `undefined` as the refusal input the write guard (T-067-01-03) turns into a named
andon before any write.
