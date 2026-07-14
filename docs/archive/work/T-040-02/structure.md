# T-040-02 — Structure: the blueprint

File-level shape of the change. Not code — the contract the code fills.

## Files

| File | Op | Role |
|---|---|---|
| `src/init/init-effect.ts` | **create** | the impure write effect — apply a plan, no-clobber |
| `src/init/init-effect.test.ts` | **create** | guarded-live temp-dir test (the AC) |

No other files change. `init-core.ts` is **reused, not reopened**. `cli.ts`,
`package.json`, gitignores — untouched (the CLI `init` arm + lisa-gate are T-040-03).

## `src/init/init-effect.ts` — public surface (in file order)

A header comment stating the rule (mirrors `propose-effect.ts`): *the converge **logic**
lives in `init-core.ts` (pure, committed); THIS is the thin impure shell that APPLIES a
plan that module produces. ADDON-FREE but IMPURE — imports only `node:fs/promises`,
`node:path`, and the pure core. No-clobber is absolute: dirs via recursive mkdir
(idempotent no-op), files via the exclusive `wx` flag (EEXIST → skip, never truncate). The
`isLisaProject` refusal is the CLI's composition (T-040-03), not here.*

### Imports

```ts
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  SCAFFOLD_MANIFEST,
  planInit,
  type ScaffoldEntry,
} from "./init-core.ts";
```

### Result type

```ts
export interface InitApplyResult {
  readonly created: readonly string[];  // manifest-relative POSIX paths written
  readonly skipped: readonly string[];  // manifest-relative paths left untouched
}
```

### Internal helper

```ts
async function pathExists(abs: string): Promise<boolean>;
```

- `stat(abs)` → true; catch → if `code === "ENOENT"` return false, else **rethrow** (the
  uniform ENOENT idiom: `(e as NodeJS.ErrnoException).code === "ENOENT"`). The single place
  "does this manifest path already exist" is decided, feeding the planner's `existing`.

### The effect

```ts
export async function applyInitScaffold(
  projectRoot: string,
  manifest: readonly ScaffoldEntry[] = SCAFFOLD_MANIFEST,
): Promise<InitApplyResult>;
```

Body, in order:
1. **Scan**: for each manifest entry, `pathExists(join(projectRoot, entry.path))`; collect
   the present `entry.path`s into `existing: string[]`.
2. **Plan**: `const plan = planInit(existing, manifest)` — the single source of the
   create/skip decision (D2). Seed `skipped = [...plan.skips]`.
3. **Apply** `plan.creates` in manifest order (D6):
   - `dir`  → `await mkdir(join(projectRoot, entry.path), {recursive:true})`; push to
     `created`.
   - `file` → `await mkdir(dirname(abs), {recursive:true})`; then
     `await writeFile(abs, entry.contents, {flag:"wx"})` →
       - success → push to `created`;
       - EEXIST (caught) → push to `skipped` instead (the TOCTOU/race reclassification, D3);
       - any other error → **propagate** (a genuine fs fault throws — the house rule).
4. **Return** `{created, skipped}` (both manifest-relative).

## `src/init/init-effect.test.ts` — coverage map (mirrors the AC)

Imports `bun:test`, the `node:fs/promises` + `node:os` + `node:path` temp-dir kit (the
`propose-effect.test.ts` precedent), and `./init-effect.ts` + a few names from
`./init-core.ts` (`SCAFFOLD_MANIFEST`, `countDemandRows`).

Helper `seedBareLisa()`: `mkdtemp(join(tmpdir(),"vend-init-"))`, write a root `CLAUDE.md`
(so the dir is framed as a bare lisa project, per the AC), return the root. Every test
tears down in `finally` with `rm(root,{recursive:true,force:true})`.

`describe` blocks:

1. **bare lisa project → full tree** (AC clause 1):
   - apply `applyInitScaffold(root)`; assert **every** `SCAFFOLD_MANIFEST` path now exists
     (`stat` each under root, dirs and files);
   - assert each `file` entry's on-disk contents `=== entry.contents` (the seeds landed
     verbatim);
   - assert the board is honestly empty: `countDemandRows(read demand.md) === 0` and
     `=== 0` for `demand-cleared.md`;
   - assert `result.created` length `=== manifest.length`, `result.skipped` is empty;
   - assert the seeded `CLAUDE.md` is still present and untouched (we created only
     vend-owned paths — one-way to lisa).

2. **no-clobber: a pre-seeded file is byte-identical** (AC clause 2):
   - seed bare lisa, then pre-write a sentinel at a manifest file path — e.g.
     `docs/knowledge/vision.md` = `"PRE-EXISTING — do not touch\n"` (mkdir its parent
     first);
   - apply; assert that file's contents are **still the sentinel** (byte-identical), and
     that its path is in `result.skipped`, not `result.created`;
   - assert the rest of the tree was still created (the gap filled around the kept file).

3. **idempotent second apply** (AC clause 2, second sentence):
   - apply once; snapshot every manifest file's contents (+ existence) ; apply a **second**
     time;
   - assert `result2.created` is empty and `result2.skipped.length === manifest.length`;
   - assert every file's contents are byte-identical to the snapshot (changed none);
   - assert no manifest path is missing and (sanity) no extra files appeared at the manifest
     paths.

4. **focused fixture manifest** (isolates the create/skip partition from the full 17):
   - a 2-entry fixture (`[{kind:"dir",path:"x"},{kind:"file",path:"x/a.md",contents:"A"}]`)
     applied to a fresh temp root → both created; pre-seed `x/a.md` then re-apply the
     fixture → `a.md` skipped + byte-identical, dir `x` skip/no-op. Proves the partition
     without leaning on the real manifest's size.

5. *(guard)* **EEXIST reclassification** — optional micro-test: pre-seed a file that the
   *plan* would mark create by passing a stale/empty `existing` is not directly reachable
   via the public entry (it scans itself), so this is exercised implicitly by block 2's
   no-clobber assertion. No separate test needed beyond noting it.

## Ordering of work (for Plan)

Header comment → imports → `InitApplyResult` → `pathExists` → `applyInitScaffold` → tests.
Single cohesive commit (one impure module + its temp-dir test). Green `bun run check`
(baml:gen + tsc --noEmit + bun test) is the gate, then the on-stop `check:committed`.

## Boundaries restated

- Impure but addon-free: only `node:fs/promises` + `node:path` + the pure core.
- No-clobber absolute: recursive mkdir for dirs; `wx` flag for files; EEXIST → skip.
- One-way to lisa: writes only manifest (vend-owned) paths; never a lisa-owned file.
- No CLI wiring, no `isLisaProject` refusal — those are T-040-03.
- `init-core.ts` reused, never edited.
