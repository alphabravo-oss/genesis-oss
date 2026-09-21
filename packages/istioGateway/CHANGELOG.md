# Changelog

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.30.2-bb.2] (2026-07-10)

### Changed

- bb-common 0.15.0 -> 1.0.2
- gluon 0.9.8 -> 1.1.2

## [1.30.2-bb.1] (2026-07-06)

### Changed

- Updated the wait job to verify every gateway `istio-proxy` image before and after rollout restart.

## [1.30.2-bb.0] (2026-06-25)

### Changed

- gateway 1.30.1 -> 1.30.2
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.30.1 -> 1.30.2

## [1.30.1-bb.1] (2026-06-15)

### Added

- Added gateway-scoped host-based classification banner configuration.

## [1.30.1-bb.0] (2026-06-10)

### Changed

- bb-common 0.14.2 -> 0.15.0
- gateway 1.29.2 -> 1.30.1
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.29.2 -> 1.30.1

## [1.29.2-bb.0] (2026-04-14)

### Changed

- bb-common 0.14.1 -> 0.14.2
- gateway 1.29.1 -> 1.29.2
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.29.1 -> 1.29.2

## [1.29.1-bb.0] (2026-03-11)

### Changed

- bb-common 0.14.0 -> 0.14.1
- gateway 1.29.0 -> 1.29.1
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.29.0 -> 1.29.1

## [1.29.0-bb.0] (2026-02-18)

### Changed

- bb-common 0.13.0 -> 0.14.0
- gateway 1.28.3 -> 1.29.0
- gluon 0.9.7 -> 0.9.8
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.28.3 -> 1.29.0

## [1.28.3-bb.0] (2026-01-20)

### Changed

- bb-common 0.12.1 -> 0.13.0
- gateway 1.28.0 -> 1.28.3
- gateway 1.28.2 -> 1.28.3
- gluon 0.9.6 -> 0.9.7
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.28.2 -> 1.28.3

## [1.28.2-bb.0] (2025-12-31)

### Changed

- bb-common 0.10.0 -> 0.12.0
- gateway 1.28.0 -> 1.28.2
- gluon 0.9.6 -> 0.9.7
- registry1.dso.mil/ironbank/opensource/istio/proxyv2 1.28.0 -> 1.28.2

## [1.28.0-bb.0] (2025-11-20)

### Changed

- gateway updated from 1.27.3 to 1.28.0
- gluon updated from 0.9.5 to 0.9.6
- bb-common updated from 0.8.3 to 0.10.0

## [1.27.3-bb.0] (2025-10-21)

### Changed

- gateway updated from 1.27.2 to 1.27.3
- gluon updated from 0.9.4 to 0.9.5
- bb-common updated from 0.8.2 to 0.8.3

## [1.27.2-bb.0] (2025-10-14)

### Changed

- gateway updated from 1.27.1 to 1.27.2
- gluon updated from 0.9.2 to 0.9.4
- bb-common updated from 0.8.0 to 0.8.2

## [1.27.1-bb.2] (2025-09-18)

### Changed

- Updated gluon to 0.9.2

## [1.27.1-bb.1] (2025-09-18)

### Changed

- Updated schema to match new bb-common schema
- Incorporated bb-common netpol implementation

## [1.27.1-bb.0] (2025-09-09)

### Changed

- gateway updated from 1.27.0 to 1.27.1

## [1.27.0-bb.0] (2025-08-15)

### Changed

- gateway updated from 1.26.3 to 1.27.0
- ironbank/opensource/istio/proxyv2 updated from 1.26.3 to 1.27.0

## [1.26.3-bb.0] (2025-07-31)

### Changed

- gateway updated from 1.26.2 to 1.26.3
- added wait script to ensure image gets updated properly
- added new network policy for wait job

## [1.26.2-bb.1] (2025-07-30)

### Changed

- Updated schema to allow for networkPolicies.istioNamespaceSelector.ingress values

## [1.26.2-bb.0] (2025-07-11)

### Changed

- ironbank/opensource/istio/proxyv2 updated from 1.26.1 to 1.26.2

## [1.26.1-bb.3] (2025-07-08)

### Updated

- Updated all `namespace` keys to use `.Release.Namespace` instead of hardcoding `istio-gateway`

### Removed

- Removed extraneous flux labels from the `Gateway` manifest

## [1.26.1-bb.2] (2025-06-17)

### Added

- Added Helm values schema

## [1.26.1-bb.1] (2025-06-17)

### Changed

- Changed the chart name back to `gateway` from `istio-gateway` (accidentally flipped it back to istio-gateway as part of renovate update)

## [1.26.1-bb.0] (2025-06-12)

### Changed

- ironbank/opensource/istio/proxyv2 updated from 1.25.3 to 1.26.1

## [1.25.3-bb.4] - 2025-06-12

### Changed

- Changed the chart name back to `gateway` from `istio-gateway` due to an issue with service recreation on 3.0 upgrade

## [1.25.3-bb.3] - 2025-06-11

### Updated

- Updated all conditional resource creations to be per-release

## [1.25.3-bb.2] - 2025-06-09

### Updated

- Fixed an issue where duplicate default `AuthorizationPolicy` resources were being created

## [1.25.3-bb.0] - 2025-06-04

### Updated

- Updated chart name to `istio-gateway` from `gateway` to avoid collisions in registry1

## [1.25.3-bb.0] - 2025-05-28

### Changed

- ironbank/opensource/istio/proxyv2 updated from 1.25.2 to 1.25.3

## [1.25.2-bb.1] (2025-04-22)

### Changed

- Updated chart meta and added annotations

## [1.25.2-bb.0] (2025-04-18)

### Changed

- Updated for upstream 1.25.2

## [1.25.1-bb.3] - 2025-04-17

### Added

- Added a default `istio=ingressgateway` label

## [1.25.1-bb.2] - 2025-04-15

### Changed

- Refactored chart to passthrough pattern

## [1.25.1-bb.1] - 2025-04-09

### Added

- Readme updated for `enterprise` value removal.

## [1.25.1-bb.0] - 2025-04-02

### Added

- Updated to match upstream v1.25.1 of istio-gateway

## [1.23.3-bb.3] - 2024-02-13

### Added

- Updated dependency reference for operatorless istio

## [1.23.3-bb.2] - 2024-02-07

### Added

- Default network policies

## [1.23.3-bb.1] - 2024-12-31

### Added

- Updated gateway to use values from template
- Modified deployment.yaml to use service values on container as well
- Added missing peerAuthentication and authorizationPolicy
- Updated values.yaml to include settings for the above
- Updated image to IronBank image as the auto setting was problematic

## [1.23.3-bb.0] - 2024-12-26

### Added

- Update Gateway to 1.23.3

## [1.23.2-bb.3] - 2024-12-24

### Changed

- Updated ports in gateway template
- Updated service account name default in \_helpers.tpl

## [1.23.2-bb.2] - 2024-12-20

### Added

- Added Gateway template

## [1.23.2-bb.1] - 2024-12-06

### Added

- Added templating for Tetrate image Integration.

## [1.23.2-bb.0] - 2024-10-21

### Added

- Updated chart from 1.22.2 to 1.23.2

## [1.22.2-bb.0] - 2024-07-17

### Added

- Added Istio/gateway v1.22.2 chart files.
- Generated README.md
