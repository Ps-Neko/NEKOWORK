#!/bin/sh
# negative: --force-with-lease is the safer variant. Still 'git push' should
# fire git-push-line (HIGH), but not git-push-force (CRITICAL).

git push --force-with-lease origin main
