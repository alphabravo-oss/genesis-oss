<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# kyverno-reporter

![Version: 3.10.0-bb.2](https://img.shields.io/badge/Version-3.10.0--bb.2-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: 3.10.0](https://img.shields.io/badge/AppVersion-3.10.0-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

Policy Reporter watches for PolicyReport Resources.
It creates Prometheus Metrics and can send rule validation events to different targets like Loki, Elasticsearch, Slack or Discord

## Upstream References

- <https://kyverno.github.io/policy-reporter>
- <https://github.com/kyverno/policy-reporter>

## Upstream Release Notes

- [Find our upstream chart's CHANGELOG here](https://github.com/kyverno/policy-reporter/blob/main/CHANGELOG.md)
- [and our upstream application release notes here](https://github.com/kyverno/kyverno/releases)

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
helm install kyverno-reporter chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| domain | string | `"dev.bigbang.mil"` | domain to use for virtual service |
| global.fullnameOverride | string | `"kyverno-reporter"` |  |
| global.labels | object | `{}` |  |
| istio.enabled | bool | `false` |  |
| istio.sidecar.enabled | bool | `false` |  |
| istio.sidecar.outboundTrafficPolicyMode | string | `"REGISTRY_ONLY"` |  |
| istio.serviceEntries.custom | list | `[]` |  |
| istio.authorizationPolicies.enabled | bool | `false` |  |
| istio.authorizationPolicies.custom | list | `[]` |  |
| istio.mtls.mode | string | `"STRICT"` |  |
| routes.inbound.policy-reporter-ui.enabled | bool | `true` |  |
| routes.inbound.policy-reporter-ui.gateways[0] | string | `"istio-gateway/public-ingressgateway"` |  |
| routes.inbound.policy-reporter-ui.hosts[0] | string | `"policyreporter.dev.bigbang.mil"` |  |
| routes.inbound.policy-reporter-ui.service | string | `"policy-reporter-ui.kyverno-reporter.svc.cluster.local"` |  |
| routes.inbound.policy-reporter-ui.port | int | `8080` |  |
| networkPolicies.enabled | bool | `false` |  |
| networkPolicies.egress.from.kyverno-reporter.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"kyverno-reporter-kyverno-reporter"` |  |
| networkPolicies.egress.from.kyverno-reporter.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.ingress.to.policy-reporter:8080.from.k8s.monitoring-monitoring-kube-prometheus@monitoring/prometheus | bool | `false` |  |
| networkPolicies.additionalPolicies | list | `[]` |  |
| bbtests.enabled | bool | `false` |  |
| bbtests.cypress.artifacts | bool | `true` |  |
| bbtests.cypress.envs.cypress_grafana_url | string | `"http://grafana.monitoring.svc.cluster.local"` |  |
| bbtests.cypress.envs.cypress_prometheus_url | string | `"http://monitoring-kube-prometheus-prometheus.monitoring.svc.cluster.local:9090"` |  |
| bbtests.cypress.envs.cypress_grafana_user | string | `"admin"` |  |
| bbtests.cypress.envs.cypress_grafana_pass | string | `"prom-operator"` |  |
| bbtests.cypress.envs.cypress_reporter_ns | string | `"kyverno-reporter"` |  |
| bbtests.cypress.envs.cypress_policyreporter_ui | string | `"http://policy-reporter-ui.kyverno-reporter.svc.cluster.local:8080"` |  |
| bbtests.scripts.envs.KYVERNO_REPORTER_URL | string | `"http://policy-reporter.kyverno-reporter.svc:8080"` |  |
| bbtests.volumes | list | `[]` |  |
| upstream | object | Upstream chart values | Values to pass to [the upstream kyverno chart](https://github.com/kyverno/policy-reporter/blob/main/charts/policy-reporter/values.yaml) |
| upstream.monitoring.enabled | bool | `true` | Enables the Prometheus Operator integration |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._

