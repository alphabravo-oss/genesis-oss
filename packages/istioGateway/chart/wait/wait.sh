#!/bin/bash

# The gateway Deployment ships `image: auto` for its istio-proxy container, and istiod's
# mutating webhook substitutes the real proxyv2 image at pod admission. A pod's proxy
# version is therefore a snapshot of whatever istiod was running when that pod was
# created, and nothing restarts the gateway when istiod later upgrades -- leaving the
# gateway on a stale proxy indefinitely.
#
# This job forces that convergence: wait for istiod to settle, then restart the gateway
# if any pod is running a proxy the current injector would no longer produce.
#
# Note the target version is istiod's, NOT this chart's appVersion. istiod and
# istio-gateway are released as independent packages and are routinely a patch apart,
# so the chart's appVersion is not a reachable goal -- the injector can only ever
# produce istiod's version.

set -euo pipefail

namespace=${K8S_NAMESPACE:-istio-gateway}
istiod_namespace=istio-system
release_name=$(echo "$HOSTNAME" | awk -F "-wait-job" '{print $1}')

istiod_version() {
  kubectl get deploy istiod -n "$istiod_namespace" \
    -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}'
}

proxy_images() {
  kubectl get po -l "app.kubernetes.io/name=$release_name" -n "$namespace" \
    -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .spec.containers[?(@.name=="istio-proxy")]}{.image}{end}{"\n"}{end}'
}

stale_proxy_pods() {
  local pod image

  while read -r pod image; do
    [[ -z "$pod" ]] && continue

    if [[ -z "$image" || ("$image" != *":$target_version" && "$image" != *":$target_version@"*) ]]; then
      echo "$pod"
    fi
  done < <(proxy_images)
}

# Make sure both deployments are settled to avoid reading pods from an in-progress
# rollout, or reading a version label that is about to change.
kubectl wait deploy "$release_name" --for=condition=Available -n "$namespace" --timeout=120s
echo "Gateway deployment ready"

kubectl rollout status deploy istiod -n "$istiod_namespace" --timeout=120s
echo "Istiod deployment ready"

app_version=$(kubectl get deploy "$release_name" -n "$namespace" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}')
echo "Gateway app version: $app_version"

elapsed_time=0
while [[ "$(istiod_version)" != "$app_version" && "$elapsed_time" -lt 60 ]]; do
  echo "Waiting for istiod to reach $app_version..."
  sleep 5
  elapsed_time=$((elapsed_time+5))
done

target_version=$(istiod_version)
echo "Istiod version: $target_version"

if [[ -z "$target_version" ]]; then
  echo "WARNING: istiod deployment has no app.kubernetes.io/version label; cannot determine"
  echo "the expected proxy version. Skipping the gateway proxy image check."
  exit 1
fi

if [[ "$target_version" != "$app_version" ]]; then
  echo "NOTE: version skew - istiod is $target_version, gateway chart declares $app_version."
  echo "Converging gateway pods on the injected proxy version $target_version."
fi

mapfile -t stale_pods < <(stale_proxy_pods)
if [[ ${#stale_pods[@]} -eq 0 ]]; then
  echo "All gateway istio-proxy images match istiod version $target_version"
  exit 0
fi

echo "Gateway pods running a proxy other than $target_version: ${stale_pods[*]}"

kubectl rollout restart deploy "$release_name" -n "$namespace"
kubectl rollout status deploy "$release_name" -n "$namespace" --timeout=120s
echo "Gateway deployment rolled to pick up the current proxy image"

# Re-read: istiod may have upgraded again while the gateway was rolling.
target_version=$(istiod_version)
echo "Istiod version after gateway rollout: $target_version"

mapfile -t stale_pods < <(stale_proxy_pods)
if [[ ${#stale_pods[@]} -ne 0 ]]; then
  echo "Gateway pods still running stale istio-proxy images: ${stale_pods[*]}"
  exit 1
fi

echo "All gateway istio-proxy images match istiod version $target_version"
