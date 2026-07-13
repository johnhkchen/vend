# Structure — T-078-02-01

## Change boundary

The ticket changes exactly two repository source files:

1. `src/gate/gates.ts`
2. `src/gate/gates.test.ts`

No files are created, deleted, or moved in `src/`. No BAML-generated file is ticket-owned. The six
RDSPI artifacts and review disposition are written only to the private Lisa attempt directory.

## Module boundary

`src/gate/gates.ts` remains the pure clearing boundary.

It continues to own:

- whole-plan gate result types;
- gate ordering;
- caller boundary guards;
- pure helper functions;
- value, story-completeness, allocation, bounds, and structural judgments;
- the public `clear` entry point;
- the `isStop` narrowing helper.

The change does not introduce a new module because the detector already belongs here and the new
diagnostic is gate-specific presentation policy.

## Public interface change

### Existing public exports retained

- `GATE_NAMES`
- `GateName`
- `ClearContext`
- `GateStop`
- `GateClear`
- `GateResult`
- `STORY_CONTRACT_FIELDS`
- `StoryContractField`
- `clear`
- `isStop`

### New public export

`matchIds` becomes public with its current signature:

```ts
export function matchIds(text: string, prefix: "P" | "N"): Set<string>
```

No call sites need migration because export visibility is additive. The internal bounds call sites
continue using the same symbol.

### Public behavior

- Inputs remain plain strings.
- Matching remains `\b${prefix}\d+\b`, global across the text.
- Results remain unique strings in encounter order through JavaScript `Set` insertion order.
- Repeated labels remain deduplicated.
- P and N matching remains explicitly selected by the prefix argument.
- Empty input or no matching labels returns an empty set.

## Private helper addition

Add one helper beside `matchIds`, before gate implementations:

```ts
function withUnlabeledCharterFix(reason: string, charter: string): string
```

Its responsibilities are limited to:

1. Detect P-label count using `matchIds(charter, "P")`.
2. Return `reason` byte-for-byte when at least one label exists.
3. Append the approved cause/fix sentence when the set is empty.

The helper does not:

- classify a plan;
- choose a gate;
- inspect the epic;
- mutate context;
- modify the charter;
- parse Markdown structure;
- expose its wording to sibling modules.

## Constant versus inline text

The diagnostic text can live as a private module constant to keep the exact bytes singular:

```ts
const UNLABELED_CHARTER_FIX =
  "your charter has no labeled invariants (P1 — Author once, run forever...) — label them or cite none";
```

The helper appends it with a fixed separator. A named constant makes the two refusal sites incapable
of drifting while keeping the text private.

## Value gate changes

### Signature

Before:

```ts
function valueGate(plan: WorkPlan): Offense | null
```

After:

```ts
function valueGate(plan: WorkPlan, ctx: ClearContext): Offense | null
```

### Branch organization

The function keeps its current order:

1. zero-ticket plan;
2. missing purpose;
3. empty/invalid advances;
4. missing done signal;
5. restated done signal;
6. pass.

Only branch 3 changes its returned `reason` expression. It passes the exact legacy reason and
`ctx.charter` to the private helper.

### Gate table

The `GATES` value entry changes from:

```ts
["value", (p) => valueGate(p)]
```

to:

```ts
["value", (p, ctx) => valueGate(p, ctx)]
```

The table type, order, and other entries remain unchanged.

## Bounds gate changes

The start of `boundsGate` remains:

```ts
const invariants = matchIds(ctx.charter, "P");
const nonGoals = matchIds(ctx.charter, "N");
```

The iteration and branch order remain:

1. trim claim;
2. refuse non-goal;
3. refuse shaped dangling P-reference;
4. allow other/free-text claim.

Only branch 3 changes its reason construction. It wraps the exact legacy dangling reason with the
private helper and supplies `ctx.charter`.

There is no need to pass the already-computed `invariants` set into the helper. Avoiding a second scan
would require a second helper signature or derived metadata. The charter is tiny and clarity is more
valuable here. If desired during implementation, the helper may accept a boolean derived from
`invariants.size === 0`, but that would make the value site perform its own match anyway. Either shape
must preserve one shared wording function.

## Test file structure

`src/gate/gates.test.ts` remains a single pure unit-test module.

### Import change

Add `matchIds` to the existing named import from `./gates.ts`. No runtime dependency is added beyond
the module already under test.

### Fixture addition

Add a charter string with no P-label tokens and a context derived from `CTX`:

```ts
const UNLABELED_CHARTER = `...`;
const UNLABELED_CTX: ClearContext = { ...CTX, charter: UNLABELED_CHARTER };
```

The prose must not accidentally include an example token such as `P1`, because the detector is token
based. Comments adjacent to the fixture should also not be concatenated into the runtime string.

### Detector describe block

Add a focused block before clear’s happy path:

- no P-labels returns an empty set;
- labeled fixtures return expected P IDs;
- P and N prefixes remain separate;
- duplicates are deduplicated if a compact test fixture includes them.

### Value tests

The existing labeled empty-advances test gains an exact legacy reason assertion.

Add an adjacent unlabeled-charter test asserting the exact complete result or at least the exact
reason after pinning status/gate/unit. Using exact `toBe` on `reason` protects punctuation and the
operator instruction.

### Bounds tests

The existing labeled dangling-ref test gains an exact legacy reason assertion.

Add an adjacent unlabeled-charter test for an unnormalized `P9` advance. It must reach `bounds`, not
normalization, because `clear` is called directly. Assert exact reason bytes.

### Existing regression surface

All other tests remain in place. Their unchanged inputs against the labeled `CTX` pin:

- happy-path clear result and gate list;
- empty-plan refusal;
- blank advances refusal;
- story-completeness failures;
- allocation failures;
- normalization behavior;
- non-goal refusal;
- free-text acceptance;
- structural failures;
- first-offense ordering;
- type guards and programmer-error throws.

## Dependency direction

There is no new import direction.

- `gates.test.ts` imports the public seam from `gates.ts`.
- Future doctor and init modules may import `matchIds` from `gates.ts` after this ticket completes.
- `gates.ts` remains independent of doctor and init.
- No cycle is introduced.

## Commit unit

The implementation and test changes form one meaningful ticket-owned source unit. They should be
committed together only after focused tests and `bun run check` pass:

```text
lisa commit-ticket
  --ticket-id T-078-02-01
  --message <ticket-scoped message>
  --include src/gate/gates.ts
  --include src/gate/gates.test.ts
```

The private phase artifacts are excluded from that source commit. Unrelated modified ticket/epic
files are also excluded.

## Verification structure

1. Focused test: `bun test src/gate/gates.test.ts`.
2. Type/build check as part of full gate.
3. Full gate: `bun run check`.
4. Inspect the exact diff for the two source paths.
5. Commit through Lisa with only those exact paths.
6. Confirm those two paths are clean afterward.
7. Confirm unrelated pre-existing working-tree changes remain present and untouched.

## Structural outcome

The change is additive at the public API and conditional at two private return sites. It preserves
the pure-core boundary, gate topology, verdict types, and all effect boundaries while establishing
the shared detector seam required by the parent story’s downstream tickets.
