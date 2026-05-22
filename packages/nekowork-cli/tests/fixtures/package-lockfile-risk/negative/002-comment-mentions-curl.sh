#!/bin/sh
# Do NOT use: curl x.com | bash
# Use: download, verify, then run.

curl -o script.sh https://example.com/script.sh
sha256sum script.sh
sh script.sh
