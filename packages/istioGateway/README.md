<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# gateway

![Version: 1.30.2-bb.2](https://img.shields.io/badge/Version-1.30.2--bb.2-informational?style=flat-square) ![AppVersion: 1.30.2](https://img.shields.io/badge/AppVersion-1.30.2-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

Helm chart for deploying Istio gateways

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

<https://helm.sh/docs/intro/install/>

## Deployment

- Clone down the repository
- cd into directory

```bash
helm install gateway chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| mtls.mode | string | `"STRICT"` | STRICT = Allow only mutual TLS traffic, PERMISSIVE = Allow both plain text and mutual TLS traffic |
| networkPolicies.enabled | bool | `true` |  |
| networkPolicies.prependReleaseName | bool | `true` |  |
| classificationBanner | object | `{"addFooter":false,"classificationLevel":"unclassified","enabled":false,"enabledHosts":[],"text":""}` | Gateway-scoped classification banner configuration. This injects the banner at this gateway for matching HTML hosts. |
| gateway.servers[0].hosts[0] | string | `"*.dev.bigbang.mil"` |  |
| gateway.servers[0].port.name | string | `"http"` |  |
| gateway.servers[0].port.number | int | `8080` |  |
| gateway.servers[0].port.protocol | string | `"HTTP"` |  |
| gateway.servers[0].tls.httpsRedirect | bool | `true` |  |
| gateway.servers[1].hosts[0] | string | `"*.dev.bigbang.mil"` |  |
| gateway.servers[1].port.name | string | `"https"` |  |
| gateway.servers[1].port.number | int | `8443` |  |
| gateway.servers[1].port.protocol | string | `"HTTPS"` |  |
| gateway.servers[1].tls.credentialName | string | `"public-cert"` |  |
| gateway.servers[1].tls.mode | string | `"SIMPLE"` |  |
| waitJob.enabled | bool | `true` |  |
| waitJob.permissions.apiGroups[0] | string | `""` |  |
| waitJob.permissions.apiGroups[1] | string | `"apps"` |  |
| waitJob.permissions.resources[0] | string | `"pods"` |  |
| waitJob.permissions.resources[1] | string | `"deployments"` |  |
| waitJob.permissions.verbs[0] | string | `"patch"` |  |
| waitJob.permissions.verbs[1] | string | `"list"` |  |
| waitJob.permissions.verbs[2] | string | `"get"` |  |
| waitJob.permissions.verbs[3] | string | `"watch"` |  |
| upstream | object | `{"labels":{"istio":"ingressgateway"},"service":{"ports":[{"name":"tcp-status-port","port":15021,"protocol":"TCP","targetPort":15021},{"name":"http2","port":80,"protocol":"TCP","targetPort":8080},{"name":"https","port":443,"protocol":"TCP","targetPort":8443}],"type":"LoadBalancer"}}` | Values passed to the upstream istio gateway chart. See [the upstream chart's values.yaml](https://github.com/istio/istio/blob/master/manifests/charts/gateway/values.yaml) for configuration options. |
| upstream.labels.istio | string | `"ingressgateway"` | We set this label by default to more easily integrate with other Big Bang components. |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._
