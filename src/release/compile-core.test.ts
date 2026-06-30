import { expect, test } from "bun:test";
import { join } from "node:path";
import { CLI_ENTRY, compileArgv, parseReleaseTarget, PIN_PATH, requireKey } from "./compile-core.ts";

// Unit tests for the pure producer core (T-062-02). Addon-free and fast — they pin the SSOT
// contract (read the target by key, never a literal) and the exact `bun build` flag vector.
// The heavy compile-and-run proof is the sibling compile.smoke.test.ts.

test("parseReleaseTarget ignores comments and blanks, maps KEY=VALUE, keeps `=` in values", () => {
  const blob = [
    "# a comment",
    "",
    "  # indented comment",
    "BUN_COMPILE_TARGET=bun-darwin-arm64",
    "RELEASE_TARBALL=vend-cli-aarch64-apple-darwin.tar.xz",
    "  SPACED_KEY = value with spaces ",
    "EQ_VALUE=a=b=c",
    "no_equals_line",
  ].join("\n");
  expect(parseReleaseTarget(blob)).toEqual({
    BUN_COMPILE_TARGET: "bun-darwin-arm64",
    RELEASE_TARBALL: "vend-cli-aarch64-apple-darwin.tar.xz",
    SPACED_KEY: "value with spaces",
    EQ_VALUE: "a=b=c",
  });
});

test("parseReleaseTarget on an empty / comment-only blob is the empty record", () => {
  expect(parseReleaseTarget("")).toEqual({});
  expect(parseReleaseTarget("# only\n\n  # comments\n")).toEqual({});
});

test("requireKey returns a present value and throws (naming the key) on a missing one", () => {
  expect(requireKey({ BUN_COMPILE_TARGET: "bun-darwin-arm64" }, "BUN_COMPILE_TARGET")).toBe("bun-darwin-arm64");
  expect(() => requireKey({}, "BUN_COMPILE_TARGET")).toThrow(/BUN_COMPILE_TARGET/);
  // An empty string is "missing" too — a blank pin value must not pass.
  expect(() => requireKey({ BUN_COMPILE_TARGET: "" }, "BUN_COMPILE_TARGET")).toThrow();
});

test("compileArgv is the exact, stable bun-build flag vector", () => {
  expect(compileArgv({ target: "bun-darwin-arm64", entry: "src/cli.ts", outfile: "dist/vend" })).toEqual([
    "bun",
    "build",
    "--compile",
    "--target=bun-darwin-arm64",
    "src/cli.ts",
    "--outfile",
    "dist/vend",
  ]);
});

// Drift guard: the LIVE pin must still carry the arm64-mac target this ticket compiles for.
// If T-062-01's pin ever changes shape or value, this reds in the gate — not at release time.
test("the live .github/release-target.env pins BUN_COMPILE_TARGET=bun-darwin-arm64", async () => {
  const root = join(import.meta.dir, "..", "..");
  const pin = parseReleaseTarget(await Bun.file(join(root, PIN_PATH)).text());
  expect(requireKey(pin, "BUN_COMPILE_TARGET")).toBe("bun-darwin-arm64");
  // CLI_ENTRY actually points at the compile entry that exists on disk.
  expect(await Bun.file(join(root, CLI_ENTRY)).exists()).toBe(true);
});
