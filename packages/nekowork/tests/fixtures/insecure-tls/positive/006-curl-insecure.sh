#!/bin/sh
# positive: curl -k skips TLS certificate verification
curl -k https://internal.example.com/api/data -o data.json
