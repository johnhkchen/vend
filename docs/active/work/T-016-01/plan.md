# T-016-01 — Plan

Ordered, independently verifiable steps. Each step is a clean commit boundary. Testing strategy
inline per step.

## Step 1 — Author `baml_src/expand.baml` + regenerate the client

- Create `baml_src/expand.baml`: header comment (authoring-only, mirrors propose.baml; SAP-rejects
  garbage; documents the honest-empty model contract), `enum SignalTier`, `class Signal` (7 fields
  with `@description`), `function ExpandFragment(fragment, charter, project) -> Signal` with the
  demand-extractor prompt (cite the source via `grounding`; abstain blank rather than invent;
  name the value via `advances`).
- Run `bun run baml:gen`. Verify `Signal` + `SignalTier` are exported from `baml_client`
  (`grep -r "class Signal\|SignalTier" baml_client/types.ts`).
- **Verify:** `bun run check:typecheck` still green (no TS consumes `Signal` yet — this just proves
  the gen produced valid types). `baml_client` is untracked, so nothing to commit from gen.
- **Commit:** `feat(expand): author ExpandFragment BAML — Signal shape + SignalTier (T-016-01)`
  (only `baml_src/expand.baml` is tracked).

## Step 2 — `src/play/expand-core.ts` (the pure core)

- Create the module: header (purity rationale, the propose-core mirror), type-only imports
  (`Signal`, `GateVerdict`), `EXPAND_GATE_NAMES`/`ExpandGateName`, `ExpandClearContext`,
  `TIER_ALIAS`, internal `nonEmpty`/`matchIds`/`flowArray`/`aliasTier`/`Offense`, the three gate
  fns, the `GATES` table, `clear()`, `renderSignalRow()`.
- Copy `nonEmpty`/`matchIds`/`flowArray` verbatim from `propose-core.ts` (self-contained per the
  gates.ts discipline — no shared-util coupling).
- **Verify:** `bun run check:typecheck` green.
- **Commit:** folded into Step 3's commit (core + its test land together — a core with no test is
  not a reviewable unit).

## Step 3 — `src/play/expand-core.test.ts` (pure unit tests)

- Create the test: `FULL_SIGNAL` fixture + `CHARTER` snippet (`P2`/`N4`), enum members as
  string-literal casts (`"Keystone" as SignalTier`), all BAML imports type-only.
- Cases (one `describe` per gate + renderer):
  - clears all three gates → `status:"clear"`, `cleared === [...EXPAND_GATE_NAMES]`.
  - honest-empty: `{...FULL, what:"  ", why:"  "}` → stop, gate `honest-empty`.
  - read-never-invent: `{...FULL, grounding:"  "}` → stop, gate `read-never-invent`.
  - value-link empty: `{...FULL, advances:[]}` → stop, gate `value-link`.
  - value-link non-goal: `{...FULL, advances:["N4"]}` → stop, reason contains "non-goal".
  - value-link dangling: `{...FULL, advances:["P9"]}` → stop, gate `value-link`.
  - value-link free-text: `{...FULL, advances:["wider v1 surface"]}` → clear.
  - renderer: `renderSignalRow(FULL)` contains what, why, the tier token, budget, readiness, `P2`.
  - renderer drift: `renderSignalRow({...FULL, tier:"Legendary" as SignalTier})` throws `RangeError`.
- **Verify:** `bun test src/play/expand-core.test.ts` green; pure (no addon loaded — runs in ms).
- **Commit:** `feat(expand): pure core — Signal gates (read-never-invent / honest-empty /
  value-link) + row renderer, unit-tested (T-016-01)`.

## Step 4 — `src/baml/expand-bridge.ts` (subprocess bridge)

- Create the bridge: clone `propose-bridge.ts` structure; `ExpandBridgeOp`/`ExpandBridgeResult`,
  `runOp` over `b.request.ExpandFragment` / `b.parse.ExpandFragment`, `extractPromptText` imported
  from `./decompose-bridge.ts`, the `import.meta.main` stdin/stdout protocol with the render-only
  key guard.
- **Verify:** `bun run check:typecheck` green; smoke `echo '{"ops":[{"mode":"render","fragment":"x",
  "charter":"P2","project":"y"}]}' | bun run src/baml/expand-bridge.ts` returns a JSON `results`
  with a prompt (manual one-off, not committed).
- **Commit:** folded into Step 5 (bridge + its test land together).

## Step 5 — `src/baml/expand.test.ts` (offline BAML pins)

- Create the test: clone `propose.test.ts`; `BRIDGE` path, `runBridge(ops)` single child spawn,
  `CANNED` Signal JSON (tier `"keystone"`, advances `["P2"]`, grounding non-blank), `FRAGMENT`/
  `CHARTER`/`PROJECT` sentinels. Cases: parse-of-canned → typed `Signal` (member `"Keystone"`,
  advances, grounding); parse-of-garbage → `ok:false` containing "required field"; render → prompt
  contains all three sentinels + the extractor framing string.
- **Verify:** `bun test src/baml/expand.test.ts` green.
- **Commit:** `test(expand): offline BAML pins — parse / SAP-reject / render via expand-bridge
  (T-016-01)`.

## Step 6 — Full gate + commit

- `bun run check` (baml:gen → typecheck → full suite). Expect all prior tests + the new
  expand-core/expand pins green, zero failures.
- `bun run check:committed` and `bun run check:head` (the E-008/E-010 gates) green.
- If clean already from per-step commits, this step is verification only.

## Testing strategy summary

| Unit | Test | Kind | Why |
|---|---|---|---|
| three gates (`clear`) | `expand-core.test.ts` | pure | the play's judgment — the AC's core requirement |
| `renderSignalRow` | `expand-core.test.ts` | pure | the Signal shape round-trips (demand-row faithful) |
| `b.parse.ExpandFragment` | `expand.test.ts` | child-spawn | SAP parse + reject pinned offline |
| `b.request.ExpandFragment` | `expand.test.ts` | child-spawn | the authored prompt renders the 3 inputs |

No integration/live test in this ticket — `vend expand` end-to-end is T-016-02. No fs/spawn in the
core ⇒ no temp-dir fixture needed here (that arrives with the effect in T-016-02).

## Verification criteria (AC mapping)

- *typed `Signal` + `ExpandFragment` render+parse via `expand-bridge`* → Steps 1, 4, 5.
- *pure gates, each unit-tested (grounded passes; speculative refused; vision-distance-zero →
  honest-empty)* → Step 3.
- *core is pure (no fs/spawn) + composes into `Play.gates`* → `clear()` returns `GateVerdict`
  (Step 2); pure test runs addon-free (Step 3).
- *`bun run check:*` green* → Step 6.

## Rollback / deviation policy

Each step is an isolated commit; a failing step reverts only its own files. If `baml:gen` produces
an unexpected `Signal` shape (e.g. enum naming), fix `expand.baml` and re-gen before touching TS —
never hand-edit `baml_client`. Document any deviation in `progress.md` before proceeding.
