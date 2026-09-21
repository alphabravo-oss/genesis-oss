# Alloy Development and Maintenance Guide

## To upgrade the Alloy Package

NOTE: Alloy Renovate updates differ from most other Big Bang Renovate updates because Alloy uses a passthrough chart, rather than a fork of the upstream chart.

1. Navigate to the upstream [chart repo and folder](https://github.com/grafana/k8s-monitoring-helm/tree/main/charts/k8s-monitoring) and find the appropriate tags that corresponds with the new chart version for this update.

    - Check the [upstream changelog](https://github.com/grafana/k8s-monitoring-helm/releases) for upgrade notices.

2. Checkout the `renovate/ironbank` branch.

3. Make sure the `./chart/Chart.yaml` is displaying the correct chart version from upstream and has `-bb.0` appended.

4. Find the correct matching sub-dependency versions for the correct alloy subchart version (ex: 2.0.16) and validate that the Renovate is using the correct ones. Usually in these locations:

    - k8s-monitoring [2.0.16 chart](https://github.com/grafana/k8s-monitoring-helm/tree/v2.0.16/charts/k8s-monitoring)
    - check `appVersion` in `./chart/Chart.yaml` and make sure it is updated
    - alloy helm chart tag from dependency [0.12.1 chart values](hhttps://github.com/grafana/alloy/blob/helm-chart/0.12.1/operations/helm/charts/alloy/values.yaml)
      - If upgrading the Iron Bank images ensure that the Big Bang package `./chart/values.yaml` has the most recent minor/patch version for the Iron Bank images.

5. Make sure `helm.sh/images:` lists every image the chart can deploy, including conditional hook images managed by this package.

6. If necessary, update the `./chart/values.yaml` image tags to match their respective tags in `helm.sh/images:` in `./chart/Chart.yaml`.

7. If necessary, update dependencies and binaries using `helm dependency update ./chart`. This step may be automated and not needed.

    - If needed, log into registry1.

      ```shell
      # Note, if you are using Ubuntu on WSL and get an error about storing credentials or about how `The name org.freedesktop.secrets was not
      # provided by any .service files` when you run the command below, install the libsecret-1-dev and gnome-keyring packages. After doing this,
      # you'll be prompted to set a keyring password the first time you run this command.
      #
      helm registry login https://registry1.dso.mil -u ${registry1.username}
      ```

    - Pull assets and commit the binaries as well as the Chart.lock file that was generated.

      ```shell
      # Note: You may need to resolve merge conflicts in chart/values.yaml before these commands work. Refer to the "Modifications made to upstream"
      # section below for hints on how to resolve them. Also, you need to be logged in to registry1 thorough docker.
      helm dependency update ./chart
      ```

    - Then log out.

      ```shell
      helm registry logout https://registry1.dso.mil
      ```

8. Update `CHANGELOG.md` adding an entry for the new version and noting all changes in a list (at minimum should include `- Updated <chart or dependency> to x.x.x`). Also, make sure the config-reloader versions are accurate if updated.

9. Generate the `README.md` updates by following the [guide in gluon](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md).

10. Push up your changes, add upgrade notices if applicable, validate that CI passes.

    - If there are any failures, follow the information in the pipeline to make the necessary updates.

    - Add the `debug` label to the MR for more detailed information.

    - Reach out to the CODEOWNERS if needed.

11. (_Optional, only required if package changes are expected to have cascading effects on bigbang umbrella chart_) As part of your MR that modifies bigbang packages, you should modify the bigbang [bigbang/tests/test-values.yaml](https://repo1.dso.mil/big-bang/bigbang/-/blob/master/tests/test-values.yaml?ref_type=heads) against your branch for the CI/CD MR testing by enabling your packages. 

    - To do this, at a minimum, you will need to follow the instructions at [bigbang/docs/developer/test-package-against-bb.md](https://repo1.dso.mil/big-bang/bigbang/-/blob/master/docs/developer/test-package-against-bb.md?ref_type=heads) with changes for Alloy enabled (the below is a reference, actual changes could be more depending on what changes where made to Alloy in the package MR).

    **[test-values.yaml](https://repo1.dso.mil/big-bang/bigbang/-/blob/master/tests/test-values.yaml?ref_type=heads)**

    ```yaml
      alloy:
        enabled: true
        git:
          tag: null
          branch: "renovate/ironbank"
        ### Additional components of Alloy should be changed to reflect testing changes introduced in the package MR
    ```

12. Follow the `Testing new Alloy Version` section of this document for manual testing.

## Update main chart

### `chart/Chart.yaml`

- update k8s-monitoring `version` and `appVersion`
- Ensure Big Bang version suffix is appended to chart version
- Ensure gluon dependencies are present and up to date

  ```yaml
    apiVersion: v2
    name: k8s-monitoring
    description: A Helm chart for gathering, scraping, and forwarding Kubernetes telemetry data to a Grafana Stack.
    type: application
    version: $VERSION-bb.0
    appVersion: $K8S_MONITORING_VERSION
    icon: https://raw.githubusercontent.com/grafana/grafana/main/public/img/grafana_icon.svg
    sources:
      - https://github.com/grafana/k8s-monitoring-helm/tree/main/charts/k8s-monitoring
    annotations:
      helm.sh/images: |
        - name: alloy
          image: registry1.dso.mil/ironbank/opensource/grafana/alloy:$ALLOY_APP_VERSION
        - name: alloy-operator
          image: registry1.dso.mil/ironbank/opensource/grafana/alloy-operator:$ALLOY_OPERATOR_VERSION
        - name: prometheus-config-reloader
          image: registry1.dso.mil/ironbank/opensource/prometheus-operator/prometheus-config-reloader:$CONFIG_RELOADER_APP_VERSION
        - name: helm-chart-toolbox-kubectl
          image: registry1.dso.mil/ironbank/opensource/grafana/helm-chart-toolbox-kubectl:$HELM_CHART_TOOLBOX_VERSION
        - name: bb-alloy-upgrade
          image: registry1.dso.mil/ironbank/big-bang/base:$AUTO_ROLLING_UPGRADE_BASE_VERSION
      bigbang.dev/upstreamReleaseNotesMarkdown: |
        - [Find our upstream chart's CHANGELOG here](https://github.com/grafana/k8s-monitoring-helm/releases/)
        - [and our upstream application release notes here](https://github.com/grafana/alloy/blob/main/docs/sources/release-notes.md?plain=1)
    dependencies:
      - name: k8s-monitoring
        version: "$K8S_MONITORING_VERSION"
        repository: https://grafana.github.io/helm-charts
      - name: gluon
        version: "$GLUON_VERSION"
        repository: oci://registry1.dso.mil/bigbang
  ```

## Modifications made to upstream

This is a high-level list of modifications that Big Bang has made to the upstream helm chart. You can use this as as cross-check to make sure that no modifications were lost during the upgrade process.

## Testing new Alloy Version

> NOTE: For these testing steps it is good to do them on both a clean install and an upgrade. For clean install, point Alloy to your branch. For an upgrade do an install with Alloy pointing to the latest tag, then perform a helm upgrade with Alloy pointing to your branch.

### Deploy Alloy as a part of BigBang

You will want to install with:

- Istio package enabled
- Loki package enabled

**`overrides/alloy.yaml`**

```yaml
sso:
  name: P1 SSO
  url: https://login.dso.mil/auth/realms/baby-yoda

domain: dev.bigbang.mil

flux:
  interval: 1m
  rollback:
    cleanupOnFail: false

istioCRDs:
  enabled: true

istiod:
  enabled: true

istioGateway:
  enabled: true

loki:
  enabled: true

alloy:
  enabled: true
  git:
    tag: null
    branch: "renovate/ironbank"
  alloyLogs:
    enabled: true
```

Testing Steps:
- Go to [https://grafana.dev.bigbang.mil](https://grafana.dev.bigbang.mil) in your browser and login with [default credentials](https://docs-bigbang.dso.mil/latest/docs/guides/using-bigbang/default-credentials/).
  - Navigate to `Connections -> Data sources -> Loki`
  - Click on `Save & test` and ensure `Data source successfully connected.` message appears
  - Navigate to `Dashboards` and then click on ``Loki Dashboard Quick Search`` and validate that data is loaded
- Log into [Prometheus](https://prometheus.dev.bigbang.mil/).
  - Select `Status` --> `Target Health` from the top banner
  - From the top left corner, select from the drop down the Service Monitors for Alloy microservice (currently only `alloy-alloy-logs`) and confirm for each Service Monitor that the statuses are all `UP` and green
- Validate all Alloy pod logs (currently `alloy-operator` and `alloy-alloy-logs`) are showing no errors with `kubectl logs` command.

> When in doubt with any testing or upgrade steps, reach out to the [CODEOWNERS](https://repo1.dso.mil/big-bang/product/packages/alloy/-/blob/main/CODEOWNERS) for assistance.