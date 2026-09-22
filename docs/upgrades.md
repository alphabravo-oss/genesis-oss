# Upgrades

Genesis tags match Big Bang tags. Move a cluster by checking out the new tag and upgrading the umbrella. Flux then pulls that tag's package charts from this repository.

```bash
git fetch --tags
git checkout 3.33.0
python3 scripts/install.py --profile keycloak -f /private/path/site-values.yaml
kubectl get helmrelease -n bigbang
```

Use your actual profiles and custom files; the example enables Keycloak. Repeat `--profile` in application order and include every custom `-f` file on each upgrade. The installer uses `--reset-values` to prevent stale values and provenance carrying into a new release. An upgrade that drops a profile turns that package off. `--dry-run` renders without applying. Back up application data before upgrading.

`helm rollback bigbang REVISION --namespace bigbang` restores the umbrella revision and its recorded provenance together. It does not roll back application data or guarantee compatibility with older schemas. The console compares the recorded checksum with its archived baseline and reports missing/mismatched content explicitly.

Wait until every HelmRelease is Ready again. Then run the Registry1 check from [Install](install.md).

`main` is the newest snapshot. A numbered tag is a Big Bang version. Older tags stay installable. The GitHub Release marked Latest is the newest Genesis version.

Cutting a new tag when Big Bang publishes one is the maintainer procedure in the engine, `docs/releasing.md`. A daily scan prompt lives at `docs/agent-release-scan.md` in that repo. The scan generates a local snapshot. A person reviews the diff, smokes it, and publishes.
