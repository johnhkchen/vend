// Selection mini-language parser (T-003-03) — the pure heart of the `vend <sel>` press.
//
// The browse half (T-003-01/02) renders a numbered shelf; this is the parse half of the
// press. It turns a tiny selection string into the picked 1-indexed positions:
// `1,2,4-6 → [1,2,4,5,6]`. Comma-separated fields, each a single index `n` or an inclusive
// range `a-b`; 1-indexed; deduped; sorted ascending; whitespace-tolerant. An invalid or
// out-of-range selection is a HARD error (a typed `SelectionError`), never a coerced guess —
// the house rule (materialize.ts: "caller error THROWS; it is never silently wrong").
//
// PURE: no fs, clock, network, process, or native addon — in fact NO imports at all. It
// takes `menuLength` as a plain number rather than the menu itself, so it never touches the
// menu/CLI modules (AC#4, rule R5) — that decoupling is exactly what lets it run in parallel
// with the menu work. The convergence (T-003-04) passes `menu.actions.length` at the
// boundary and resolves the returned indices against the persisted `.vend/menu.json`.
// PARTIAL, not total (the one departure from id-guard's `detectCollisions`): it returns a
// fresh deduped+sorted array on valid input, or throws `SelectionError` on anything else.
// Inputs are never mutated.

/** Closed set of failure modes, so the boundary (T-003-04) can `switch` exhaustively when
 *  turning a fault into a user-facing message instead of pattern-matching a string. */
export type SelectionErrorReason =
  | "empty" // the whole selection, or a single field, is blank (e.g. "", "1,,2", "1,")
  | "non-integer" // a single field is not a positive integer (e.g. "a", "1.5")
  | "out-of-range" // an index is < 1 (e.g. "0") or > menuLength
  | "reversed-range" // a range a-b with a > b (e.g. "6-4")
  | "malformed-range"; // a field shaped like a broken range (e.g. "1-2-3", "3-", "-3")

/**
 * A rejected selection. Carries machine-branchable structure, not just a message — mirrors
 * `IdCollisionError`/`ClaudeTimeoutError`: a `super(...)` human sentence plus typed fields so
 * a genuine bug is never misread as a clean rejection. `field` is the offending raw field
 * (`""` for the whole-input-empty case); `input` is the original selection string.
 */
export class SelectionError extends Error {
  readonly reason: SelectionErrorReason;
  readonly field: string;
  readonly input: string;
  constructor(reason: SelectionErrorReason, field: string, input: string, detail: string) {
    super(`invalid selection ${JSON.stringify(input)}: ${detail}`);
    this.name = "SelectionError";
    this.reason = reason;
    this.field = field;
    this.input = input;
  }
}

/** A single 1-indexed position: one or more ASCII digits, nothing else. */
const SINGLE = /^\d+$/;
/** An inclusive range `a-b`, tolerant of whitespace around the dash (`4 - 6`). */
const RANGE = /^(\d+)\s*-\s*(\d+)$/;

/**
 * Parse a selection mini-language string into the picked 1-indexed positions, deduped and
 * sorted ascending. PURE and PARTIAL — throws `SelectionError` on empty, non-integer,
 * out-of-range, reversed, or malformed input rather than guessing. `menuLength` is the size
 * of the menu the indices are validated against; any index outside `1..menuLength` is
 * `out-of-range` (so an empty menu, `menuLength <= 0`, rejects everything). Inputs are not
 * mutated.
 */
export function parseSelection(s: string, menuLength: number): number[] {
  const trimmed = s.trim();
  if (trimmed === "") {
    throw new SelectionError("empty", "", s, "no selection given");
  }
  const picked = new Set<number>();
  for (const raw of trimmed.split(",")) {
    const field = raw.trim();
    if (field === "") {
      throw new SelectionError("empty", "", s, "empty field (stray comma)");
    }
    for (const n of expandField(field, s, menuLength)) {
      picked.add(n);
    }
  }
  return [...picked].sort((a, b) => a - b);
}

/** Classify one trimmed, non-empty field into its 1-indexed positions, throwing on any
 *  fault. Single → `[n]`; range `a-b` → `[a, …, b]` inclusive. */
function expandField(field: string, input: string, menuLength: number): number[] {
  if (SINGLE.test(field)) {
    const n = Number(field);
    assertInRange(n, field, input, menuLength);
    return [n];
  }
  const m = RANGE.exec(field);
  if (m && m[1] !== undefined && m[2] !== undefined) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Endpoints must exist on the menu before "is the order sensible?" is meaningful (D7).
    assertInRange(a, field, input, menuLength);
    assertInRange(b, field, input, menuLength);
    if (a > b) {
      throw new SelectionError("reversed-range", field, input, `range ${a}-${b} is reversed`);
    }
    const out: number[] = [];
    for (let i = a; i <= b; i++) {
      out.push(i);
    }
    return out;
  }
  // Neither shape matched: a stray dash means a broken range; otherwise a broken single.
  if (field.includes("-")) {
    throw new SelectionError("malformed-range", field, input, `${JSON.stringify(field)} is not a valid range`);
  }
  throw new SelectionError("non-integer", field, input, `${JSON.stringify(field)} is not a positive integer`);
}

/** The single bound check: `n` must be an integer in `1..menuLength`. Throws `out-of-range`
 *  otherwise — this is where `0` and overflow are caught (1-indexed, never a guess). */
function assertInRange(n: number, field: string, input: string, menuLength: number): void {
  if (!Number.isInteger(n) || n < 1 || n > menuLength) {
    throw new SelectionError("out-of-range", field, input, `index ${n} is not in 1..${menuLength}`);
  }
}
