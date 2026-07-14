# T-059-01 — Structure

The file-level blueprint. Three source files modified, one test file extended. No files
created or deleted. No BAML regen. Ordering: pure formatter first (everything depends on
it), then the two impure verbs, then tests.

## Files touched

| File | Change | Risk |
| --- | --- | --- |
| `src/play/project-context.ts` | add `intent?` to `SnapshotParts`; emit section in `buildProjectSnapshot`; export `SEED_PATH` | low — additive, gated on optional field |
| `src/play/steer.ts` | tolerant `SEED.md` read; pass `intent` | low — one read + one field |
| `src/play/survey.ts` | identical change to steer | low — identical |
| `src/play/project-context.test.ts` | add intent-present / intent-absent / blank pins | none — test-only |

## 1. `src/play/project-context.ts` (the pure core + the constant)

### 1a. The `SEED_PATH` constant

Add beside `CHARTER_PATH` (line 18):

```ts
/** Default seed location (the root one-line intent doc `vend steer`/`survey` read). */
export const SEED_PATH = "SEED.md";
```

Public interface: a new named export. Mirrors `CHARTER_PATH` exactly (same module, same
shape, same role — a default root-relative path the impure verbs `join(root, …)`).

### 1b. `SnapshotParts` gains an optional field (line 35)

```ts
export interface SnapshotParts {
  readonly root: string;
  readonly srcFiles: readonly string[];
  readonly stories: readonly string[];
  readonly tickets: readonly string[];
  /** The seed's stated intent (root SEED.md), verbatim. Optional: absent ⇒ no section ⇒
   *  snapshot byte-identical to today (the deliberate exception to "names, not contents":
   *  SEED *is* the intent doc). Blank/whitespace-only is treated as absent (honest-empty). */
  readonly intent?: string;
}
```

Optionality is the contract: the 4 non-wiring callers omit it and are unaffected.

### 1c. `buildProjectSnapshot` emits the section (line 49)

Insert the intent section **first**, after the title, before `## Source modules`. Use a
trim + blank-as-absent guard so a present-but-empty intent emits nothing (D3):

```ts
export function buildProjectSnapshot(parts: SnapshotParts): string {
  const sorted = (xs) => [...xs].sort();
  const list = (xs) => (xs.length ? sorted(xs).map((x) => `- ${x}`).join("\n") : "- (none)");
  const intent = parts.intent?.trim();
  return [
    `# Project snapshot — ${parts.root}`,
    "",
    ...(intent ? ["## Stated intent (SEED.md)", "", intent, ""] : []),
    "## Source modules (src/**)",
    list(parts.srcFiles),
    "",
    "## Existing stories",
    list(parts.stories),
    "",
    "## Existing tickets",
    list(parts.tickets),
    "",
  ].join("\n");
}
```

**Byte-identical invariant:** when `parts.intent` is `undefined` (or trims to `""`), the
spread is `[]` and the array is identical to today's — so `.join("\n")` is byte-identical.
This is the central correctness property and is what the unchanged existing test guards.

The house comment block above the function (lines 42–48) gets one sentence noting the
intent section is the deliberate exception to "a listing, not the file contents", justified
because SEED *is* the intent doc.

## 2. `src/play/steer.ts` — `assembleSteerInputs` (line 109)

Two edits:

- **Import** `SEED_PATH` from `./project-context.ts` (line 31 already imports
  `buildProjectSnapshot, listIdsIn, CHARTER_PATH` from there — add `SEED_PATH`).
- **Read SEED tolerantly** inside the existing `Promise.all`, pass as `intent`:

```ts
export async function assembleSteerInputs(opts: SteerOptions): Promise<SteerInputs> {
  const root = opts.projectRoot ?? process.cwd();
  const [charter, intent, stories, tickets] = await Promise.all([
    readFile(join(root, CHARTER_PATH), "utf8"),
    readFile(join(root, SEED_PATH), "utf8").catch(() => undefined),
    listIdsIn(`${root}/docs/active/stories`),
    listIdsIn(`${root}/docs/active/tickets`),
  ]);
  const project = buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent });
  return { project, charter };
}
```

`charter` stays non-tolerant (required). `intent` is tolerant (`.catch(() => undefined)` —
the `listIdsIn` idiom). The doc comment (lines 101–107) gains a sentence: it now also reads
the root SEED intent tolerantly into the snapshot (the E-059 make-or-break wire).

## 3. `src/play/survey.ts` — `assembleSurveyInputs` (line 120)

**Identical** change to steer (the two bodies are byte-for-byte the same today). Add
`SEED_PATH` to the line-32 import; add the tolerant read to the `Promise.all`; pass
`intent`. Same doc-comment sentence. Keeping the two bodies identical preserves the
"survey has the identical gap; both reuse `buildProjectSnapshot`" invariant from the ticket.

## 4. `src/play/project-context.test.ts` — new pins

Extend the existing `describe("buildProjectSnapshot …")` block (does not touch the
`listEpicIdTitlesIn` block). Add three tests:

- **`emits a Stated intent (SEED.md) section before Source modules when intent present`** —
  build with `intent: "A team-finder for solo hackathon-goers"`; assert the output contains
  `## Stated intent (SEED.md)` and the verbatim line, and that the intent header's index is
  `<` the `## Source modules` index.
- **`intent absent ⇒ no section, byte-identical shape`** — build the same parts with and
  without `intent`; assert the no-intent output has no `Stated intent` substring and that
  `buildProjectSnapshot(parts)` `===` `buildProjectSnapshot({ ...parts })` (the spread
  without intent), i.e. adding the optional field changed nothing for the absent case. The
  pre-existing `(none)`-count and section tests continue to pass unchanged — that is the
  byte-identical guarantee in force.
- **`blank/whitespace intent ⇒ treated as absent (no section)`** — `intent: "  \n "` ⇒ no
  `Stated intent` section (D3 honest-empty).

No new imports needed beyond the already-imported `buildProjectSnapshot`.

## Ordering of changes (for atomic commits)

1. **project-context.ts** (constant + field + formatter) **+ its tests** — self-contained,
   independently verifiable (`bun test src/play/project-context.test.ts`). The pure core
   lands and is pinned before any caller uses the new field.
2. **steer.ts + survey.ts** — wire the tolerant read. Depends on step 1's `SEED_PATH` +
   `intent` field existing. Typechecks only after step 1.

Two commits, or one cohesive commit if the steps are small — the plan sequences them.

## Public-interface delta (the full surface change)

- **New export:** `SEED_PATH: string` from `project-context.ts`.
- **Widened type:** `SnapshotParts` gains optional `intent?: string` (backward-compatible —
  existing constructions still satisfy it).
- **No change** to: `buildProjectSnapshot`'s signature shape (still one parts arg),
  `SteerInputs`/`SurveyInputs`, any BAML type, any other caller, the run-log, the CLI
  surface. Nothing is deleted or renamed.

## What stays untouched (explicit non-scope)

- `baml_src/steer.baml` and any generated `baml_client/*` — no regen.
- The other 4 `buildProjectSnapshot` callers (decompose, expand, note, propose-epic).
- `src/init/init-core.ts` (`TEMPLATE_REGISTRY.hackathon`) — that's T-059-02.
- The live re-drive / `EXPECTED-OUTCOME.md` — that's T-059-03.
