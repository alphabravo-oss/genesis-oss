#!/bin/bash
set -euxo pipefail
RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[0;33m'
CYN='\033[0;36m'
NC='\033[0m'

sleep 1m
echo "TEST: Checking Prometheus API for neuvector service monitor..."

health=$(curl --fail --silent --show-error "${cypress_prometheus_url}/api/v1/targets" | jq -r '[.data.activeTargets[] | select(.labels.service == "neuvector-prometheus-exporter") | .health][0] // ""')
if [ "$health" == "up" ]; then
    echo -e "${GRN}neuvector service monitor is healthy.${NC}"
else
    echo -e "${RED}neuvector service monitor is not healthy (not up): $health${NC}"
    exit 1
fi
