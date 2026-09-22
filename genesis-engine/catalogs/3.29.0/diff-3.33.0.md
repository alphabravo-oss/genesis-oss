# 3.29.0 compared with 3.33.0

Enabled packages: 15.

- istioCRDs 1.30.2-bb.0 (3.33.0 is 1.30.4-bb.0).
- istiod 1.30.2-bb.0 (3.33.0 is 1.30.4-bb.0).
- istioGateway 1.30.2-bb.2 (3.33.0 is 1.30.4-bb.0).
- kiali 2.28.0-bb.1 (3.33.0 is 2.31.0-bb.0).
- kyverno 3.8.1-bb.5 (3.33.0 is 3.9.1-bb.0).
- kyvernoReporter 3.7.4-bb.3 (3.33.0 is 3.10.0-bb.2).
- alloy 4.2.2-bb.0 (3.33.0 is 4.3.2-bb.0).
- loki 6.55.0-bb.2 (3.33.0 is 6.55.0-bb.7).
- neuvector 2.10.3-bb.1 (3.33.0 is 2.11.1-bb.0).
- prometheusOperatorCRDs 30.0.1-bb.0 (3.33.0 is 31.0.1-bb.0).
- monitoring 87.10.1-bb.1 (3.33.0 is 88.6.2-bb.0).
- grafana 10.5.15-bb.4 (3.33.0 is 12.10.0-bb.0).
- bbctl 3.0.1-bb.3 is default-on here and off in 3.33.0.
- certManager v1.20.3-bb.2 is default-on in 3.33.0 and off here.

Images: 69. Unverified: 19.
- gap: kyvernoPolicies registry1.dso.mil/ironbank/big-bang/devops-tester:1.1 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/grafana/grafana-enterprise-logs:v3.6.5 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/ironbank/opensource/grafana/enterprise-logs-provisioner:3.6.5 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/bigbang/grafana/loki-helm-test:0.0.1 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/bigbang/grafana/loki-canary:3.7.1 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/opensource/nginx/nginx:1.30.0 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/opensource/memcached/memcached:1.6.41 (no public repo in the 3.33.0 map)
- gap: loki registry1.dso.mil/ironbank/opensource/prometheus/memcached-exporter:v0.15.3 (no public repo in the 3.33.0 map)
- gap: neuvector registry1.dso.mil/ironbank/opensource/neuvector/registry-adapter:v0.2.8 (no public repo in the 3.33.0 map)
- gap: tempo registry1.dso.mil/ironbank/opensource/grafana/tempo-query:2.10.5 (no public repo in the 3.33.0 map)
- gap: monitoring registry1.dso.mil/ironbank/opensource/bats/bats:1.13.0 (no public repo in the 3.33.0 map)
- gap: monitoring registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.8 (no public repo in the 3.33.0 map)
- gap: monitoring registry1.dso.mil/ironbank/opensource/prometheus/blackbox_exporter:v0.28.0 (no public repo in the 3.33.0 map)
- gap: monitoring registry1.dso.mil/ironbank/opensource/prometheus/snmp_exporter:v0.30.1 (no public repo in the 3.33.0 map)
- gap: grafana registry1.dso.mil/ironbank/opensource/bats/bats:1.13.0 (no public repo in the 3.33.0 map)
- gap: grafana registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal:9.8 (no public repo in the 3.33.0 map)
- gap: grafana registry1.dso.mil/ironbank/opensource/grafana/grafana-image-renderer:v5.9.1 (no public repo in the 3.33.0 map)
- gap: bbctl registry1.dso.mil/ironbank/big-bang/bbctl:2.3.1 (no public repo in the 3.33.0 map)
- gap: bbctl registry1.dso.mil/ironbank/opensource/yq/yq:4.50.1 (no public repo in the 3.33.0 map)

Turned off in the oss overlay:
- bbctl: bbctl's images are Iron Bank builds with no verified public ref. The package is left in the snapshot and turned off.
