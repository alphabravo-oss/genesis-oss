# Flux

Flux installs from `base/flux` before the umbrella. The images are public:

| Image | Reference |
|---|---|
| helm-controller | `ghcr.io/fluxcd/helm-controller:v1.6.4` |
| kustomize-controller | `ghcr.io/fluxcd/kustomize-controller:v1.9.5` |
| notification-controller | `ghcr.io/fluxcd/notification-controller:v1.9.4` |
| source-controller | `ghcr.io/fluxcd/source-controller:v1.9.5` |

Upstream docs: [https://fluxcd.io/docs/](https://fluxcd.io/docs/)

Genesis removes the `private-registry` pull secret from the Flux kustomization. The source controller needs about 1.5 GiB of memory while it packs the package charts. The k3d profile sets that limit.
