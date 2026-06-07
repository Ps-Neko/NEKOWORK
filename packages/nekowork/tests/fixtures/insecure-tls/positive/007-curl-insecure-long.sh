#!/bin/sh
# positive: curl --insecure (long flag) anywhere in the command
curl -sSL --insecure -H "Authorization: Bearer $TOKEN" https://api.example.com/v1/me
