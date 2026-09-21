#!/bin/bash

set -euo pipefail

namespace=${K8S_NAMESPACE:-istio-gateway}
istiod_namespace=istio-system
release_name=$(echo "$HOSTNAME" | awk -F "-wait-job" '{print $1}')

proxy_images() {
  kubectl get po -l "app.kubernetes.io/name=$release_name" -n "$namespace" \
    -o jsonpath='{range .items[*]}{.metadata.name}{" "}{range .spec.containers[?(@.name=="istio-proxy")]}{.image}{end}{"\n"}{end}'
}

stale_proxy_pods() {
  local pod image

  while read -r pod image; do
    [[ -z "$pod" ]] && continue

    if [[ -z "$image" || ("$image" != *":$app_version" && "$image" != *":$app_version@"*) ]]; then
      echo "$pod"
    fi
  done < <(proxy_images)
}

# Make sure deployment is ready to avoid reading old pods from an in-progress rollout.
kubectl wait deploy "$release_name" --for=condition=Available -n "$namespace" --timeout=30s && echo "Gateway deployment ready"

app_version=$(kubectl get deploy "$release_name" -n "$namespace" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}')

mapfile -t stale_pods < <(stale_proxy_pods)
if [[ ${#stale_pods[@]} -eq 0 ]]; then
  echo "All gateway istio-proxy images match app version $app_version"
  exit 0
fi

elapsed_time=0
while [[ "$(kubectl get deploy istiod -n "$istiod_namespace" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}')" != "$app_version" && "$elapsed_time" -lt 60 ]]; do
  echo "Waiting for istiod to upgrade..."
  sleep 5
  elapsed_time=$((elapsed_time+5))
done

istiod_version=$(kubectl get deploy istiod -n "$istiod_namespace" -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}')
if [[ "$istiod_version" != "$app_version" ]]; then
  echo "Istiod version $istiod_version did not reach gateway app version $app_version"
  exit 1
fi

kubectl wait deploy istiod --for=condition=Available -n "$istiod_namespace" --timeout=30s && echo "Istiod deployment completed"

kubectl rollout restart deploy "$release_name" -n "$namespace"
kubectl rollout status deploy "$release_name" -n "$namespace" --timeout=120s && echo "Gateway deployment rolled to update image"

mapfile -t stale_pods < <(stale_proxy_pods)
if [[ ${#stale_pods[@]} -ne 0 ]]; then
  echo "Gateway pods still running stale istio-proxy images: ${stale_pods[*]}"
  exit 1
fi

echo "All gateway istio-proxy images match app version $app_version"
