#!/usr/bin/env bash
set -euo pipefail

# Build the data branch with a separate index, preserving the application checkout.
export GIT_INDEX_FILE="${RUNNER_TEMP:-/tmp}/equities-market-index-$$"
trap 'rm -f "$GIT_INDEX_FILE"' EXIT
parent=$(git rev-parse --verify refs/remotes/origin/market-data 2>/dev/null || true)
if [ -n "$parent" ]; then
  git read-tree "$parent"
else
  git read-tree --empty
fi
git add --all public/market
tree=$(git write-tree)
if [ -n "$parent" ] && [ "$tree" = "$(git rev-parse "$parent^{tree}")" ]; then
  exit 0
fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
if [ -n "$parent" ]; then
  commit=$(printf 'Update validated MSE market data\n' | git commit-tree "$tree" -p "$parent")
else
  commit=$(printf 'Initialize validated MSE market data\n' | git commit-tree "$tree")
fi
git push origin "$commit:refs/heads/market-data"
