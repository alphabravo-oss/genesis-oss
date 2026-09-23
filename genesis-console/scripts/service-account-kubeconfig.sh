#!/usr/bin/env bash
# Print a kubeconfig for the console's read-only service account. First install it:
#   helm install RELEASE deploy/chart -n NAMESPACE --create-namespace --set console.enabled=false
# Then paste this script's output into Cluster connection in the console.
set -euo pipefail
release="${1:?usage: service-account-kubeconfig.sh RELEASE NAMESPACE}"
namespace="${2:?usage: service-account-kubeconfig.sh RELEASE NAMESPACE}"
secret="${release}-token"
for _ in $(seq 1 20); do
  token="$(kubectl -n "$namespace" get secret "$secret" -o jsonpath='{.data.token}' 2>/dev/null || true)"
  [ -n "$token" ] && break
  sleep 1
done
[ -n "${token:-}" ] || { echo "no token in secret $namespace/$secret; is the chart installed with console.enabled=false?" >&2; exit 1; }
ca="$(kubectl -n "$namespace" get secret "$secret" -o jsonpath='{.data.ca\.crt}')"
server="$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')"
name="$(kubectl config view --minify -o jsonpath='{.clusters[0].name}')"
cat <<EOF
apiVersion: v1
kind: Config
current-context: ${name}
clusters:
- name: ${name}
  cluster:
    server: ${server}
    certificate-authority-data: ${ca}
users:
- name: ${release}
  user:
    token: $(printf '%s' "$token" | base64 -d)
contexts:
- name: ${name}
  context:
    cluster: ${name}
    user: ${release}
EOF
