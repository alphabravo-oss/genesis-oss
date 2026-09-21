# Installation Notes

- Reference the repository [README](../README.md) for chart values and package metadata.
- CRDs must be installed into the cluster prior to installing cert-manager.

## Istio

cert-manager serves admission webhooks that are called by the Kubernetes API server. The chart excludes webhook pod port `10250` from Istio sidecar inbound capture so kube-apiserver admission webhook callbacks can reach the webhook directly while the pod can still use sidecar mesh behavior for other traffic. For ambient deployments, the webhook pod sets `ambient.istio.io/bypass-inbound-capture: "true"` so only outbound traffic is captured by ambient mesh. The chart also renders a pod-selected `PeerAuthentication` that sets webhook pod port `10250` to `PERMISSIVE` for kube-apiserver webhook callbacks.

The chart defaults the cert-manager `ServiceMonitor` endpoint to scrape with Big Bang's Istio mTLS Prometheus certificates. If deploying without Istio STRICT mTLS, override the Big Bang scrape settings so Prometheus uses the upstream plaintext HTTP metrics endpoint:

```yaml
upstream:
  prometheus:
    servicemonitor:
      endpointAdditionalProperties: {}
```

## Managed issuers

The chart can manage one self-signed issuer and one Let's Encrypt ACME issuer. Both are disabled by default, and managed issuer resources are created on upgrade by default so the cert-manager webhook can become ready first. The default scope is a namespaced `Issuer` in the Helm release namespace; set `scope: ClusterIssuer` only when cluster-wide issuance is intentional.

For a first installation into a cluster without an existing cert-manager webhook, enable the managed issuer in the initial values if desired, then perform an upgrade after the cert-manager Helm release and webhook are Ready. The default `createOnInstall: false` prevents the issuer from racing the validating webhook endpoint. The same staged procedure is required when reinstalling cert-manager while retained CRDs and webhook configurations remain in the cluster.

Set `createOnInstall: true` only when the cert-manager webhook is already ready during the initial Helm install. The package CI uses the safe upgrade-only default to keep clean installs race-free while still testing the actual Helm-managed issuers on upgrade.

Default resource names are release-prefixed:

- `<release>-selfsigned`
- `<release>-letsencrypt-staging`
- `<release>-letsencrypt-production`
- `<release>-letsencrypt-custom` when `server` is overridden

Use the generated resource in a `Certificate` with an explicit reference. For the default release name:

```yaml
issuerRef:
  name: cert-manager-selfsigned
  kind: Issuer
```

For a cluster-scoped issuer, use `kind: ClusterIssuer`. An `Issuer` can only serve `Certificate` resources in its own namespace.

### Self-signed

The minimal configuration activates self-signed issuer management:

```yaml
issuers:
  selfSigned:
    enabled: true
```

On a fresh cert-manager installation, perform the staged upgrade described above before referencing the issuer. To create it during the initial install, add `createOnInstall: true` only when the cert-manager webhook is already Ready.

Self-signed end-entity certificates are not publicly trusted and are not a general-purpose production trust solution. For a private PKI, use the self-signed issuer only to bootstrap a CA certificate, store that CA keypair securely, create a separately managed CA issuer, and distribute the CA trust bundle with a mechanism such as the separate trust-manager package. This chart intentionally does not create a CA issuer.

To create a cluster-scoped bootstrap issuer with a custom name:

```yaml
issuers:
  selfSigned:
    enabled: true
    scope: ClusterIssuer
    name: platform-bootstrap
```

### Let's Encrypt HTTP-01

Staging is the safe default. The requested DNS name must resolve publicly to the selected ingress controller, and the controller must route `/.well-known/acme-challenge/` traffic to cert-manager's temporary solver Service and pod.

```yaml
issuers:
  letsEncrypt:
    enabled: true
    email: platform-team@example.mil
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
```

The chart adds sidecar and ambient mesh-exclusion metadata to HTTP-01 solver pod templates. Explicit values in a solver's `podTemplate.metadata` take precedence when solver pods must join the mesh.

The chart does not manage HTTP-01 solver ingress NetworkPolicies because cert-manager solver pods are shared across issuers. Manage solver ingress policy externally for the namespaces and ingress or Gateway sources used by the deployment.

### Let's Encrypt DNS-01

Create the provider credential Secret separately and pass only its reference. Never place provider credentials directly in chart values.

```yaml
issuers:
  letsEncrypt:
    enabled: true
    email: platform-team@example.mil
    solvers:
      - dns01:
          cloudflare:
            apiTokenSecretRef:
              name: cloudflare-api-token
              key: api-token
        selector:
          dnsZones:
            - example.mil
```

The Secret must be in the namespace expected by cert-manager for the selected issuer scope. Consult the cert-manager provider documentation for its Secret and workload-identity requirements.

### Gateway API HTTP-01

Gateway API CRDs must already exist. Enable cert-manager's Gateway API support and reference a Gateway with an HTTP listener on port `80`; its listener must allow HTTPRoutes from the challenge namespace.

```yaml
upstream:
  config:
    enableGatewayAPI: true

issuers:
  letsEncrypt:
    enabled: true
    email: platform-team@example.mil
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs:
              - name: public
                namespace: istio-gateway
                kind: Gateway
```

If Gateway API CRDs are installed after cert-manager starts, restart the controller so it discovers them.

`upstream.extraArgs: [--enable-gateway-api]` is also supported when controller arguments are managed directly. HTTP-01 ingress solvers must set exactly one of `ingressClassName`, `class`, or `name`; classless solvers are intentionally rejected because they can target every ingress controller in the cluster.

### Production and custom endpoints

Validate issuance against staging before selecting production, which is subject to Let's Encrypt production rate limits:

```yaml
issuers:
  letsEncrypt:
    enabled: true
    environment: production
    email: platform-team@example.mil
    solvers:
      - http01:
          ingress:
            ingressClassName: nginx
```

Set `server` to use a custom ACME directory. A custom server produces the default name `<release>-letsencrypt-custom`; override `name` when a more specific identity is needed. Generated issuer names retain their full release and environment components, and `privateKeySecretName` overrides the generated `<issuer-name>-account-key` Secret name. Set `privateKeySecretName` when appending `-account-key` to a long explicit issuer name would exceed Kubernetes' 253-character resource-name limit.

Custom ACME servers must use HTTPS with a hostname on port `443`, which is the only port configured by the generated NetworkPolicy and ServiceEntry. Malformed URLs, URL fragments, and URLs with userinfo are not supported.

### Authorization and approval

A `ClusterIssuer` can be referenced by certificate requests from every namespace. Restrict who can create or update `Certificate` and `CertificateRequest` resources, constrain allowed DNS names, and configure the separate approver-policy package when policy-based approval is required. Ensure approval policies explicitly allow the generated issuer reference; otherwise requests remain unapproved. Namespaced `Issuer` is the safer default because its authorization boundary is the release namespace.

### Account key lifecycle

cert-manager creates the ACME account key in the Secret named by `privateKeySecretName` or the generated default. The chart never accepts or renders the private key. For an `Issuer`, the Secret is in the issuer namespace. For a `ClusterIssuer`, cert-manager stores it in the controller's cluster resource namespace, which this package defaults to the cert-manager release namespace.

Back up this Secret as sensitive account identity data. Preserve it during upgrades and migrations to retain the ability to manage and revoke certificates from the same ACME account. Deleting it causes cert-manager to register a replacement account key. The Secret is not a Helm-rendered resource, but deleting its namespace still deletes it. Standard Big Bang package removal may remove the package namespace, so export or otherwise back up the account Secret before disabling or uninstalling the package.

### Network and mesh prerequisites

When Let's Encrypt issuer creation is enabled for the current install or upgrade and `bb-common.networkPolicies.enabled` is enabled, the chart adds a controller egress `NetworkPolicy` for TCP `443` and UDP/TCP `53` so cert-manager can resolve ACME and provider hosts. It separately permits DNS traffic to the cluster's kube-dns pods. HTTP-01 adds TCP `80` for controller self-checks. The chart does not manage solver ingress policy because solver pods are shared across issuers; manage that ingress policy externally. DNS-01 uses the same DNS egress for authoritative propagation checks. Disabling common NetworkPolicies disables these chart-owned ACME NetworkPolicies as well. Kubernetes NetworkPolicy cannot select FQDNs, so the default IPv4 egress CIDR is broad and excludes the link-local metadata address. Add an IPv6 CIDR entry for IPv6-only or dual-stack destinations, with exclusions appropriate to the environment. `controllerEgress.cidrs` must contain at least one entry. Kubernetes validates CIDR syntax and exception containment when it applies the rendered NetworkPolicy.

Existing `controllerEgress.cidrs` string entries must be migrated to objects. For example, change `- 203.0.113.0/24` to `- cidr: 203.0.113.0/24`; move any exclusions under the applicable entry's `except` field.

With Big Bang Istio sidecars and `REGISTRY_ONLY`, the chart creates a namespace-local `ServiceEntry` for the selected ACME directory. Users must add their own outbound routes or ServiceEntries for requested HTTP-01 domain names and DNS provider APIs. HTTP-01 controller self-checks use port `80` and may follow redirects to port `443`. Ambient deployments do not use the ACME directory `ServiceEntry`, but ambient and sidecar deployments still require working NetworkPolicy paths. Opting solver pods into the mesh also requires an `AuthorizationPolicy` that permits traffic from the ingress controller or Gateway namespace.

For HTTP-01, namespace owners must provide ingress policy access to temporary solver pods on TCP `8089` in each participating certificate namespace. Provider APIs that do not use TCP `443` require a separate egress policy for their additional ports.

```yaml
issuers:
  letsEncrypt:
    scope: ClusterIssuer
```

### Runtime ACME acceptance test

The normal Gluon script test runs after cert-manager is installed and the webhook accepts admission requests. During clean-install pipeline runs, managed issuers stay disabled to avoid the cert-manager webhook race described above; the script creates an equivalent temporary self-signed `Issuer` after the webhook is ready and proves that cert-manager can issue a certificate from it. On upgrades with the self-signed issuer enabled, the script requires the configured packaged issuer to exist and become Ready, so the upgrade test fails if Helm did not create it. This staged install-then-upgrade lifecycle is intentional for Helm and GitOps deployments.

Let's Encrypt issuance is not part of the default package pipeline because ACME requires external public DNS, public HTTP reachability, or DNS-provider credentials. See [Let's Encrypt Test Plan](letsencrypt-test-plan.md) for the manual test strategy and expected evidence.

In external infrastructure with a public test DNS name and a configured staging HTTP-01 or DNS-01 route, run the script with:

```bash
ACME_TEST_FQDN=acme-test.example.mil \
ACME_ISSUER_NAME=cert-manager-letsencrypt-staging \
ACME_ISSUER_KIND=Issuer \
BUILTIN_ISSUER_KIND=Issuer \
NAMESPACE=cert-manager \
bash chart/tests/scripts/cert_manager.sh
```

Set `BUILTIN_ISSUER_KIND=ClusterIssuer` when the packaged self-signed issuer uses cluster scope. The script otherwise uses the namespaced `Issuer` default. The chart injects its release namespace and instance name into the runtime test automatically; set `NAMESPACE` and `INSTANCE_NAME` when running the script directly for a custom release.

The script defaults `ACME_EXPECTED_SERVER` to the Let's Encrypt staging directory and verifies the selected issuer is ACME-backed, then verifies the resulting Order and Challenge reach `valid`. Set `ACME_EXPECTED_SERVER` explicitly when testing a custom ACME server. Do not use production ACME or hard-coded credentials for this test.
