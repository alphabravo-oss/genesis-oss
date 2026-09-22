# Optional profiles

Pass one of these with the generated overlay. None of them are on by default.

```bash
helm upgrade --install bigbang umbrella \
  -n bigbang \
  -f umbrella/values-genesis.yaml \
  -f profiles/keycloak.yaml
```

| File | What it adds |
|---|---|
| `keycloak.yaml` | Keycloak from `quay.io/keycloak/keycloak`. The bundled database chart expects a Bitnami image. This profile turns that chart off. Bring Postgres yourself. `docker.io/library/postgres:18.4` was verified. |
| `ldap.yaml` | Values only. Points Keycloak at an LDAP directory you already run. The bind password stays in a Secret. |
| `ca-trust.yaml` | How to add a private CA bundle. It does not embed certificates. |
| `vault.yaml` | HashiCorp Vault and its injector from Docker Hub. |
| `openbao.yaml` | Same chart, server image `quay.io/openbao/openbao:2.4.4`. |
| `argocd.yaml` | Argo CD and Dex from public registries, with the chart's own Redis instead of the Bitnami redis-bb chart. |
| `gitlab.yaml` | Turns GitLab on. Public image sources are `catalogs/3.33.0/public.md`. This install is large. |
| `enforce-labels.yaml` | Sets Kyverno `require-labels` to Enforce. Apply `policies/add-standard-labels.yaml` first. |

`k3d.yaml` is the smoke profile. `hack/k3d-up.sh` applies it. It is not an optional product feature.
