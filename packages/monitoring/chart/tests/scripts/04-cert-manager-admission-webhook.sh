#!/bin/bash

set -euo pipefail

command -v kubectl >/dev/null || {
  echo "kubectl required in image set by .Values.bbtests.scripts.image; set that value to an image that includes kubectl"
  exit 2
}

monitoring_namespace="${MONITORING_NAMESPACE:-monitoring}"
certificate_name="${ADMISSION_CERTIFICATE_NAME:-monitoring-kube-prometheus-admission}"
webhook_name="${ADMISSION_WEBHOOK_NAME:-monitoring-kube-prometheus-admission}"
webhook_service_name="${ADMISSION_SERVICE_NAME:-monitoring-kube-prometheus-operator}"
prometheus_rule_name="${PROMETHEUS_RULE_NAME:-monitoring-cert-manager-webhook-smoke}"
manifest_path="/test/prometheus-rule-webhook-smoke.json"
certificate_timeout="${CERTIFICATE_READY_TIMEOUT:-180s}"
injection_timeout_seconds="${WEBHOOK_INJECTION_TIMEOUT_SECONDS:-180}"
injection_poll_seconds="${WEBHOOK_INJECTION_POLL_SECONDS:-2}"

cleanup() {
  kubectl delete prometheusrule.monitoring.coreos.com "${prometheus_rule_name}" \
    -n "${monitoring_namespace}" --ignore-not-found=true >/dev/null
}
trap cleanup EXIT

echo "Validating cert-manager issued the Prometheus Operator admission certificate"
kubectl wait \
  --for=condition=Ready \
  --timeout="${certificate_timeout}" \
  "certificate.cert-manager.io/${certificate_name}" \
  -n "${monitoring_namespace}"

secret_name=$(kubectl get certificate.cert-manager.io "${certificate_name}" \
  -n "${monitoring_namespace}" \
  -o jsonpath='{.spec.secretName}')

if [[ "${secret_name}" != "${certificate_name}" ]]; then
  echo "Certificate secretName mismatch: got ${secret_name}, expected ${certificate_name}"
  exit 1
fi

echo "Validating cert-manager injected the CA bundle into the admission webhook"
injection_deadline=$(( $(date +%s) + injection_timeout_seconds ))
inject_ca_from=""
ca_bundle=""
while (( $(date +%s) < injection_deadline )); do
  inject_ca_from=$(kubectl get validatingwebhookconfiguration.admissionregistration.k8s.io "${webhook_name}" \
    -o jsonpath='{.metadata.annotations.cert-manager\.io/inject-ca-from}' 2>/dev/null || true)
  ca_bundle=$(kubectl get validatingwebhookconfiguration.admissionregistration.k8s.io "${webhook_name}" \
    -o jsonpath='{.webhooks[0].clientConfig.caBundle}' 2>/dev/null || true)

  if [[ "${inject_ca_from}" == "${monitoring_namespace}/${certificate_name}" && -n "${ca_bundle}" ]]; then
    break
  fi

  sleep "${injection_poll_seconds}"
done

if [[ "${inject_ca_from}" != "${monitoring_namespace}/${certificate_name}" ]]; then
  echo "Webhook inject-ca-from mismatch or timeout: got ${inject_ca_from}, expected ${monitoring_namespace}/${certificate_name}"
  exit 1
fi

if [[ -z "${ca_bundle}" ]]; then
  echo "Webhook ${webhook_name} did not receive a CA bundle within ${injection_timeout_seconds}s"
  exit 1
fi

service_name=$(kubectl get validatingwebhookconfiguration.admissionregistration.k8s.io "${webhook_name}" \
  -o jsonpath='{.webhooks[0].clientConfig.service.name}')

if [[ "${service_name}" != "${webhook_service_name}" ]]; then
  echo "Webhook service mismatch: got ${service_name}, expected ${webhook_service_name}"
  exit 1
fi

echo "Validating the admission webhook accepts a valid PrometheusRule"
cat > "${manifest_path}" <<EOF
{
  "apiVersion": "monitoring.coreos.com/v1",
  "kind": "PrometheusRule",
  "metadata": {
    "name": "${prometheus_rule_name}",
    "namespace": "${monitoring_namespace}"
  },
  "spec": {
    "groups": [
      {
        "name": "cert-manager-webhook-smoke",
        "rules": [
          {
            "alert": "CertManagerWebhookSmokeTest",
            "expr": "vector(1)",
            "labels": {
              "severity": "none"
            },
            "annotations": {
              "summary": "Smoke test rule for Prometheus Operator admission webhook"
            }
          }
        ]
      }
    ]
  }
}
EOF

kubectl apply -f "${manifest_path}"

created_rule=$(kubectl get prometheusrule.monitoring.coreos.com "${prometheus_rule_name}" \
  -n "${monitoring_namespace}" \
  -o jsonpath='{.metadata.name}')

if [[ "${created_rule}" != "${prometheus_rule_name}" ]]; then
  echo "PrometheusRule smoke test resource was not created"
  exit 1
fi

echo "cert-manager admission webhook validation passed"
