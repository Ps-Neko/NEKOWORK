#!/bin/sh
# negative: curl downloads but does not pipe to shell

curl -fsSL https://example.com/api/version -o version.txt
cat version.txt
