# Alloy

Alloy collects logs and cluster events. Metrics scrape is off in the default overlay. Loki is the log store.

| Image | Reference |
|---|---|
| Operator | `ghcr.io/grafana/alloy-operator:1.11.0` |
| Alloy | `docker.io/grafana/alloy:v1.18.0` |
| Config reloader | `quay.io/prometheus-operator/prometheus-config-reloader:v0.93.0` |
| kubectl toolbox | `ghcr.io/grafana/helm-chart-toolbox-kubectl:0.1.6` |

Upstream docs: [https://grafana.com/docs/alloy/latest/](https://grafana.com/docs/alloy/latest/)

On k8s-monitoring 4.1 and 4.2 the finalizer hook treats an empty global registry as the image registry. Genesis turns that hook off for those charts. `3.33.0` uses 4.3, which keeps each image's own registry, so the hook stays on.
