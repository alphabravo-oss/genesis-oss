# Charts with no container image

Genesis `3.33.0`. These four packages do not pull an image. Every published tag of each package repo was searched. None of them added a workload image in an older tag.

| Big Bang package | Tag in 3.33.0 | What it is | Public equivalent |
|---|---|---|---|
| `istioCRDs` | `1.30.4-bb.0` | Istio CRDs. The chart vendors upstream `base`. | Istio chart `base` `1.30.4` from `https://istio-release.storage.googleapis.com/charts`. The tarball `base-1.30.4.tgz` is already in the Big Bang chart. |
| `prometheusOperatorCRDs` | `31.0.1-bb.0` | Prometheus Operator CRDs. The chart vendors upstream `prometheus-operator-crds`. | prometheus-community chart `prometheus-operator-crds` `31.0.1` (`appVersion` `v0.93.1`) from `https://prometheus-community.github.io/helm-charts`. Release tarball: `https://github.com/prometheus-community/helm-charts/releases/download/prometheus-operator-crds-31.0.1/prometheus-operator-crds-31.0.1.tgz`. |
| `gatewayAPI` | `1.6.1-bb.0` | Gateway API CRDs. The chart wraps the upstream install file. | Kubernetes SIG Gateway API `v1.6.1` publishes `standard-install.yaml`, not a Helm chart. `https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.6.1/standard-install.yaml`. The release assets are that file and `experimental-install.yaml`. |
| `wrapper` | `0.4.15` | Big Bang library chart. It renders network policies, Istio policy, ServiceMonitors, and dashboards into a package. It has no workload of its own. | None. The only source on all 25 tags is `repo1.dso.mil`. |
