# T-057-03 — Structure

_File-level blueprint. Which files change, the exact shape of each change, the ordering. Not code —
the shape of the code._

## Files touched

| File | Change | Kind |
|---|---|---|
| `src/cli.ts` | USAGE line + `ParsedCommand` arm + `parseArgs` route + `parseAnnotateArgs` + dispatch arm | modify |
| `src/cli.test.ts` | new `describe("parseArgs — annotate …")` block | modify |

No new files. No deletions. No new imports (`Seat` is already imported at cli.ts :14 for svg;
`castExpandFragment`/`expandFragmentPlay` are lazy-imported inside the dispatch arm, as for expand).

## `src/cli.ts` — the five edits, in order

### 1. USAGE banner (:17–:29)

Add one line after the `expand` line (keep the round-trip halves adjacent):

```
"       vend annotate <node-id> \"<feedback>\" [--seat <designer|dev>]\n" +
```

Satisfies the AC's "the usage banner lists `vend annotate`."

### 2. `ParsedCommand` union (:42–:95)

Add, after the `expand` member:

```ts
| { readonly cmd: "annotate"; readonly nodeId: string; readonly feedback: string; readonly seat: Seat }
```

`seat: Seat` (not `string`): the parser validates against `SVG_SEATS`, so the parsed value is always
one of the two seats; `Seat` is assignable to `Annotation.seat: string` at the dispatch boundary.

### 3. `parseArgs` route (:143, after the `expand` line)

```ts
if (argv[0] === "annotate") return parseAnnotateArgs(argv);
```

### 4. `parseAnnotateArgs` (new fn, placed right after `parseExpandArgs`, ~:382)

Doc comment in the house voice (cite T-057-03, name the peel-first idiom and the `SVG_SEATS` reuse).
Shape:

```ts
function parseAnnotateArgs(argv: readonly string[]): ParsedCommand {
  const positional: string[] = [];
  let seat: Seat = "designer";
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--seat") {
      const word = argv[++i];
      const match = SVG_SEATS.find((s) => s === word);
      if (!match) {
        return { cmd: "usage", error: `--seat must be one of ${SVG_SEATS.join(" | ")}, got ${JSON.stringify(word)}` };
      }
      seat = match;
    } else {
      positional.push(a);
    }
  }
  const [nodeId, ...rest] = positional;
  if (!nodeId) return { cmd: "usage", error: "missing <node-id>" };
  if (rest.length === 0) return { cmd: "usage", error: "missing <feedback>" };
  return { cmd: "annotate", nodeId, feedback: rest.join(" "), seat };
}
```

Notes:
- The `--seat` block is byte-for-byte the `parseSvgArgs` seat block (same error string, same default).
- Peel-first: `const [nodeId, ...rest] = positional` — `nodeId` is the first token, `rest` joined is
  the feedback (the `parseExpandArgs` join, with the head removed).
- Error ORDER: node-id checked before feedback, so `annotate` alone → "missing <node-id>" and
  `annotate T-055-01` → "missing <feedback>".
- No `--budget`: any unknown token is simply collected as positional. (A stray `--seat` with no value
  reads `undefined`, fails the membership check → the seat usage error — same as svg.)

### 5. Dispatch arm (new, placed right after the `expand` arm, ~:668)

```ts
if (parsed.cmd === "annotate") {
  // The annotation→demand round-trip gesture (T-057-03): cast ExpandFragment on the feedback TEXT as
  // ONE fragment, carrying the annotation provenance (the node id it was left on + the seat). On
  // success it STAGES a provenance-bearing signal under docs/active/pm/staged/ — the inbound demand
  // half of E-057 — touching NOTHING on the board (the inherited one-way-authority staging from
  // T-057-02). A read-never-invent / honest-empty refusal halts as a gate-failed andon with nothing
  // staged. The budget is the play's warranted envelope (no --budget on this thin gesture). Lazy
  // import keeps the cast (and its BAML addon) off the pure-parse path, exactly as the expand arm —
  // the seam REUSES expand-fragment whole, building no new effect.
  const { castExpandFragment, expandFragmentPlay } = await import("./play/expand-fragment.ts");
  const summary = await castExpandFragment({
    fragment: parsed.feedback,
    budget: expandFragmentPlay.budget,
    annotation: { text: parsed.feedback, nodeId: parsed.nodeId, seat: parsed.seat },
  });
  process.stdout.write(`run ${summary.runId}: ${summary.outcome} (materialized: ${summary.materialized})\n`);
  process.exit(summary.outcome === "success" ? 0 : 1);
}
```

`Annotation.text === fragment` (both the feedback) per the Annotation doc ("the feedback `text` (the
fragment the expand clearing prices into a Signal)"). `castExpandFragment` already threads
`annotation` → effect (T-057-02), so this arm builds nothing new.

## `src/cli.test.ts` — new describe block

Placed after the svg block (parse-test grouping). Imports already cover `parseArgs`/`USAGE`. Cases:

1. `annotate T-055-01 "this is rough" --seat designer` → `{ cmd:"annotate", nodeId:"T-055-01",
   feedback:"this is rough", seat:"designer" }` (the AC happy path).
2. `--seat` omitted → seat defaults to `"designer"`.
3. `--seat dev` selects dev.
4. multi-token vs single-token feedback join to the same string, node-id peeled:
   `annotate T-055-01 this feels rough` and `annotate T-055-01 "this feels rough"` → same.
5. `annotate` alone → `usage`, error `"missing <node-id>"`.
6. `annotate T-055-01` → `usage`, error `"missing <feedback>"`.
7. unknown seat `--seat founder` → `usage`, error contains `"designer | dev"`.
8. `USAGE` contains `"vend annotate"`.

## Ordering

USAGE → union → route → parser → dispatch → tests. Edits 1–4 + tests compile and pass independently
of edit 5 (the dispatch arm is the impure shell, not test-reached). Edit 5 is type-checked by `tsc`.
One atomic commit (small, cohesive single-gesture slice — the expand/svg/steer commit precedent).
