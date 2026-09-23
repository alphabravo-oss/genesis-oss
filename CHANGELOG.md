# Changelog

Newest first. Tag kinds are explained in [README.md](README.md#releases): `X.Y.Z` tracks Big Bang `X.Y.Z`, `X.Y.Z+genesis.N` is a Genesis patch on it, and `console-vX.Y.Z` is the console.

## 3.33.0+genesis.1 — 2026-09-23

Genesis patch on Big Bang 3.33.0. The umbrella chart version stays `3.33.0`.

### Fixed

- **Kyverno reports controller churn.** Big Bang's `disallow-deprecated-apis` policy matched every version of busy kinds such as `Lease`, so each leader-election renewal produced an admission report. The reports controller exhausted its API budget, lost its leader lease, and restarted every ~30 minutes at several CPU cores. Every API the policy checks for was removed by Kubernetes 1.32 and Genesis requires 1.34, so it is now disabled (`kyvernoPolicies.values.policies.disallow-deprecated-apis.enabled: false`).

### Added

- A weekday workflow opens an issue when Big Bang publishes a newer release.
- Patch releases (`X.Y.Z+genesis.N`) for fixes between Big Bang releases.

### Upgrade

- Flux: set your GitRepository `spec.ref.tag` to `3.33.0+genesis.1`.
- Helm: from this tag, re-run `python3 scripts/install.py` with your usual profiles and values.

## console-v1.0.0 — 2026-09-23

First published console release: `ghcr.io/alphabravo-oss/genesis-console:1.0.0` (amd64, arm64) and `oci://ghcr.io/alphabravo-oss/charts/genesis-console` version `1.0.0`.

### Added

- **Overview:** status line, cards for package health, Flux drift, images with Critical or High findings (with scan coverage), and configuration differences; a Needs attention list; a cluster panel.
- **Packages:** comparison summary and tabs for packages, comparison settings (release and Automatic or chosen profiles), and upgrade guidance. Package detail pages compare settings side by side.
- **Images:** running-in-cluster and release-catalog views, Trivy scans, SBOM downloads, severity legend, and one rescan action for older limited scans.
- **Cluster connection:** paste or upload a named kubeconfig, test it, and save it. Stored AES-256-GCM encrypted with a key outside the database and decrypted only into a private memory-backed directory. Login plugins and certificate file paths are rejected with instructions; chart connector mode (`console.enabled=false`) and `scripts/service-account-kubeconfig.sh` cover EKS, GKE, and AKS.
- Light, dark, and system themes; command palette; CSV export.

### Comparison accuracy

- `null` equals unset, and Flux chart defaults (`version: "*"`, `reconcileStrategy: ChartVersion`) equal an unset baseline.
- A package Git source such as a mirror is shown as installation-specific and not counted as a difference.

## 3.33.0 — 2026-09-21

Genesis for Big Bang 3.33.0: the same default-on packages with anonymously pullable public images. Conformance is relaxed: pods start and the default UIs answer. No image comes from `registry1.dso.mil` or `registry.dso.mil`. Install the umbrella chart with `umbrella/values-genesis.yaml`.

## 3.32.0 — 2026-09-21

Genesis for Big Bang 3.32.0. cert-manager joins the default-on set.

## 3.31.1, 3.31.0, 3.30.0, 3.29.0, 3.28.0 — 2026-09-21

Genesis for each Big Bang release, published together as the support window. `bbctl` is in these snapshots and turned off because its image has no public reference.
