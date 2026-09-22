# Kyverno

Three releases: Kyverno 1.19.1 (`kyverno` chart 3.9.1), Kyverno policies, and Policy Reporter.

| Image | Reference |
|---|---|
| Admission, background, cleanup, reports | `ghcr.io/kyverno/kyverno:v1.19.1` and the matching controller tags |
| Pre and readiness | `ghcr.io/kyverno/kyvernopre:v1.19.1`, `ghcr.io/kyverno/readiness-checker:v1.19.1` |
| Policy Reporter | `ghcr.io/kyverno/policy-reporter:3.10.0` |
| Policy Reporter UI | `ghcr.io/kyverno/policy-reporter-ui:2.8.1` |

Upstream docs: [https://kyverno.io/docs/](https://kyverno.io/docs/)

Genesis clears `global.image.registry` and sets each controller image registry to `ghcr.io`. The chart prefers a parent registry over a per-image default, and the upstream parent value points at Registry1.

`restrict-image-registries` allows `docker.io`, `quay.io`, `ghcr.io`, `registry.k8s.io`, and `registry.gitlab.com`. `require-labels` is Audit until you follow [Day-2](../day-2.md).
