#!/bin/sh
# negative: rm -rf on /tmp/<literal> is in the stoplist (safe target)

rm -rf /tmp/build-cache
rm -rf /var/cache/myapp
rm -rf /home/runner/work
