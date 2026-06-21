# T-051-01 — Research

> Add a symmetric `disallowedTools` option to `buildArgs`/`DispenseOptions` so the
> headless seam can emit `--disallowedTools`, beside the existing `allowedTools`
> allowlist and under the same empty-omitted-emits-nothing discipline.

Descriptive map of what exists today and how the pieces connect. No solutions here.

## The seam

The single metered seam lives in `src/executor/claude.ts`. It dispenses a prompt
to Claude via the `claude -p` headless CLI and is deliberately split into a PURE
core (arg building, stream parsing, line buffering, message routing, the timeout
latch) plus ONE impure function, `dispense`, that spawns the process. The split is
the testing contract: everything pure is unit-tested with sample lines and a fake
child; `dispense` is the single intentionally-untested function.

The relevant surfaces for this ticket:

- **`buildArgs(opts) → string[]`** (claude.ts:139–167). PURE. Builds the `claude -p`
  argv. Base flags `["-p", "--output-format", "stream-json", "--verbose"]` are
  always present. Each optional flag is appended only when its option is supplied,
  and the function is written so that **when nothing optional is supplied the argv
  is byte-identical to the pre-feature baseline**. This is the function the ticket
  extends.
- **`DispenseOptions`** (claude.ts:72–103). The option bag for `dispense`. Carries
  `prompt`, `model`, `effort`, `system`, `maxTurns`, `mcpConfig`, `allowedTools`,
  `strictMcp`, `onMessage`, `timeoutMs`. Each agentic option maps 1:1 to a
  `buildArgs` flag.
- **`dispense(opts)`** (claude.ts:302–331). Impure. Destructures the agentic options
  and forwards them to `buildArgs({ ... })` (claude.ts:303), then spawns. The
  forwarding list must include any new option or it is silently dropped.
- **`ClaudeExecutor`** (claude.ts:343–348). A one-line delegate over `dispense`;
  honors every option on `DispenseOptions` by construction (it just passes the bag
  through). No change of substance needed here beyond what `DispenseOptions` carries.

## The `allowedTools` precedent (E-032) — the exact pattern to mirror

`allowedTools` was added in E-032 (T-032-01 pure builder, T-032-02 threading). Its
shape is the template for `disallowedTools`:

1. **Type** — `DispenseOptions.allowedTools?: readonly string[]` (claude.ts:90),
   doc-commented "Empty/omitted ⇒ no flag."
2. **`buildArgs` destructure + inline param type** — `allowedTools` appears both in
   the destructure (claude.ts:146) and in the inline parameter type literal
   (claude.ts:154). `buildArgs` declares its own param shape inline; it does NOT
   reuse `DispenseOptions`, so the two must be kept in sync by hand.
3. **Emission guard** (claude.ts:164):
   ```ts
   if (allowedTools && allowedTools.length > 0) args.push("--allowedTools", allowedTools.join(","));
   ```
   Two-part guard: present AND non-empty. The value is **comma-joined into ONE argv
   element** — deliberate, because the CLI flag is variadic (`<tools...>`) and a
   space-separated multi-element push would let the flag swallow a following flag.
4. **`dispense` forwarding** (claude.ts:302–303): `allowedTools` is destructured from
   `DispenseOptions` and named in the `buildArgs({ ... })` call.
5. **Ordering** — tool flags are appended after `--max-turns`, in the order
   `--mcp-config`, `--allowedTools`, `--strict-mcp-config` (claude.ts:163–165).

## CLI flag verification (done during research)

`claude -p --help` confirms the symmetric flag exists and has the same shape:

```
--allowedTools,    --allowed-tools    <tools...>   Comma or space-separated list of tool names to allow
--disallowedTools, --disallowed-tools <tools...>   Comma or space-separated list of tool names to deny
```

So `--disallowedTools` is the camelCase spelling that mirrors `--allowedTools`
exactly, and it is **variadic** — confirming the same comma-join-into-one-element
discipline is required. E-032 recorded its spelling verification in-code; this
ticket should do likewise (AC requirement).

## Test surface

`src/executor/claude.test.ts` is the oracle. Header (lines 14–17) states the rule:
no live spawn; pure helpers tested with samples. The `buildArgs` tool-scoping block
(lines 75–125) is the section the new cases belong in:

- `mcpConfig alone` (77), `allowedTools comma-joins into ONE element` (83), `empty
  allowedTools emits no flag` (89), `strictMcp true/false` (94), `all tool flags
  compose ... in order` (101), `no tool options ⇒ byte-identical` (119).

These give an exact template: a positive case (flag + comma-joined value as one
element), an empty-array case (no flag), a composition case (ordering), and a
back-compat byte-identical assertion.

## Constraints & assumptions

- **Pure/impure split is sacred.** The new logic lives entirely in `buildArgs`
  (pure), so it is fully testable without a live model. No new impurity.
- **Back-compat is a hard gate.** `buildArgs({})` and `buildArgs({ disallowedTools: [] })`
  must remain byte-identical to today's argv. Existing back-compat tests must stay
  green unchanged.
- **`buildArgs` param type is inline, not shared.** Both the destructure and the
  inline type literal must gain `disallowedTools`, plus `DispenseOptions`, plus the
  `dispense` destructure+forward. Four edit points for one option (mirrors E-032).
- **Scope boundary.** This ticket only adds the *plumbing* — the option and the flag.
  WHO sets `disallowedTools` (routing the `AskUserQuestion` denylist through
  autonomous plays only) is **T-051-02**, the sibling ticket. This ticket must not
  touch cast/play routing; it only makes the headless seam *able* to emit the flag.
- **Ordering choice is open for Design.** Where `--disallowedTools` sits relative to
  `--allowedTools`/`--strict-mcp-config` is a small decision; the natural reading is
  immediately after `--allowedTools` (allow then deny, before strict-mcp).
