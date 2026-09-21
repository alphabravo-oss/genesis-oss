# Developer Maintenance

## How to upgrade the Istio Gateway Package chart

`istio-gateway` is a passthrough chart. That means it does not fork an upstream
chart but instead embeds one as a dependency. Because of this, the upgrade
process is incredibly simple.

1. Checkout the branch that renovate created. This branch will have the image
   tag updates and typically some other necessary version changes that you will
   want. You can either work off of this branch or branch off of it.

1. Update dependency archives via `helm` (from repository root)
   ```sh
   helm dependency update ./chart
   ```

1. Update version references for the chart in `Chart.yaml`. `version` should be
   `<version>-bb.0` (ex: `1.25.1-bb.0`) and `appVersion` should be `<version>`
   (ex: `1.25.1`). Also validate that the Big Bang
   `bigbang.dev/applicationVersions` and `helm.sh/images` annotations are update
   to reflect the chart's new application and image versions.

1. Add an entry to `CHANGELOG.md` detailing what changed in the update. At a
   minimum mention updating the dependency chart.

1. Regenerate the readme following the
   [steps in Gluon](https://repo1.dso.mil/platform-one/big-bang/apps/library-charts/gluon/-/blob/master/docs/bb-package-readme.md).

1. Open an MR (or check the one that Renovate created for you) and validate that
   the pipeline is successful.

1. Follow the testing steps below for some manual confirmations.

## Testing new Istio Gateway version

Generally, an `istio-gateway` update should be tested alongside the new versions
of `istio-base` and `istiod`. Follow the steps outlined in the Istio base/istod
[Development Maintenance Guide](https://repo1.dso.mil/big-bang/apps/sandbox/istio/-/blob/main/docs/DEVELOPMENT_MAINTENANCE.md?ref_type=heads#testing-new-istio-controlplane-version)

## Big Bang components incorporated into this chart

- Added `networkPolicies` section to enable default network policies and allow
  custom additional network policies to be added.

```
networkPolicies:
  enabled: true
  additionalPolicies: []
```

- Added the following `mtls` section to enable mutual TLS used in
  `chart/templates/bigbang/istio/peer-authentications/default.yaml`:

```
mtls:
  # -- STRICT = Allow only mutual TLS traffic,
  # PERMISSIVE = Allow both plain text and mutual TLS traffic
  mode: STRICT
```
