# Design — T-069-01-02

## Decision summary

Extend the pure ticket renderer with an optional routing seat and extend `materialize` with the same
optional trailing argument. `renderTicketFile` conditionally inserts `agent: <seat>` immediately
after `priority:`. `materialize` validates a supplied seat with the canonical `findUnknownSeat`
oracle before it performs any board read or write, throwing a typed `UnknownSeatError` that carries
the rejected value. Existing calls that omit the parameter retain byte-identical output.

## Goals

1. Stamp one valid gesture-level seat onto every generated ticket.
2. Preserve every byte of legacy output when the seat is absent.
3. Reject values outside the canonical upstream seat tuple.
4. Make rejection typed and useful to the later effect relabel.
5. Make zero partial output structural rather than cleanup-based.
6. Keep exact rendering logic pure and filesystem work in the existing shell.
7. Avoid preempting effect, run-log, chain, or CLI tickets.

## D1 — Optional trailing parameters

### Choice

Use these compatible signatures:

```ts
renderTicketFile(t, snapshot, agent?)
materialize(plan, targets, charter, agent?)
```

### Rationale

- Every existing call remains source-compatible.
- The ticket's value is optional at the gesture boundary.
- A trailing scalar mirrors the established charter parameter flow without restructuring callers.
- The later decompose-effect ticket can pass `ctx.inputs.agent` directly.
- Tests can exercise both legacy and routed cases against the public functions.

### Rejected: add the seat to `TicketDraft`

The BAML draft represents model-produced work. Routing is operator input applied uniformly after the
plan clears; putting it into each draft would invite per-ticket variation, require schema/codegen
changes, and violate the story's explicit per-gesture boundary.

### Rejected: add an options object now

An options object could scale to more metadata, but it would churn every call site and change a
settled public seam for one optional value. No current requirement warrants that migration.

## D2 — Conditional frontmatter insertion

### Choice

In the ordered frontmatter array, insert:

```ts
...(agent !== undefined ? [`agent: ${agent}`] : []),
```

directly after the `priority:` element and before `phase:`.

### Rationale

- The array remains the single owner of frontmatter ordering.
- Exact placement is obvious in code and pinned by a byte-exact golden.
- Absence contributes zero elements and therefore zero bytes.
- A supplied empty or invalid string is not silently erased by truthiness; validation owns refusal.
- Ticket body and story rendering remain untouched.

### Rejected: render and then string-replace `priority:`

Post-processing would be more fragile, obscure ordering ownership, and could accidentally match body
text. The frontmatter array already provides the correct structural seam.

### Rejected: always emit an empty agent field

This would change legacy bytes and write invalid empty metadata on bare mints.

## D3 — Validation at the materialize boundary

### Choice

At the beginning of `materialize`, when `agent !== undefined`, call `findUnknownSeat(agent)`. Throw
`UnknownSeatError` if the oracle returns a string.

### Rationale

- `materialize` is the last centralized boundary before board effects.
- Every production route must pass through it.
- The check uses the single vocabulary created by the dependency ticket.
- Placing it before board reads makes the guarantee stronger and cheaper than merely before writes.
- The pure renderer remains total and reusable; validation policy stays in the effect shell.
- The unknown value, including an empty string, is rejected rather than normalized or omitted.

### Rejected: validate in `renderTicketFile`

That would make a pure formatter throw policy errors and validate repeatedly for every ticket. It
would also allow story rendering and clock work to occur before the first ticket triggers refusal.

### Rejected: validate in `assembleInputs`

The story explicitly requires a write-side guard, and assembly is a transport seam shared before the
materialization effect. Validation there would not protect other direct materialize callers.

### Rejected: rely only on CLI validation

CLI validation cannot protect chain or internal call sites and would not establish the requested
write-side invariant.

## D4 — Typed error shape

### Choice

Export `UnknownSeatError extends Error` from `materialize.ts` with:

- readonly `seat: string` payload;
- `name = 'UnknownSeatError'`;
- a refusal message naming the unknown value and canonical known values.

### Rationale

- It follows `IdCollisionError` and `BareCodeError` in the same module.
- `instanceof` gives the later effect ticket a precise relabel seam.
- The payload avoids parsing human-readable text.
- Listing `KNOWN_SEATS` makes direct failures actionable and keeps the message sourced from the same
  contract.
- Exporting from the writer matches where the refusal originates.

### Rejected: reuse `RangeError`

`RangeError` is already used for programmer-level BAML enum drift. An invalid operator-supplied seat
is an expected typed refusal and needs a distinct later run-log outcome.

### Rejected: define the error in `agent-seat.ts`

The upstream module intentionally owns only the pure vocabulary and oracle. Error policy belongs to
the materialization effect, just as the dependency ticket documented.

## D5 — Guard ordering

### Choice

Order the guards as:

1. unknown seat;
2. board id collision;
3. rendered bare charter code;
4. directory creation and writes.

### Rationale

- Seat validity is independent of board state and costs no I/O.
- An invalid call is refused before any filesystem observation or clock read.
- Existing identity-before-content ordering remains intact for valid or absent seats.
- No cleanup path is needed because no mutation has begun.
- Later effect code receives the most immediate input-contract error.

## D6 — Test design

### Legacy golden

Leave the existing two-argument `renderTicketFile(ticket(), SNAPSHOT)` full-file golden unchanged.
Its continued pass proves that omission produces exactly the pre-change bytes and no `agent:` key.

### Routed golden

Add a byte-exact pure renderer golden using `agent = 'codex'`. It should differ from the legacy
golden by exactly one line between `priority: high` and `phase: ready`.

### Multi-ticket filesystem proof

Materialize a plan with at least two tickets and seat `codex`, read both files, and assert every file
contains the exact adjacent sequence `priority: high`, `agent: codex`, `phase: ready`. Also assert
there are no missing or duplicate stamps.

### Unknown-seat zero-write proof

Call `materialize` with `gpt` against fresh target paths. Capture the failure and assert:

- `instanceof UnknownSeatError`;
- `.seat === 'gpt'`;
- error name/message are meaningful;
- neither target directory exists after refusal.

This directly proves the acceptance criterion's typed failure and zero-created-file requirement.

### Regression verification

- Run focused materialize tests.
- Run TypeScript build.
- Run `git diff --check`.
- Run the complete `bun run check` gate.

## D7 — Documentation updates in code

Update the module-level and materialize comments from two pre-write guards to three. Document the
new ordering and that a supplied seat is validated once then threaded to every ticket renderer.
Avoid unrelated comment cleanup.

## Scope guard

This design does not:

- pass `ctx.inputs.agent` from `decompose-epic.ts`;
- catch or relabel `UnknownSeatError`;
- add `unknown-seat` to run-log types;
- alter chain options;
- parse `--agent` in the CLI;
- modify story frontmatter;
- modify ticket body prose;
- modify BAML declarations;
- alter Lisa dispatch;
- add seats beyond `claude | codex`;
- support per-ticket seat overrides.

## Compatibility and risk assessment

- API risk is low because both new parameters are optional and trailing.
- Byte-compatibility risk is controlled by retaining the unchanged existing golden.
- Placement risk is controlled by a routed exact golden and adjacent-line filesystem assertions.
- Partial-write risk is controlled by placing validation at function entry and checking real paths.
- Vocabulary drift risk is controlled by importing the upstream constant/oracle.
- The primary implementation risk is accidentally using a truthiness check; explicit
  `!== undefined` avoids it.

## Final decision

Compose the upstream pure seat oracle once at the start of the impure materialization boundary,
express refusal with a local typed error, and conditionally add one ordered frontmatter line in the
pure ticket renderer. This is the smallest change that proves both routing bytes and the hard
zero-write contract while preserving the story's ticket boundaries.
