<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# kyverno

![Version: 3.9.0-bb.0](https://img.shields.io/badge/Version-3.9.0--bb.0-informational?style=flat-square) ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square) ![AppVersion: v1.19.0](https://img.shields.io/badge/AppVersion-v1.19.0-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

Kubernetes Native Policy Management

## Upstream References

- <https://kyverno.io/>
- <https://github.com/kyverno/kyverno>

## Upstream Release Notes

- [Find our upstream chart's CHANGELOG here](https://github.com/kyverno/kyverno/blob/main/CHANGELOG.md)
- [and our upstream application release notes here](https://github.com/kyverno/kyverno/releases)

## Learn More

- [Application Overview](docs/overview.md)
- [Other Documentation](docs/)

## Pre-Requisites

- Kubernetes Cluster deployed
- Kubernetes config installed in `~/.kube/config`
- Helm installed

Kubernetes: `>=1.25.0-0`

Install Helm

https://helm.sh/docs/intro/install/

## Deployment

- Clone down the repository
- cd into directory

```bash
helm install kyverno chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| networkPolicies.enabled | bool | `false` |  |
| networkPolicies.ingress.defaults.allowPrometheusToIstioSidecar.enabled | bool | `false` |  |
| networkPolicies.ingress.definitions.kubeAPI.from[0].ipBlock.cidr | string | `"192.168.0.0/16"` |  |
| networkPolicies.ingress.definitions.kubeAPI.from[1].ipBlock.cidr | string | `"172.16.0.0/12"` |  |
| networkPolicies.ingress.definitions.kubeAPI.from[2].ipBlock.cidr | string | `"10.0.0.0/8"` |  |
| networkPolicies.ingress.to.kyverno-admission-controller:9443.podSelector.matchLabels."app.kubernetes.io/component" | string | `"admission-controller"` |  |
| networkPolicies.ingress.to.kyverno-admission-controller:9443.from.definition.kubeAPI | bool | `true` |  |
| networkPolicies.ingress.to.kyverno:8000.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"kyverno-kyverno"` |  |
| networkPolicies.ingress.to.kyverno:8000.from.k8s.monitoring/prometheus | bool | `true` |  |
| networkPolicies.egress.defaults.allowIstiod.enabled | bool | `false` |  |
| networkPolicies.egress.definitions.private-registry.to[0].ipBlock.cidr | string | `"15.205.173.153/32"` |  |
| networkPolicies.egress.definitions.private-registry.ports[0].port | int | `443` |  |
| networkPolicies.egress.definitions.private-registry.ports[0].protocol | string | `"TCP"` |  |
| networkPolicies.egress.from.kyverno-admission-controller.podSelector.matchLabels."app.kubernetes.io/component" | string | `"admission-controller"` |  |
| networkPolicies.egress.from.kyverno-admission-controller.to.definition.private-registry | bool | `true` |  |
| networkPolicies.egress.from.kyverno-admission-controller.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.egress.from.kyverno-migrate-resources.podSelector.matchLabels."batch.kubernetes.io/job-name" | string | `"kyverno-kyverno-migrate-resources"` |  |
| networkPolicies.egress.from.kyverno-migrate-resources.to.definition.kubeAPI | bool | `true` |  |
| networkPolicies.additionalPolicies | list | `[]` |  |
| istio.enabled | bool | `false` |  |
| openshift | bool | `false` |  |
| bbtests.enabled | bool | `false` |  |
| bbtests.scripts.image | string | `"registry1.dso.mil/ironbank/opensource/kubernetes/kubectl:v1.35"` |  |
| bbtests.scripts.additionalVolumeMounts[0].name | string | `"kyverno-bbtest-manifest"` |  |
| bbtests.scripts.additionalVolumeMounts[0].mountPath | string | `"/yaml"` |  |
| bbtests.scripts.additionalVolumes[0].name | string | `"kyverno-bbtest-manifest"` |  |
| bbtests.scripts.additionalVolumes[0].configMap.name | string | `"kyverno-bbtest-manifest"` |  |
| global.image.registry | string | `"registry1.dso.mil"` |  |
| global.imagePullSecrets[0].name | string | `"private-registry"` |  |
| global.resyncPeriod | string | `"15m"` |  |
| global.templating.enabled | bool | `false` |  |
| global.templating.debug | bool | `false` |  |
| global.templating.version | string | `nil` |  |
| upstream | object | Upstream chart values | Values to pass to [the upstream Kyverno chart](https://github.com/kyverno/kyverno/blob/main/charts/kyverno/values.yaml) |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._

