#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="cert-manager"
CERT_DIR="$(mktemp -d)"

cleanup() {
  kubectl -n "${NAMESPACE}" delete secret ca-secret --ignore-not-found >/dev/null 2>&1 || true
  kubectl -n "${NAMESPACE}" delete issuer ca-issuer --ignore-not-found >/dev/null 2>&1 || true
  kubectl -n "${NAMESPACE}" delete certificate example-com --ignore-not-found >/dev/null 2>&1 || true
  rm -rf "${CERT_DIR}"
}

trap cleanup EXIT

echo "Generating local CA keypair..."
openssl genrsa -out "${CERT_DIR}/ca.key" 2048
openssl req -x509 -new -nodes -key "${CERT_DIR}/ca.key" -sha256 -days 3650 -out "${CERT_DIR}/ca.crt" -subj "/C=US/ST=CA/L=San Antonio/O=TestCA/CN=test-ca"

echo "Creating Kubernetes secret..."
kubectl -n "${NAMESPACE}" create secret tls ca-secret --cert="${CERT_DIR}/ca.crt" --key="${CERT_DIR}/ca.key" --dry-run=client -o yaml | kubectl apply -f -

cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: ca-issuer
  namespace: cert-manager
  annotations:
    cert-manager.io/allowed: "true"
spec:
  ca:
    secretName: ca-secret
EOF

cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: example-com
  namespace: cert-manager
spec:
  secretName: example-com-tls
  duration: 24h
  renewBefore: 12h
  commonName: example.com
  issuerRef:
    name: ca-issuer
    kind: Issuer
EOF

echo "Waiting for certificate readiness..."
kubectl -n "${NAMESPACE}" wait --for=condition=Ready --timeout=120s certificate/example-com

ready_status="$(kubectl -n "${NAMESPACE}" get certificate example-com -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')"
if [[ "${ready_status}" != "True" ]]; then
  echo "Certificate readiness check failed (Ready=${ready_status})"
  exit 1
fi

echo "Certificate smoke test succeeded"
