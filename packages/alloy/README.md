<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# k8s-monitoring

![Version: 4.1.7-bb.0](https://img.shields.io/badge/Version-4.1.7--bb.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 4.1.7](https://img.shields.io/badge/AppVersion-4.1.7-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

A Helm chart for gathering, scraping, and forwarding Kubernetes telemetry data to a Grafana Stack.

## Upstream References

- <https://github.com/grafana/k8s-monitoring-helm/tree/main/charts/k8s-monitoring>

## Upstream Release Notes

- [Find k8s-monitoring CHANGELOG here](https://github.com/grafana/k8s-monitoring-helm/releases/)
- [and Grafana Alloy's release notes here](https://grafana.com/docs/alloy/latest/release-notes/)

## Learn More

- [Application Overview](docs/overview.md)
- [Other Documentation](docs/)

## Pre-Requisites

- Kubernetes Cluster deployed
- Kubernetes config installed in `~/.kube/config`
- Helm installed

Install Helm

https://helm.sh/docs/intro/install/

## Deployment

- Clone down the repository
- cd into directory

```bash
helm install k8s-monitoring chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| global.image.registry | string | `"registry1.dso.mil"` |  |
| global.image.pullSecrets[0].name | string | `"private-registry"` |  |
| global.imageRegistry | string | `"registry1.dso.mil"` | Overrides the Docker registry globally for all images |
| global.imagePullSecrets[0].name | string | `"private-registry"` |  |
| serviceMonitors | list | `[]` |  |
| networkPolicies.enabled | bool | `false` | Toggle networkPolicies |
| networkPolicies.ingress.to.alloy-logs:12345.from.k8s.alloy-alloy-metrics@alloy/alloy-metrics | bool | `true` |  |
| networkPolicies.ingress.to.alloy-logs:12345.from.k8s.monitoring-monitoring-kube-prometheus@monitoring/prometheus | bool | `true` |  |
| networkPolicies.ingress.to.alloy-singleton:12345.from.k8s.alloy-alloy-metrics@alloy/alloy-metrics | bool | `true` |  |
| networkPolicies.ingress.to.alloy-singleton:12345.from.k8s.monitoring-monitoring-kube-prometheus@monitoring/prometheus | bool | `true` |  |
| networkPolicies.ingress.to.alloy-metrics:12345.from.k8s.monitoring-monitoring-kube-prometheus@monitoring/prometheus | bool | `true` |  |
| networkPolicies.ingress.to.alloy-receiver:4317.from.k8s.*/* | bool | `true` |  |
| networkPolicies.ingress.to.alloy-receiver:9411.from.k8s.*/* | bool | `true` |  |
| networkPolicies.ingress.to.alloy-receiver:12345.from.k8s.alloy-alloy-metrics@alloy/alloy-metrics | bool | `true` |  |
| networkPolicies.ingress.to.alloy-receiver:12345.from.k8s.monitoring-monitoring-kube-prometheus@monitoring/prometheus | bool | `true` |  |
| networkPolicies.egress.defaults.enabled | bool | `true` |  |
| networkPolicies.egress.from.alloy-logs.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.alloy-logs.to.k8s.logging/logging-loki:3100 | bool | `true` |  |
| networkPolicies.egress.from.alloy-logs.to.k8s.logging/logging-loki-write:3100 | bool | `true` |  |
| networkPolicies.egress.from.alloy-logs.to.k8s.logging/logging-loki-distributor:3100 | bool | `true` |  |
| networkPolicies.egress.from.alloy-operator.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.alloy-upstream.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.alloy-singleton.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.alloy-singleton.to.k8s.logging/logging-loki:3100 | bool | `true` |  |
| networkPolicies.egress.from.alloy-singleton.to.k8s.logging/logging-loki-write:3100 | bool | `true` |  |
| networkPolicies.egress.from.alloy-singleton.to.k8s.logging/logging-loki-distributor:3100 | bool | `true` |  |
| networkPolicies.egress.from.alloy-receiver.to.k8s.tempo/tempo:4317 | bool | `true` |  |
| networkPolicies.egress.from.alloy-receiver.to.definition.kubeAPI | bool | `true` |  |
| autoRollingUpgrade.enabled | bool | `true` |  |
| autoRollingUpgrade.image.repository | string | `"registry1.dso.mil/ironbank/big-bang/base"` |  |
| autoRollingUpgrade.image.tag | string | `"2.1.0"` |  |
| istio.enabled | bool | `false` |  |
| istio.sidecar.enabled | bool | `false` |  |
| istio.sidecar.outboundTrafficPolicyMode | string | `"REGISTRY_ONLY"` |  |
| istio.serviceEntries.custom | list | `[]` |  |
| istio.authorizationPolicies.enabled | bool | `false` |  |
| istio.authorizationPolicies.custom | list | `[]` |  |
| istio.mtls.mode | string | `"STRICT"` |  |
| bbtests.enabled | bool | `false` |  |
| bbtests.cypress.artifacts | bool | `true` |  |
| bbtests.cypress.envs.cypress_prometheus_url | string | `"https://prometheus.dev.bigbang.mil"` |  |
| bbtests.cypress.envs.cypress_alertmanager_url | string | `"https://alertmanager.dev.bigbang.mil"` |  |
| bbtests.scripts.envs.LOKI_SERVICE | string | `"loki.dev.bigbang.mil"` |  |
| bbtests.scripts.envs.TIMEOUT | string | `"10"` |  |
| bbtests.scripts.envs.RETRIES | string | `"7"` |  |
| upstream | object | Upstream chart values | Values to pass to [the upstream k8s-monitoring chart](https://github.com/grafana/k8s-monitoring-helm/blob/main/charts/k8s-monitoring/values.yaml) |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._

