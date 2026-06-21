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
