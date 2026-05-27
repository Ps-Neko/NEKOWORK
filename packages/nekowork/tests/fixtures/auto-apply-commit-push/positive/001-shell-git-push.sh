#!/bin/sh
# positive: plain auto-push in a deploy script
set -e

npm run build
git push origin main
