# T-003-03 — Structure: pure-selection-minilanguage

> The blueprint: which files, what each exports, internal organization, boundaries.
> Not code — the shape of the code.

## Files

| Path | Action | Why |
|------|--------|-----|
| `src/shelf/` | **create** (dir) | New home for the shelf surface; T-003-01 also lands here, disjoint file (R5) |
| `src/shelf/select.ts` | **create** | The pure parser + `SelectionError` (the whole ticket) |
| `src/shelf/select.test.ts` | **create** | `bun:test` pure-function coverage, mirrors `id-guard.test.ts` |

No existing file is modified or deleted. Nothing in the tree imports this yet; the sole
future consumer is T-003-04 (`src/cli.ts`), out of scope here. Creating `src/shelf/` does
not conflict with T-003-01 — distinct files, no shared edits (the R5 guarantee).

## `src/shelf/select.ts` — public surface

Exactly three exports — the contract named by the acceptance criteria, nothing more:

```ts
export type SelectionErrorReason =
  | "empty"
  | "non-integer"
  | "out-of-range"
  | "reversed-range"
  | "malformed-range";

export class SelectionError extends Error {
  readonly reason: SelectionErrorReason;
  readonly field: string;   // the offending raw field; "" for whole-input-empty
  readonly input: string;   // the original selection string, for message context
  constructor(reason: SelectionErrorReason, field: string, input: string, detail: string);
}

export function parseSelection(s: string, menuLength: number): number[];
```

### Internal organization (top → bottom)

1. **Header comment** — purity + partiality contract, in the `id-guard.ts` voice:
   pure (no fs/clock/network/process/native addon, no imports), throws `SelectionError`
   on invalid input, returns a fresh deduped+sorted array otherwise; inputs not mutated;
   the R5 note (takes `menuLength` as a param so it never imports the menu module).
2. **`SelectionErrorReason`** union type.
3. **`SelectionError`** class — `super(detail)`, `this.name = "SelectionError"`, assign the
   three readonly fields. `detail` is the human sentence; `reason` is the machine tag.
4. **Two module-level `RegExp` constants** — `SINGLE = /^\d+$/`,
   `RANGE = /^(\d+)\s*-\s*(\d+)$/`. Hoisted so they are compiled once.
5. **`parseSelection`** — the one public function (orchestrator).
6. **Private helpers** (unexported, below the export so the public function reads first):
   - `expandField(field, input, menuLength): number[]` — classify one trimmed field into
     its index list (single → `[n]`, range → `[a..b]`), throwing on any fault.
   - `assertInRange(n, field, input, menuLength): void` — the `1 ≤ n ≤ menuLength` guard,
     throwing `out-of-range`. Single source of the bound check (used for both a single
     index and each range endpoint).

### `parseSelection` control flow (the blueprint, not code)

```
trim s → if "" → throw SelectionError("empty", "", s, "no selection given")
split on "," → fields[]
acc = new Set<number>()
for raw of fields:
    field = raw.trim()
    if field === "" → throw SelectionError("empty", "", s, "empty field (stray comma)")
    for n of expandField(field, s, menuLength): acc.add(n)
return [...acc].sort((a,b) => a - b)
```

### `expandField` control flow

```
if SINGLE.test(field):
    n = Number(field); assertInRange(n, field, input, menuLength); return [n]
m = RANGE.exec(field)
if m:
    a = Number(m[1]); b = Number(m[2])          // m[1]/m[2] guarded for noUncheckedIndexedAccess
    assertInRange(a, field, input, menuLength)
    assertInRange(b, field, input, menuLength)
    if a > b → throw SelectionError("reversed-range", field, input, `${a} > ${b}`)
    return [a, a+1, …, b]                        // inclusive
// neither shape matched:
if field.includes("-") → throw SelectionError("malformed-range", field, input, …)
else                   → throw SelectionError("non-integer", field, input, …)
```

`m[1]`/`m[2]`: under `noUncheckedIndexedAccess` these are `string | undefined`. Because the
regex matched, they are present; the code asserts/guards them (e.g. `if (!m[1] || !m[2])`
unreachable-throw, or a local non-null after the `exec` truthy check) so `tsc --strict`
stays green without an `as`.

### `assertInRange` control flow

```
if !Number.isInteger(n) || n < 1 || n > menuLength:
    throw SelectionError("out-of-range", field, input,
        `index ${n} not in 1..${menuLength}`)
```

(`Number.isInteger` is belt-and-suspenders — `^\d+$` already guarantees an integer — but it
documents the invariant and costs nothing.)

## `src/shelf/select.test.ts` — coverage blueprint

`import { describe, expect, test } from "bun:test"` and
`import { parseSelection, SelectionError } from "./select.ts"`. Five `describe` blocks,
matching `id-guard.test.ts`'s exact-array (`toEqual`) discipline:

1. **happy path** — `1,2,4-6 → [1,2,4,5,6]` (the spec example); a lone index; a lone range;
   a full-menu range.
2. **dedup & sort** — `1,1 → [1]`; `4-6,5 → [4,5,6]`; out-of-order `4-6,1 → [1,4,5,6]`;
   overlapping ranges `1-3,2-4 → [1,2,3,4]`.
3. **whitespace tolerance** — ` 1, 2 , 4-6 ` and `4 - 6` parse correctly.
4. **hard errors** — each asserted with `expect(() => …).toThrow(SelectionError)` plus a
   `reason` check via a try/catch helper: `0` (out-of-range), `> menuLength` (out-of-range),
   `6-4` reversed, `a`/`1.5` non-integer, `1-2-3`/`3-` malformed-range, empty string and
   stray-comma (empty).
5. **edge / precedence** — `3-3 → [3]` (equal endpoints, not reversed); `6-4` with
   `menuLength 5` → out-of-range (endpoint check wins, D7); `menuLength 0` → any index
   out-of-range; `01 → [1]` (leading zero accepted, D5).

### Reason-assertion helper

A small in-test helper to pin the `reason` tag, not just the class:

```ts
function reasonOf(fn: () => unknown): SelectionErrorReason | "NO-THROW" {
  try { fn(); return "NO-THROW"; }
  catch (e) { return e instanceof SelectionError ? e.reason : "NO-THROW"; }
}
```

## Ordering of changes

Single atomic unit — `select.ts` and `select.test.ts` land together in one commit (the
test cannot compile without the module; the module has no other consumer to stage against).
Plan.md sequences the within-file build order.

## Boundaries honored

- **R5 / AC#4** — no import of menu or CLI modules; `menuLength` is a plain parameter. The
  module has *zero* imports.
- **Purity** — no fs/clock/network/process; total except for the documented throw paths.
- **House surface** — three exports, matching the acceptance criteria verbatim; helpers
  private. Typed error in the `IdCollisionError` mould.
