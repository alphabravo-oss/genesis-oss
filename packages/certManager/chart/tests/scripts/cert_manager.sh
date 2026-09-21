#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-cert-manager}"
INSTANCE_NAME="${INSTANCE_NAME:-cert-manager}"
RUN_ID="${RUN_ID:-${HOSTNAME:-$(date +%s)-$$}}"
RUN_ID="$(printf '%s' "${RUN_ID}" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-' | cut -c1-20)"
while [[ "${RUN_ID}" == *- ]]; do
  RUN_ID="${RUN_ID%-}"
done
if [[ -z "${RUN_ID}" ]]; then
  RUN_ID="run-$(date +%s)-$$"
fi
if [[ ! "${RUN_ID}" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
  echo "RUN_ID must normalize to a lowercase alphanumeric value with internal dashes only"
  exit 1
fi
TEST_LABEL_KEY="cert-manager.io/test-run"
WEBHOOK_SERVICE="${WEBHOOK_SERVICE:-cert-manager-webhook}"
WEBHOOK_CA_SECRET="${WEBHOOK_CA_SECRET:-${WEBHOOK_SERVICE}-ca}"
BUILTIN_ISSUER_NAME="${BUILTIN_ISSUER_NAME:-cert-manager-selfsigned}"
BUILTIN_ISSUER_KIND="${BUILTIN_ISSUER_KIND:-Issuer}"
REQUIRE_BUILTIN_ISSUER="${REQUIRE_BUILTIN_ISSUER:-false}"
SELF_SIGNED_TEST_ISSUER_NAME="${SELF_SIGNED_TEST_ISSUER_NAME:-test-selfsigned}-${RUN_ID}"
SELF_SIGNED_CERT_NAME="test-selfsigned-cert-${RUN_ID}"
SELF_SIGNED_SECRET_NAME="test-selfsigned-cert-tls-${RUN_ID}"
BAD_ISSUER_CERT_NAME="test-bad-issuer-cert-${RUN_ID}"
BAD_ISSUER_SECRET_NAME="test-bad-issuer-cert-tls-${RUN_ID}"
ACME_CERT_NAME="test-acme-cert-${RUN_ID}"
ACME_SECRET_NAME="test-acme-cert-tls-${RUN_ID}"
ACME_TEST_FQDN="${ACME_TEST_FQDN:-}"
ACME_ISSUER_NAME="${ACME_ISSUER_NAME:-cert-manager-letsencrypt-staging}"
ACME_ISSUER_KIND="${ACME_ISSUER_KIND:-Issuer}"
ACME_EXPECTED_SERVER="${ACME_EXPECTED_SERVER:-https://acme-staging-v02.api.letsencrypt.org/directory}"

retry_apply() {
  local max_attempts="$1"
  local sleep_seconds="$2"
  local attempt=1
  local manifest output

  manifest="$(cat)"
  while (( attempt <= max_attempts )); do
    set +e
    output="$(printf '%s\n' "${manifest}" | kubectl apply -f - 2>&1)"
    status=$?
    set -e

    if (( status == 0 )); then
      printf '%s\n' "${output}"
      return 0
    fi

    printf '%s\n' "${output}"
    echo "kubectl apply failed (attempt ${attempt}/${max_attempts}), retrying in ${sleep_seconds}s..."
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  echo "kubectl apply failed after ${max_attempts} attempts"
  return 1
}

find_order_for_certificate() {
  local certificate_name="$1"
  local order_name found_certificate

  while read -r order_name; do
    [[ -z "${order_name}" ]] && continue
    found_certificate="$(kubectl -n "${NAMESPACE}" get "${order_name}" -o jsonpath='{.metadata.annotations.cert-manager\.io/certificate-name}' 2>/dev/null || true)"
    if [[ "${found_certificate}" == "${certificate_name}" ]]; then
      printf '%s\n' "${order_name#*/}"
      return 0
    fi
  done < <(kubectl -n "${NAMESPACE}" get orders -o name 2>/dev/null || true)
}

find_challenge_for_order() {
  local order_name="$1"
  local challenge_name owner_order

  while read -r challenge_name; do
    [[ -z "${challenge_name}" ]] && continue
    owner_order="$(kubectl -n "${NAMESPACE}" get "${challenge_name}" -o jsonpath='{.metadata.ownerReferences[0].name}' 2>/dev/null || true)"
    if [[ "${owner_order}" == "${order_name}" ]]; then
      printf '%s\n' "${challenge_name#*/}"
      return 0
    fi
  done < <(kubectl -n "${NAMESPACE}" get challenges -o name 2>/dev/null || true)
}

admission_diagnostics() {
  echo "=== webhook endpoints ==="
  kubectl -n "${NAMESPACE}" get endpoints "${WEBHOOK_SERVICE}" -o wide || true
  echo "=== webhook pod status ==="
  kubectl -n "${NAMESPACE}" get pods -l app.kubernetes.io/component=webhook,app.kubernetes.io/instance="${INSTANCE_NAME}" -o wide || true
  echo "=== validating webhook config ==="
  kubectl get validatingwebhookconfiguration "${WEBHOOK_SERVICE}" -o yaml || true
  echo "=== mutating webhook config ==="
  kubectl get mutatingwebhookconfiguration "${WEBHOOK_SERVICE}" -o yaml || true
  echo "=== recent webhook logs ==="
  webhook_pod="$(kubectl -n "${NAMESPACE}" get pods -l app.kubernetes.io/component=webhook,app.kubernetes.io/instance="${INSTANCE_NAME}" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)"
  if [[ -n "${webhook_pod}" ]]; then
    kubectl -n "${NAMESPACE}" logs "${webhook_pod}" --tail=200 || true
  fi
}

wait_for_webhook_admission() {
  local max_attempts="$1"
  local sleep_seconds="$2"
  local attempt=1
  local output

  while (( attempt <= max_attempts )); do
    set +e
    output="$(kubectl apply --dry-run=server -f - 2>&1 <<EOF
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: webhook-admission-probe
  namespace: ${NAMESPACE}
spec:
  selfSigned: {}
EOF
)"
    status=$?
    set -e

    if (( status == 0 )); then
      echo "Webhook admission probe succeeded"
      return 0
    fi

    printf '%s\n' "${output}"
    echo "Webhook admission probe failed (attempt ${attempt}/${max_attempts}), retrying in ${sleep_seconds}s..."
    sleep "${sleep_seconds}"
    attempt=$((attempt + 1))
  done

  echo "Webhook admission probe failed after ${max_attempts} attempts"
  admission_diagnostics
  return 1
}

cleanup() {
  kubectl -n "${NAMESPACE}" delete certificate "${SELF_SIGNED_CERT_NAME}" "${BAD_ISSUER_CERT_NAME}" "${ACME_CERT_NAME}" --ignore-not-found >/dev/null 2>&1 || true
  kubectl -n "${NAMESPACE}" delete secret "${SELF_SIGNED_SECRET_NAME}" "${BAD_ISSUER_SECRET_NAME}" "${ACME_SECRET_NAME}" --ignore-not-found >/dev/null 2>&1 || true
  kubectl -n "${NAMESPACE}" delete issuer "${SELF_SIGNED_TEST_ISSUER_NAME}" --ignore-not-found >/dev/null 2>&1 || true
}

trap cleanup EXIT
cleanup

if [[ "${BUILTIN_ISSUER_KIND}" != "Issuer" && "${BUILTIN_ISSUER_KIND}" != "ClusterIssuer" ]]; then
  echo "BUILTIN_ISSUER_KIND must be Issuer or ClusterIssuer"
  exit 1
fi

if [[ "${REQUIRE_BUILTIN_ISSUER}" != "true" && "${REQUIRE_BUILTIN_ISSUER}" != "false" ]]; then
  echo "REQUIRE_BUILTIN_ISSUER must be true or false"
  exit 1
fi

echo "Checking required cert-manager CRDs..."
for crd in \
  certificates.cert-manager.io \
  certificaterequests.cert-manager.io \
  clusterissuers.cert-manager.io \
  issuers.cert-manager.io \
  orders.acme.cert-manager.io \
  challenges.acme.cert-manager.io; do
  kubectl get crd "${crd}" >/dev/null
done

echo "Waiting for cert-manager deployments to be available..."
kubectl -n "${NAMESPACE}" wait --for=condition=Available --timeout=180s deployment -l app.kubernetes.io/instance="${INSTANCE_NAME}"

echo "Waiting for cert-manager webhook pod readiness..."
kubectl -n "${NAMESPACE}" wait --for=condition=Ready --timeout=180s pod -l app.kubernetes.io/component=webhook,app.kubernetes.io/instance="${INSTANCE_NAME}"

echo "Waiting for cert-manager webhook endpoint to be ready..."
endpoint_ready=false
for _ in $(seq 1 36); do
  addresses="$(kubectl -n "${NAMESPACE}" get endpoints "${WEBHOOK_SERVICE}" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null || true)"
  if [[ -n "${addresses}" ]]; then
    endpoint_ready=true
    break
  fi
  sleep 5
done
if [[ "${endpoint_ready}" != "true" ]]; then
  echo "Webhook endpoint ${WEBHOOK_SERVICE} did not become ready"
  admission_diagnostics
  exit 1
fi

echo "Validating cert-manager webhook registration..."
kubectl get validatingwebhookconfiguration "${WEBHOOK_SERVICE}" >/dev/null
kubectl get mutatingwebhookconfiguration "${WEBHOOK_SERVICE}" >/dev/null

echo "Validating cert-manager webhook TLS secret exists..."
kubectl -n "${NAMESPACE}" get secret "${WEBHOOK_CA_SECRET}" >/dev/null

echo "Waiting for cert-manager webhook admission to be ready..."
wait_for_webhook_admission 60 5

echo "Running positive self-signed issuer/certificate test..."
issuer_name="${SELF_SIGNED_TEST_ISSUER_NAME}"
issuer_kind="Issuer"
if [[ "${BUILTIN_ISSUER_KIND}" == "ClusterIssuer" ]] && kubectl get clusterissuer "${BUILTIN_ISSUER_NAME}" >/dev/null 2>&1; then
  echo "Using packaged self-signed ClusterIssuer ${BUILTIN_ISSUER_NAME}"
  issuer_name="${BUILTIN_ISSUER_NAME}"
  issuer_kind="ClusterIssuer"
  kubectl wait --for=condition=Ready --timeout=180s "clusterissuer/${issuer_name}"
elif [[ "${BUILTIN_ISSUER_KIND}" == "Issuer" ]] && kubectl -n "${NAMESPACE}" get issuer "${BUILTIN_ISSUER_NAME}" >/dev/null 2>&1; then
  echo "Using packaged self-signed Issuer ${BUILTIN_ISSUER_NAME}"
  issuer_name="${BUILTIN_ISSUER_NAME}"
  kubectl -n "${NAMESPACE}" wait --for=condition=Ready --timeout=180s "issuer/${issuer_name}"
elif [[ "${REQUIRE_BUILTIN_ISSUER}" == "true" ]]; then
  echo "Packaged self-signed ${BUILTIN_ISSUER_KIND} ${BUILTIN_ISSUER_NAME} is required after an upgrade but was not found"
  exit 1
else
  echo "Creating post-install self-signed issuer ${SELF_SIGNED_TEST_ISSUER_NAME}"
  kubectl -n "${NAMESPACE}" delete issuer "${SELF_SIGNED_TEST_ISSUER_NAME}" --ignore-not-found
  cat <<EOF | retry_apply 30 6
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: ${SELF_SIGNED_TEST_ISSUER_NAME}
  namespace: ${NAMESPACE}
  labels:
    ${TEST_LABEL_KEY}: ${RUN_ID}
spec:
  selfSigned: {}
EOF
fi

cat <<EOF | retry_apply 30 6
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${SELF_SIGNED_CERT_NAME}
  namespace: ${NAMESPACE}
  labels:
    ${TEST_LABEL_KEY}: ${RUN_ID}
spec:
  secretName: ${SELF_SIGNED_SECRET_NAME}
  commonName: test.example.com
  dnsNames:
  - test.example.com
  issuerRef:
    name: ${issuer_name}
    kind: ${issuer_kind}
EOF

kubectl -n "${NAMESPACE}" wait --for=condition=Ready --timeout=180s "certificate/${SELF_SIGNED_CERT_NAME}"

if [[ -n "${ACME_TEST_FQDN}" ]]; then
  if [[ "${ACME_TEST_FQDN}" == \*.* ]]; then
    echo "ACME_TEST_FQDN must not be a wildcard; use a separate DNS-01 test for wildcard certificates"
    exit 1
  fi
  if [[ ! "${ACME_TEST_FQDN}" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]]; then
    echo "ACME_TEST_FQDN must be a non-wildcard DNS name"
    exit 1
  fi
  if [[ "${ACME_ISSUER_KIND}" != "Issuer" && "${ACME_ISSUER_KIND}" != "ClusterIssuer" ]]; then
    echo "ACME_ISSUER_KIND must be Issuer or ClusterIssuer"
    exit 1
  fi

  echo "Running opt-in ACME certificate test against ${ACME_EXPECTED_SERVER}..."
  if [[ "${ACME_ISSUER_KIND}" == "ClusterIssuer" ]]; then
    kubectl wait --for=condition=Ready --timeout=300s "clusterissuer/${ACME_ISSUER_NAME}"
    acme_server="$(kubectl get clusterissuer "${ACME_ISSUER_NAME}" -o jsonpath='{.spec.acme.server}')"
  else
    kubectl -n "${NAMESPACE}" wait --for=condition=Ready --timeout=300s "issuer/${ACME_ISSUER_NAME}"
    acme_server="$(kubectl -n "${NAMESPACE}" get issuer "${ACME_ISSUER_NAME}" -o jsonpath='{.spec.acme.server}')"
  fi
  if [[ -z "${acme_server}" ]]; then
    echo "${ACME_ISSUER_KIND} ${ACME_ISSUER_NAME} is not an ACME issuer"
    exit 1
  fi
  if [[ "${acme_server}" != "${ACME_EXPECTED_SERVER}" ]]; then
    echo "${ACME_ISSUER_KIND} ${ACME_ISSUER_NAME} uses ${acme_server}, expected ${ACME_EXPECTED_SERVER}"
    exit 1
  fi
  cat <<EOF | retry_apply 30 6
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${ACME_CERT_NAME}
  namespace: ${NAMESPACE}
  labels:
    ${TEST_LABEL_KEY}: ${RUN_ID}
spec:
  secretName: ${ACME_SECRET_NAME}
  dnsNames:
    - "${ACME_TEST_FQDN}"
  issuerRef:
    name: ${ACME_ISSUER_NAME}
    kind: ${ACME_ISSUER_KIND}
EOF
  order_name=""
  for _ in $(seq 1 60); do
    order_name="$(find_order_for_certificate "${ACME_CERT_NAME}" || true)"
    if [[ -n "${order_name}" ]]; then
      break
    fi
    sleep 5
  done
  if [[ -z "${order_name}" ]]; then
    echo "ACME test did not create an Order for ${ACME_CERT_NAME}"
    exit 1
  fi
  challenge_name=""
  for _ in $(seq 1 60); do
    challenge_name="$(find_challenge_for_order "${order_name}" || true)"
    if [[ -n "${challenge_name}" ]]; then
      break
    fi
    sleep 5
  done
  if [[ -z "${challenge_name}" ]]; then
    echo "ACME test did not create a Challenge for Order ${order_name}"
    exit 1
  fi

  kubectl -n "${NAMESPACE}" wait --for=jsonpath='{.status.state}'=valid --timeout=300s "challenge/${challenge_name}"
  kubectl -n "${NAMESPACE}" wait --for=condition=Ready --timeout=600s "certificate/${ACME_CERT_NAME}"
  kubectl -n "${NAMESPACE}" wait --for=jsonpath='{.status.state}'=valid --timeout=300s "order/${order_name}"
  kubectl -n "${NAMESPACE}" get certificate "${ACME_CERT_NAME}" -o wide
fi

echo "Running negative issuer/certificate test..."
cat <<EOF | retry_apply 10 5
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${BAD_ISSUER_CERT_NAME}
  namespace: ${NAMESPACE}
  labels:
    ${TEST_LABEL_KEY}: ${RUN_ID}
spec:
  secretName: ${BAD_ISSUER_SECRET_NAME}
  commonName: bad.example.com
  issuerRef:
    name: does-not-exist
    kind: Issuer
EOF

for _ in $(seq 1 36); do
  status="$(kubectl -n "${NAMESPACE}" get certificate "${BAD_ISSUER_CERT_NAME}" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"
  if [[ "${status}" == "False" ]]; then
    echo "Negative test passed (${BAD_ISSUER_CERT_NAME} Ready=False)"
    echo "cert-manager helm test PASS"
    exit 0
  fi
  sleep 5
done

echo "Negative test failed: expected ${BAD_ISSUER_CERT_NAME} Ready=False"
kubectl -n "${NAMESPACE}" get certificate "${BAD_ISSUER_CERT_NAME}" -o yaml || true
exit 1
