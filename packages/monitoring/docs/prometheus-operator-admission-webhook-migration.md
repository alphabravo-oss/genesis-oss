# Prometheus Operator admission webhook migration

Monitoring `88.3.0-bb.1` uses the integrated cert-manager installation to issue
and inject the Prometheus Operator admission-webhook certificate by default.
The upstream `kube-webhook-certgen` create/patch jobs are disabled by default.

## Before upgrading

1. Ensure the Big Bang cert-manager package is enabled and healthy. The
   monitoring chart renders cert-manager `Issuer` and `Certificate` resources
   when `upstream.prometheusOperator.admissionWebhooks.certManager.enabled` is
   true.
2. Confirm cert-manager's CRDs and controllers are ready before upgrading
   monitoring. In an umbrella deployment, deploy cert-manager before the
   monitoring HelmRelease.
3. If the existing deployment uses the upstream patch method, plan the change
   during a maintenance window. The upgrade changes certificate ownership and
   changes the webhook failure policy to `Fail` after the upgrade.

## Default migration

The default values for `88.3.0-bb.1` are:

```yaml
upstream:
  prometheusOperator:
    admissionWebhooks:
      certManager:
        enabled: true
      patch:
        enabled: false
```

Apply the monitoring upgrade only after cert-manager is ready. Then verify:

```bash
kubectl -n monitoring wait \
  --for=condition=Ready \
  certificate/monitoring-kube-prometheus-admission \
  --timeout=180s

kubectl get validatingwebhookconfiguration \
  monitoring-kube-prometheus-admission \
  -o jsonpath='{.metadata.annotations.cert-manager\.io/inject-ca-from}{"\n"}'
```

The annotation should reference
`monitoring/monitoring-kube-prometheus-admission`, and the webhook's
`clientConfig.caBundle` should be non-empty. The monitoring package's Helm test
performs these checks and creates a valid `PrometheusRule` to verify that the
webhook is serving requests.

Do not manually delete the admission Secret during a normal upgrade. Let
cert-manager reconcile the `Certificate` and its Secret. If cert-manager
reports that an existing Secret cannot be adopted or updated, stop the
upgrade, preserve the Secret for rollback, and resolve that cert-manager
ownership conflict before retrying.

## Temporarily retaining the patch method

If cert-manager cannot be deployed yet, explicitly retain the upstream method
instead of relying on the new default:

```yaml
upstream:
  prometheusOperator:
    admissionWebhooks:
      certManager:
        enabled: false
      patch:
        enabled: true
        image:
          registry: <approved-kube-webhook-certgen-registry>
          repository: <approved-kube-webhook-certgen-repository>
          tag: <approved-tag>
```

The patch image must be available from an approved registry. The default chart
no longer supplies the non-Iron-Bank `kube-webhook-certgen` image.

## Rollback

Before rolling back, ensure the target chart's certificate method is selected
explicitly. A rollback to the previous chart requires cert-manager mode to be
disabled and the previous patch-job image/settings to be restored. Keep the
cert-manager-created Secret until the rollback is confirmed; do not delete it
as a first response to a failed upgrade.
