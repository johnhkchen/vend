# T-040-03 — Design: the `vend init` command

Grounded in research.md. Each decision is anchored in the existing codebase, with the rejected
alternatives recorded.

## D1 — `parseInitArgs` shape: flags-only, no positional, no budget

**Decision.** `vend init` takes NO arguments. `parseArgs(["init"])` → `{ cmd: "init" }`. Any
token after `init` — positional or flag — is a usage error: `unexpected init argument: <tok>`.

**Why.** `init` scaffolds the cwd; there is no subject to type and nothing is cast, so there is
nothing to fund. This is exactly `shelf`'s situation (research §"per-verb parsers"), and
`parseShelfArgs` is the tightest template: `if (argv.length > 1) return usage`. The `ScaffoldEntry`
manifest and the target root (the cwd) are both implicit, so the command line carries no data.

**Rejected.**
- *Optional `--budget` (the survey/steer shape).* Rejected: nothing is cast; a budget would be
  dead. `shelf` already set the precedent that a no-cast verb omits `--budget` entirely.
- *Optional positional `[dir]` to scaffold a non-cwd target.* Rejected: out of AC scope ("the
  cwd is not a lisa project" — the cwd is the implicit, only target). The effect already accepts
  a `projectRoot` parameter, so a future ticket can widen this without reshaping the parser.
- *A `--force` / `--no-clobber` flag.* Rejected: no-clobber is ABSOLUTE and unconditional in the
  effect (T-040-02). There is no clobbering mode to toggle.

## D2 — `init` is its own `ParsedCommand` arm: `{ cmd: "init" }`

**Decision.** Add `| { readonly cmd: "init" }` to the `ParsedCommand` union — a payload-free arm,
exactly like `{ cmd: "shelf" }`.

**Why.** Mirrors `shelf`. No data crosses the parse boundary, so the arm needs no fields. Routing
in `parseArgs`: `if (argv[0] === "init") return parseInitArgs(argv);`, placed beside the other
`if (argv[0] === …)` lines.

## D3 — the refuse-or-apply composition lives in `init-effect.ts` as `runInit`, returning a typed result

**Decision.** Add to `src/init/init-effect.ts`:

```ts
export type InitOutcome =
  | { readonly kind: "not-lisa"; readonly root: string }
  | { readonly kind: "scaffolded"; readonly result: InitApplyResult };

export async function runInit(projectRoot: string): Promise<InitOutcome>;
```

`runInit` reads the top-level entries of `projectRoot` (`readdir`), feeds them to the pure
`isLisaProject`; on a miss it returns `{ kind: "not-lisa", root }` (the typed andon — a clean
refusal returned as DATA, nothing written); on a hit it calls `applyInitScaffold(projectRoot)`
and returns `{ kind: "scaffolded", result }`.

**Why.** This is the house pattern: `pressShelf`, `castWork`, and `runPlay` all return a
discriminated union that includes their precondition failures, and the CLI arm stays a thin
`switch (kind)` → exit code. Putting the refusal in `runInit` (a) makes it **testable** against a
real temp dir with the existing `init-effect.test.ts` harness, and (b) keeps the `import.meta.main`
block — which never runs under test — a pure router. The "typed andon" the ticket asks for is
precisely the `not-lisa` kind; the "a clean refusal returns data, a real fault throws" rule the
effect header already cites applies: a genuine `readdir` fault (anything but ENOENT) propagates.

The init-effect.ts header says the refusal+hint is "the CLI's composition (T-040-03)". This design
keeps the **hint string and exit code in the CLI** (D5) while moving the **detection composition**
(readdir + isLisaProject + apply) into the effect module so it is testable. The CLI still owns the
user-facing andon; the effect owns only the typed branch. This honors both the header's intent and
the house testability pattern.

**Rejected.**
- *Inline the whole refuse-or-apply in `import.meta.main`.* Rejected: the refusal path — the
  headline behavior of this ticket — would be entirely untested. The house already solved this
  with returned-kind composition; not using it here would be a regression in discipline.
- *A new `src/init/init-cli.ts` module.* Rejected: needless. The composition is a world-touching
  verb; `init-effect.ts` is exactly the "world-touching verb" module and already imports the pure
  core and `node:fs/promises`. Adding `readdir` to its import list is the minimal change.
- *Put detection in the pure core.* Rejected: `isLisaProject` is the pure part and already exists.
  The `readdir` is impure and must live in the effect.

## D4 — cwd listing: a single non-recursive `readdir(projectRoot)`

**Decision.** `runInit` lists only the top-level entries: `await readdir(projectRoot)`.

**Why.** Both `LISA_MARKERS` (`CLAUDE.md`, `.lisa.toml`) are project-ROOT files (research). A
recursive walk would be wasted work and could false-positive on a nested `CLAUDE.md`. `readdir`
returns bare names, which `isLisaProject` (operating on a `Set` of normalized names) consumes
directly — no path-joining needed for detection.

**Edge case.** If `projectRoot` itself does not exist, `readdir` throws ENOENT. For `process.cwd()`
this is effectively impossible (the cwd exists by definition). We let a genuine fault propagate
(the house rule); we do NOT treat a missing root as `not-lisa`, because that would mask a real
fault behind the wrong andon.

## D5 — the CLI dispatch arm: thin switch on `InitOutcome`

**Decision.** In `import.meta.main`, after the other arms:

```ts
if (parsed.cmd === "init") {
  const { runInit } = await import("./init/init-effect.ts");
  const outcome = await runInit(process.cwd());
  if (outcome.kind === "not-lisa") {
    process.stderr.write(
      `not a lisa project (no CLAUDE.md or .lisa.toml in ${outcome.root}) — run \`lisa init\` first\n`,
    );
    process.exit(1);
  }
  const { created, skipped } = outcome.result;
  process.stdout.write(`vend init: scaffolded ${created.length} created, ${skipped.length} skipped\n`);
  process.exit(0);
}
```

**Why.**
- **Lazy import** of the effect — the uniform idiom (keeps the pure-parse path import-free).
- **Hint string** satisfies the AC: it says "not a lisa project" and points at `lisa init`. It
  also names the two markers and the offending root, so the user knows exactly why and where —
  consistent with `work`'s informative refusals (`no staged board found (tried …)`).
- **Exit 1 on `not-lisa`.** It is an environment precondition refusal, the same family as
  `no-board`/`no-menu` (exit 1), not a malformed command line (exit 2). "Non-zero" per the AC
  is satisfied either way; exit 1 is the precedent-correct non-zero.
- **Exit 0 + tally on success** — mirrors `applyInitScaffold`'s own `created`/`skipped`
  language and the work-arm's receipt-then-exit-0 shape. The idempotent re-run (all skipped)
  still exits 0: re-running `init` on an already-scaffolded project is success, not an error.

## D6 — USAGE line

**Decision.** Add `"       vend init\n"` to the `USAGE` banner, placed with the other zero-arg
read/setup verbs (near `shelf`). No argument placeholders — there are none.

**Why.** The AC requires USAGE to list the init line. The bare form matches the flags-only D1.

## Test strategy (detailed in plan.md)

- **`cli.test.ts`** — pure `parseInitArgs` tests: bare `init` → `{cmd:"init"}`; an unexpected
  positional → usage; an unknown flag → usage. (AC: "tests cover bare `init` and
  unknown-flag→usage".) Plus an assertion that `USAGE` contains the init line.
- **`init-effect.test.ts`** — guarded-live `runInit` tests: a non-lisa temp dir → `not-lisa` with
  the root echoed and NOTHING written; a bare-lisa temp dir → `scaffolded` with the full tree and
  a truthful tally; idempotent second `runInit` → `scaffolded`, zero created.
