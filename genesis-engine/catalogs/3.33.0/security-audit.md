# Default-on image audit

Tag 3.33.0. Digests come from an anonymous manifest GET.

| Image | Digest | Signature | High and critical |
|---|---|---|---|
| `flux/helm-controller` | `8ff15409e46d` | signed | 0 critical, 7 high |
| `flux/kustomize-controller` | `a3a955eb2bc4` | signed | 0 critical, 17 high |
| `flux/notification-controller` | `840f318265ee` | signed | 0 critical, 9 high |
| `flux/source-controller` | `6f20d232d596` | signed | 0 critical, 11 high |
| `alloy/operator` | `913ea3c5c0a5` | unsigned | 0 critical, 46 high |
| `alloy/alloy` | `491b0578c049` | unsigned | 0 critical, 19 high |
| `alloy/config-reloader` | `0ccb22ca9f3f` | signed | 0 critical, 9 high |
| `alloy/kubectl-toolbox` | `937666386128` | unsigned | 3 critical, 176 high |
| `cert-manager/controller` | `6c13d61e0348` | unsigned | 0 critical, 15 high |
| `cert-manager/webhook` | `a61e817632ce` | unsigned | 0 critical, 15 high |
| `cert-manager/cainjector` | `06ad347fe0dc` | unsigned | 0 critical, 12 high |
| `cert-manager/acmesolver` | `d8d948a9fa0f` | unsigned | 0 critical, 11 high |
| `cert-manager/startupapicheck` | `b0c9a2c18d02` | unsigned | 0 critical, 12 high |
| `grafana/grafana` | `121a7a9ece6d` | unsigned | 1 critical, 86 high |
| `grafana/k8s-sidecar` | `7eac5c4fed71` | unsigned | 0 critical, 8 high |
| `istio/pilot` | `c236c1df5cc1` | unsigned | 0 critical, 5 high |
| `istio/proxyv2` | `43b6aeab7428` | unsigned | 0 critical, 5 high |
| `istio/busybox-example` | `141c253bc4c3` | unsigned | 0 critical, 0 high |
| `istio-gateway/kubectl` | `0bb95b2a4508` | unsigned | 2 critical, 48 high |
| `kiali/operator` | `f837d8f25545` | unsigned | 2 critical, 85 high |
| `kiali/kiali` | `df636734606c` | unsigned | 0 critical, 21 high |
| `kiali/kubectl` | `1ec2791a3ddd` | signed | 0 critical, 16 high |
| `kyverno/kyverno` | `b31d8511ae5f` | unsigned | 0 critical, 0 high |
| `kyverno/pre` | `c25c47461f06` | unsigned | 0 critical, 0 high |
| `kyverno/background-controller` | `8f1e9143373a` | unsigned | 0 critical, 0 high |
| `kyverno/cleanup-controller` | `67a48e62a8d8` | unsigned | 0 critical, 0 high |
| `kyverno/reports-controller` | `c0eee97b9b44` | unsigned | 0 critical, 0 high |
| `kyverno/cli` | `ced7b2be0b04` | unsigned | 0 critical, 0 high |
| `kyverno/readiness-checker` | `31bb42ce7f5b` | unsigned | 0 critical, 0 high |
| `kyverno/kubectl` | `5ed410ebac5d` | signed | 0 critical, 8 high |
| `kyverno-policies/kubectl` | `59bafa07ff3a` | unsigned | 2 critical, 49 high |
| `policy-reporter/reporter` | `a77e93fe5117` | signed | 0 critical, 2 high |
| `policy-reporter/ui` | `748d8c18851b` | unsigned | 0 critical, 0 high |
| `policy-reporter/kyverno-plugin` | `f84d330794b0` | unsigned | 0 critical, 15 high |
| `loki/loki` | `d70e4659623f` | unsigned | 0 critical, 10 high |
| `monitoring/prometheus` | `5ce7540c3c00` | unsigned | 0 critical, 6 high |
| `monitoring/alertmanager` | `690c7b525f43` | unsigned | 0 critical, 8 high |
| `monitoring/node-exporter` | `1b4e4438faca` | unsigned | 0 critical, 9 high |
| `monitoring/kube-state-metrics` | `42cfe3723a5f` | signed | 0 critical, 4 high |
| `monitoring/operator` | `e52bb28fd41c` | signed | 0 critical, 11 high |
| `monitoring/config-reloader` | `428f088fe6fe` | signed | 0 critical, 9 high |
| `monitoring/thanos` | `b567818fe608` | unsigned | 0 critical, 15 high |
| `neuvector/controller` | `ae45c394f1ac` | unsigned | 0 critical, 53 high |
| `neuvector/enforcer` | `aa2137cc90ec` | unsigned | 0 critical, 61 high |
| `neuvector/manager` | `9e729010b7eb` | unsigned | 0 critical, 11 high |
| `neuvector/scanner` | `07edf7e8d26d` | unsigned | 0 critical, 0 high |
| `neuvector/prometheus-exporter` | `c827a5f78888` | unsigned | 4 critical, 61 high |
| `neuvector/updater` | `4026b29997dc` | unsigned | 2 critical, 24 high |
| `tempo/tempo` | `ee21727732c7` | unsigned | 0 critical, 39 high |


Signature is a keyless cosign check. Unsigned means no keyless signature was found. It is not a failed release.
