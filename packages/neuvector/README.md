<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# neuvector

![Version: 2.11.1-bb.0](https://img.shields.io/badge/Version-2.11.1--bb.0-informational?style=flat-square) ![AppVersion: 5.6.1](https://img.shields.io/badge/AppVersion-5.6.1-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

Helm chart for NeuVector's core services

## Upstream References

- <https://neuvector.com>

## Upstream Release Notes

- [Find the upstream NeuVector `core` chart's release notes here](https://github.com/neuvector/neuvector-helm/tags)
- [and our upstream application release notes here](https://github.com/neuvector/neuvector/releases)

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
helm install neuvector chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| domain | string | `"dev.bigbang.mil"` |  |
| istio.enabled | bool | `false` |  |
| istio.injection | string | `"enabled"` |  |
| istio.mtls.mode | string | `"STRICT"` |  |
| istio.sidecar.enabled | bool | `true` |  |
| istio.sidecar.outboundTrafficPolicyMode | string | `"REGISTRY_ONLY"` |  |
| istio.authorizationPolicies.enabled | bool | `false` |  |
| istio.authorizationPolicies.generateFromNetpol | bool | `true` |  |
| routes.inbound.neuvector.enabled | bool | `true` |  |
| routes.inbound.neuvector.gateways[0] | string | `"istio-system/public"` |  |
| routes.inbound.neuvector.hosts[0] | string | `"neuvector.{{ .Values.domain }}"` |  |
| routes.inbound.neuvector.service | string | `"neuvector-service-webui"` |  |
| routes.inbound.neuvector.port | int | `8443` |  |
| routes.inbound.neuvector.selector.app | string | `"neuvector-manager-pod"` |  |
| networkPolicies.enabled | bool | `false` |  |
| networkPolicies.egress.from.controller.podSelector.matchLabels.app | string | `"neuvector-controller-pod"` |  |
| networkPolicies.egress.from.controller.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.adapter.podSelector.matchLabels.app | string | `"neuvector-registry-adapter-pod"` |  |
| networkPolicies.egress.from.adapter.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.updater.podSelector.matchLabels.app | string | `"neuvector-updater-pod"` |  |
| networkPolicies.egress.from.updater.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.cert-upgrader.podSelector.matchLabels.app | string | `"neuvector-cert-upgrader-pod"` |  |
| networkPolicies.egress.from.cert-upgrader.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.enforcer.podSelector.matchLabels.app | string | `"neuvector-enforcer-pod"` |  |
| networkPolicies.egress.from.enforcer.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.scanner.podSelector.matchLabels.app | string | `"neuvector-scanner-pod"` |  |
| networkPolicies.egress.from.scanner.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.ingress.to.exporter:8068.podSelector.matchLabels.app | string | `"neuvector-prometheus-exporter-pod"` |  |
| networkPolicies.ingress.to.exporter:8068.from.k8s.monitoring/prometheus | bool | `true` |  |
| monitoring.enabled | bool | `false` |  |
| monitoring.namespace | string | `"monitoring"` |  |
| bbtests.enabled | bool | `false` |  |
| bbtests.updater.enabled | bool | `false` |  |
| bbtests.cypress.artifacts | bool | `true` |  |
| bbtests.cypress.envs.cypress_url | string | `"http://neuvector-service-webui.{{ .Release.Namespace }}.svc.cluster.local:8443"` |  |
| bbtests.cypress.envs.cypress_prometheus_url | string | `"http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090"` |  |
| bbtests.cypress.envs.cypress_prometheus_targets_url | string | `"http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090/targets?pool=serviceMonitor%2Fneuvector%2Fneuvector-prometheus-exporter%2F0"` |  |
| bbtests.cypress.resources.requests.cpu | string | `"2"` |  |
| bbtests.cypress.resources.requests.memory | string | `"4Gi"` |  |
| bbtests.cypress.resources.limits.cpu | string | `"2"` |  |
| bbtests.cypress.resources.limits.memory | string | `"4Gi"` |  |
| bbtests.scripts.enabled | bool | `false` |  |
| bbtests.scripts.image | string | `"registry1.dso.mil/ironbank/big-bang/base:2.1.0"` |  |
| bbtests.scripts.envs.cypress_prometheus_targets_url | string | `"http://monitoring-monitoring-kube-prometheus.monitoring.svc.cluster.local:9090/targets?pool=serviceMonitor%2Fneuvector%2Fneuvector-prometheus-exporter%2F0"` |  |
| bbtests.scripts.envs.cypress_prometheus_url | string | `"http://monitoring-monitoring-kube-prometheus.monitoring.svc.cluster.local:9090"` |  |
| bbtests.scripts.envs.URL | string | `"http://neuvector-service-webui.{{ .Release.Namespace }}.svc.cluster.local:8443"` |  |
| upstream | object | Upstream chart values for Neuvector core | Values to pass to [the upstream NeuVector core subchart](https://github.com/neuvector/neuvector-helm/blob/master/charts/core/values.yaml) |
| monitor.imagePullSecrets | string | `"private-registry"` |  |
| monitor.install | bool | `false` |  |
| monitor.serviceAccount | string | `"default"` |  |
| monitor.registry | string | `"registry1.dso.mil"` |  |
| monitor.exporter.enabled | bool | `false` |  |
| monitor.exporter.serviceMonitor.enabled | bool | `false` |  |
| monitor.exporter.svc.enabled | bool | `false` |  |
| monitor.exporter.image.repository | string | `"ironbank/neuvector/neuvector/prometheus-exporter"` |  |
| monitor.exporter.image.tag | string | `"1-1.0.0"` |  |
| monitor.exporter.image.imagePullPolicy | string | `"Always"` |  |
| monitor.exporter.containerSecurityContext.runAsUser | int | `1001` |  |
| monitor.exporter.containerSecurityContext.runAsGroup | int | `1001` |  |
| monitor.exporter.containerSecurityContext.capabilities.drop[0] | string | `"ALL"` |  |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._
