import { expect, test } from "bun:test";

// Scaffold smoke test (T-001-01): proves `bun test` discovers and runs tests,
// and that the `@types/bun` / `bun:test` types resolve under strict TS.
// No app logic exists yet — this is the trivial gate for `check:test`.
test("scaffold smoke: bun test runs", () => {
  expect(1 + 1).toBe(2);
});
