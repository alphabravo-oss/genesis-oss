# Profiles

Profiles live in `profiles/`. The default install does not use them. Pass one file at install or upgrade time:

```bash
helm upgrade --install bigbang umbrella \
  --namespace bigbang \
  -f umbrella/values-genesis.yaml \
  -f profiles/keycloak.yaml
```

| File | What it adds |
|---|---|
| `keycloak.yaml` | Keycloak `quay.io/keycloak/keycloak:26.7.2`. The bundled database chart expects a Bitnami layout. No public `postgresql:18.4` image of that layout was found, so the profile turns that chart off. Point `keycloak.database.host` at Postgres 18. `docker.io/library/postgres:18.4` was verified. |
| `ldap.yaml` | Notes for pointing Keycloak at an LDAP directory you already run. The bind password stays in a Secret named `keycloak-ldap`. Genesis does not run an IDM. |
| `ca-trust.yaml` | Names a Secret, `genesis-ca-bundle`, for a private CA. Create the Secret yourself. The file also adds that name to GitLab's `customCAs` list when you combine it with the GitLab profile. |
| `vault.yaml` | HashiCorp Vault `1.21.4`, the injector `vault-k8s:v1.7.6`, and the CSI provider `vault-csi-provider:v1.7.4`, from Docker Hub. |
| `openbao.yaml` | The same chart with the server image `quay.io/openbao/openbao:2.4.4`. The chart starts a `vault` binary. Confirm the image provides that name before you depend on it. The injector stays HashiCorp because it speaks the same API. |
| `argocd.yaml` | Argo CD `quay.io/argoproj/argocd:v3.4.5` and Dex `ghcr.io/dexidp/dex:v2.45.1`. Flux still installs the umbrella. The Bitnami `redis-bb` chart is off. Argo CD uses its own Redis. |
| `gitlab.yaml` | Turns GitLab on. Public image sources are the `gitlab/` rows in [Add-on images](packages/addons.md). The Enterprise Edition images need a GitLab license. This install is large. |
| `enforce-labels.yaml` | Sets Kyverno `require-labels` to Enforce. Apply the label policy in [Day-2](day-2.md) first. |

You can pass more than one `-f`. Keycloak plus `ldap.yaml` is the single sign-on shape: Keycloak is the broker, and the directory is one you already operate.
