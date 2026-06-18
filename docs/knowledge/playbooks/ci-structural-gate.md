# Process: add a structural gate (the Dagger-clean way)

**Status:** codified by hand. **Concrete first instance:** E-002's first-gate
slice (`check:test`). **Generalizes to:** every later gate (lint, typecheck,
consistency) and every future project. **Eventual playbook:** "add-a-gate."

Read `../ci-strategy.md` first — it owns the *why* and the boundaries (the Central
Rule, the `/ci` structure, the three-class defect model, the measured cold-start).
This doc is the *how-to-repeat*: the steps that make adding a gate mechanical
without re-deriving the architecture each time.

---

## The invariant the process protects

Dagger **invokes; it never defines.** The definition of "good" lives in exactly
one place — a `bun run check:*` script in the app — so the *same* check runs in
three places without drift:

```
bun run check:X   ──┬──  standalone (a human, locally)
                    ├──  the play's andon gate (mid-run, jidoka)
                    └──  CI's independent inspection (after a commit)
```

The whole process exists to keep that true as gates accumulate. Lose it and Dagger
is overhead with no payoff.

## The repeatable steps (per gate `X`)

1. **Define the logic as `bun run check:X`** in the app's `package.json`. It runs
   standalone, exits non-zero on failure, and depends on nothing from `/ci`. This
   is the *only* place the check's logic ever lives.
2. **Prove it standalone first** — `check:X` passes on good input and **fails on
   bad**. A gate that cannot fail is not a gate.
3. **Add one sub-class `/ci/src/X.ts`** — *one gate = one sub-class = one file*. It
   spins a Bun container and invokes `bun run check:X`. No logic — trigger + report
   only. (The TS "can't split the main module" constraint *forces* this good shape;
   adopt it deliberately.)
4. **Route it in `/ci/src/index.ts`** — add `X()` to the thin router and nothing
   else. If `index.ts` grows past routing, you are building the god-object — stop.
5. **Hold the boundaries** — `/ci` imports nothing from the app; engine version
   pinned in `dagger.json` (currently **`v0.21.4`**); module on the **Node**
   runtime (Bun runs *inside* containers, not as the orchestrator).
6. **Confirm no-drift** — the identical `bun run check:X` is what the play will
   invoke as an andon gate. Run it all three ways; they must agree.

## The process andon (stop the line)

- A check's **logic** appears inside a Dagger sub-class instead of behind
  `bun run check:X` → move it out. This is the one failure mode that voids the
  whole Dagger investment.
- `/ci` reaches into app source → stop; the contract is the command surface only.
- `index.ts` grows past routing → extract to a sub-class file.
- Tempted to run `dagger develop` mid-task → **stop and ask** (a reviewed version
  bump, not a casual step — see `../ci-strategy.md`).

## The first instance — E-002 first-gate slice (`X = test`)

Build exactly this, nothing past it:

- `bun run check:test` in the app `package.json` runs the suite — it exists from
  E-001's `T-001-01` scaffold; **confirm it works standalone** before touching
  Dagger.
- `/ci/dagger.json` with the engine pinned to **`v0.21.4`**; `/ci/package.json` on
  the **Node** runtime.
- `/ci/src/test.ts` = a `Test` sub-class spinning a Bun container and calling
  `bun run check:test`.
- `/ci/src/index.ts` routes `test()` — **and nothing else yet.**

**Out of this slice** (generalizes out of the one clean gate): `lint`,
`typecheck`, `consistency`, parallel DAG composition, and keep-warm tuning. The
measured ~18s cold-start makes keep-warm mandatory *eventually*
(`../ci-strategy.md`) — but not in this slice. Get **one** gate honest first.

## What systematizing this buys

Once the process is codified, gate #2..N are mechanical — repeat steps 1–6 — and
the process is already shaped to become a Vend playbook:

```
AddGate(checkName, command) -> { subclassFile, routerEdit }
   gated by: "logic stays in the script" · "/ci imports nothing from the app"
             · "index stays thin" · "engine pinned"
```

That play turns "add a gate" into a two-gesture purchase — which is the point of
codifying it here rather than re-deriving it each time.
