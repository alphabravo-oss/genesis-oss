<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# cert-manager

![Version: v1.20.3-bb.2](https://img.shields.io/badge/Version-v1.20.3--bb.2-informational?style=flat-square) ![AppVersion: v1.20.3](https://img.shields.io/badge/AppVersion-v1.20.3-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

A Helm chart for cert-manager

## Upstream References

- <https://cert-manager.io>
- <https://github.com/cert-manager/cert-manager>

## Upstream Release Notes

- [Find upstream chart's release notes and CHANGELOG here](https://github.com/cert-manager/cert-manager)

## Learn More

- [Application Overview](docs/overview.md)
- [Other Documentation](docs/)

## Pre-Requisites

- Kubernetes Cluster deployed
- Kubernetes config installed in `~/.kube/config`
- Helm installed

Kubernetes: `>= 1.22.0-0`

Install Helm

https://helm.sh/docs/intro/install/

## Deployment

- Clone down the repository
- cd into directory

```bash
helm install cert-manager chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| bb-common.istio.enabled | bool | `true` |  |
| bb-common.istio.mtls.mode | string | `"STRICT"` |  |
| bb-common.istio.sidecar.enabled | bool | `true` |  |
| bb-common.istio.sidecar.outboundTrafficPolicyMode | string | `"REGISTRY_ONLY"` |  |
| bb-common.istio.authorizationPolicies.enabled | bool | `true` |  |
| bb-common.istio.authorizationPolicies.generateFromNetpol | bool | `true` |  |
| bb-common.networkPolicies.enabled | bool | `true` |  |
| bb-common.networkPolicies.ingress.definitions.kubeAPI.from[0].ipBlock.cidr | string | `"10.0.0.0/8"` |  |
| bb-common.networkPolicies.ingress.definitions.kubeAPI.from[1].ipBlock.cidr | string | `"172.16.0.0/12"` |  |
| bb-common.networkPolicies.ingress.definitions.kubeAPI.from[2].ipBlock.cidr | string | `"192.168.0.0/16"` |  |
| bb-common.networkPolicies.ingress.to.cert-manager-webhook:10250.podSelector.matchLabels."app.kubernetes.io/component" | string | `"webhook"` |  |
| bb-common.networkPolicies.ingress.to.cert-manager-webhook:10250.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"{{ .Release.Name }}"` |  |
| bb-common.networkPolicies.ingress.to.cert-manager-webhook:10250.from.definition.kubeAPI | bool | `true` |  |
| bb-common.networkPolicies.ingress.to.cert-manager-metrics:9402.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"{{ .Release.Name }}"` |  |
| bb-common.networkPolicies.ingress.to.cert-manager-metrics:9402.from.k8s.monitoring-monitoring-kube-prometheus@monitoring/prometheus | bool | `true` |  |
| bb-common.networkPolicies.egress.from.cert-manager-controller.podSelector.matchLabels."app.kubernetes.io/component" | string | `"controller"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-controller.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"{{ .Release.Name }}"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-controller.to.definition.kubeAPI | bool | `true` |  |
| bb-common.networkPolicies.egress.from.cert-manager-webhook.podSelector.matchLabels."app.kubernetes.io/component" | string | `"webhook"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-webhook.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"{{ .Release.Name }}"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-webhook.to.definition.kubeAPI | bool | `true` |  |
| bb-common.networkPolicies.egress.from.cert-manager-cainjector.podSelector.matchLabels."app.kubernetes.io/component" | string | `"cainjector"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-cainjector.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"{{ .Release.Name }}"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-cainjector.to.definition.kubeAPI | bool | `true` |  |
| bb-common.networkPolicies.egress.from.cert-manager-startupapicheck.podSelector.matchLabels."app.kubernetes.io/component" | string | `"startupapicheck"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-startupapicheck.podSelector.matchLabels."app.kubernetes.io/instance" | string | `"{{ .Release.Name }}"` |  |
| bb-common.networkPolicies.egress.from.cert-manager-startupapicheck.to.definition.kubeAPI | bool | `true` |  |
| bb-common.routes.outbound | object | `{}` |  |
| issuers.selfSigned.enabled | bool | `false` |  |
| issuers.selfSigned.createOnInstall | bool | `false` |  |
| issuers.selfSigned.scope | string | `"Issuer"` |  |
| issuers.selfSigned.name | string | `""` |  |
| issuers.selfSigned.labels | object | `{}` |  |
| issuers.selfSigned.annotations | object | `{}` |  |
| issuers.letsEncrypt.enabled | bool | `false` |  |
| issuers.letsEncrypt.createOnInstall | bool | `false` |  |
| issuers.letsEncrypt.scope | string | `"Issuer"` |  |
| issuers.letsEncrypt.name | string | `""` |  |
| issuers.letsEncrypt.labels | object | `{}` |  |
| issuers.letsEncrypt.annotations | object | `{}` |  |
| issuers.letsEncrypt.environment | string | `"staging"` |  |
| issuers.letsEncrypt.email | string | `""` |  |
| issuers.letsEncrypt.server | string | `""` |  |
| issuers.letsEncrypt.privateKeySecretName | string | `""` |  |
| issuers.letsEncrypt.solvers | list | `[]` |  |
| issuers.letsEncrypt.networking.controllerEgress.enabled | bool | `true` |  |
| issuers.letsEncrypt.networking.controllerEgress.cidrs[0].cidr | string | `"0.0.0.0/0"` |  |
| issuers.letsEncrypt.networking.controllerEgress.cidrs[0].except[0] | string | `"169.254.169.254/32"` |  |
| issuers.letsEncrypt.networking.serviceEntry.enabled | bool | `true` |  |
| upstream.fullnameOverride | string | `"cert-manager"` |  |
| upstream.crds.enabled | bool | `true` |  |
| upstream.crds.keep | bool | `true` |  |
| upstream.global.imagePullSecrets[0].name | string | `"private-registry"` |  |
| upstream.global.priorityClassName | string | `"system-cluster-critical"` |  |
| upstream.securityContext.runAsUser | int | `1001` |  |
| upstream.securityContext.runAsGroup | int | `1001` |  |
| upstream.securityContext.runAsNonRoot | bool | `true` |  |
| upstream.securityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| upstream.replicaCount | int | `2` |  |
| upstream.podDisruptionBudget.enabled | bool | `true` |  |
| upstream.podDisruptionBudget.minAvailable | int | `1` |  |
| upstream.automountServiceAccountToken | bool | `false` |  |
| upstream.serviceAccount.automountServiceAccountToken | bool | `false` |  |
| upstream.volumes[0].name | string | `"serviceaccount-token"` |  |
| upstream.volumes[0].projected.defaultMode | int | `292` |  |
| upstream.volumes[0].projected.sources[0].serviceAccountToken.expirationSeconds | int | `3607` |  |
| upstream.volumes[0].projected.sources[0].serviceAccountToken.path | string | `"token"` |  |
| upstream.volumes[0].projected.sources[1].configMap.name | string | `"kube-root-ca.crt"` |  |
| upstream.volumes[0].projected.sources[1].configMap.items[0].key | string | `"ca.crt"` |  |
| upstream.volumes[0].projected.sources[1].configMap.items[0].path | string | `"ca.crt"` |  |
| upstream.volumes[0].projected.sources[2].downwardAPI.items[0].path | string | `"namespace"` |  |
| upstream.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.apiVersion | string | `"v1"` |  |
| upstream.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.fieldPath | string | `"metadata.namespace"` |  |
| upstream.volumeMounts[0].name | string | `"serviceaccount-token"` |  |
| upstream.volumeMounts[0].mountPath | string | `"/var/run/secrets/kubernetes.io/serviceaccount"` |  |
| upstream.volumeMounts[0].readOnly | bool | `true` |  |
| upstream.image.repository | string | `"registry1.dso.mil/ironbank/jetstack/cert-manager-controller"` |  |
| upstream.image.tag | string | `"v1.20.3"` |  |
| upstream.webhook.replicaCount | int | `3` |  |
| upstream.webhook.podDisruptionBudget.enabled | bool | `true` |  |
| upstream.webhook.podDisruptionBudget.minAvailable | int | `1` |  |
| upstream.webhook.automountServiceAccountToken | bool | `false` |  |
| upstream.webhook.serviceAccount.automountServiceAccountToken | bool | `false` |  |
| upstream.webhook.volumes[0].name | string | `"serviceaccount-token"` |  |
| upstream.webhook.volumes[0].projected.defaultMode | int | `292` |  |
| upstream.webhook.volumes[0].projected.sources[0].serviceAccountToken.expirationSeconds | int | `3607` |  |
| upstream.webhook.volumes[0].projected.sources[0].serviceAccountToken.path | string | `"token"` |  |
| upstream.webhook.volumes[0].projected.sources[1].configMap.name | string | `"kube-root-ca.crt"` |  |
| upstream.webhook.volumes[0].projected.sources[1].configMap.items[0].key | string | `"ca.crt"` |  |
| upstream.webhook.volumes[0].projected.sources[1].configMap.items[0].path | string | `"ca.crt"` |  |
| upstream.webhook.volumes[0].projected.sources[2].downwardAPI.items[0].path | string | `"namespace"` |  |
| upstream.webhook.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.apiVersion | string | `"v1"` |  |
| upstream.webhook.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.fieldPath | string | `"metadata.namespace"` |  |
| upstream.webhook.volumeMounts[0].name | string | `"serviceaccount-token"` |  |
| upstream.webhook.volumeMounts[0].mountPath | string | `"/var/run/secrets/kubernetes.io/serviceaccount"` |  |
| upstream.webhook.volumeMounts[0].readOnly | bool | `true` |  |
| upstream.webhook.podAnnotations."ambient.istio.io/bypass-inbound-capture" | string | `"true"` |  |
| upstream.webhook.podAnnotations."traffic.sidecar.istio.io/excludeInboundPorts" | string | `"10250"` |  |
| upstream.webhook.image.repository | string | `"registry1.dso.mil/ironbank/jetstack/cert-manager-webhook"` |  |
| upstream.webhook.image.tag | string | `"v1.20.3"` |  |
| upstream.webhook.securityContext.runAsUser | int | `1001` |  |
| upstream.webhook.securityContext.runAsGroup | int | `1001` |  |
| upstream.webhook.securityContext.runAsNonRoot | bool | `true` |  |
| upstream.webhook.securityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| upstream.cainjector.replicaCount | int | `2` |  |
| upstream.cainjector.podDisruptionBudget.enabled | bool | `true` |  |
| upstream.cainjector.podDisruptionBudget.minAvailable | int | `1` |  |
| upstream.cainjector.automountServiceAccountToken | bool | `false` |  |
| upstream.cainjector.serviceAccount.automountServiceAccountToken | bool | `false` |  |
| upstream.cainjector.volumes[0].name | string | `"serviceaccount-token"` |  |
| upstream.cainjector.volumes[0].projected.defaultMode | int | `292` |  |
| upstream.cainjector.volumes[0].projected.sources[0].serviceAccountToken.expirationSeconds | int | `3607` |  |
| upstream.cainjector.volumes[0].projected.sources[0].serviceAccountToken.path | string | `"token"` |  |
| upstream.cainjector.volumes[0].projected.sources[1].configMap.name | string | `"kube-root-ca.crt"` |  |
| upstream.cainjector.volumes[0].projected.sources[1].configMap.items[0].key | string | `"ca.crt"` |  |
| upstream.cainjector.volumes[0].projected.sources[1].configMap.items[0].path | string | `"ca.crt"` |  |
| upstream.cainjector.volumes[0].projected.sources[2].downwardAPI.items[0].path | string | `"namespace"` |  |
| upstream.cainjector.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.apiVersion | string | `"v1"` |  |
| upstream.cainjector.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.fieldPath | string | `"metadata.namespace"` |  |
| upstream.cainjector.volumeMounts[0].name | string | `"serviceaccount-token"` |  |
| upstream.cainjector.volumeMounts[0].mountPath | string | `"/var/run/secrets/kubernetes.io/serviceaccount"` |  |
| upstream.cainjector.volumeMounts[0].readOnly | bool | `true` |  |
| upstream.cainjector.image.repository | string | `"registry1.dso.mil/ironbank/jetstack/cert-manager-cainjector"` |  |
| upstream.cainjector.image.tag | string | `"v1.20.3"` |  |
| upstream.cainjector.securityContext.runAsUser | int | `1001` |  |
| upstream.cainjector.securityContext.runAsGroup | int | `1001` |  |
| upstream.cainjector.securityContext.runAsNonRoot | bool | `true` |  |
| upstream.cainjector.securityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| upstream.acmesolver.image.repository | string | `"registry1.dso.mil/ironbank/opensource/jetstack/cert-manager-acmesolver"` |  |
| upstream.acmesolver.image.tag | string | `"v1.20.3"` |  |
| upstream.startupapicheck.automountServiceAccountToken | bool | `false` |  |
| upstream.startupapicheck.serviceAccount.automountServiceAccountToken | bool | `false` |  |
| upstream.startupapicheck.volumes[0].name | string | `"serviceaccount-token"` |  |
| upstream.startupapicheck.volumes[0].projected.defaultMode | int | `292` |  |
| upstream.startupapicheck.volumes[0].projected.sources[0].serviceAccountToken.expirationSeconds | int | `3607` |  |
| upstream.startupapicheck.volumes[0].projected.sources[0].serviceAccountToken.path | string | `"token"` |  |
| upstream.startupapicheck.volumes[0].projected.sources[1].configMap.name | string | `"kube-root-ca.crt"` |  |
| upstream.startupapicheck.volumes[0].projected.sources[1].configMap.items[0].key | string | `"ca.crt"` |  |
| upstream.startupapicheck.volumes[0].projected.sources[1].configMap.items[0].path | string | `"ca.crt"` |  |
| upstream.startupapicheck.volumes[0].projected.sources[2].downwardAPI.items[0].path | string | `"namespace"` |  |
| upstream.startupapicheck.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.apiVersion | string | `"v1"` |  |
| upstream.startupapicheck.volumes[0].projected.sources[2].downwardAPI.items[0].fieldRef.fieldPath | string | `"metadata.namespace"` |  |
| upstream.startupapicheck.volumeMounts[0].name | string | `"serviceaccount-token"` |  |
| upstream.startupapicheck.volumeMounts[0].mountPath | string | `"/var/run/secrets/kubernetes.io/serviceaccount"` |  |
| upstream.startupapicheck.volumeMounts[0].readOnly | bool | `true` |  |
| upstream.startupapicheck.podAnnotations."sidecar.istio.io/inject" | string | `"false"` |  |
| upstream.startupapicheck.podLabels."istio.io/dataplane-mode" | string | `"none"` |  |
| upstream.startupapicheck.image.repository | string | `"registry1.dso.mil/ironbank/opensource/cleanstart/cert-manager-startupapicheck"` |  |
| upstream.startupapicheck.image.tag | string | `"1.20.3-amd64"` |  |
| upstream.startupapicheck.securityContext.runAsUser | int | `1001` |  |
| upstream.startupapicheck.securityContext.runAsGroup | int | `1001` |  |
| upstream.startupapicheck.securityContext.runAsNonRoot | bool | `true` |  |
| upstream.startupapicheck.securityContext.seccompProfile.type | string | `"RuntimeDefault"` |  |
| upstream.prometheus.enabled | bool | `true` |  |
| upstream.prometheus.servicemonitor.enabled | bool | `true` |  |
| upstream.prometheus.servicemonitor.endpointAdditionalProperties.scheme | string | `"https"` |  |
| upstream.prometheus.servicemonitor.endpointAdditionalProperties.enableHttp2 | bool | `false` |  |
| upstream.prometheus.servicemonitor.endpointAdditionalProperties.tlsConfig.caFile | string | `"/etc/prom-certs/root-cert.pem"` |  |
| upstream.prometheus.servicemonitor.endpointAdditionalProperties.tlsConfig.certFile | string | `"/etc/prom-certs/cert-chain.pem"` |  |
| upstream.prometheus.servicemonitor.endpointAdditionalProperties.tlsConfig.keyFile | string | `"/etc/prom-certs/key.pem"` |  |
| upstream.prometheus.servicemonitor.endpointAdditionalProperties.tlsConfig.insecureSkipVerify | bool | `true` |  |
| upstream.prometheus.podmonitor.enabled | bool | `false` |  |
| bbtests.enabled | bool | `false` |  |
| bbtests.scripts.enabled | bool | `false` |  |
| bbtests.scripts.envs.NAMESPACE | string | `"{{ .Release.Namespace }}"` |  |
| bbtests.scripts.envs.INSTANCE_NAME | string | `"{{ .Release.Name }}"` |  |
| bbtests.scripts.envs.WEBHOOK_SERVICE | string | `"{{ include \"cert-manager.webhookServiceName\" . }}"` |  |
| bbtests.scripts.envs.WEBHOOK_CA_SECRET | string | `"{{ include \"cert-manager.webhookServiceName\" . }}-ca"` |  |
| bbtests.scripts.envs.REQUIRE_BUILTIN_ISSUER | string | `"{{ and .Release.IsUpgrade .Values.issuers.selfSigned.enabled }}"` |  |
| bbtests.scripts.envs.BUILTIN_ISSUER_NAME | string | `"{{ include \"cert-manager.selfSignedIssuerName\" . }}"` |  |
| bbtests.scripts.envs.BUILTIN_ISSUER_KIND | string | `"{{ .Values.issuers.selfSigned.scope }}"` |  |
| bbtests.scripts.image | string | `"registry1.dso.mil/ironbank/opensource/kubernetes/kubectl:v1.34"` |  |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._

