## Classification Banner EnvoyFilters

The `istiod` package continues to own the legacy sidecar-scoped classification banner EnvoyFilter. That filter selects workloads with the `classification-banner.bigbang.dev/inject: "true"` pod label and reads banner settings from workload pod annotations.

Gateway-scoped classification banner configuration is now managed by the `istio-gateway` package. Configure the gateway package when the banner should apply at an ingress gateway, including ambient deployments where the sidecar-scoped EnvoyFilter does not apply to application workloads.
