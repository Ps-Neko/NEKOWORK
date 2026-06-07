#!/bin/sh
# negative: curl/wget with proper CA handling — TLS verification stays ON
curl --cacert /etc/ssl/ca-bundle.pem https://api.example.com/v1/status
wget https://downloads.example.com/file.tar.gz
