# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.20.3-bb.2] - 2026-08-13

### Changed

- Promoted cert-manager to the Big Bang integrated package track.
- Updated package documentation and umbrella integration references for the
  `product/packages/cert-manager` project location.

## [1.20.3-bb.1] - 2026-07-20

### Added

- Added optional Helm-managed self-signed and Let's Encrypt issuers with namespaced defaults, validation, ACME networking, runtime coverage, and operational documentation.

### Fixed

- Added UDP and TCP `53` controller egress for ACME host resolution and DNS-01 authoritative propagation checks.
- Require a non-empty controller egress CIDR list and bind each NetworkPolicy exception to its CIDR.
- Remove fixed certificate Secrets before and after runtime tests without deleting Helm-managed issuers.
- Pass configured self-signed issuer names and scopes to runtime tests, and require enabled self-signed issuers during upgrades.
- Preserve explicit issuer and ACME account Secret names instead of truncating them.
- Reject custom ACME URLs with invalid ServiceEntry host authorities.
- Reject Gateway API solvers without a parent reference or labels.
- Preserve complete generated issuer and account Secret names, including environment suffixes, for long release names.
- Bind runtime test RBAC to the correct ServiceAccount for custom release names.
- Clarify the safe staged lifecycle for managed issuers on fresh installations.
- Respect the common NetworkPolicy toggle for ACME controller and solver policies.
- Support numeric issuer and account Secret names, and custom release context in runtime tests.

### Changed

- Changed `issuers.letsEncrypt.networking.controllerEgress.cidrs` entries from strings to objects with `cidr` and optional `except` fields.

## [1.20.3-bb.0] - 2026-07-13

### Changed

- bb-common updated 0.15.0 -> 1.0.2
- cert-manager updated v1.20.2-> v1.20.3
- gluon updated 1.0.1 -> 1.1.1
- Updated `upstream` cert-manager defaults to align with documented best-practice Helm values.
- Enabled CRD retention with `upstream.crds.keep: true`.
- Set cert-manager workloads to `system-cluster-critical`.
- Added HA defaults: 2 replicas for controller and cainjector, 3 replicas for webhook, plus PDBs with `minAvailable: 1`.
- Disabled automatic service account token automounting and added explicit projected token mounts for controller, webhook, cainjector, and startupapicheck.

## [1.20.2-bb.8] - 2026-07-10

### Fixed

- Added Istio mTLS scrape settings to the cert-manager ServiceMonitor endpoint so Prometheus metrics targets work under STRICT mTLS

## [1.20.2-bb.7] - 2026-07-09

### Fixed

- Updated startupapicheck to use the approved Iron Bank cleanstart image and follow upstream enablement by default
- Added default kube API egress NetworkPolicy for the startupapicheck hook Job
- Updated startupapicheck cleanstart image to use the available `1.20.3-amd64` tag because the `v1.20.2` tag is not published

## [1.20.2-bb.6] - 2026-07-01

### Added

- Added a cert-manager webhook `PeerAuthentication` with port-level `PERMISSIVE` mTLS on pod port `10250` for Kubernetes API server admission webhook callbacks in ambient mesh deployments
- Added `ambient.istio.io/bypass-inbound-capture: "true"` to the cert-manager webhook pod so ambient mesh captures outbound traffic while bypassing inbound kube-apiserver webhook callbacks
- Added `traffic.sidecar.istio.io/excludeInboundPorts: "10250"` to the cert-manager webhook pod so sidecar-injected deployments can bypass inbound capture for kube-apiserver webhook callbacks
- Added ambient test values for Big Bang package testing

## [1.20.2-bb.5] - 2026-06-25

### Fixed

- Added default Prometheus ingress policy for cert-manager metrics scraping

## [1.20.2-bb.4] - 2026-06-25

### Fixed

- Added default kube-apiserver ingress policy for the cert-manager webhook

## [1.20.2-bb.3] - 2026-05-12

### Added

- Enabled cert-manager Prometheus ServiceMonitor by default (`upstream.prometheus.servicemonitor.enabled: true`) while keeping PodMonitor disabled

## [1.20.2-bb.2] - 2026-05-11

### Added

- Transitioned cert-manager package maintenance track metadata from `bb_sandbox` to `bb_maintained`
- Completed maintained-track closeout version/docs updates for cert-manager after bb-common migration merge

## [1.20.2-bb.1] - 2026-05-08

### Added

- Migrated Istio and NetworkPolicy configuration to bb-common subchart values
- Added bb-common-driven hardening values (default-deny network policies, strict mTLS, sidecar, and authorization policies)
- Aligned webhook naming and runtime tests to `cert-manager-webhook`
- Expanded helm unit test coverage for bb-common security resources and toggle behavior

## [1.20.2-bb.0] - 2026-05-04

### Added

- Update cert-manager to v1.20.2
- Update bb-common dependency to v0.15.0
- Documented maintenance workflow updates and hardened issuer smoke test script
- Updated Renovate configuration to group cert-manager, gluon, and bb-common updates into a single MR
- Documented Phase 1 maintenance scope, RBAC review guidance, image sourcing, and test workflow
- Added package overview documentation and fixed installation doc references
- Hardened issuer smoke test script for reliable cleanup and readiness validation
- Added static test runner script with helm lint/template/helm-unittest checks
- Added cert-manager negative issuer, CRD readiness, and upgrade validation scripts
- Added helm unit tests for Big Bang Istio templates
- Added Helm test hook resources using the Gluon script runner for runtime bbtests

## [1.19.3-bb.1] - 2026-02-10

### Added

- Update values to correctly match what it should be

## [1.19.3-bb.0] - 2026-02-05

### Added

- Update to 1.19.3

## [1.19.1-bb.0] - 2025-10-30

### Added

- Update to 1.19.1

## [1.19.0-bb.0] - 2025-08-15

### Added

- Update to 1.19.0

## [1.18.2-bb.0] - 2025-07-11

### Added

- fix deployment with istio in place

## [1.16.0-bb.4] - 2024-12-26

### Added

- fix deployment with istio in place

## [1.16.0-bb.3] - 2024-12-23

### Added

- fix wrapper version

## [1.16.0-bb.2] - 2024-12-23

### Added

- removed the other chart and leave only cert-manager to avoid issues
- finalized wrapper configuration

## [1.16.0-bb.1] - 2024-11-1

### Added

- fine tune and test wrapper for future integration

## [1.16.0-bb.0] - 2024-10-22

### Added

- Update cert-manager to version v1.16.0
- Updated approver policy to version v0.15.2
- Add wrapper file
- modified the acme resolver image pull

## [1.15.2-bb.4] - 2024-09-13

### Added

- resolving security context validation issues

## [1.15.2-bb.3] - 2024-09-10

### Added

- add testing of resources
- fix kyverno and istio policy deployment

## [1.15.2.2] - 2024-08-30

### Added

- add kyverno policy to cert-manager approver-policy and trust manager
- add istio policy to cert-manager approver-policy and trust manager

## [1.15.2.1] - 2024-05-29

### Added

- add approver policy
- add trust manager
- create umbrella chart

## [1.15.2] - 2024-05-28

### Added

- updated version of files to v1.15.2

## [1.15.0] - 2024-05-28

### Added

- updated version of files to v1.15.0

## [0.0.0] - 2024-05-27

### Added

- First changelog file
