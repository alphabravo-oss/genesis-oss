# Upgrades

Genesis tags match Big Bang tags. Move a cluster by checking out the new tag and upgrading the umbrella. Flux then pulls that tag's package charts from this repository.

```bash
git fetch --tags
git checkout 3.33.0
helm upgrade bigbang umbrella \
  --namespace bigbang \
  -f umbrella/values-genesis.yaml
kubectl get helmrelease -n bigbang
```

Keep any profile files you added (`-f profiles/keycloak.yaml` and the others) on the upgrade command. An upgrade that drops a profile turns that package off.

Wait until every HelmRelease is Ready again. Then run the Registry1 check from [Install](install.md).

`main` is the newest snapshot. A numbered tag is a Big Bang version. Older tags stay installable. The GitHub Release marked Latest is the newest Genesis version.

Cutting a new tag when Big Bang publishes one is the maintainer procedure in the engine, `docs/releasing.md`. A daily scan prompt lives at `docs/agent-release-scan.md` in that repo. The scan generates a local snapshot. A person reviews the diff, smokes it, and publishes.
