# T-003-03 — Design: pure-selection-minilanguage

> Options, tradeoffs, decisions with rationale — grounded in the Research map.
> One module, `src/shelf/select.ts`: a pure `parseSelection` + a typed `SelectionError`.

## The shape, decided up front

Mirror `id-guard.ts` exactly (the closest sibling, obs 20402): one pure function with a
long purity-contract header, plus a typed error in the `materialize.ts`/`claude.ts` mould.
No imports, no I/O. The only departure from `detectCollisions` is that this function is
**partial** — it throws `SelectionError` on invalid input rather than being total. That is
the whole point of the ticket ("a hard error, never a guess").

```ts
export type SelectionErrorReason =
  | "empty" | "non-integer" | "out-of-range" | "reversed-range" | "malformed-range";
export class SelectionError extends Error { /* reason, field, input */ }
export function parseSelection(s: string, menuLength: number): number[]
```

## D1 — One function, or a tokenizer/parser split?

**Options.** (a) A single `parseSelection` with an inline field loop. (b) A layered
tokenize → parse-field → expand → dedupe/sort pipeline of small exported helpers.

**Decision: (a), a single function with *private* helpers.** The grammar is two productions
(single, range) under a comma split — far below the complexity that earns a parser
abstraction. `id-guard.ts` exports exactly one function and keeps everything else implicit;
matching that keeps the public surface to precisely what the acceptance criteria name
(`parseSelection`, `SelectionError`). Internal helpers (`expandField`, `assertIndex`) stay
unexported — they are not contract, and exporting them would invite tests that pin
implementation shape rather than behavior. Rejected (b): premature; adds surface T-003-04
must ignore.

## D2 — Error model: typed class vs. result object vs. bare throw

**Options.** (a) `throw new SelectionError(...)` carrying structured fields. (b) Return a
discriminated union `{ ok: true, indices } | { ok: false, error }`. (c) `throw new Error(string)`.

**Decision: (a), a typed `SelectionError extends Error`.** This is the settled house
convention — `IdCollisionError`, `ClaudeTimeoutError`, and the `alias()` `RangeError` all
throw typed errors with machine-branchable fields, and the house rule is explicit: "a bad
index is a hard error, never silently wrong" (`materialize.ts` header). The acceptance
criteria literally say "throw a typed `SelectionError`." Rejected (b): a result union would
break from every sibling and force the T-003-04 boundary into a different idiom than the
rest of the codebase. Rejected (c): loses the structure the boundary needs to render a
helpful message ("field `6-4` is reversed").

**Error structure.** Carry three `readonly` fields:
- `reason: SelectionErrorReason` — a closed union the boundary can `switch` on.
- `field: string` — the offending raw field (`""` for the empty-input case).
- `input: string` — the whole original selection string, for context in the message.

Five reasons (closed union): `empty`, `non-integer`, `out-of-range`, `reversed-range`,
`malformed-range`. These map 1:1 onto the acceptance criteria's error list plus the
malformed-shape case Research surfaced. A closed union (not free-form strings) means
T-003-04 gets exhaustiveness checking for free.

## D3 — Empty input → throw or `[]`?

**Decision: throw `SelectionError("empty")`.** `parseSelection` is only ever reached on the
`vend <sel>` path, where a selection is mandatory (bare `vend` shows the menu and never
calls this). An empty/whitespace-only string is the user pressing the button with nothing
selected — a hard error is the honest response, consistent with "never a guess." Returning
`[]` would hand T-003-04 an ambiguous "select nothing" it would have to re-reject anyway.
A trailing/double comma (`1,`, `1,,2`) yields an empty *field*, which is also `"empty"`
(same reason, with `field: ""`) — one concept, one reason.

## D4 — Whitespace tolerance: how far?

**Decision: trim the whole string, trim each comma field, and tolerate spaces around the
range dash.** Concretely: `s.trim()`, split on `,`, `.trim()` each field, and match a range
with `/^(\d+)\s*-\s*(\d+)$/`. So ` 1, 2 , 4 - 6 ` is valid. Whitespace *inside* a single
number (`4 6`) is **not** tolerated — it falls through to `non-integer`, because "4 6" is
not one integer and silently picking one would be a guess. This satisfies the AC's
`1,2,4-6` and "whitespace-tolerant" without over-accepting.

## D5 — Integer grammar: `\d+` vs. signed/decimal-aware

**Decision: a field endpoint is `^\d+$` (one or more ASCII digits).** Consequences, all
intended:
- `1.5` → not `\d+` → `non-integer`. ✓ (AC: non-integer throws.)
- `-1` → not `\d+` (the `-` is the range separator, never a sign) → falls to range/malformed
  handling → `malformed-range`. ✓
- `01` → matches `\d+`, `Number("01") === 1`. **Accepted** as `1`. Leading zeros are a
  harmless integer spelling; rejecting them would be pedantry the spec doesn't ask for.
- `0` → matches `\d+`, `Number("0") === 0` → caught by the range check as `out-of-range`
  (1-indexed). ✓ This is the AC's explicit `0` case.

Using a regex + `Number()` (not `parseInt`, which would silently accept `"12abc"`) keeps
the "no silent coercion" promise.

## D6 — Field dispatch and the malformed-range boundary

A trimmed, non-empty field is classified by structure:
1. `^\d+$` → **single** index.
2. `^(\d+)\s*-\s*(\d+)$` → **range**.
3. otherwise → an error. **Which** error? If the field *contains* a `-`, it is a broken
   range (`1-2-3`, `3-`, `-3`, `1-`) → `malformed-range`. If it contains no `-`, it is a
   broken single (`a`, `1.5`, `4 6`) → `non-integer`. This split gives the boundary a
   precise reason instead of a catch-all.

## D7 — Validation order within a range (the `6-4` question)

**Decision: validate each endpoint is in `[1, menuLength]` first, then check reversed.**
Rationale: range membership is the more fundamental precondition (the index must *exist* on
the menu before "is the order sensible?" is even meaningful). Deterministic, documented
consequence: `6-4` with `menuLength = 5` → `out-of-range` (6 > 5); `6-4` with
`menuLength ≥ 6` → `reversed-range`. Equal endpoints (`3-3`) are **not** reversed — inclusive
range of one element `[3]`. Tested both ways so the precedence is pinned, not incidental.

## D8 — `menuLength` invariants — own them or not?

**Decision: do not separately validate `menuLength`; let the range check absorb it.** The
function's contract is "indices valid against a menu of this length." If `menuLength` is `0`
(empty menu) or negative, every index is `> menuLength` or `< 1` and throws `out-of-range`
naturally — the correct outcome (nothing is selectable). The pure function need not police
the menu's own invariants (that is the menu module's job, T-003-01); duplicating it here
would couple them. One guard only: treat `menuLength` as an integer bound in the comparison;
no extra throw path.

## D9 — Dedup + sort

**Decision: accumulate every produced index into a `Set<number>`, then
`[...set].sort((a, b) => a - b)`.** The numeric comparator is mandatory — JS default sort is
lexicographic (`10` before `2`). Set gives dedup across both single and range sources
(`4-6,5 → {4,5,6}`; `1,1 → {1}`). Output is a fresh array; no input is mutated (there is
nothing mutable to mutate — `s` is a string).

## Decision summary

| # | Decision |
|---|----------|
| D1 | One public `parseSelection`; private helpers; mirror `id-guard.ts` surface |
| D2 | Typed `SelectionError extends Error` with `reason`/`field`/`input`; 5-value closed reason union |
| D3 | Empty input/field → throw `empty` |
| D4 | Trim whole + each field + tolerate spaces around dash; no space inside a number |
| D5 | Endpoints are `^\d+$` + `Number()`; `01`→1, `1.5`/`-1` rejected, `0`→out-of-range |
| D6 | Field with `-` but no valid range shape → `malformed-range`; else `non-integer` |
| D7 | Range: endpoints-in-range first, then reversed; `a==b` allowed |
| D8 | No separate `menuLength` validation; out-of-range absorbs `0`/negative menus |
| D9 | `Set<number>` → numeric `.sort()`; fresh array, no mutation |
