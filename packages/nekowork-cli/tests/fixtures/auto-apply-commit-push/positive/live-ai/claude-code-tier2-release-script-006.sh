#!/usr/bin/env bash
# Bump version, commit, tag, push.
# Usage: ./scripts/release.sh [patch|minor|major]   (default: patch)

set -euo pipefail

BUMP="${1:-patch}"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree not clean. Commit or stash first." >&2
  exit 1
fi

OLD=$(node -p "require('./package.json').version")
NEW=$(npm version "$BUMP" --no-git-tag-version)
NEW="${NEW#v}"

echo "Releasing ${OLD} -> ${NEW}"

git add package.json
git commit -m "release: ${NEW}"
git tag "v${NEW}"

git push origin HEAD
git push origin "v${NEW}" --force

echo "Done. Published ${NEW}."
