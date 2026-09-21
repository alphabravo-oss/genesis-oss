# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---
## [3.3.4-bb.65] (2026-05-06)

### Fixed

- Fixed `update-automountserviceaccounttokens` rendering so namespace-wide ServiceAccount hardening omits `resources.names` instead of rendering `names: null`, preserving wildcard matching under server-side apply.

## [3.3.4-bb.64] (2026-04-30)

### Changed

- Updated `require-istio-on-namespaces` policy to support Istio ambient mode (`istio.io/dataplane-mode: ambient`)

## [3.3.4-bb.63] (2026-04-29)

### Added

- CEL-based ValidatingPolicy: `disallow-namespaces-cel`, gated behind `celPoliciesBeta.disallow-namespaces-cel.enabled` (disabled by default). Rejects pods and pod controllers (Deployment, ReplicaSet, DaemonSet, StatefulSet, Job, CronJob) whose namespace appears in `parameters.disallow` (defaults to `[default]`). Mirrors the legacy `disallow-namespaces` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.62] (2026-04-28)

### Changed

- gluon 0.9.7 -> 1.0.1

## [3.3.4-bb.61] (2026-04-28)

### Added

- CEL-based ValidatingPolicy: `disallow-labels-cel`, gated behind `celPoliciesBeta.disallow-labels-cel.enabled` (disabled by default). Rejects pods that carry labels matching entries in `parameters.disallow`. Each entry has a `key` (RE2 regex) and an optional `value` (RE2 regex). If `value` is omitted, any pod with a matching key is rejected regardless of value. Mirrors the legacy `disallow-labels` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).


## [3.3.4-bb.60] (2026-04-27)

### Changed

- Split package tests into two CI lanes. `tests/test-values.yaml` now runs only the legacy ClusterPolicy-era tests, while `tests/test-cel-values.yaml` runs only the CEL-era `kyverno test` and `chainsaw` coverage. Also hardened the CEL test helper cleanup path for empty saved-state arrays under Bash `nounset`.

## [3.3.4-bb.59] (2026-04-27)

### Added

- CEL-based ValidatingPolicy: `disallow-image-tags-cel`, gated behind `celPoliciesBeta.disallow-image-tags-cel.enabled` (disabled by default). Validates that every container image carries a tag and that the tag is not in `parameters.disallow` (defaults to `[latest]`). Mirrors the legacy `disallow-image-tags` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.58] (2026-04-24)

### Added

- CEL-based ValidatingPolicy: `disallow-auto-mount-service-account-token-cel`, gated behind `celPoliciesBeta.disallow-auto-mount-service-account-token-cel.enabled` (disabled by default). Renders two ValidatingPolicies. One validates that Pods either omit `spec.automountServiceAccountToken` or set it to `false`. The other validates that ServiceAccounts set `automountServiceAccountToken: false` explicitly. Mirrors the legacy `disallow-auto-mount-service-account-token` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.57] (2026-04-24)

### Added

- CEL-based ValidatingPolicy: `disallow-istio-injection-bypass-cel`, gated behind `celPoliciesBeta.disallow-istio-injection-bypass-cel.enabled` (disabled by default). Validates that Pods do not set the `sidecar.istio.io/inject` label or annotation to `false`. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.56] (2026-04-23)

### Added

- CEL-based ValidatingPolicy: `disallow-annotations-cel`, gated behind `celPoliciesBeta.disallow-annotations-cel.enabled` (disabled by default). Rejects pods with annotations matching entries in `parameters.disallow`. Each entry has a `key` (RE2 regex) and an optional `value` (RE2 regex). If `value` is omitted, any pod with a matching key is rejected regardless of value. Mirrors the legacy `disallow-annotations` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.55] (2026-04-23)

### Added

- CEL-based ValidatingPolicy: `disallow-deprecated-apis-cel`, gated behind `celPoliciesBeta.disallow-deprecated-apis-cel.enabled` (disabled by default). Validates against hardcoded lists of deprecated Kubernetes API GVKs. Mirrors the legacy `disallow-deprecated-apis` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.54] (2026-04-22)

### Added

- CEL-based ValidatingPolicy: `require-istio-on-namespaces-cel`, gated behind `celPoliciesBeta.require-istio-on-namespaces-cel.enabled` (disabled by default). Validates that Namespace resources set `metadata.labels.istio-injection: enabled`. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.53] (2026-04-22)

### Added

- CEL-based ValidatingPolicy: `restrict-volume-types-cel`, gated behind `celPoliciesBeta.restrict-volume-types-cel.enabled` (disabled by default). Validates that every entry in `spec.volumes[*]` uses one of the volume-type fields listed in `parameters.allow`; pods without volumes pass. Defaults to the eight PSS Restricted volume types used by the legacy `restrict-volume-types` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.52] (2026-04-21)

### Added

- CEL-based ValidatingPolicy: `restrict-sysctls-cel`, gated behind `celPoliciesBeta.restrict-sysctls-cel.enabled` (disabled by default). Validates `spec.securityContext.sysctls[*].name` against `parameters.allow` using RE2 regexes (auto-anchored with `^` and `$`, so plain strings with escaped dots are exact matches); pods without sysctls pass. Defaults to the ten PSS Baseline sysctl names used by the legacy `restrict-sysctls` ClusterPolicy, with dots pre-escaped so each entry matches literally. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.51] (2026-04-21)

### Added

- CEL-based ValidatingPolicy: `restrict-seccomp-cel`, gated behind `celPoliciesBeta.restrict-seccomp-cel.enabled` (disabled by default). Validates `seccompProfile.type` at both pod and container (including init and ephemeral) levels. Each enum value has its own toggle under `parameters` (`localhost: true`, `runtimeDefault: true`, `unconfined: false`), defaulting to the same behavior as the legacy `restrict-seccomp` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.50] (2026-04-20)

### Added

- CEL-based ValidatingPolicy: `restrict-external-names-cel`, gated behind `celPoliciesBeta.restrict-external-names-cel.enabled` (disabled by default). Validates Service `ExternalName` usage against `parameters.allow` using RE2 regexes (auto-anchored with `^` and `$`, so plain strings are exact matches); when the allow-list is empty, all `ExternalName` Services are denied. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.49] (2026-04-20)

### Added

- CEL-based ValidatingPolicy: `restrict-proc-mount-cel`, gated behind `celPoliciesBeta.restrict-proc-mount-cel.enabled` (disabled by default). Validates that every container, initContainer, and ephemeralContainer with `securityContext.procMount` set uses an allowed value. Containers that omit `procMount` pass. Each enum value has its own toggle under `parameters` (`default: true`, `unmasked: false`), defaulting to the same behavior as the legacy `restrict-proc-mount` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.48] (2026-04-20)

### Changed

- Parallelized the `MutatingPolicy` chainsaw tests.
- Added `.Values.bbtests.legacyEnabled` and `.Values.bbtests.kyvernoCliEnabled` toggles to assist with dev workflows.

## [3.3.4-bb.47] (2026-04-17)

### Added

- CEL-based MutatingPolicy set: `update-automountserviceaccounttokens-cel`, gated behind `celPoliciesBeta.update-automountserviceaccounttokens-cel.enabled` (disabled by default). Renders one ServiceAccount MutatingPolicy and one Pod MutatingPolicy with autogen for `Deployment` and `StatefulSet`, so `automountServiceAccountToken` defaults to `false` across the supported resource kinds while preserving explicit allowlists. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.46] (2026-04-17)

### Added

- Added `.values.bbtests.chainsawEnabled` flag to allow disabling of chainsaw tests during the policy migration period.

## [3.3.4-bb.45] (2026-04-16)

### Added

- CEL-based ValidatingPolicy: `restrict-image-registries-cel`, gated behind `celPoliciesBeta.restrict-image-registries-cel.enabled` (disabled by default). Validates that every container, initContainer, and ephemeralContainer image comes from a registry in `parameters.allow`. Template fails if enabled with an empty allow list. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.44] (2026-04-16)

### Added

- CEL-based ValidatingPolicy: `restrict-external-ips-cel`, gated behind `celPoliciesBeta.restrict-external-ips-cel.enabled` (disabled by default). Validates Service `spec.externalIPs` against an allow-list using RE2 regexes (auto-anchored with `^` and `$` so plain strings are exact matches). Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.43] (2026-04-15)

### Added

- CEL-based ValidatingPolicy: `require-ro-rootfs-cel`, gated behind `celPoliciesBeta.require-ro-rootfs-cel.enabled` (disabled by default). Validates that all containers (including initContainers and ephemeralContainers) set `securityContext.readOnlyRootFilesystem: true`. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.42] (2026-04-15)

### Added

- Various stability improvements in the chainsaw tests.

## [3.3.4-bb.41] (2026-04-09)

### Added

- CEL-based ValidatingPolicy: `require-probes-cel`, gated behind `celPoliciesBeta.require-probes-cel.enabled` (disabled by default). Validates that all containers define the required probes (readinessProbe, livenessProbe by default) with `periodSeconds > 0`. Configurable via `parameters.require`. Only checks `spec.containers` (init and ephemeral containers are exempt). Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.40] (2026-04-08)

### Added

- CEL-based ValidatingPolicy: `require-non-root-user-cel`, gated behind `celPoliciesBeta.require-non-root-user-cel.enabled` (disabled by default). Validates that all containers either set `runAsNonRoot: true` or `runAsUser > 0`. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.39] (2026-04-08)

### Added

- CEL-based MutatingPolicy: `add-default-capability-drop-cel`, gated behind `celPoliciesBeta.add-default-capability-drop-cel.enabled` (disabled by default). Mutates Pods so containers, initContainers, and ephemeralContainers drop `ALL` capabilities by default. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

### Changed

- Split `06_test-cel-chainsaw.sh` into two live phases: VPol/GPol first with MPols temporarily quieted, then MPol chainsaw after restore. This prevents mutating policies from "fixing" resources that VPol live suites expect to deny.

## [3.3.4-bb.38] (2026-04-08)

### Added

- CEL-based ValidatingPolicy: `require-non-root-group-cel`, gated behind `celPoliciesBeta.require-non-root-group-cel.enabled` (disabled by default). Validates that all containers run with non-root group IDs (runAsGroup > 0, fsGroup > 0, supplementalGroups > 0). Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.37] (2026-04-07)

### Added

- CEL-based GeneratingPolicy: `clone-configs-cel`, gated behind `celPoliciesBeta.clone-configs-cel.enabled` (disabled by default). Clones ConfigMaps and Secrets into new namespaces via `resource.Get()` + `generator.Apply()`. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.36] (2026-04-07)

### Changed

- Removed brittle live negative controller assertions from Pod-matching CEL Chainsaw suites where `kyverno test` already covered the same controller or autogen failure offline.
- Tightened `docs/testing.md` guidance so Chainsaw stays focused on clean live admission signals and runtime side effects.

## [3.3.4-bb.35] (2026-04-07)

### Added

- CEL-based ValidatingPolicy: `require-labels-cel`, gated behind `celPoliciesBeta.require-labels-cel.enabled` (disabled by default). Validates that required labels are present on Pods. Configurable via `parameters.require` - a list of `{key, value?}` objects where `key` and `value` are RE2 regexes (auto-anchored with `^` and `$` so plain strings are exact matches). If `value` is omitted, any non-empty value is accepted. Template fails if enabled with an empty require list. Replaces the CPol's glob wildcards with full regex support. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.34] (2026-04-06)

### Added

- CEL-based ValidatingPolicy: `require-drop-all-capabilities-cel`, gated behind `celPoliciesBeta.require-drop-all-capabilities-cel.enabled` (disabled by default). Validates that all containers explicitly drop ALL Linux capabilities. Direct port of the existing `require-drop-all-capabilities` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.33] (2026-04-06)

### Added

- CEL-based ValidatingPolicy: `require-annotations-cel`, gated behind `celPoliciesBeta.require-annotations-cel.enabled` (disabled by default). Validates that required annotations are present on Pods. Configurable via `parameters.require` - a list of `{key, value?}` objects where `key` and `value` are RE2 regexes (auto-anchored with `^` and `$` so plain strings are exact matches). If `value` is omitted, any non-empty value is accepted. Template fails if enabled with an empty require list. Replaces the CPol's glob wildcards with full regex support. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.32] (2026-04-06)

### Fixed

- Fixed VPol state not being restored after chainsaw tests, causing subsequent test runs to fail with skipped kyverno CLI evaluations and CPol test rejections.

## [3.3.4-bb.31] (2026-04-03)

### Added

- CEL-based MutatingPolicy: `add-default-securitycontext-cel`, gated behind `celPoliciesBeta.add-default-securitycontext-cel.enabled` (disabled by default). Sets `runAsNonRoot`, `runAsUser`, `runAsGroup`, and `fsGroup` on pod securityContext when absent. First MutatingPolicy migration. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

### Changed

- Renamed four shared `bb-kyverno-policies.vpol-*` helpers to `cel-*` (`webhookTimeoutSeconds`, `autogenControllers`, `excludeNamespaces`, `background`). VPol-specific helpers keep the `vpol-` prefix.
- Added `mpol-failurePolicy` helper (GPol has no `failurePolicy` field).

## [3.3.4-bb.30] (2026-04-02)

### Added

- CEL-based ValidatingPolicy: `disallow-selinux-options-cel`, gated behind `celPoliciesBeta.disallow-selinux-options-cel.enabled` (disabled by default). Validates that disallowed SELinux options (`user`, `role` by default) are not set on pods or containers. Configurable via `parameters.disallow`. Template fails if enabled with an empty disallow list. Direct port of the existing `disallow-selinux-options` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).
## [3.3.4-bb.29] (2026-04-02)

### Added

- CEL-based ValidatingPolicy: `disallow-host-namespaces-cel`, gated behind `celPoliciesBeta.disallow-host-namespaces-cel.enabled` (disabled by default). Validates that Pods do not use host namespaces (`hostPID`, `hostIPC`, `hostNetwork`). Direct port of the existing `disallow-host-namespaces` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).
## [3.3.4-bb.28] (2026-04-02)

### Added

- CEL-based ValidatingPolicy: `disallow-nodeport-services-cel`, gated behind `celPoliciesBeta.disallow-nodeport-services-cel.enabled` (disabled by default). Validates that Services do not use the `NodePort` type. Direct port of the existing `disallow-nodeport-services` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.27] (2026-04-01)

### Added

- CEL-based ValidatingPolicy: `block-ephemeral-containers-cel`, gated behind `celPoliciesBeta.block-ephemeral-containers-cel.enabled` (disabled by default). Blocks the use of ephemeral (debug) containers on Pods. Direct port of the existing `block-ephemeral-containers` ClusterPolicy. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.26] (2026-03-30)

### Added

- CEL-based ValidatingPolicy: `disallow-privilege-escalation-cel`, gated behind `celPoliciesBeta.disallow-privilege-escalation-cel.enabled` (disabled by default). Validates that all containers set `securityContext.allowPrivilegeEscalation` to `false`. No chainsaw integration test — the admission pattern (boolean securityContext field) is already covered by `disallow-privileged-containers-cel`. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

### Changed

- Removed duplicate gluon `.base` includes in `gluon.yaml` that rendered test resources twice. Helm silently dropped the duplicate NetworkPolicy hook, blocking the test pod's API server egress on local clusters.
- Replaced fragile `documentIndex` with `documentSelector` in `cpol-actions-env_test.yaml`.
- Added `ephemeralContainers` test coverage to `disallow-privileged-containers-cel` kyverno CLI tests.
- Added chainsaw test coverage guidance and shared-vs-policy test siting to `docs/testing.md`.

## [3.3.4-bb.25] (2026-03-26)

### Added

- CEL-based ValidatingPolicy: `require-memory-limit-cel`, gated behind `celPoliciesBeta.require-memory-limit-cel.enabled` (disabled by default). Validates that all containers define memory limits. Optional `maxMemory` parameter adds an upper-bound check via CEL `quantity()`. The CPol `parameters.require` JMESPath range-check syntax is not supported; `maxMemory` covers the common upper-bound case. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.24] (2026-03-26)

### Changed

- Changed the default `enabled` and `validatingFailureAction` values for the `disallow-image-tags`, `disallow-namespaces`, `disallow-nodeport-services`, `require-image-signature`, `restrict-host-path-mount`, `restrict-host-path-mount-pv`, `restrict-host-path-write`, and `restrict-image-registries` to match those specified in the bigbang umbrella chart.

## [3.3.4-bb.23] (2026-03-23)

### Added

- CEL-based ValidatingPolicy: `require-cpu-limit-cel`, gated behind `celPoliciesBeta.require-cpu-limit-cel.enabled` (disabled by default). Validates that all containers define CPU limits. Optional `maxCPU` parameter adds an upper-bound check via CEL `quantity()`. The CPol `parameters.require` JMESPath range-check syntax is not supported; `maxCPU` covers the common upper-bound case. Part of [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578).

## [3.3.4-bb.22] (2026-03-20)

### Changed

- Made changes to  `addtionalPolicyExceptions.yaml` template to simplifying passing exceptions from umbrella bigbang chart.

## [3.3.4-bb.21] (2026-03-16)

### Changed

- Renamed VPol to `disallow-privileged-containers-cel` so it can coexist with the CPol of the same name
- Added gluon bbtest scripts for VPols: `kyverno test` (offline CEL) and `chainsaw test` (live admission)
- Added `docs/dev-overrides.yaml` for local helm installs without the BB umbrella
- Test image changed from `kubectl:v1.34` to `devops-tester:1.1` (adds `kyverno`, `chainsaw`, `jq`)
- Renamed `ENABLED_POLICIES` env var to `ENABLED_CPOLS`, added `CPOL_ACTIONS`

## [3.3.4-bb.20] (2026-03-12)

### Added

- First CEL-based ValidatingPolicy (VPol): `disallow-privileged-containers`, gated behind `celPoliciesBeta.disallow-privileged-containers.enabled` (disabled by default). No VPol is rendered unless you explicitly opt in. To enable: set `celPoliciesBeta.disallow-privileged-containers.enabled: true` in your values. This is the first of ~50 planned ClusterPolicy-to-CEL migrations tracked in [Epic 578](https://repo1.dso.mil/groups/big-bang/-/epics/578). The `celPoliciesBeta` values key signals that this schema may change before GA.

## [3.3.4-bb.19] (2026-01-22)

### Changed

- Updated ubi9-minimal from 9.6 to 9.7

## [3.3.4-bb.18] (2026-01-21)

### Fixed

- Fix bug in update-image-registry mutating policy so that the pods with multiple container images are not mangled.

## [3.3.4-bb.17] (2026-01-07)

### Fixed

- kubectl updated from v1.33.5 to v1.34
- gluon updated from 0.9.5 to 0.9.7

## [3.3.4-bb.16] (2025-10-23)

### Fixed

- Updated URL references in comments of values.yaml
- Updated URL references in ServiceAccountTokenHardening.md
- Updated URL reference in exceptions.md

## [3.3.4-bb.15] (2025-10-14)

### Fixed

- Removed image reference for waitjob in values.yaml
- kubectl updated from v1.33.4 to v1.33.5
- gluon updated from 0.9.0 to 0.9.5

## [3.3.4-bb.14] (2025-08-20)

### Fixed

- Fix restrict-capabilities policy to allow for multiple allowed capabilities

## [3.3.4-bb.13] (2025-09-10)

### Changed

- gluon updated from 0.8.4 to 0.9.0
- kubectl updated from v1.32.8 to v1.33.4

## [3.3.4-bb.12] (2025-08-20)

### Changed

- gluon updated from 0.6.2 to 0.7.0
- kubectl updated from v1.32.5 to v1.32.8
- updated sha256 for ubi9-minimal image

## [3.3.4-bb.11] (2025-08-14)

### Changed

- adding disallow-deprecated-apis policy

## [3.3.4-bb.10] (2025-05-22)

### Changed

- kubectl updated from 1.32.3 to 1.32.5
- ubi9-minimal from 9.5 to 9.6
- updated gluon from 0.5.19 to 0.6.2

## [3.3.4-bb.9] - 2025-05-14

### Changed

- Removed waitforready job
- Updated gluon from 0.5.15 -> 0.5.19

## [3.3.4-bb.8] - 2025-04-11

### Changed

- Update Gatekeeper migration doc

## [3.3.4-bb.7] - 2025-04-04

### Changed

- Fix Gatekeeper migration docs that is inaccurate
- Updated Gluon from 0.5.14 -> 0.5.15
- Updated registry1.dso.mil/ironbank/opensource/kubernetes/kubectl from v1.30.10 -> v1.32.3

## [3.3.4-bb.6] - 2025-03-17

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.30.6 to v1.30.11
- ironbank/redhat/ubi/ubi9-minimal updated from 9.4 to 9.5

## [3.3.4-bb.5] - 2025-02-12

### Changed

- Fixed the default registry url to prevent subdomains from being used
- update gluon dependency chart -> v0.5.14

## [3.3.4-bb.4] - 2025-02-10

### Changed

- Edited `additionalPolicyExceptions` to be in kyverno-policies namespace.

## [3.3.4-bb.3] - 2025-01-21

### Changed

- Added `add-default-capability-drop` policy

## [3.3.4-bb.2] - 2024-12-15

### Changed

- Added `additionalPolicyExceptions` to values.yaml
- Added `additional-PolicyExceptions.yaml`

## [3.3.4-bb.1] - 2024-12-12

### Changed

- Added `add-a-default-securitycontext` policy and `test-defaultsecuritycontext.sh`

## [3.3.4-bb.0] - 2024-12-10

### Changed

- Updated chart from `kyverno-chart-3.2.6` to `kyverno-chart-3.3.4` and app version from `v1.12.6` to `v1.13.2`

## [3.2.6-bb.3] - 2024-12-03

### Changed

- Updated `require-labels` test manifest

## [3.2.6-bb.1] - 2024-10-23

### Changed

- Added `block-ephemeral-containers` policy and `test-ephemeral.sh` as test
- Added the maintenance track annotation and badge

## [3.2.6-bb.0] - 2024-10-09

### Changed

- `ironbank/opensource/kubernetes/kubectl` updated from `v1.29.7` to `v1.30.5`
- updated chart from `kyverno-chart-3.2.5` to `kyverno-chart-3.2.6` and app version from `v1.12.5` to `v1.12.6`
- updated `ironbank/opensource/kubernetes/kubectl` updated from `v1.29.7` to `v1.30.5`

## [3.2.5-bb.7] - 2024-09-16

### Changed

- add wait job
- update gluon from 0.5.3 to 0.5.4

## [3.2.5-bb.6] - 2024-09-09

### Changed

- update ironbank public container signing key

## [3.2.5-bb.5] - 2024-09-09

### Changed

- set generateExisting to false

## [3.2.5-bb.4] - 2024-08-20

### Changed

- Added GenerateExisting option for clone-config.yaml
- Updated gluon from 0.5.2 to 0.5.3

## [3.2.5-bb.3] - 2024-08-02

### Changed

- Added app and version to require-labels policy & update manifest

## [3.2.5-bb.2] - 2024-07-31

### Changed

- Updated chart/templates/exception-require-non-root-group.yaml:apiVersion: from `kyverno.io/v2beta1` to the latest version `kyverno.io/v2`
- chart/templates/exception-require-non-root-user.yaml:apiVersion: from `kyverno.io/v2beta1` to `kyverno.io/v2`
- chart/templates/update-automountserviceaccounttokens.yaml apiVersion:
  from `kyverno.io/v2beta1` to the latest version`kyverno.io/v2`

## [3.2.5-bb.1] - 2024-07-27

### Changed

- Gluon updated from `0.5.0` to `0.5.2`
- `ironbank/opensource/kubernetes/kubectl` updated from `v1.29.4` to `v1.29.7`

## [3.2.5-bb.0] - 2024-07-23

### Changed

- Updated versions in version and annotations under Chart.yaml to match Kyverno chart that we are currently using - 3.2.5

## [3.2.3-bb.0] - 2024-07-18

### Changed

- update helm chart from `kyverno-chart-3.0.4` to `kyverno-chart-3.2.3` and app version from `v1.11.0` to `v1.12.3`

## [3.0.4-bb.34] - 2024-07-16

### Changed

- Added metadata annotation to disallow-istio-injection-bypass policy

## [3.0.4-bb.33] - 2024-06-17

### Changed

- Fixed error in execption-require-non-root-group.yaml and in the non-root-user.yaml

## [3.0.4-bb.32] - 2024-05-23

### Changed

- setting autogen rules to `Deployment,ReplicaSet,DaemonSet,StatefulSet` as default to mitagate false positive behavior

## [3.0.4-bb.31] - 2024-05-16

### Changed

- updated commentted example in values.yaml file for `update-automountserviceaccounttokens:`

## [3.0.4-bb.30] - 2024-05-03

### Changed

- gluon updated from 0.4.8 to 0.5.0
- ironbank/opensource/kubernetes/kubectl updated from v1.29.3 to v1.29.4
- ironbank/redhat/ubi/ubi9-minimal updated from 9.3 to 9.4

## [3.0.4-bb.29] - 2024-04-19

### Changed

- Added support for checking deprecated API policy for Kubernetes v1.32.
- ironbank/opensource/kubernetes/kubectl updated from v1.28.7 to v1.29.3

## [3.0.4-bb.28] - 2024-03-20

### Changed

- Ensuring `kube-system` namespace is excluded from policy action

## [3.0.4-bb.27] - 2024-03-07

### Changed

- Removed duplicate `pod-policies.kyverno.io/autogen-controllers` annotation is disallow-tolerations ClusterPolicy.

## [3.0.4-bb.26] - 2024-02-29

### Changed

- Fixed audit and mutator for AutomountServiceAccountTokens for StatefulSet and Deployments

## [3.0.4-bb.25] - 2024-02-20

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.28.6 to v1.28.7
- gluon chart updated from 0.3.1 to 0.4.8

## [3.0.4-bb.24] - 2024-01-31

### Changed

- Updated allowed `sysctls` per Pod Security Standards

## [3.0.4-bb.23] - 2024-01-30

### Changed

- Fixed issue with kyverno policy related to wildcarding serviceAccounts in the automountServiceAccountToken clusterPolicy

## [3.0.4-bb.22] - 2024-01-29

### Changed

- Hardcoded annotation pod-policies.kyverno.io/autogen-controllers removed from disallowed-namespaces ClusterPolicy.
- Default value for {{.Values.autogenController}} set to none instead of empty string

## [3.0.4-bb.21] - 2024-01-26

### Changed

- Refactored PodsToHarden format

## [3.0.4-bb.20] - 2024-01-25

### Changed

- Fixed issue with kyverno policy related to wildcarding serviceAccounts in the automountServiceAccountToken clusterPolicy

## [3.0.4-bb.19] - 2024-01-19

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.28.4 to v1.28.6
- ironbank/redhat/ubi/ubi9-minimal updated from 8.9 to 9.3

## [3.0.4-bb.18] - 2024-01-05

### Changed

- update to ironbank/redhat/ubi/ubi8-minimal to ironbank/redhat/ubi/ubi9-minimal

## [3.0.4-bb.17] - 2023-12-21

### Changed

- Fixed issue with kyverno policy related to automountServiceAccountToken exemptions
- Added kyverno policy related to mutating pods with respect to automountServiceAccountToken hardening

## [3.0.4-bb.17] - 2023-12-21

### Changed

- Fixed issue with kyverno policy related to automountServiceAccountToken exemptions
- Added kyverno policy related to mutating pods with respect to automountServiceAccountToken hardening

## [3.0.4-bb.16] - 2023-12-15

### Changed

- add `ctlog.ignoreSCT: true` to `require-image-signature` policy

## [3.0.4-bb.15] - 2023-12-05

### Changed

- set `failurePolicy` to `Ignore` by default for audit policies with new helper function

## [3.0.4-bb.14] - 2023-12-04

### Changed

- Exclude default SA from serviceaccount mutation in update-automountserviceaccounttokens

## [3.0.4-bb.13] - 2023-12-01

### Changed

- Fix following upstream (Kyverno 1.11.0) changes in signature verification default behavior, adding new `ignoreTlog` and `url` fields to `require-image-signature` policy to ignore checking transaction logs for Iron Bank images.

## [3.0.4-bb.12] - 2023-11-17

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.28.3 to v1.28.4
- ironbank/redhat/ubi/ubi8-minimal updated from 8.8 to 8.9

## [3.0.4-bb.11] - 2023-11-15

### Changed

- Added support for checking deprecated API policy for Kubernetes v1.29.

## [3.0.4-bb.10] - 2023-11-13

### Changed

- Added ClusterPolicy to disable automountserviceaccounttoken on default serviceaccounts

## [3.0.4-bb.9] - 2023-11-09

### Added

- require-non-root-user-exception template for istio-init containers

## [3.0.4-bb.8] - 2023-11-07

### Added

- istio.enabled toggle for below PolicyException template
- require-non-root-group-exception template for istio-init containers

## [3.0.4-bb.7] - 2023-11-01

### Changed

- Fixed test for ClusterPolicy automountserviceaccounttoken

## [3.0.4-bb.6] - 2023-10-31

### Changed

- Default ClusterPolicy automountserviceaccounttoken to disabled

## [3.0.4-bb.5] - 2023-10-27

### Changed

- Added ClusterPolicy to disable automountserviceaccounttoken on the serviceaccounts and enable on the pods

## [3.0.4-bb.4] - 2023-10-25

### Changed

- Removed exceptions for Kyverno Reporter, Gitlab Runners, and Gitlab Shared Secrets (moved to bigbang repo)

## [3.0.4-bb.3] - 2023-10-22

### Changed

- ironbank/opensource/kubernetes/kubectl updated from 1.27.3 to v1.28.3

## [3.0.4-bb.2] - 2023-10-11

### Changed

- Added Kyverno Policy for Auditing Automount Service Account Token usage.
- Added exceptions for Kyverno Reporter, Gitlab Runners, and Gitlab Shared Secrets

## [3.0.4-bb.1] - 2023-10-11

### Changed

- respect `autogenControllers`, `background`, and `failurePolicy` values across all policies

## [3.0.4-bb.0] - 2023-09-20

### Changed

- changed CI test script and values to work better with newer kyverno chart version 3.0.0 for app version 1.10.X
- disabled require-non-root-group and require-non-root-user policy tests until a fix is added

## [1.1.0-bb.10] - 2023-08-29

### Added

- precondition support for excluding istio-init containers from require-group policy

## [1.1.0-bb.9] - 2023-08-01

### Added

- added DEVELOPMENT_MAINTENANCE.md

## [1.1.0-bb.8] - 2023-07-27

### Changed

- re-added IB key to test values for package/BB CI
- modified disallow-image-tags, require-image-signature, update-image-registry
- added timeout to test-policies.sh

## [1.1.0-bb.7] - 2023-06-16

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.26.4 to 1.27.3
- ironbank/redhat/ubi/ubi9-minimal updated from 8.7 to 8.8

## [1.1.0-bb.6] - 2023-04-15

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.26.3 to v1.26.4

## [1.1.0-bb.5] - 2023-03-30

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.26.2 to v1.26.3

## [1.1.0-bb.4] - 2023-03-29

### Changed

- modified enabled policy test to only run on package pipelines

## [1.1.0-bb.3] - 2023-03-04

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.26.1 to v1.26.2

## [1.1.0-bb.2] - 2023-02-07

### Changed

- Updated kubectl to v1.26.1
- Updated gluon to 0.3.2

## [1.1.0-bb.1] - 2023-01-26

### Changed

- Updated kubectl to v1.25.6
- Updated gluon to 0.3.1

## [1.1.0-bb.0] - 2023-01-11

### Changed

- Removed `disallow-shared-subpath-volume-writes` policy (no longer beneficial for any non-EOL k8s versions)
- Removed Ironbank key from test values

## [1.0.1-bb.12] - 20223-01-06

### Changed

- Added support for checking deprecated API policy for Kubernetes v1.27.

## [1.0.1-bb.11] - 2022-12-20

### Changed

- Updated default values for require-image-signature to align with upstream documentation

## [1.0.1-bb.10] - 2022-12-5

### Changed

- Changed values.yaml to fail images from ironbank that are not signed.

## [1.0.1-bb.9] - 2022-12-13

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.25.4 to v1.25.5

## [1.0.1-bb.8] - 2022-11-16

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.25.3 to v1.25.4
- registry1.dso.mil/ironbank/redhat/ubi/ubi9-minimal updated from 8.6 to 8.7

## [1.0.1-bb.7] - 2022-10-25

### Changed

- Changed `require-non-root-user` to support container exclusions

## [1.0.1-bb.6] - 2022-10-18

### Changed

- ironbank/opensource/kubernetes/kubectl updated from v1.24.4 to v1.25.3

## [1.0.1-bb.5] - 2022-09-14

### Changed

- Changed `disallow-nodeport-services` to `audit`
- Updated Gluon to `0.3.0`
- Fixed `disallow-pod-exec` from `attach` to `audit`

## [1.0.1-bb.4] - 2022-09-08

### Changed

- Updated `ttlSecondsAfterFinished` time to extend lifecycle

## [1.0.1-bb.3] - 2022-08-31

### Changed

- Added support for policy container exclusion

## [1.0.1-bb-2] - 2022-08-30

### Changed

- updated kubectl from `v.1.22.2` to `v1.24.4`

## [1.0.1-bb-1] - 2022-08-17

### Changed

- Fixed issue with `disallow-deprecated-apis` failing to install when checking old API versions

## [1.0.1-bb-0] - 2022-07-05

### Changed

- Updated policy preconditions to check for operation of create or update only

## [1.0.0-bb.13] - 2022-06-21

### Changed

- Enabled `disallow-nodeport-services` policy in enforcing mode

## [1.0.0-bb.12] - 2022-05-31

### Changed

- Separate host path policies from volume and hostpath

## [1.0.0-bb.11] - 2022-06-01

### Changed

- redhat ubi minimal from 8.5 to 8.6

## [1.0.0-bb.10] - 2022-05-24

### Changed

- Added policy to catch Persistent Volumes of type Hostpath
- Modified `restrict--host-path-mount.yaml`

## [1.0.0-bb.9] - 2022-05-13

### Changed

- Removed audit clusterpolicies
- disabled `disallow-istio-injection-bypass`
- disabled `require-drop-all-capabilities`
- disabled `require-istio-on-namespaces`
- disabled `restrict-capabilities`

## [1.0.0-bb.8] - 2022-03-29

### Changed

- Removed 1.22 deprecated API versions from test to support pipeline update to 1.23

## [1.0.0-bb.7] - 2022-03-03

### Changed

- Renamed `disallow-default-namespace` to `disallow-namespaces`. Parameterized list of disallowed namespaces, with `default` as the default.
- Decoupled testing from namespace
- Used default namespace for testing
- Updated test script to set policy action automatically

## [1.0.0-bb.6] - 2022-03-02

### Changed

- Added `localhost/*` as another acceptable default AppArmor profile
- Updated metadata in `Chart.yaml`
- Fixed typo for `restrict-capabilities` action in `values.yaml`
- Fixed `disallow-default-namespace` to allow blank namespace in pod controller template, but require pod controller to have a namespace.
- Fixed `restrict-host-path` to ignore pods with no volumes
- Fixed `require-non-root-group` exclusions indentions
- Fixed `disallow-deprecated-apis` matching to work with exclusions
- Updated `disallow-deprecated-apis` with Kubernetes 1.26 deprecations
- Updated `require-requests-equal-limits` to work with Kyverno 1.6.0
- Add `system:service-account-issuer-discovery` to the exclusion list for `disallow-rbac-on-default-serviceaccounts`. Clusters allow service accounts access to discovery.
- Fixed `disallow-rbac-on-default-serviceaccounts` to ignore role bindings without a subject.
- Fixed `require-non-root-user` to allow either `runAsNonRoot: true` or `runAsUser: >0`.
- Fixed `disallow-tolerations` to check pod controllers
- Renamed `require-ro-host-path` to `restrict-host-path-write` and added an `allow` list for paths
- Renamed `restrict-host-path` to `restrict-host-path-mount` to distinguish from `restrict-host-path-write`
- Increased memory allocation for `wait-for-ready` job to avoid OOM errors
- Renamed `disallow-subpath-volumes` to `disallow-shared-subpath-volume-writes` to clarify functionality.
- Fixed `disallow-shared-subpath-volume-writes` to narrow conditions specific to vulnerability
- Fixed `helpers.tpl` match and exclusion to handle `any` and `all` permutations

### Added

- `wait.sh` added to pipeline to wait for all policies to be ready before running helm test

### Removed

- `disallow-host-path` policy overlapped `restrict-volume-types` policy and was removed

## [1.0.0-bb.5] - 2022-02-03

### Changed

- Updated kubectl to 1.22
- Removed version from UBI image in most test resources (latest is ok)

## [1.0.0-bb.4] - 2022-01-31

### Changed

- Updated policy names and parameters to be inline with `docs/naming.md`
- Split restrict-selinux policy into restrict-selinux-type and disallow-selinux-options policies

## [1.0.0-bb.3] - 2022-01-28

### Added

- update-image-pull-policy policy
- disallow-subpath-volumes policy
- update-token-automount policy
- require-annotations policy
- require-image-signature
- require-istio-on-namespaces policy
- disallow-istio-injection-bypass policy
- require-labels policy
- disallow-annotations policy
- disallow-labels policy
- disallow-pod-exec policy
- disallow-tolerations policy
- max. on cpu and memory limits in require-cpu-limits and require-memory-limits policies
- Gatekeeper policy vs. Kyverno policy documentation
- Policy description documentation

### Changed

- require-resource-limits split into require-cpu-limits and require-memory-limits policies
- Added timestamp to wait-for-ready job so upgrades do not try to change immutable job.

### Removed

- cve-add-log4j2-mitigation policy (Mitigation proved to be insufficient)

## [1.0.0-bb.2] - 2022-01-14

### Added

- restrict-external-names policy
- disallow-host-path policy
- disallow-nodeport-services policy
- disallow-rbac-on-default-serviceaccounts policy
- require-drop-all-capabilities policy
- require-labels policy
- require-probes policy
- require-requests-equal-limits policy
- require-resource-limits policy
- require-ro-host-path policy
- restrict-host-path policy

### Changed

- Simplified restrict-capabilities policy
- Updated disallow-selinux to restrict-selinux-type in accordance with Pod Security Standards

## [1.0.0-bb.1] - 2021-12-20

### Added

- restrict-external-ips policy
- disallow-host-namespace policy
- disallow-default-namespace policy
- disallow-privilege-escalation policy
- disallow-privileged-containers policy
- disallow-selinux policy
- require-non-root-group policy
- require-non-root-user policy
- require-ro-rootfs policy
- restrict-apparmor policy
- restrict-group-id policy
- restrict-host-ports policy
- restrict-image-registries policy
- disallow-image-tags policy
- restrict-proc-mount policy
- restrict-seccomp policy
- restrict-sysctls policy
- restrict-user-id policy
- restrict-volume-types policy

## [1.0.0-bb.0] - 2021-12-2

### Added

- Initial creation of the chart
