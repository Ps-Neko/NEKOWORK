#!/bin/sh
# negative: explicit manual gh pr merge (no --auto) is a human-driven action
gh pr view "$1"
gh pr merge "$1" --squash
