# cert-manager Overview

This integrated package provides the `cert-manager` chart for Big Bang package
consumption with secure defaults and approved image sources.

## What this package includes

- upstream `cert-manager` chart as dependency (`upstream` alias)
- Big Bang package scaffolding for integrated-track lifecycle
- image overrides to approved Iron Bank paths
- baseline runtime security settings in values
- optional Helm-managed self-signed and Let's Encrypt issuers, disabled by default

## What this package does not include

- `trust-manager` integration (separate package)
- `approver-policy` integration (separate package)
- Big Bang umbrella chart wiring (maintained in `big-bang/bigbang`)
- CA issuers, provider-specific issuers, DNS credentials, ingress/Gateway resources,
  or trust distribution

## Related docs

- [Installation Notes](./installing.md)
- [Development and Maintenance](./DEVELOPMENT_MAINTENANCE.md)
