# Monitoring and Grafana

One monitoring release (Prometheus Operator, Prometheus, Alertmanager, node-exporter, kube-state-metrics) and a Grafana release. On `3.33.0` the operator chart is 0.93.1 and Grafana is 13.1.0.

| Image | Reference |
|---|---|
| Prometheus | `quay.io/prometheus/prometheus:v3.14.0` |
| Alertmanager | `quay.io/prometheus/alertmanager:v0.34.0` |
| Operator | `quay.io/prometheus-operator/prometheus-operator:v0.93.1` |
| Grafana | `docker.io/grafana/grafana:13.1.0` |
| Grafana sidecar | `quay.io/kiwigrid/k8s-sidecar:2.10.1` |

Upstream docs: [Prometheus](https://prometheus.io/docs/), [Grafana](https://grafana.com/docs/grafana/latest/).

Grafana's admin password starts as `prom-operator`. The public Grafana image runs as UID 472, and the overlay sets that user, group, and fsGroup.

The UI is `grafana.dev.genesis.local`. Prometheus is `prometheus.dev.genesis.local`. Alertmanager is `alertmanager.dev.genesis.local`.

On `3.28.0` through `3.31.1` the admission webhook job uses `registry.k8s.io/ingress-nginx/kube-webhook-certgen` at the chart's tag. `3.33.0` does not render that image.
