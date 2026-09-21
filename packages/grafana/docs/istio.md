# Istio and Network Hardening

The Grafana package uses the [Big Bang Common Library](https://repo1.dso.mil/big-bang/product/packages/bb-common) (`bb-common`) to render its Istio, authorization-policy, network-policy, and routing resources. The common configuration model and supported options are documented centrally:

- [Istio](https://repo1.dso.mil/big-bang/product/packages/bb-common/-/tree/main/docs/istio)
- [Authorization policies](https://repo1.dso.mil/big-bang/product/packages/bb-common/-/tree/main/docs/authorization-policies)
- [Network policies](https://repo1.dso.mil/big-bang/product/packages/bb-common/-/tree/main/docs/network-policies)
- [Routes](https://repo1.dso.mil/big-bang/product/packages/bb-common/-/tree/main/docs/routes)

This document covers only the behavior and traffic requirements specific to Grafana.

## Package defaults

The standalone Grafana package has the following relevant defaults:

- `networkPolicies.enabled: true` enables the bb-common default-deny policies and Grafana-specific traffic rules.
- `istio.enabled: false` disables Istio resources until explicitly enabled.
- `istio.mtls.mode: STRICT` is used when Istio is enabled.
- `istio.sidecar.enabled: false` means a `REGISTRY_ONLY` Istio `Sidecar` is not created by default.
- `istio.authorizationPolicies.enabled: true` and `generateFromNetpol: true` cause authorization policies to be rendered when Istio is enabled, including policies derived from network-policy identities.

Enabling Istio does not automatically enable the `REGISTRY_ONLY` Sidecar in a standalone package deployment. Set both values when that behavior is required:

```yaml
istio:
  enabled: true
  sidecar:
    enabled: true
    outboundTrafficPolicyMode: REGISTRY_ONLY
```

## Big Bang umbrella behavior

When Grafana is deployed by the Big Bang umbrella chart, the umbrella translates its global Istio configuration into the current bb-common package values. Global or package-level hardened mode enables Grafana's `REGISTRY_ONLY` Sidecar and authorization-policy generation when sidecar mode is in use. Ambient mode enables the corresponding authorization and network-policy behavior without creating an Istio `Sidecar` resource.

The umbrella continues to accept legacy `grafana.values.istio.hardened` keys for backward compatibility and maps custom entries and authorization policies into the current bb-common structure. New standalone package configuration should use `istio.serviceEntries.custom` and `istio.authorizationPolicies.custom` directly.

## Resources created for Grafana

Depending on the enabled values, bb-common renders the following resources:

- A `PeerAuthentication` using `istio.mtls.mode`.
- An optional `Sidecar` using `istio.sidecar.outboundTrafficPolicyMode`.
- Default authorization policies that deny unspecified traffic and allow same-namespace traffic.
- Authorization policies generated from network-policy entries that include a service-account identity.
- Custom `ServiceEntry` and `AuthorizationPolicy` resources.
- The inbound Grafana `VirtualService` and its related access policies.

The default Grafana route uses:

- Host: `grafana.<domain>`
- Gateway: `istio-gateway/public-ingressgateway`
- Destination: `monitoring-grafana` on port `80`
- A `/metrics` redirect to `/`

## Grafana-specific traffic

The package supplies network-policy configuration for these flows:

- Ingress from Kiali to Grafana. The Kiali service-account identity is included so bb-common can generate the corresponding Istio authorization policy.
- Egress from Grafana to the Kubernetes API, which is required by the dashboard and datasource sidecars.
- External egress for Grafana datasources and integrations.
- Same-namespace traffic through bb-common's default policies, including traffic between Grafana and the bundled image-renderer deployment.

Review and narrow the default external egress rule when the destinations required by a deployment are known.

## External services with `REGISTRY_ONLY`

Kubernetes Services are present in the Istio service registry automatically. External hostnames are not, even when a Kubernetes `NetworkPolicy` permits the connection. Add external destinations to `istio.serviceEntries.custom` when `istio.sidecar.enabled` uses `REGISTRY_ONLY`.

This commonly applies to:

- External Grafana datasources.
- An image renderer hosted outside the cluster.
- External plugin or dashboard download endpoints.
- Other APIs contacted by custom Grafana integrations.

Refer to the [bb-common ServiceEntry documentation](https://repo1.dso.mil/big-bang/product/packages/bb-common/-/tree/main/docs/istio#service-entries) for the supported value format.

## SSO ServiceEntry

The Grafana package creates a `networking.istio.io/v1` `ServiceEntry` for the configured OIDC authorization host when all of the following are enabled:

- `istio.enabled`
- `istio.sidecar.enabled`
- `sso.enabled`

This allows the Grafana pod to reach the identity provider while outbound traffic is restricted to `REGISTRY_ONLY`. If the deployment uses additional OIDC or authentication endpoints that are not represented by that host, add them through `istio.serviceEntries.custom`.
