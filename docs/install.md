# Install

You need a Kubernetes cluster at 1.34 or newer, `kubectl`, Helm 4, Python 3.9 or newer, and `git`. The cluster must be able to pull from `ghcr.io`, `docker.io`, `quay.io`, and `registry.k8s.io`.

## Flux

Flux in this edition is the manifest under `base/flux`. Those images are `ghcr.io/fluxcd`.

```bash
git clone --branch 3.33.0 https://github.com/alphabravo-oss/genesis-oss.git
cd genesis-oss
kubectl kustomize base/flux | kubectl apply -f -
kubectl -n flux-system rollout status deploy/source-controller
kubectl -n flux-system rollout status deploy/helm-controller
kubectl -n flux-system rollout status deploy/kustomize-controller
kubectl -n flux-system rollout status deploy/notification-controller
```

`scripts/install_flux.sh` is the upstream helper and expects a Registry1 login. Use the kustomize command above.

## Umbrella

```bash
python3 scripts/install.py
```

The default release name and namespace are `bigbang`. Package charts are pulled from this Git repository at the tag recorded in `umbrella/values.yaml`. The installer verifies `baseline.json` and records the release version, baseline SHA-256, ordered profiles, profile checksums, and presence of custom value files in Helm values and a ConfigMap. Keep custom values in separate `-f` files; editing baseline inputs fails verification. Use `--dry-run` to render before applying.

Direct Helm commands remain supported but do not record profile intent automatically. The read-only [console](console.md) shows those installations as **Not recorded** rather than guessing.

## Ready

```bash
kubectl get helmrelease -n bigbang
```

Every default-on HelmRelease shows Ready. On `3.33.0` that list is istio-crds, istiod, the two gateways, kiali, kyverno, kyverno-policies, kyverno-reporter, alloy, loki, tempo, prometheus-operator-crds, monitoring, grafana, neuvector, and cert-manager.

```bash
kubectl get pods -A -o jsonpath='{range .items[*]}{range .spec.containers[*]}{.image}{"\n"}{end}{end}' | grep registry1 || echo "no Registry1 images"
```

The second command prints `no Registry1 images` when the install matches this edition.

## k3d

The engine repo has `hack/k3d-up.sh` for a local smoke cluster. It uses `rancher/k3s:v1.36.4-k3s1`, turns Traefik off, and publishes the gateway on host ports 8080 and 8443 because 80 and 443 are often already taken. On that cluster, k3s already runs metrics-server, so the script turns the Big Bang metrics-server addon off.

That script uses or creates a cluster named `genesis`, reapplies the stack, and replaces its local Git mirror. It is the smoke path. The commands above are the install.
