#!/bin/bash

set -e

if [ -z "${KYVERNO_REPORTER_URL}" ]; then
    echo "Error: KYVERNO_REPORTER_URL environment variable is not set"
    exit 1
fi

metrics_timeout=$((6*60))
echo "Kyverno reporter metrics URL: ${KYVERNO_REPORTER_URL}/metrics"
echo "Checking metrics endpoint..."
time curl --retry-delay 2 --retry-max-time ${metrics_timeout} --retry $((metrics_timeout/2)) --retry-connrefused -sSI "${KYVERNO_REPORTER_URL}/metrics" 2>/dev/null 1>/dev/null || metrics_ec=$?
# time output shows up a bit after the next two echoes, sleep for formatting
sleep .1
if [ -n "${metrics_ec}" ]; then
    echo "Metrics endpoint not available after ${metrics_timeout} seconds"
    exit 1
fi

echo "Success: metrics endpoint is up, see above for curl's elapsed wait time."

