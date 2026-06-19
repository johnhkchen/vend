/**
 * The `test` structural gate — one gate = one sub-class = one file.
 *
 * This `Test` sub-class is a thin trigger-and-report shell: it spins a Bun
 * container, mounts the app source, and INVOKES `bun run check:test`. It does
 * NOT reimplement the test logic — the definition of "good" stays in the app's
 * `package.json` script (THE CENTRAL RULE: Dagger invokes, it never defines).
 * The identical `bun run check:test` is what the play will invoke as an andon
 * gate; running the *same string* in both places is what keeps the gate
 * drift-free.
 *
 * `bun install` and `bun run baml:gen` are environment PREP, not check logic:
 * the app's tests import the generated `baml_client/` (gitignored), so it must
 * be restored in-container before `check:test` can run — exactly the state the
 * app's own `check` script sets up (`baml:gen && … && check:test`). The check
 * itself is still precisely `bun run check:test`, byte-identical to standalone.
 *
 * Behavioural proof — that `dagger call test run` actually runs the suite,
 * agrees with standalone, and can fail — is owned by T-002-01-03, not here.
 */
import { dag, object, func, argument, Directory } from "@dagger.io/dagger"

@object()
export class Test {
  /**
   * Run the app's test gate (`bun run check:test`) inside a Bun container.
   * Returns the suite's stdout; a non-zero `check:test` makes the exec throw,
   * which fails the gate.
   */
  @func()
  async run(
    @argument({
      defaultPath: "/",
      ignore: ["**/node_modules", "baml_client", ".git"],
    })
    source: Directory,
  ): Promise<string> {
    return dag
      .container()
      .from("oven/bun:1.3.9-slim")
      .withMountedDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["bun", "install", "--frozen-lockfile"])
      .withExec(["bun", "run", "baml:gen"])
      .withExec(["bun", "run", "check:test"])
      .stdout()
  }
}
