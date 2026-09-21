# Files that require bigbang integration testing

### See [bb MR testing](https://repo1.dso.mil/big-bang/bigbang/-/blob/master/docs/community/development/test-package-against-bb.md?ref_type=heads) for details regarding testing changes against bigbang umbrella chart

There are certain integrations within the bigbang ecosystem and this package that require additional testing outside of the specific package tests ran during CI.  This is a requirement when files within those integrations are changed, as to avoid causing breaks up through the bigbang umbrella.  Currently, these include changes to the istio implementation within the package (see: [istio templates](https://repo1.dso.mil/big-bang/product/packages/istiod/-/tree/0e9ab1b936939be3d58e3e63714ccae139a702d8/chart/templates/bigbang/istio)).

Be aware that any changes to files listed in the [Modifications made to upstream chart](#modifications-made-to-upstream-chart) section will also require a codeowner to validate the changes using above method, to ensure that they do not affect the package or its integrations adversely.

Be sure to also test against monitoring locally as it is integrated by default with these high-impact service control packages, and needs to be validated using the necessary chart values beneath `istio.hardened` block with `monitoring.enabled` set to true as part of your [dev-overrides.yaml](./dev-overrides.yaml).

# How to upgrade the Package chart

BigBang makes modifications to the upstream helm chart. The full list of changes is at the end of  this document.

1. Read release notes from upstream [CHANGEME](). Be aware of changes that are included in the upgrade, you can find those by [comparing the current and new revision CHANGEME](). Take note of any manual upgrade steps that customers might need to perform, if any.
1. Do diff of [upstream chart CHANGEME]() between old and new release tags to become aware of any significant chart changes. A graphical diff tool such as [Meld](https://meldmerge.org/) is useful. 

1. Create a development branch and merge request tied to the Repo1 issue created for the package upgrade.  The association between the branch and the issue can be made by prefixing the branch name with the issue number, e.g. `56-update-package`. DO NOT create a branch if working `renovate/istio-crds`. Continue edits on `renovate/istio-crds`.

1. Run a helm dependency command to update the `chart/charts/*.tgz` archives and create a new requirements.lock file. You will commit the tar archives along with the requirements.lock that was generated.

    ```bash
    helm dependency update ./chart
    ```

1. In `/chart/values.yaml` verify all the image tags to the new version are updated.
1. Verify `/CHANGELOG.md` with an entry for "upgrade to app version X.X.X chart version X.X.X-bb.X". Or, whatever description is appropriate.
1. Verify the `/README.md` or follow the [gluon library script](https://repo1.dso.mil/platform-one/big-bang/apps/library-charts/gluon/-/blob/master/docs/bb-package-readme.md).
1. Verify `/chart/Chart.yaml` to the appropriate versions. The annotation version should match the `appVersion`.

    ```yaml
    version: X.X.X-bb.X
    appVersion: X.X.X
    annotations:
      dev.bigbang.mil/applicationVersions: |
        - CHANGEME: X.X.X
    ```

1. Update `annotations.helm.sh/images` section in `/chart/Chart.yaml` to fix references to updated packages (if needed).
1. Use a development environment to deploy and test. See more detailed testing instructions below. Also test an upgrade by deploying the old version first and then deploying the new version.
1. When the Package pipeline runs expect the cypress tests to fail due to UI changes. It is usually necessary to run the cypress tests locally in order to troubleshoot a failing test. The following steps are about how to set up local cypress testing. There is not good documentation anywhere else so it is included here.
    1. [Install a current version of cypress](https://docs.cypress.io/guides/getting-started/installing-cypress#npm-install) on your workstation.
    1. Make a sibling directory named `cypress` next to where you have the repo cloned.

        ```bash
        mkdir cypress
        ls -l
        drwxrwxr-x cypress
        drwxrwxr-x CHANGEME
        ```

        Inside the cypress directory create a symbolic link named `integration` that points to the cypress tests inside the package repo.

        ```bash
        cd cypress
        ln -s ../CHANGEME/chart/tests/cypress integration
        ls -l
        lrwxrwxrwx integration -> ../CHANGEME/chart/tests/cypress/
        cd ..
        ```

    1. Export the environment variables that are needed by the cypress test. Reference the `bbtests:` at the end of `/chart/values.yaml`.

        ```bash
        export cypress_url=https://CHANGEME.dev.bigbang.mil
        CHANGEME=add more env vars as needed
        ```

    1. Run cypress from the parent directory of the package and cypress directories.

        ```bash
        cypress
        ```

    1. When Cypress launches select the same directory where you ran cypress and you should see the cypress tests listed. Run them manually, in order, one at a time.
    1. Investigate and fix errors in the cypress tests. You can run a separate browser with developer tools to find out names of elements on each page.
1. Update the `/README.md` and `/CHANGELOG.md` again if you have made any additional changes during the upgrade/testing process.

# Testing new version

1. Create a k8s dev environment. One option is to use the Big Bang [k3d-dev.sh](https://repo1.dso.mil/platform-one/big-bang/bigbang/-/tree/master/docs/developer/scripts) with no arguments which will give you the default configuration. The following steps assume you are using the script.
1. Follow the instructions at the end of the script to connect to the k8s cluster and install flux.
   1. Deploy CHANGEME with the dev values overrides from [docs/dev-overrides.yaml](./dev-overrides.yaml). Core apps are disabled for quick deployment.
   1. Example helm upgrade command (run from within your local checkout of the `bigbang` repository):

    ```shell
    helm upgrade -n bigbang --create-namespace --install \
     bigbang ./chart \
     -f https://repo1.dso.mil/big-bang/bigbang/-/raw/master/tests/test-values.yaml \
     -f https://repo1.dso.mil/big-bang/product/packages/CHANGEME/-/raw/main/docs/dev-overrides.yaml \
     --set addons.CHANGEME.git.branch=YOUR-WORKING-BRANCH-NAME-HERE
   ```

1. Access CHANGEME UI from a browser and login with SSO (to learn about deploying CHANGEME with a dev version of Keycloak, see [keycloak-dev.md](./keycloak-dev.md)).

1. CHANGEME: Add more steps here

1. Perform a manual upgrade test. First deploy the current version. Then deploy your development branch. Verify that the upgrade is successful.
1. Retest with monitoring and logging enabled. Verify that the logging and monitoring are working.

# Modifications made to upstream chart

This is a high-level list of modifications that Big Bang has made to the upstream helm chart. You can use this as as cross-check to make sure that no modifications were lost during the upgrade process.

## chart/templates/bigbang/*

Everything under this directory is a modification to the upstream chart.  The files are modified to work with the Big Bang umbrella chart.  The files are also modified to work with the Istio service mesh.  The Istio modifications are not upstreamed to the original chart.

- `dashboards` - Grafana dashboards.  This is a low-impact integration.
- `istio/` - Istio configuration.  This is a high-impact integration and requires additional testing when changes are made.
  - `authorization-policies/` - Istio authorization policies.  This is a high-impact integration and requires additional testing when changes are made.
  - `peer-authentication/` - Istio peer authentication policies.  This is a high-impact integration and requires additional testing when changes are made.
  - `service-entries/` - Istio service entries.  This is a high-impact integration and requires additional testing when changes are made.
  - `sidecars/` - Istio sidecars.  This is a high-impact integration and requires additional testing when changes are made.
  - `virtual-services/` - Istio virtual services.  This is a high-impact integration and requires additional testing when changes are made.
- `network-policies/` - Network policies.  This is a high-impact integration and requires additional testing when changes are made.