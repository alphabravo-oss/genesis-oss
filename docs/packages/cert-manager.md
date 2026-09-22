# cert-manager

cert-manager is default-on for `3.33.0` at v1.20.3. `3.28.0` through `3.31.1` leave it off, matching those Big Bang tags.

| Image | Reference |
|---|---|
| Controller | `quay.io/jetstack/cert-manager-controller:v1.20.3` |
| Webhook | `quay.io/jetstack/cert-manager-webhook:v1.20.3` |
| CA injector | `quay.io/jetstack/cert-manager-cainjector:v1.20.3` |
| ACME solver | `quay.io/jetstack/cert-manager-acmesolver:v1.20.3` |

Upstream docs: [https://cert-manager.io/docs/](https://cert-manager.io/docs/)

The overlay sets `global.imagePullSecrets` to an empty list. The chart's upstream value names a `private-registry` secret this edition does not create.

Use cert-manager to replace the dev gateway certificate when the domain is no longer `dev.genesis.local`.
