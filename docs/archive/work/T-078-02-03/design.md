# Design — T-078-02-03

## Goal

Make every newly scaffolded generic Vend charter teach and satisfy the P-label convention at minute
zero, while retaining the charter as an editable stub and preserving all existing init behavior.

The resulting guarantees are:

- the base charter contains P-labeled invariant examples;
- the shared gate detector resolves at least one label from those exact seed bytes;
- a one-line comment states that casts cite the labels;
- a real fresh init writes those same labeled bytes to `docs/knowledge/charter.md`;
- no existing file is rewritten;
- named overlay behavior is unchanged.

## Decision 1 — enrich the existing generic seed in place

### Chosen approach

Expand module-private `CHARTER_STUB` in `src/init/init-core.ts` with:

- the existing title;
- the existing generic authoring guidance;
- a small `## Invariants` section;
- a one-line HTML comment explaining that casts cite the labels;
- several P-labeled placeholder invariant bullets.

### Why this fits

- `CHARTER_STUB` is already the source for the base manifest charter entry.
- The planner and writer already preserve its contents byte-for-byte.
- A content edit reaches bare init and standalone base-derived templates automatically.
- It does not broaden public API.
- It preserves pure-core architecture.
- It changes future scaffolds only; no-clobber protects existing workspaces.

### Rejected alternative — export `CHARTER_STUB`

Exporting the constant would let tests import it directly, but creates a production API solely for
test access. The exported manifest already exposes the exact bytes consumers receive. Testing through
the manifest better proves the real configuration and avoids an unnecessary symbol.

### Rejected alternative — post-process the charter in the effect

Injecting labels during filesystem writes would duplicate content policy in the impure shell, bypass
the manifest's single-source guarantee, and complicate no-clobber reasoning. The effect should remain
blind to charter semantics.

### Rejected alternative — create a separate charter template module

A new module is unnecessary for this small generic stub. The existing file groups all base scaffold
seed strings and already treats compile-time strings as pure values. Splitting one short seed adds a
boundary without reuse.

## Decision 2 — use editable generic placeholder invariants

### Chosen approach

Ship a compact set of labels such as `P1`, `P2`, and `P3`, each phrased as a project-authoring prompt
rather than as Vend's own product invariants.

The stub should teach shape and semantics:

- each invariant has a stable `P<number>` label;
- each invariant expresses durable project value or a constraint;
- the operator is expected to replace the placeholder language;
- the label convention remains visible while authoring.

### Why multiple labels

The ticket says “P-labeled invariants” and “these labels,” plural. Although acceptance requires only
one resolved label, several examples make the convention legible and prevent a misleading impression
that only one invariant may exist.

### Why not copy Vend's own P1–P7

A newly initialized project should define its own value function. Copying Vend's seven product
principles would seed the wrong domain assumptions and make the stub look authoritative rather than
editable. Generic prompts preserve honesty.

### Why not ship only `P1 — TODO`

A bare TODO satisfies the regex but teaches little. Short meaningful placeholders demonstrate the
kind of stable project judgment the charter is meant to hold while remaining clearly replaceable.

## Decision 3 — make the teaching line a Markdown HTML comment

### Chosen line

Use one exact line:

```markdown
<!-- Casts cite these labels in `advances`; keep each P-label stable once referenced. -->
```

### Rationale

- It contains the acceptance phrase “Casts cite these labels.”
- It names the actual field, `advances`, where citations live.
- It explains why stability matters after references exist.
- It is source-visible for authors without adding rendered-document clutter.
- It is exactly one line and can be byte-pinned by a pure test.

### Rejected alternative — visible prose paragraph

Visible prose would also teach the rule, but the ticket explicitly calls it a comment line. An HTML
comment fulfills that shape precisely and makes the contract distinguishable from authored charter
content.

### Rejected alternative — TypeScript source comment

A comment outside the template would never reach the scaffolded workspace and would fail the
newcomer-facing intent.

## Decision 4 — prove the pure contract through the manifest and shared detector

### Chosen test placement

Add a focused `describe` block in `src/init/init-core.test.ts` near the existing manifest tests. Derive
the charter file entry from `SCAFFOLD_MANIFEST`, then assert:

- the entry exists and is a file;
- `matchIds(contents, "P")` contains one or more labels;
- the expected exact HTML comment line is present.

### Rationale

- The test stays filesystem-free.
- It exercises the same bytes the planner hands to the effect.
- It uses the detector exported by the gate module, satisfying the shared-seam contract.
- It does not replicate the detector's regex.
- It catches both accidental label removal and comment drift.

### Import direction assessment

`init-core.test.ts` may import `matchIds` from `../gate/gates.ts`. This is a test-only dependency, not
a production init-core dependency. `gates.ts` has no runtime BAML addon import; its BAML types are
erased. The pure test remains ordinary and addon-free.

### Rejected alternative — assert `.toContain("P1")` only

A substring assertion could pass on text that the real detector does not accept. The acceptance
criterion specifically requires resolution through the exported detector.

### Rejected alternative — move the test to `gates.test.ts`

That would make the gate package own init seed behavior and widen the predecessor ticket's surface.
The behavior belongs with the seed under `src/init`.

## Decision 5 — add explicit fresh-workspace effect proof

### Chosen test placement

Extend the existing “bare lisa project gets the full tree” temp-directory test in
`src/init/init-effect.test.ts`. After `applyInitScaffold(root)`:

- read `docs/knowledge/charter.md` from disk;
- assert its P-label set through `matchIds` is non-empty;
- assert its bytes equal the base manifest charter entry.

### Rationale

- The existing test already represents a fresh Vend init workspace.
- It uses the real filesystem writer and cleanup discipline.
- The direct assertion makes the ticket property explicit instead of relying only on the generic
  “all files equal manifest” loop.
- Byte equality joins the pure source and effect result in one proof.

### Rejected alternative — new standalone temp-directory test

A separate test would repeat setup, apply, and cleanup for a property already inside the fresh-root
scenario. Extending the focused scenario is clearer and faster.

### Rejected alternative — test only `runInit`

`runInit` adds template and Lisa-gate composition unrelated to this content property. The existing
effect seam is enough to prove a fresh workspace receives the labeled charter. Other tests already
cover `runInit` dispatch.

## Compatibility and boundaries

- Bare init writes richer bytes at the same path.
- Existing workspaces remain untouched by `wx` and planner skip semantics.
- The manifest entry count and order do not change.
- The hackathon charter continues to override the same path.
- The kitchen overlay remains untouched.
- No doctor logic changes.
- No gate detector or verdict logic changes.
- No schema changes.
- No live cast or token spend is needed.

## Verification design

Run the smallest checks first:

1. `bun test src/init/init-core.test.ts src/init/init-effect.test.ts`
2. `bun run check`
3. `git diff --check` on the three ticket-owned source paths.
4. Inspect the exact diff and worktree state.
5. Commit exactly the three source paths through `lisa commit-ticket`.
6. Verify those paths are clean and the commit contains only them.

## Design conclusion

The implementation is deliberately content-led: teach the convention in the one seed already used
by every base scaffold, then pin its semantic readability in the pure layer and its materialization
in the effect layer. No new production behavior or architecture is necessary.
