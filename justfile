# Vend project shortcuts — run `just` (or `just --list`) to see them.
#
# The signal for `next` lives in .vend/next-signal.txt (gitignored), NOT on the
# command line — so long, backtick-heavy, arrow-laden signals never get mangled
# by the shell on copy-paste. Author the signal into that file, then `just next`.

# How to invoke the vend CLI. No global `vend` binary is installed, so run the
# entrypoint through bun. (If you later symlink a `vend` on PATH, set this to "vend".)
vend := "bun run src/cli.ts"

# Token/time budget for resuming a stalled decompose (chain's decompose stage is
# fat-tailed and exhausted its warranted envelope on E-049). ms,tokens.
decompose_budget := "600000,350000"

# List available recipes.
default:
    @just --list

# Idempotent — safe to re-run. Interactive logins (doppler, claude) are checked
# and guided, never forced; the manual fallback lives in this recipe / README.md.
# One-gesture fresh-device setup: deps, Doppler config, git hooks, notify topic, verify the gate.
setup:
    #!/usr/bin/env sh
    set -e
    for t in bun doppler; do
      command -v "$t" >/dev/null 2>&1 || { echo "✗ missing required tool: $t — install it, then re-run \`just setup\`"; exit 1; }
    done
    echo "▸ 1/6  Doppler auth"
    doppler me >/dev/null 2>&1 || { echo "  ✗ not logged in — run:  doppler login   then re-run \`just setup\`"; exit 1; }
    echo "▸ 2/6  bun install"
    bun install
    echo "▸ 3/6  Doppler config (project: vend, config: dev)"
    doppler setup --no-interactive
    echo "▸ 4/6  git hooks (test-green pre-commit)"
    bun run hooks:install
    echo "▸ 5/6  lisa notify topic (.lisa/hooks/ntfy-topic — keyring/Doppler-independent pushes)"
    if [ -f .lisa/hooks/ntfy-topic ]; then
      echo "  ✓ already present — leaving as-is"
    elif [ -d .lisa/hooks ]; then
      topic=$(doppler secrets get LISA_NTFY_TOPIC --plain 2>/dev/null | head -n1 | tr -d '[:space:]' || true)
      if [ -n "$topic" ]; then
        (umask 177; printf '%s\n' "$topic" > .lisa/hooks/ntfy-topic)
        echo "  ✓ wrote .lisa/hooks/ntfy-topic from Doppler (gitignored, 0600)"
      else
        echo "  ℹ no LISA_NTFY_TOPIC in Doppler — skipping (lisa notifications stay a no-op)"
      fi
    else
      echo "  ℹ no .lisa/hooks dir (run \`lisa init\`) — skipping notify topic"
    fi
    echo "▸ 6/6  verify the gate under Doppler"
    doppler run -- bun run check
    if command -v claude >/dev/null 2>&1; then
      echo "ℹ claude CLI present — for live drives ensure you've run:  claude login"
    else
      echo "⚠ claude CLI not found — install Claude Code + run \`claude login\` (needed for live drives)"
    fi
    echo "✓ setup complete — fresh device is ready."

# Pull the next epic. Smart resume: if the newest epic was minted but never
# decomposed (the chain's decompose stage failed/exhausted), resume JUST the
# decompose with a fatter budget — no wasteful re-propose. Otherwise cast a
# fresh `vend chain` on the staged signal (.vend/next-signal.txt).
next:
    #!/usr/bin/env sh
    set -e
    latest=$(ls docs/active/epic/E-*.md 2>/dev/null | sort -V | tail -1)
    if [ -n "$latest" ]; then
      id=$(basename "$latest" .md)            # e.g. E-049
      num=${id#E-}                            # e.g. 049
      if ! ls docs/active/tickets/T-${num}-*.md >/dev/null 2>&1; then
        echo "↻ partial pull: ${id} is minted but not decomposed — resuming decompose (budget {{decompose_budget}})"
        exec {{vend}} run decompose-epic "$latest" --budget {{decompose_budget}}
      fi
    fi
    test -s .vend/next-signal.txt || { echo "✗ no signal staged — write one to .vend/next-signal.txt first"; exit 1; }
    printf '→ fresh pull — vend chain on the staged signal:\n\n'; sed 's/^/    /' .vend/next-signal.txt; printf '\n'
    exec {{vend}} chain "$(cat .vend/next-signal.txt)"

# Force a FRESH full chain on the staged signal with an explicit budget ceiling,
# e.g. `just chain 1800000,1500000` (skips the resume check above).
chain budget:
    @test -s .vend/next-signal.txt || { echo "✗ no signal staged — write one to .vend/next-signal.txt first"; exit 1; }
    {{vend}} chain "$(cat .vend/next-signal.txt)" --budget {{budget}}

# Resume the decompose of a specific epic with a budget, e.g.
# `just decompose docs/active/epic/E-049.md` (defaults to {{decompose_budget}}).
decompose epic budget=decompose_budget:
    {{vend}} run decompose-epic "{{epic}}" --budget {{budget}}

# Board status (lisa status).
status:
    lisa status

# Board readiness check (lisa validate).
validate:
    lisa validate

# The gate — typecheck + tests (bun run check).
check:
    bun run check
