# Day-2

## Domain and UIs

`values-genesis.yaml` sets the domain to `dev.genesis.local`. The public gateway serves:

| UI | Host |
|---|---|
| Grafana | `grafana.dev.genesis.local` |
| Kiali | `kiali.dev.genesis.local` |
| NeuVector | `neuvector.dev.genesis.local` |
| Prometheus | `prometheus.dev.genesis.local` |
| Alertmanager | `alertmanager.dev.genesis.local` |
| Policy Reporter | `policyreporter.dev.genesis.local` |

Kiali is under `/kiali/`. Point those names at the gateway address.

On the k3d smoke cluster the gateway is the machine's LAN address, port 8080 for HTTP and port 8443 for HTTPS. HTTPS needs the name `*.dev.genesis.local` in the TLS handshake. The dev certificate is the secret `public-cert` in `istio-gateway`, created by `hack/k3d-up.sh` for that name.

Change the domain in `values-genesis.yaml` before you install on any other network. Then issue a certificate with cert-manager and store it where the public gateway expects `public-cert`.

## Passwords

Change these before the gateway is reachable past the lab:

| Service | Default |
|---|---|
| Grafana | user `admin`, password `prom-operator` |
| NeuVector | bootstrap password `changeme$!` (the UI asks for a new one) |
| Keycloak, if you enable that profile | user `admin`, password `password` |

## Labels

Kyverno `require-labels` is Audit. It wants `app.kubernetes.io/name` and `app.kubernetes.io/version` on pods. Many upstream pods omit them, so the default install records the misses and still admits the pods.

To enforce them, apply `profiles/policies/add-standard-labels.yaml` first. That policy fills a missing name from the app label or the container name, and a missing version from the image tag. Then install with `-f profiles/enforce-labels.yaml`.

## Metrics

On k3s, metrics-server is already running and the horizontal pod autoscalers can read CPU. `hack/k3d-up.sh` turns the Big Bang metrics-server addon off so the two Deployments do not collide. On a cluster that does not ship metrics-server, leave the addon at its upstream setting.
