# Istio

Three Helm releases: `istio-crds`, `istiod`, and the public and passthrough gateways. Chart version on `3.33.0` is Istio 1.30.4.

| Image | Reference |
|---|---|
| Pilot | `docker.io/istio/pilot:1.30.4` |
| Proxy | `docker.io/istio/proxyv2:1.30.4` |
| Gateway kubectl | `registry.k8s.io/kubectl:v1.35.0` |

Upstream docs: [https://istio.io/latest/docs/](https://istio.io/latest/docs/)

The public gateway serves `*.dev.genesis.local` on ports 8080 and 8443 inside the mesh. On k3d those are published as host 8080 and 8443. The passthrough gateway is ClusterIP on the k3d profile so both gateways do not fight for host ports 80 and 443. On any other cluster, set the passthrough Service back to LoadBalancer if you need it on the node.

The gateway certificate for the smoke cluster is secret `public-cert`.
