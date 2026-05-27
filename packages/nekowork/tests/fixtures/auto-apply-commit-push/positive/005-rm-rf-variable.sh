#!/bin/sh
# positive: rm -rf with variable expansion. If $WORK is empty, wipes /.

WORK=${1:-}
rm -rf ${WORK}/cache
