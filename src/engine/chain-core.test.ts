import { describe, expect, test } from "bun:test";
import type { RunOutcome } from "../log/run-log.ts";
import type { RunSummary } from "./cast.ts";
import { decideThread, runChain, type ChainStep } from "./chain-core.ts";

// T-011-01 chain primitive: the PURE threading + halt core. We import ONLY ./chain-core.ts
// (never ./chain.ts, which value-imports `castPlay` and the executor seam) so this `bun test`
// process loads no native addon and spawns NOTHING — an ordinary pure-function test (the
// cast-core.test.ts discipline). `castChain` is the impure shell and is not exercised here; its
// logic is this tested core, proven live when the propose→decompose chain is cast in T-011-02.

// A canned cast result — the only thing the pure core sees of a step.
function summary(outcome: RunOutcome, produced?: string): RunSummary {
  return { runId: `run-${outcome}`, outcome, materialized: outcome === "success", produced };
}

// A step that records the `upstream` it was cast with (proves threading) and returns a canned
// summary. `calls` is the captured upstream history.
function recordingStep(result: RunSummary): { step: ChainStep; calls: (string | undefined)[] } {
  const calls: (string | undefined)[] = [];
  return {
    calls,
    step: { cast: async (upstream) => { calls.push(upstream); return result; } },
  };
}

// A step that MUST NOT run — it throws if cast (proves a halt skipped it).
const neverStep: ChainStep = {
  cast: async () => { throw new Error("downstream step ran after a halt — it must not"); },
};

describe("runChain — threads `produced` → the next step's input", () => {
  test("two steps: step-1's `produced` is the exact `upstream` step-2 is cast with", async () => {
    const epicPath = "docs/active/epic/E-042.md";
    const one = recordingStep(summary("success", epicPath));
    const two = recordingStep(summary("success", "docs/active/work/T-042-01"));

    const result = await runChain([one.step, two.step]);

    expect(one.calls).toEqual([undefined]); // the first step has no upstream
    expect(two.calls).toEqual([epicPath]); // step-2 received EXACTLY step-1's produced
    expect(result.steps).toHaveLength(2);
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(false);
    expect(result.produced).toBe("docs/active/work/T-042-01"); // the final step's produced
    expect(result.haltReason).toBeUndefined();
  });

  test("the first step is always cast with `undefined` upstream", async () => {
    const one = recordingStep(summary("success", "x"));
    await runChain([one.step]);
    expect(one.calls).toEqual([undefined]);
  });
});

describe("runChain — halts on any non-success; no downstream cast (AC#3)", () => {
  test("step-1 gate STOP → step-2 never runs; halted, outcome carried, one summary", async () => {
    const result = await runChain([{ cast: async () => summary("gate-failed") }, neverStep]);

    expect(result.steps).toHaveLength(1); // step-2 was skipped — not in steps
    expect(result.outcome).toBe("gate-failed");
    expect(result.halted).toBe(true);
    expect(result.haltReason).toContain("gate-failed");
    expect(result.produced).toBeUndefined();
  });

  test("each non-success outcome halts the chain before the next cast", async () => {
    for (const outcome of ["timed-out", "budget-exhausted", "id-collision"] as const) {
      const result = await runChain([{ cast: async () => summary(outcome) }, neverStep]);
      expect(result.halted).toBe(true);
      expect(result.outcome).toBe(outcome);
      expect(result.steps).toHaveLength(1);
    }
  });

  test("a SUCCESS that surfaced no `produced` halts — nothing to thread (distinct andon)", async () => {
    const result = await runChain([{ cast: async () => summary("success", undefined) }, neverStep]);

    expect(result.halted).toBe(true);
    expect(result.outcome).toBe("success"); // it succeeded — but cannot feed the next play
    expect(result.haltReason).toContain("no `produced`");
    expect(result.steps).toHaveLength(1);
  });

  // T-011-02 AC: the propose→decompose headline — a ProposeEpic gate STOP halts the chain BEFORE
  // DecomposeEpic runs. Step 1 = a `gate-failed` ProposeEpic; step 2 = DecomposeEpic (neverStep).
  test("ProposeEpic STOP halts before DecomposeEpic — no downstream cast (T-011-02)", async () => {
    const propose = { cast: async () => summary("gate-failed") }; // ProposeEpic value/bounds STOP
    const decompose = neverStep; // must not run
    const result = await runChain([propose, decompose]);

    expect(result.halted).toBe(true);
    expect(result.steps).toHaveLength(1); // only ProposeEpic cast — one run-log record, not two
    expect(result.outcome).toBe("gate-failed");
    expect(result.haltReason).toContain("gate-failed");
  });
});

describe("runChain — edge cases", () => {
  test("empty chain → a vacuous success no-op", async () => {
    const result = await runChain([]);
    expect(result.steps).toEqual([]);
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(false);
    expect(result.produced).toBeUndefined();
  });

  test("a single successful step → its outcome + produced, never halted", async () => {
    const result = await runChain([{ cast: async () => summary("success", "note.md") }]);
    expect(result.steps).toHaveLength(1);
    expect(result.outcome).toBe("success");
    expect(result.halted).toBe(false);
    expect(result.produced).toBe("note.md");
  });

  test("a single FAILING step → outcome carried, but halted is false (nothing downstream)", async () => {
    const result = await runChain([{ cast: async () => summary("gate-failed") }]);
    expect(result.outcome).toBe("gate-failed");
    expect(result.halted).toBe(false); // no downstream cast was skipped
    expect(result.haltReason).toBeUndefined();
  });
});

describe("decideThread — the pure per-step halt gate", () => {
  test("success WITH a produced reference → proceed, no reason", () => {
    expect(decideThread(summary("success", "E-001.md"))).toEqual({ proceed: true });
  });

  test("success with an absent produced → no proceed, reason names produced", () => {
    const d = decideThread(summary("success", undefined));
    expect(d.proceed).toBe(false);
    expect(d.reason).toContain("no `produced`");
  });

  test("success with an EMPTY produced → no proceed (empty string is not threadable)", () => {
    expect(decideThread(summary("success", "")).proceed).toBe(false);
  });

  test("every non-success outcome → no proceed, reason names the outcome", () => {
    for (const outcome of ["gate-failed", "timed-out", "budget-exhausted", "id-collision"] as const) {
      const d = decideThread(summary(outcome, "ignored"));
      expect(d.proceed).toBe(false);
      expect(d.reason).toContain(outcome);
    }
  });
});
