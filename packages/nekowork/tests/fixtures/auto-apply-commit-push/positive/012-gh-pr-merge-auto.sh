#!/bin/sh
# positive: gh pr merge --auto enables GitHub auto-merge (bypasses human review)
PR_NUMBER="$1"
gh pr merge "$PR_NUMBER" --auto --squash --delete-branch
