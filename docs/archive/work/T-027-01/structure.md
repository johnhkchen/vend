# T-027-01 Structure — board-freshness-gate

The file-level blueprint. No new files — the change extends four existing ones, plus two test files.
Shape of the code, not the code.

## Files touched

| File | Change | Public surface |
|---|---|---|
| `src/play/work-core.ts` | **modify** | +`isBoardStale` (export), +`renderStaleBoard` (export) |
| `src/play/work-core.test.ts` | **modify** | +`describe("isBoardStale")`, +`describe("renderStaleBoard")` |
| `src/play/work.ts` | **modify** | +`staleOk` on `WorkOptions`, +`stale-board` on `WorkResult`, +`newestActiveMtimeMs` (private), gate in `castWork` |
| `src/cli.ts` | **modify** | +`--stale-ok` in `parseWorkArgs`, +`staleOk` on `work` `ParsedCommand`, +`stale-board` dispatch branch, USAGE |
| `src/cli.test.ts` | **modify** | +`--stale-ok` parser cases in the `work` block |

No files created or deleted. No new module — D1 places the pure pieces in the existing `work-core.ts`.

## `src/play/work-core.ts` (pure core)

Add two exports, alongside `parseBoardSignals`/`renderReceipt`, reusing the existing `amber()` helper.

```ts
/** PURE/TOTAL. The board is stale iff it predates the project's live state (fresh-on-tie). mtime is a
 *  heuristic — a git checkout can reset it; `--stale-ok` is the escape hatch (T-027-01, IA-5/IA-9). */
export function isBoardStale(boardMtimeMs: number, liveMtimeMs: number): boolean {
  return boardMtimeMs < liveMtimeMs;
}

/** The stale-board andon (IA-9) — amber, a SUCCESSFUL refusal. Renders both timestamps (ISO, so the
 *  pure text is assertable — `new Date(ms)` is total) + the re-survey next move + the honest mtime
 *  caveat. `opts.color` (default false) gates the ANSI, like renderReceipt. PURE. */
export function renderStaleBoard(
  r: { readonly boardPath: string; readonly boardMtimeMs: number; readonly liveMtimeMs: number },
  opts: { color?: boolean } = {},
): string { /* amber header + staged/changed lines + re-survey move + caveat */ }
```

- `isBoardStale`: the D2 `<` predicate, the honest-caveat comment required by the ticket.
- `renderStaleBoard`: builds the D5 copy. Header through `amber(..., color)`. `new Date(ms).toISOString()`
  for both timestamps. Includes `r.boardPath` so the operator sees which board was refused. Joins with
  `\n`. The stop-head phrasing echoes `STOP_HEAD.andon` ("a successful stop, not a crash").
- No new imports (Date is a global; `amber` is in-file).

## `src/play/work-core.test.ts`

Two new `describe` blocks (the file already imports from `./work-core.ts` — extend the import line):

- `isBoardStale`: `(100, 200) → true`, `(200, 100) → false`, `(100, 100) → false` (the AC trio), plus
  `(5, 0) → false` (degenerate: no live state ⇒ fresh).
- `renderStaleBoard`: a fixture `{ boardPath:"…/steer.md", boardMtimeMs: <A>, liveMtimeMs: <B>}` with
  `B > A`; assert the output contains `new Date(A).toISOString()`, `new Date(B).toISOString()`, the
  re-survey move (`vend steer` / `vend work`), the `--stale-ok` caveat; assert default (no color) has
  no `\x1b[` and `{color:true}` does.

## `src/play/work.ts` (impure shell)

1. **Imports:** extend the `node:fs/promises` import to add `readdir` and `stat`:
   `import { readFile, readdir, stat } from "node:fs/promises";`. Add `isBoardStale` to the work-core
   import line (`parseBoardSignals, labelForSignal, isBoardStale`).

2. **`WorkOptions`** — add:
   ```ts
   /** Spend even when the board is stale (IA-5 — the human override). Default: refuse a stale board. */
   readonly staleOk?: boolean;
   ```

3. **`WorkResult`** — add the variant:
   ```ts
   | { readonly kind: "stale-board"; readonly boardPath: string; readonly boardMtimeMs: number; readonly liveMtimeMs: number }
   ```
   Doc comment: a stale board is a clean refusal (the CLI renders the amber andon + exits 1, like
   no-board/empty-board), not a thrown fault.

4. **Private gather** `newestActiveMtimeMs(root: string): Promise<number>` (near `readBoard`, the
   no-shared-util mirror of load.ts's `readNodes`):
   ```ts
   const ACTIVE_DIRS = ["docs/active/epic", "docs/active/stories", "docs/active/tickets"];
   async function newestActiveMtimeMs(root: string): Promise<number> {
     let newest = 0;
     for (const rel of ACTIVE_DIRS) {
       let names: string[];
       try { names = await readdir(join(root, rel)); } catch { continue; } // ENOENT tolerant
       for (const name of names) {
         if (!name.endsWith(".md")) continue;
         try { const s = await stat(join(root, rel, name)); if (s.mtimeMs > newest) newest = s.mtimeMs; }
         catch { continue; }
       }
     }
     return newest;
   }
   ```

5. **The gate in `castWork`** — between the `empty-board` return and `const funded = …`:
   ```ts
   if (!opts.staleOk) {
     const boardMtimeMs = (await stat(board.path)).mtimeMs;
     const liveMtimeMs = await newestActiveMtimeMs(root);
     if (isBoardStale(boardMtimeMs, liveMtimeMs)) {
       return { kind: "stale-board", boardPath: board.path, boardMtimeMs, liveMtimeMs };
     }
   }
   ```
   Skipped entirely under `--stale-ok` (no stat cost). Runs after empty-board (nothing stale about an
   empty board; saves the gather). Header note: the gate is impure (stat) but proven by the free live
   refusal + the pure `isBoardStale`/`renderStaleBoard` units — the module's existing "not unit-tested"
   stance is unchanged.

## `src/cli.ts` (dispatch shell)

1. **`USAGE`** (~22): `"       vend work [--budget <ms>,<tokens>] [--board <path>] [--stale-ok]\n"`.

2. **`ParsedCommand`** `work` variant (~51) — add:
   ```ts
   /** Spend even when the staged board is stale (IA-5 override); absent ⇒ the freshness gate refuses. */
   readonly staleOk?: boolean;
   ```

3. **`parseWorkArgs`** (~369) — add a `--stale-ok` arm to the loop and thread it:
   ```ts
   let staleOk = false;
   …
   } else if (a === "--stale-ok") {
     staleOk = true;
   } else { … unexpected work argument … }
   …
   return { cmd: "work", ...(budget ? { budget } : {}), ...(board ? { board } : {}), ...(staleOk ? { staleOk: true } : {}) };
   ```
   Presence flag (the `--no-gates` precedent), so the default object shape is preserved.

4. **The `work` dispatch arm** (~586):
   - extend the work-core lazy import: `const { renderReceipt, formatStepSignal, renderStaleBoard } = …`.
   - thread the flag into `castWork`: `...(parsed.staleOk ? { staleOk: true } : {})`.
   - add the branch after `empty-board`, before the `spent` receipt:
     ```ts
     if (result.kind === "stale-board") {
       process.stderr.write(`${renderStaleBoard(result, { color: true })}\n`);
       process.exit(1);
     }
     ```

## `src/cli.test.ts`

Extend the `work` block (~210–239):
- `work --stale-ok → { cmd:"work", staleOk:true }`.
- composition: `work --budget 1,2 --board b.md --stale-ok → { cmd:"work", budget:{…}, board:"b.md", staleOk:true }`.
- bare `work` still `{ cmd:"work" }` (no `staleOk` key — shape preserved).

## Ordering of changes (detail for Plan)

work-core (decision+render+units) → work.ts (gather+gate+result) → cli.ts (flag+render+dispatch) →
live proof. Each of the first three is independently green (the pure units land with their functions;
the cli arm typechecks against the new variant). The live refusal is the capstone, deterministic and
free.
