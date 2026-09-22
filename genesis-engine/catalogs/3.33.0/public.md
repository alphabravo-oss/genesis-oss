# Public

Genesis `3.33.0`. Same order in [ironbank.md](ironbank.md), [public.md](public.md), and [other.md](other.md).

`default-on` is what the default install renders. `optional` is already in a default-on chart or subchart and is pulled only if that feature is turned on. `disabled` ships in a package that Big Bang leaves off. `auto` is metrics-server, which installs when the cluster has no metrics API.

A public reference is filled only after an anonymous manifest check. A blank cell has no verified public image yet.

| Image | Reference | When |
|---|---|---|
| `flux/helm-controller` | `ghcr.io/fluxcd/helm-controller:v1.6.4` | default-on |
| `flux/kustomize-controller` | `ghcr.io/fluxcd/kustomize-controller:v1.9.5` | default-on |
| `flux/notification-controller` | `ghcr.io/fluxcd/notification-controller:v1.9.4` | default-on |
| `flux/source-controller` | `ghcr.io/fluxcd/source-controller:v1.9.5` | default-on |
| `alloy/operator` | `ghcr.io/grafana/alloy-operator:1.11.0` | default-on |
| `alloy/alloy` | `docker.io/grafana/alloy:v1.18.0` | default-on |
| `alloy/config-reloader` | `quay.io/prometheus-operator/prometheus-config-reloader:v0.93.0` | default-on |
| `alloy/kubectl-toolbox` | `ghcr.io/grafana/helm-chart-toolbox-kubectl:0.1.6` | default-on |
| `cert-manager/controller` | `quay.io/jetstack/cert-manager-controller:v1.20.3` | default-on |
| `cert-manager/webhook` | `quay.io/jetstack/cert-manager-webhook:v1.20.3` | default-on |
| `cert-manager/cainjector` | `quay.io/jetstack/cert-manager-cainjector:v1.20.3` | default-on |
| `cert-manager/acmesolver` | `quay.io/jetstack/cert-manager-acmesolver:v1.20.3` | default-on |
| `cert-manager/startupapicheck` | `quay.io/jetstack/cert-manager-startupapicheck:v1.20.3` | default-on |
| `grafana/grafana` | `docker.io/grafana/grafana:13.1.0` | default-on |
| `grafana/k8s-sidecar` | `quay.io/kiwigrid/k8s-sidecar:2.10.1` | default-on |
| `istio/pilot` | `docker.io/istio/pilot:1.30.4` | default-on |
| `istio/proxyv2` | `docker.io/istio/proxyv2:1.30.4` | default-on |
| `istio/busybox-example` | `docker.io/library/busybox:1.28` | default-on |
| `istio-gateway/kubectl` | `registry.k8s.io/kubectl:v1.35.0` | default-on |
| `kiali/operator` | `quay.io/kiali/kiali-operator:v2.31.0` | default-on |
| `kiali/kiali` | `quay.io/kiali/kiali:v2.31.0` | default-on |
| `kiali/kubectl` | `registry.k8s.io/kubectl:v1.35.8` | default-on |
| `kyverno/kyverno` | `ghcr.io/kyverno/kyverno:v1.19.1` | default-on |
| `kyverno/pre` | `ghcr.io/kyverno/kyvernopre:v1.19.1` | default-on |
| `kyverno/background-controller` | `ghcr.io/kyverno/background-controller:v1.19.1` | default-on |
| `kyverno/cleanup-controller` | `ghcr.io/kyverno/cleanup-controller:v1.19.1` | default-on |
| `kyverno/reports-controller` | `ghcr.io/kyverno/reports-controller:v1.19.1` | default-on |
| `kyverno/cli` | `ghcr.io/kyverno/kyverno-cli:v1.19.1` | default-on |
| `kyverno/readiness-checker` | `ghcr.io/kyverno/readiness-checker:v1.19.1` | default-on |
| `kyverno/kubectl` | `registry.k8s.io/kubectl:v1.37.0` | default-on |
| `kyverno-policies/kubectl` | `registry.k8s.io/kubectl:v1.34.1` | default-on |
| `policy-reporter/reporter` | `ghcr.io/kyverno/policy-reporter:3.10.0` | default-on |
| `policy-reporter/ui` | `ghcr.io/kyverno/policy-reporter-ui:2.8.1` | default-on |
| `policy-reporter/kyverno-plugin` | `ghcr.io/kyverno/policy-reporter/kyverno-plugin:0.6.2` | default-on |
| `loki/loki` | `docker.io/grafana/loki:3.7.7` | default-on |
| `monitoring/prometheus` | `quay.io/prometheus/prometheus:v3.14.0` | default-on |
| `monitoring/alertmanager` | `quay.io/prometheus/alertmanager:v0.34.0` | default-on |
| `monitoring/node-exporter` | `quay.io/prometheus/node-exporter:v1.12.1` | default-on |
| `monitoring/kube-state-metrics` | `registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.20.0` | default-on |
| `monitoring/operator` | `quay.io/prometheus-operator/prometheus-operator:v0.93.1` | default-on |
| `monitoring/config-reloader` | `quay.io/prometheus-operator/prometheus-config-reloader:v0.93.1` | default-on |
| `monitoring/thanos` | `quay.io/thanos/thanos:v0.42.4` | default-on |
| `neuvector/controller` | `docker.io/neuvector/controller:5.6.1` | default-on |
| `neuvector/enforcer` | `docker.io/neuvector/enforcer:5.6.1` | default-on |
| `neuvector/manager` | `docker.io/neuvector/manager:5.6.1` | default-on |
| `neuvector/scanner` | `docker.io/neuvector/scanner:6` | default-on |
| `neuvector/prometheus-exporter` | `docker.io/neuvector/prometheus-exporter:1-1.0.0` | default-on |
| `neuvector/updater` | `docker.io/curlimages/curl:8.15.0` | default-on |
| `tempo/tempo` | `docker.io/grafana/tempo:2.10.5` | default-on |
| `gitlab/certificates:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/certificates:v19.3.2-ubi` | disabled |
| `gitlab/cfssl-self-sign:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/cfssl-self-sign:v19.3.2-ubi` | disabled |
| `gitlab/gitaly-init-cgroups:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitaly-init-cgroups:v19.3.2-ubi` | disabled |
| `gitlab/gitaly:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitaly:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-base:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-base:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-container-registry:v4.40.2-gitlab-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-container-registry:v4.40.2-gitlab-ubi` | disabled |
| `gitlab/gitlab-exporter:16.9.0-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-exporter:16.9.0-ubi` | disabled |
| `gitlab/gitlab-geo-logcursor:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-geo-logcursor:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-kas:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-kas:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-mailroom:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-mailroom:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-openbao:v2.5.5-gitlab2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-openbao:v2.5.5-gitlab2-ubi` | disabled |
| `gitlab/gitlab-pages:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-pages:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-shell:v14.56.1-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-shell:v14.56.1-ubi` | disabled |
| `gitlab/gitlab-sidekiq-ee:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-sidekiq-ee:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-toolbox-ee:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-toolbox-ee:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-webservice-ee:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-webservice-ee:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-workhorse-ee:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-workhorse-ee:v19.3.2-ubi` | disabled |
| `gitlab/gitlab-zoekt:v19.2.1-ubi` | `registry.gitlab.com/gitlab-org/build/cng/gitlab-zoekt:v19.2.1-ubi` | disabled |
| `gitlab/kubectl:v19.3.2-ubi` | `registry.gitlab.com/gitlab-org/build/cng/kubectl:v19.3.2-ubi` | disabled |
| `gitlabRunner/gitlab-runner-helper:ubi-fips-x86_64-v19.2.2` | `registry.gitlab.com/gitlab-org/gitlab-runner/gitlab-runner-helper:x86_64-v19.2.2` | disabled |
| `gitlabRunner/gitlab-runner:ubi-fips-v19.2.2` | `registry.gitlab.com/gitlab-org/gitlab-runner:v19.2.2` | disabled |
| `gitlab/model-gateway:self-hosted-v19.2.0-ee` | `registry.gitlab.com/gitlab-org/modelops/applied-ml/code-suggestions/ai-assist/model-gateway:self-hosted-v19.2.0-ee` | disabled |
| `gitlab/busybox:1.37.0` | `docker.io/library/busybox:1.37.0` | disabled |
| `fortify/mysqld_exporter:0.18.0` | `quay.io/prometheus/mysqld-exporter:v0.18.0` | disabled |
| `anchoreEnterprise/cli:0.9.4` |  | disabled |
| `anchoreEnterprise/enterprise:6.1.1` |  | disabled |
| `anchoreEnterprise/enterpriseui:6.1.0` |  | disabled |
| `argocd/argocd:v3.4.5` | `quay.io/argoproj/argocd:v3.4.5` | disabled |
| `kyvernoPolicies/cypress:15.13.1` | `docker.io/cypress/included:15.13.1` | optional |
| `certManager/cypress:15.16.0` | `docker.io/cypress/included:15.16.0` | optional |
| `mattermost/cypress:15.17.0` | `docker.io/cypress/included:15.17.0` | disabled |
| `alloy/cypress:15.18.1` | `docker.io/cypress/included:15.18.1` | optional |
| `anchoreEnterprise/cypress:15.20.0` | `docker.io/cypress/included:15.20.0` | disabled |
| `grafana/cypress:15.20.1` | `docker.io/cypress/included:15.20.1` | optional |
| `fortify/cypress:15.21.0` | `docker.io/cypress/included:15.21.0` | disabled |
| `kyverno/cypress:15.21.1` | `docker.io/cypress/included:15.21.1` | optional |
| `loki/cypress:15.5.0` | `docker.io/cypress/included:15.5.0` | optional |
| `gitlab/cypress:16.0.0` | `docker.io/cypress/included:16.0.0` | disabled |
| `loki/devops-tester:1.0` |  | optional |
| `kyvernoPolicies/devops-tester:1.1` |  | optional |
| `argocd/devops-tester:1.2` |  | disabled |
| `gitlab/devops-tester:1.3` |  | disabled |
| `loki/loki-canary:3.7.7` |  | optional |
| `loki/loki-helm-test:0.0.1` |  | optional |
| `anchoreEnterprise/redis-exporter:v1.86.0` | `docker.io/oliver006/redis_exporter:v1.86.0` | disabled |
| `argocd/redis-exporter:v1.88.0` | `docker.io/oliver006/redis_exporter:v1.88.0` | disabled |
| `anchoreEnterprise/redis-exporter:v1.89.0` | `docker.io/oliver006/redis_exporter:v1.89.0` | disabled |
| `renovate/renovate:44.43.1` | `ghcr.io/renovatebot/renovate:44.43.1` | disabled |
| `eckOperator/eck-operator:3.5.0` | `docker.io/elastic/eck-operator:3.5.0` | disabled |
| `elasticsearchKibana/elasticsearch:9.5.3` | `docker.io/elastic/elasticsearch:9.5.3` | disabled |
| `elasticsearchKibana/kibana:9.5.3` | `docker.io/elastic/kibana:9.5.3` | disabled |
| `loki/grafana-enterprise-logs:v3.6.13` |  | optional |
| `vault/vault-csi-provider:v1.7.4` | `docker.io/hashicorp/vault-csi-provider:v1.7.4` | disabled |
| `vault/vault-k8s:v1.7.6` | `docker.io/hashicorp/vault-k8s:v1.7.6` | disabled |
| `vault/vault:1.21.4` | `docker.io/hashicorp/vault:1.21.4` | disabled |
| `loki/enterprise-logs-provisioner:3.6.13` |  | optional |
| `authservice/authservice:1.1.8` |  | disabled |
| `monitoring/k8s-sidecar:2.10.3` | `quay.io/kiwigrid/k8s-sidecar:2.10.3` | optional |
| `loki/k8s-sidecar:2.11.1` | `quay.io/kiwigrid/k8s-sidecar:2.11.1` | optional |
| `fortify/ssc:26.2.2.0004` |  | disabled |
| `mimir/kafka-native:4.3.1` |  | disabled |
| `grafana/bats:1.14.0` |  | optional |
| `argocd/dex:v2.45.1` | `ghcr.io/dexidp/dex:v2.45.1` | disabled |
| `elasticsearchKibana/elasticsearch-exporter:v1.11.0` |  | disabled |
| `externalSecrets/external-secrets:v2.10.0` |  | disabled |
| `fluentbit/fluent-bit:v5.1.2` |  | disabled |
| `renovate/gitea:1.27.3` |  | disabled |
| `harbor/harbor-core:v2.15.2` |  | disabled |
| `harbor/harbor-exporter:v2.15.2` |  | disabled |
| `harbor/harbor-jobservice:v2.15.2` |  | disabled |
| `harbor/harbor-portal:v2.15.2` |  | disabled |
| `harbor/harbor-registryctl:v2.15.2` |  | disabled |
| `harbor/registry:v2.15.2` |  | disabled |
| `harbor/trivy-adapter:v2.15.2` |  | disabled |
| `mimir/enterprise-metrics:v2.17.15` |  | disabled |
| `grafana/grafana-image-renderer:v5.12.1` |  | optional |
| `mimir/mimir:3.1.2` |  | disabled |
| `mimir/rollout-operator:v0.38.0` |  | disabled |
| `loki/rollout-operator:v0.39.0` |  | optional |
| `tempo/tempo-query:2.10.5` |  | optional |
| `headlamp/headlamp:v0.45.0` |  | disabled |
| `istioCNI/install-cni:1.30.4` |  | disabled |
| `ztunnel/ztunnel:1.30.4` |  | disabled |
| `fluentbit/configmap-reload:v0.15.0` |  | disabled |
| `keycloak/keycloak:26.7.2` | `quay.io/keycloak/keycloak:26.7.2` | disabled |
| `metricsServer/metrics-server:v0.9.0` |  | auto |
| `vault/kubectl:v1.30.11` |  | disabled |
| `vault/kubectl:v1.32.5` |  | disabled |
| `loki/kubectl:v1.33` |  | optional |
| `elasticsearchKibana/kubectl:v1.36` |  | disabled |
| `loki/kubectl:v1.36.4` |  | optional |
| `mattermostOperator/mattermost-operator:v1.25.9` |  | disabled |
| `mattermost/mattermost:11.10.1` |  | disabled |
| `mimir/memcached:1.6.43` |  | disabled |
| `loki/memcached:1.6.45` |  | optional |
| `vault/mc:RELEASE.2025-04-16T18-13-26Z` |  | disabled |
| `loki/mc:RELEASE.2025-08-13T08-35-41Z` |  | optional |
| `vault/minio:RELEASE.2025-05-24T17-08-30Z` | `quay.io/minio/minio:RELEASE.2025-05-24T17-08-30Z` | disabled |
| `loki/minio:RELEASE.2025-10-15T17-29-55Z` |  | optional |
| `vault/operator-sidecar:v7.0.1` |  | disabled |
| `loki/operator-sidecar:v7.1.0` |  | optional |
| `minioOperator/operator:v7.1.1` |  | disabled |
| `fortify/mysql8:8.4.11` |  | disabled |
| `neuvector/registry-adapter:v0.2.10` |  | optional |
| `mimir/nginx:1.30.3` |  | disabled |
| `loki/nginx:1.31.4` |  | optional |
| `gitlab/nginx:1.31.5` |  | disabled |
| `gatekeeper/gatekeeper:v3.23.1` |  | disabled |
| `keycloak/postgresql:18.4` | `docker.io/library/postgres:18.4` | disabled |
| `harbor/postgresql:18.6` |  | disabled |
| `monitoring/blackbox_exporter:v0.28.0` |  | optional |
| `sonarqube/jmx-exporter:1.6.0` |  | disabled |
| `loki/memcached-exporter:v0.16.0` |  | optional |
| `monitoring/snmp_exporter:v0.30.1` |  | optional |
| `anchoreEnterprise/redis8-slim:8.10.0` |  | disabled |
| `authservice/redis8-slim:8.10.1` |  | disabled |
| `argocd/redis8-slim:8.8.0` | `docker.io/library/redis:8.8.0` | disabled |
| `thanos/thanos:v0.42.2` |  | disabled |
| `velero/velero-plugin-for-aws:v1.14.2` |  | disabled |
| `velero/velero-plugin-for-csi:v0.7.1` |  | disabled |
| `velero/velero-plugin-for-microsoft-azure:v1.14.2` |  | disabled |
| `velero/velero:v1.18.2` |  | disabled |
| `grafana/ubi9-minimal:9.8` |  | optional |
| `fortify/ubi9:9.8` |  | disabled |
| `sonarqube/sonarqube-community-build:26.8.0.126808-community` |  | disabled |
| `twistlock/console:34.05.157` |  | disabled |
| `twistlock/defender:34.05.157` |  | disabled |
