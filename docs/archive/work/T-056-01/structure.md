# T-056-01 — Structure: flip-designer-default-to-coarse-axis

_Phase: Structure. The file-level blueprint — what changes, where, and in what shape. Not code._

## Files touched

| File | Change | Why |
|------|--------|-----|
| `src/present/spec.ts` | **Modify** 1 line | Flip `DESIGNER_PRESET.groupBy: "story" → "status"` (:125). The whole behavioral change. |
| `src/present/presets.test.ts` | **Modify** (add 1 test) | AC clauses (a)+(b): pin `defaultPresetForSeat("designer").groupBy === "status"` and `DEV_PRESET.groupBy === "epic"`. |
| `src/present/svg-file.test.ts` | **Modify** (add 1 test + rename 1 test) | AC clause (c): live-board `groupCount` collapses to a handful; rename the stale "(groupBy story)" test. |

No files created or deleted. No new modules, exports, or interfaces. The `Grouping` type already
admits `"status"`, so no type surface changes.

## Change 1 — `src/present/spec.ts`

Single-line edit inside the frozen `DESIGNER_PRESET` literal:

```
-  groupBy: "story",
+  groupBy: "status",
```

Optionally refresh the preset's doc comment if it names the axis (it does not currently name
`story` — :112-113 describe intent/density, not grouping), so no comment edit is needed there.
`DEV_PRESET.groupBy: "epic"` (:141) is left exactly as is.

Ordering note: this is the first and only source change; tests are written against it.

## Change 2 — `src/present/presets.test.ts`

Add one pure test to the existing `describe("seat / preset table (pure)", ...)` block. It needs no
new imports — `defaultPresetForSeat`, `DESIGNER_PRESET`, `DEV_PRESET` are already imported (lines
6, 15). Shape:

```
test("the designer default groups by the coarse status axis; dev keeps epic (T-056-01)", () => {
  expect(defaultPresetForSeat("designer").groupBy).toBe("status");
  expect(DESIGNER_PRESET.groupBy).toBe("status");   // the preset itself, not just the lookup
  expect(DEV_PRESET.groupBy).toBe("epic");          // dev's finer axis is unchanged
});
```

This is the AC's (a)+(b) tooth: coarse designer default, unchanged dev axis.

## Change 3 — `src/present/svg-file.test.ts`

### 3a. Rename the stale test (cosmetic, no assertion change)

Line 171's test name `"... differs from designer (groupBy story)"` → `"... designer (groupBy
status)"`. The body (`dev.svg !== designer.svg`) is untouched and still holds.

### 3b. Add the live-board glanceability test (AC clause (c))

A new test in the existing live-board describe block (or its own block) that runs the **default**
seam against the **live board** (no injected graph) into a temp dir, and asserts the group collapse.
It reuses already-imported helpers (`writeBoardSvg`, `projectGraph`, `DESIGNER_PRESET`, `tempDir`,
`rm`) and adds one import: `DEV_PRESET`-free; it needs a `story`-axis spec for the relative bound,
built as `{ ...DESIGNER_PRESET, groupBy: "story" }`. Shape:

```
test("the default vend svg collapses the live board to a glanceable handful of status groups, not ~62 (T-056-01)", async () => {
  const dir = await tempDir();
  try {
    // default seat = designer = status axis, over the LIVE board (no injected graph).
    const result = await writeBoardSvg({ outDir: dir });
    // a handful, not a strip:
    expect(result.groupCount).toBeLessThanOrEqual(6);

    // non-vacuous: the same live board under the old story axis is far wider.
    const live = await loadWorkGraph();
    const storyGroups = projectGraph(live, { ...DESIGNER_PRESET, groupBy: "story" }).groups.length;
    expect(result.groupCount).toBeLessThan(storyGroups);
    expect(storyGroups).toBeGreaterThan(6); // proves the strip was real (guards the comparison)

    // observable in the written artifact:
    expect(await exists(result.path)).toBe(true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

New import needed at top of file: `import { loadWorkGraph } from "../graph/load.ts";` (the live
board loader, the same one `writeBoardSvg` uses internally). `exists` and `tempDir` helpers already
exist in the file (lines 71-82).

Determinism/authority note: this test reads the live board (read-only) and writes only to a temp
dir, matching the existing "writes the staged artifact, never docs/active" test's posture — no new
authority risk introduced.

## Module boundaries (unchanged)

- `spec.ts` remains the pure source of preset constants.
- `presets.ts` remains the seat→preset table + persistence; it forwards the changed preset by
  reference — no edit.
- `svg-file.ts` remains the impure seam; no edit (it already selects the designer default).
- `project.ts` / `projection-svg.ts` already implement `status` grouping fully — no edit.

## Ordering of changes

1. Edit `spec.ts:125` (the value).
2. Add the `presets.test.ts` assertion (pins the value).
3. Rename + add the `svg-file.test.ts` tests (pins the observable collapse).
4. Run `bun test` (full suite) + `bun run build` (typecheck) — expect green.

Each step is independently verifiable; the source edit and its tests can land in one atomic commit
since the change is a single coherent unit.
