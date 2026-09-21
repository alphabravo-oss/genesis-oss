# How to upgrade to Prometheus-Operator-CRDs chart

The prometheus-operator-crds chart is a Big Bang managed version of the prometheus-operatator-crds [upstream chart](https://github.com/prometheus-community/helm-charts/tree/main/charts/prometheus-operator-crds).
The below details the steps required to update to a new version of the prometheus-operator-crds package.

NOTE: This package is slightly different than others as there are no pods or images associated with the chart, it is for CRDs only.


1. Navigate to the upstream [chart repo and folder](https://github.com/prometheus-community/helm-charts/tree/main/charts/prometheus-operator-crds) and find the tag that corresponds with the new chart version for this update

2.  `git clone` the [prometheus-operator-crds] repository](https://repo1.dso.mil/big-bang/product/packages/prometheus-operator-crds) from Repo1 and checkout the `renovate/ironbank` branch.

3. Update the chart version in `./chart/Chart.yaml` and append or bump the `-bb.0` suffix (if missing or incorrect) to the chart version from upstream.

4. Ensure the Big Bang `./chart/Chart.yaml` and the target upstream version `Chart.yaml` align correctly with the following:
    - Check `appVersion` and `bigbang.dev/applicationVersions` in `./chart/Chart.yaml` to make sure they match and have updated to the correct version
    - Check the upstream chart dependencies and compare the dependency versions against the corresponding image tags in `./chart/values.yaml` to make sure they match

5. Update dependencies and binaries using `helm dependency update ./chart`.

6. Update `CHANGELOG.md` adding an entry for the new version and noting all changes (at minimum should include `Updated prometheus-operatator-crds from x.x.x to x.x.x`).

7. Generate the `README.md` updates by following the [guide in gluon](https://repo1.dso.mil/platform-one/big-bang/apps/library-charts/gluon/-/blob/master/docs/bb-package-readme.md).

8. Push up your changes, add upgrade notices if applicable, validate that CI passes.
    - If there are any failures, follow the information in the pipeline to make the necessary updates.
    - Add the `debug` label to the MR for more detailed information.
    - Reach out to the CODEOWNERS if needed.

9. (_Optional, only required if package changes are expected to have cascading effects on bigbang umbrella chart_) As part of your MR that modifies bigbang packages, you should modify the bigbang [bigbang/tests/test-values.yaml](https://repo1.dso.mil/big-bang/bigbang/-/blob/master/tests/test-values.yaml?ref_type=heads) to target your branch for CI/CD MR testing.

    - To do this, at a minimum, you will need to follow the instructions at [bigbang/docs/developer/test-package-against-bb.md](https://repo1.dso.mil/big-bang/bigbang/-/blob/master/docs/developer/test-package-against-bb.md?ref_type=heads) with changes for prometheus-operatator-crds enabled (Refer to `docs/dev-overrides.yaml` for example)

10. Complete the manual testing steps in the following section.

11. Once all manual testing is complete, take your MR out of "Draft" status, assign reviewers, and add the review label.

# Testing new Prometheus-Operator-CRDs Version

Refer to `docs/dev-overrides.yaml` for YAML values to deploy against Big Bang.

- Ensure all Monitoring Pods are alive and healthy
- Login to [Prometheus](https://prometheus.dev.bigbang.mil/), validate under `Status` -> `Targets` that all targets are showing as up as healthy
- Login to [Alert Manager](https://alertmanager.dev.bigbang.mil/) and validate that alerts are firing (if the main page shows no alert groups check the Prometheus logs and see if there are errors with that connection)
