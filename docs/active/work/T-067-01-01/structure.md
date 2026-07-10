# T-067-01-01 — charter-code-snapshot-resolver — Structure

The blueprint: exact files, boundaries, and interfaces. Shape of the code, not the code.

## File inventory

| File | Change | Owner |
| --- | --- | --- |
| `src/play/charter-snapshot.ts` | **create** — the pure resolver module | this ticket |
| `src/play/charter-snapshot.test.ts` | **create** — the pure test suite | this ticket |

Nothing else changes. No edits to materialize.ts / gates.ts / decompose-epic.ts /
project-context.ts / any doc file (fences: design D8). `seed-text-modules.d.ts` already
declares the `*.md` text-module the test needs — no declaration work.

## `src/play/charter-snapshot.ts`

**Header comment** (house pattern: every module narrates its job, purity, and boundaries):
the E-067/T-067-01-01 story — pay charter resolution once at the cut; a code→one-liner
snapshot map downstream artifacts trust so they never dereference the live charter (P6).
Names the purity standard (id-guard: no fs/clock/addon, ZERO imports, total), the
definition-anchored parse (bold `**CODE — Title.**` bullets only — prose mentions of a code
neither create nor shadow), first-definition-wins (D5), and the deliberate split from
gates.ts's `matchIds` (bounds asks "is this code known?"; this asks "what did it SAY?").

**Exports (the whole public surface):**

```
export type CharterSnapshot = ReadonlyMap<string, string>;
export function snapshotCharterCodes(charter: string): CharterSnapshot;
```

- `CharterSnapshot` — the settled contract both sibling tickets build on (story wave
  rationale). Key: the code exactly as written (`"P4"`, `"N1"`, `"K2"`). Value: the
  definition's one-line title, trailing period stripped, internal whitespace collapsed,
  guaranteed non-blank — never `""`. Absence: `.get()` → `undefined` (strict tsc forces the
  caller to narrow; the AC's typed absence).
- `snapshotCharterCodes` — PURE, TOTAL, never throws. Empty/codeless charter → empty map.

**Internal organization** (single screen of code):

1. `const DEFINITION = /\*\*([A-Z]{1,3}\d+) — ([^*]+?)\*\*/g` — module-level, the one place
   the definition shape is encoded. Capture 1: prefix-generic code (D2). Capture 2: the
   title, non-greedy and `*`-free so a span can never leak across bold boundaries; `[^*]`
   matches `\n`, so a wrapped bold span still captures whole. The ` — ` separator is the
   literal em-dash-with-spaces every repo charter uses.
2. `function oneLine(raw: string): string` — private normalizer: strip ONE trailing `.`,
   collapse `\s+` runs to single spaces, trim. Kept separate so the "one line" meaning has
   one home.
3. `snapshotCharterCodes` — `matchAll` over the charter; per match: normalize; skip when the
   normalized title is blank (a malformed `**P8 — .**` mints NO entry — D2's structural
   "never `""`"); skip when the code is already present (first-wins, D5); build a `Map`,
   return it (typed as `CharterSnapshot`; the mutable `Map` never escapes).

**Imports: none.** Not even type-only — the id-guard standard the AC and design D6 demand.

## `src/play/charter-snapshot.test.ts`

**Module-level fixtures:**

- `import { describe, expect, test } from "bun:test"` (house pattern).
- `import { snapshotCharterCodes } from "./charter-snapshot.ts"` (+ type `CharterSnapshot`
  if an annotation earns it).
- `import liveCharter from "../../docs/knowledge/charter.md" with { type: "text" }` — the
  LIVE charter, zero fs (design D7's only-mechanism argument).
- `import kitchenCharter from "../../examples/templates/kitchen-seed/charter.md" with
  { type: "text" }` — the K-code generality proof (same file kitchen-overlay.ts imports).
- `const LIVE_EXPECTED` — the gold pin: a plain object/array literal of all 11 entries,
  `P1` → `Author once, run forever` … `N4` → `Not an executor`, transcribed from
  `docs/knowledge/charter.md` §Invariants/§Non-goals.
- Small fabricated-charter string fixtures inline per describe (gates.test.ts precedent),
  including a RETIRED-charter fixture (live shape minus P3) and malformed-definition strings.

**Suites (one `describe` per design-D7 group):**

1. `describe("live charter gold pin")` — full-map equality against `LIVE_EXPECTED` (size 11
   + every entry); the deliberate gold-master: amending the charter fails here and forces
   conscious re-ratification.
2. `describe("typed absence")` — unknown codes (`P9`, `PE1`, `X1`) → `.get` `undefined` /
   `.has` false on the live snapshot; retired fixture: `P3` absent, neighbors still resolve.
3. `describe("never an empty string")` — malformed definitions (`**P8 — .**`, `**P8 — **`,
   whitespace title) mint no entry; sweep every value of BOTH real-charter snapshots for
   non-blank.
4. `describe("definition-anchored, first wins")` — non-bold prose mention creates nothing;
   a prose mention BEFORE a real definition doesn't shadow it; duplicate definition → first
   text wins (pinned).
5. `describe("shape robustness")` — wrapped bold span → one collapsed line; exactly one
   trailing period stripped (a title ending `…v2.` keeps interior periods); kitchen charter
   → exactly K1..K3 with their titles (prefix generality proven on a real artifact).

## Boundaries & contracts honored

- **Play-layer, zero-dependency leaf.** Nothing imports the new module yet (consumers arrive
  in T-067-01-02/03); it imports nothing. No cycle risk by construction.
- **gates.ts untouched** — `matchIds` and the bounds gate keep their any-occurrence
  semantics; the two coexist per story scope.
- **The snapshot value is code-free** (D3): `P4 — <text>` assembly belongs to
  T-067-01-02's renderer, the single owner of that format.
- **No refusal logic here**: empty map / absent code are returned data; the named andon is
  T-067-01-03's contract.

## Ordering

Single commit is natural (module + test are one unit; the test IS the AC). Within the work:
module first, then test, then `bun run check`. No migration/sequencing concerns — a leaf
module cannot break existing code, and `check:typecheck` covers the text-import typing.

## Verification gates

- `bun test src/play/charter-snapshot.test.ts` — the new suite.
- `bun run check` — baml:gen + tsc --noEmit + full bun test (the repo's real gate).
