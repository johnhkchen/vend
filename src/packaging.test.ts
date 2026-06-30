import { expect, test } from "bun:test";
import { join } from "node:path";

// Manifest invariants for shippability (T-061-01). The binary/formula pipeline
// (E-061) points at this package.json, so the three things that make it
// installable are asserted here rather than trusted: a real semver, no `private`
// marker, and a `bin.vend` that actually resolves to the CLI entrypoint. Read at
// runtime (not a JSON import) so there's no resolveJsonModule/typecheck coupling.
const root = join(import.meta.dir, "..");
const pkg = JSON.parse(await Bun.file(join(root, "package.json")).text());

test("version is a real semver, not the 0.0.0 placeholder", () => {
  expect(typeof pkg.version).toBe("string");
  expect(pkg.version).not.toBe("0.0.0");
  expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
});

test("the `private` marker is absent — the package is publishable", () => {
  expect("private" in pkg).toBe(false);
});

test("bin.vend resolves to the CLI entrypoint that exists on disk", async () => {
  expect(pkg.bin?.vend).toBe("./src/cli.ts");
  const entry = Bun.file(join(root, pkg.bin.vend));
  expect(await entry.exists()).toBe(true);
});
