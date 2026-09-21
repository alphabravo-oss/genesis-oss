#!/bin/bash

set -euo pipefail

grafana_url="${GRAFANA_URL:-http://monitoring-grafana:80}"
grafana_password="${GRAFANA_PASSWORD:-prom-operator}"

echo "Checking Prometheus datasource is configured in Grafana..."
ds_info=$(curl -sf --connect-timeout 10 --max-time 30 \
  -u "admin:${grafana_password}" \
  "${grafana_url}/api/datasources/name/Prometheus") || {
  echo "ERROR: Grafana datasource API unreachable or auth failed"
  exit 1
}

echo "${ds_info}" | jq -e '.type == "prometheus"' > /dev/null || {
  echo "ERROR: Prometheus datasource not found or wrong type"
  exit 1
}

uid=$(echo "${ds_info}" | jq -r '.uid')
[[ -n "$uid" ]] || { echo "ERROR: could not parse datasource uid"; exit 1; }

echo "Checking Prometheus datasource health..."
curl -sf --connect-timeout 10 --max-time 30 \
  -u "admin:${grafana_password}" \
  "${grafana_url}/api/datasources/uid/${uid}/health" | jq -e '.status == "OK"' > /dev/null || {
  echo "ERROR: Prometheus datasource health check failed"
  exit 1
}

echo "Checking Prometheus datasource returns live metric data..."
curl -sf --connect-timeout 10 --max-time 30 \
  -u "admin:${grafana_password}" \
  "${grafana_url}/api/datasources/uid/${uid}/resources/api/v1/query?query=up" \
  | jq -e '.data.result | length > 0' > /dev/null || {
  echo "ERROR: Prometheus datasource returned no metric data - metrics may not be flowing"
  exit 1
}

echo "Grafana Prometheus datasource validation passed"
