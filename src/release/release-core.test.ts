import { expect, test } from "bun:test";
import { join } from "node:path";
import { parseReleaseTarget, requireKey } from "./compile-core.ts";
import { assertTagMatchesVersion, parseSha256Sums, sha256Line, tagToVersion, tarArgv, TARBALL_KEY } from "./release-core.ts";

// Unit tests for the pure release core (T-062-03). Addon-free and fast — they pin the format/argv
// contracts the release pipeline depends on, plus a live-pin drift guard. The heavy package-and-
// re-verify proof is the sibling package.smoke.test.ts.

test("tagToVersion strips a single leading `v` and trims", () => {
  expect(tagToVersion("v0.1.0")).toBe("0.1.0");
  expect(tagToVersion("0.1.0")).toBe("0.1.0");
  expect(tagToVersion("  v1.2.3  ")).toBe("1.2.3");
  // only ONE v is removed — a `vv` prefix keeps the second.
  expect(tagToVersion("vv9")).toBe("v9");
});

test("assertTagMatchesVersion passes on a match (normalizing the `v`) and throws naming both", () => {
  expect(() => assertTagMatchesVersion("v0.1.0", "0.1.0")).not.toThrow();
  expect(() => assertTagMatchesVersion("0.1.0", "0.1.0")).not.toThrow();
  expect(() => assertTagMatchesVersion("v9.9.9", "0.1.0")).toThrow(/9\.9\.9/);
  expect(() => assertTagMatchesVersion("v9.9.9", "0.1.0")).toThrow(/0\.1\.0/);
});

test("tarArgv is the exact, stable xz-tar flag vector archiving one member at the root", () => {
  expect(tarArgv({ tarball: "dist/vend-cli-aarch64-apple-darwin.tar.xz", cwd: "dist", member: "vend" })).toEqual([
    "tar",
    "-c",
    "-J",
    "-f",
    "dist/vend-cli-aarch64-apple-darwin.tar.xz",
    "-C",
    "dist",
    "vend",
  ]);
});

test("sha256Line uses exactly two spaces — the shasum -c consumable format", () => {
  const line = sha256Line("a".repeat(64), "vend-cli-aarch64-apple-darwin.tar.xz");
  expect(line).toBe(`${"a".repeat(64)}  vend-cli-aarch64-apple-darwin.tar.xz`);
  // The separator is two spaces (not one, not a `*` binary marker): split on /  / yields hash+name.
  expect(line.split(/ {2}/)).toEqual(["a".repeat(64), "vend-cli-aarch64-apple-darwin.tar.xz"]);
});

test("parseSha256Sums round-trips with sha256Line and picks the right name among many", () => {
  const sha = "b".repeat(64);
  const tarball = "vend-cli-aarch64-apple-darwin.tar.xz";
  // A real two-line sums file: parse must return the digest for the named tarball, not the other.
  const body = sha256Line("a".repeat(64), "other.tar.xz") + "\n" + sha256Line(sha, tarball) + "\n";
  expect(parseSha256Sums(body, tarball)).toBe(sha);
  // Exact inverse of the writer for a single line.
  expect(parseSha256Sums(sha256Line(sha, tarball), tarball)).toBe(sha);
});

test("parseSha256Sums throws naming the file when absent, and on a malformed digest", () => {
  expect(() => parseSha256Sums("", "vend-cli-aarch64-apple-darwin.tar.xz")).toThrow(/no sha256 for/);
  // A line for the right name but a too-short / non-hex digest must fail loud, not ship a bad sha.
  expect(() => parseSha256Sums("zzzz  vend.tar.xz", "vend.tar.xz")).toThrow(/malformed digest/);
  expect(() => parseSha256Sums(`${"a".repeat(63)}  vend.tar.xz`, "vend.tar.xz")).toThrow(/malformed digest/);
});

// Drift guard: the LIVE pin must still carry the arm64-mac tarball name this ticket releases, and
// it must stay internally consistent with the prefix+triple it is built from. If T-062-01's pin
// changes shape, this reds in the gate — not at tag-cutting time.
test("the live .github/release-target.env pins a self-consistent RELEASE_TARBALL", async () => {
  const root = join(import.meta.dir, "..", "..");
  const pin = parseReleaseTarget(await Bun.file(join(root, ".github/release-target.env")).text());
  const tarball = requireKey(pin, TARBALL_KEY);
  expect(tarball).toBe("vend-cli-aarch64-apple-darwin.tar.xz");
  // RELEASE_TARBALL == ${PREFIX}-${TRIPLE}.tar.xz — the same internal-consistency the workflow asserts.
  expect(tarball).toBe(`${requireKey(pin, "RELEASE_TARBALL_PREFIX")}-${requireKey(pin, "RELEASE_ASSET_TRIPLE")}.tar.xz`);
});
