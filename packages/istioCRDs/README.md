<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# istio-crds

![Version: 1.30.3-bb.0](https://img.shields.io/badge/Version-1.30.3--bb.0-informational?style=flat-square) ![AppVersion: 1.30.3](https://img.shields.io/badge/AppVersion-1.30.3-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

Helm chart for deploying Istio cluster resources and CRDs

## Upstream References

- <https://github.com/istio/istio>

## Upstream Release Notes

- [Find upstream chart's release notes and CHANGELOG here](https://istio.io/latest/news/releases)

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
helm install istio-crds chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| upstream.global.imagePullSecrets | list | `[]` |  |
| upstream.global.istioNamespace | string | `"istio-system"` |  |
| upstream.base.excludedCRDs | list | `[]` |  |
| upstream.base.enableCRDTemplates | bool | `true` |  |
| upstream.base.validationURL | string | `""` |  |
| upstream.base.validationCABundle | string | `""` |  |
| upstream.base.enableIstioConfigCRDs | bool | `true` |  |
| upstream.defaultRevision | string | `"default"` |  |
| upstream.experimental.stableValidationPolicy | bool | `false` |  |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._

