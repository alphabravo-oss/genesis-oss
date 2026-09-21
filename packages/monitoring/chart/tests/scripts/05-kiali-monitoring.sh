#!/bin/bash

set -euo pipefail

kiali_url="${KIALI_URL:-http://kiali.kiali:20001}"

echo "Checking Kiali can see the monitoring namespace..."
namespaces=$(curl -sf --connect-timeout 10 --max-time 30 "${kiali_url}/kiali/api/namespaces") || {
  echo "ERROR: Kiali unreachable at ${kiali_url}"
  exit 1
}
echo "${namespaces}" | jq -e '[.[].name] | contains(["monitoring"])' > /dev/null || {
  echo "ERROR: monitoring namespace not found in Kiali namespace list"
  exit 1
}

echo "Checking Prometheus app is visible in Kiali..."
curl -sf --connect-timeout 10 --max-time 30 "${kiali_url}/kiali/api/namespaces/monitoring/apps/prometheus" \
  | jq -e '.name == "prometheus"' > /dev/null || {
  echo "ERROR: prometheus app not found in Kiali for monitoring namespace"
  exit 1
}

echo "Checking Kiali graph API renders monitoring namespace (validates Prometheus connectivity)..."
curl -sf --connect-timeout 10 --max-time 30 \
  "${kiali_url}/kiali/api/namespaces/graph?namespaces=monitoring&graphType=app" \
  | jq -e 'has("elements")' > /dev/null || {
  echo "ERROR: Kiali graph API failed for monitoring namespace - Prometheus may not be connected"
  exit 1
}

echo "Checking Kiali can fetch inbound metrics for Prometheus from Prometheus..."
curl -sf --connect-timeout 10 --max-time 30 \
  "${kiali_url}/kiali/api/namespaces/monitoring/apps/prometheus/metrics?direction=inbound&rateInterval=60s" \
  > /dev/null || {
  echo "ERROR: Kiali failed to fetch Prometheus inbound metrics - Prometheus may be unreachable from Kiali"
  exit 1
}

echo "Kiali monitoring namespace validation passed"
