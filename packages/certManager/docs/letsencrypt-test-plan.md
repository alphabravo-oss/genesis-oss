# Let's Encrypt Test Plan

## Intent

This plan defines how to validate the optional Let's Encrypt issuer support in a standard Big Bang development deployment without adding flaky or credential-dependent checks to the default package pipeline.

The package pipeline does not run Let's Encrypt ACME issuance tests. ACME validation requires external public infrastructure or DNS-provider credentials that are not available in isolated CI and should not be hard-coded into package values.

## What CI Covers

The normal pipeline should cover:

- Helm rendering for staging, production, and custom ACME issuer configuration.
- Validation failures for missing email, missing solvers, invalid scopes, invalid environments, and incompatible solver settings.
- Default-disabled behavior so existing installs do not create ACME resources.
- Runtime cert-manager health and self-signed issuance through the Gluon script test.

These checks prove chart behavior and cert-manager functionality, but they do not prove that Let's Encrypt can reach a specific environment's challenge endpoint.

## What Manual ACME Testing Proves

Manual ACME testing should prove:

- The package installs through the Big Bang umbrella with its normal Istio, NetworkPolicy, private-registry, and Kyverno controls in place.
- The rendered `Issuer` or `ClusterIssuer` becomes `Ready` with the Let's Encrypt staging directory.
- A `Certificate` for a controlled test FQDN becomes `Ready`.
- cert-manager creates and completes `Order` and `Challenge` resources.
- The selected solver has sufficient provider, mesh, and network access.
- Kyverno does not reject cert-manager or temporary solver resources.

Use the Let's Encrypt staging environment for all routine testing. Production ACME should only be used after staging succeeds and should not be part of package CI.

## Recommended Big Bang Test Path

Use DNS-01 for the repeatable Big Bang development test. It does not require a second ingress controller, a public tunnel, or a public route into a `k3d` load balancer. It does require a delegated test zone and a narrowly scoped DNS-provider credential.

HTTP-01 can be tested when the environment already has a public DNS name and an Istio-compatible cert-manager solver route. See [HTTP-01 With Big Bang Istio](#http-01-with-big-bang-istio) before selecting that path.

### Required Repositories and Tools

Use a checkout of this repository and a checkout of the [Big Bang umbrella](https://repo1.dso.mil/big-bang/bigbang). The examples use these variables so the repositories do not have to be siblings:

```bash
export CERT_MANAGER_REPO_DIR=/path/to/cert-manager
export BIGBANG_REPO_DIR=/path/to/bigbang
```

Required local tools and access:

- The tools required by the umbrella `docs/reference/scripts/developer/k3d-dev.sh` script.
- `helm`, `kubectl`, and `flux` access to the resulting cluster.
- Registry1 credentials for Iron Bank image pulls.
- A pushed cert-manager branch or tag that Flux can read. A local uncommitted checkout cannot be used as a Flux `GitRepository` source.
- A dedicated DNS test zone and credentials scoped to create and delete its `_acme-challenge` TXT records.

Set the registry variables consumed by the Big Bang development scripts:

```bash
export REGISTRY1_USERNAME=<registry1-username>
export REGISTRY1_TOKEN=<registry1-cli-secret>
```

Do not commit these values, a generated registry values file, a DNS-provider token, or an ACME account key.

### 1. Create the Big Bang k3d Environment

Run the umbrella's supported development script rather than creating a plain `k3d` cluster manually:

```bash
"${BIGBANG_REPO_DIR}/docs/reference/scripts/developer/k3d-dev.sh"
```

The script provisions the development host and cluster but does not install Flux or Big Bang. Follow the connection and `KUBECONFIG` instructions printed by the script.

The script enables MetalLB by default. That is sufficient for DNS-01 because Let's Encrypt does not connect to the cluster. For HTTP-01, choose a script mode that exposes the Istio HTTP listener through a public address and verify public TCP port `80` reachability before continuing; workstation-only `sshuttle`, SOCKS, `/etc/hosts`, and private MetalLB addresses are not reachable by Let's Encrypt.

### 2. Prepare Private Registry Values

Create or reuse a private, uncommitted Big Bang values file with Registry1 credentials:

```yaml
# registry-values.yaml -- never commit this file
registryCredentials:
  registry: registry1.dso.mil
  username: <registry1-username>
  password: <registry1-cli-secret>
```

Big Bang creates the package namespace pull secret and passes `bb-common` integration values to the cert-manager package. Keep the package's default Iron Bank images for this test, including `cert-manager-acmesolver`; replacing them with public images would bypass the private-registry path this test is intended to validate.

### 3. Install Flux

From the umbrella checkout, install the Flux version provided by Big Bang:

```bash
cd "${BIGBANG_REPO_DIR}"
./scripts/install_flux.sh \
  -u "${REGISTRY1_USERNAME}" \
  -p "${REGISTRY1_TOKEN}"
```

### 4. Install Standard Big Bang and cert-manager

Set a branch or tag that contains the cert-manager changes under test:

```bash
export CERT_MANAGER_GIT_REF=<pushed-branch-or-tag>
```

Install Big Bang with the package's existing `tests/test-values.yaml`. Managed issuers are intentionally created during the upgrade after cert-manager's webhook is ready; this avoids an admission race during the initial install:

```bash
cd "${BIGBANG_REPO_DIR}"
helm dependency build chart
helm upgrade --install bigbang chart \
  --namespace bigbang \
  --create-namespace \
  --values /path/to/registry-values.yaml \
  --values chart/ingress-certs.yaml \
  --values docs/reference/configs/example/policy-overrides-k3d.yaml \
  --values "${CERT_MANAGER_REPO_DIR}/tests/test-values.yaml" \
  --set-string "packages.cert-manager.git.branch=${CERT_MANAGER_GIT_REF}"
```

Use `packages.cert-manager.git.tag` instead of `branch` when testing a tag. Do not set both.

This deployment intentionally keeps the standard Big Bang components enabled, including `istiod`, `istioGateway`, `kyverno`, and `kyvernoPolicies`. The k3d policy overrides make only the exceptions required by the Big Bang development load balancer; do not disable Kyverno or broadly exclude the `cert-manager` namespace.

`chart/ingress-certs.yaml` supplies the Big Bang development certificate used to bring up the normal Istio public gateway. It is useful for validating the standard deployment, but it is not the Let's Encrypt certificate requested by this test and it does not satisfy an ACME challenge.

Wait for reconciliation and verify the core packages and cert-manager before enabling the issuer:

```bash
kubectl get helmreleases -A
kubectl -n cert-manager wait \
  --for=condition=Available \
  --timeout=300s \
  deployment \
  --selector app.kubernetes.io/instance=cert-manager
kubectl -n cert-manager get pods
```

### 5. Create the DNS Credential Secret

Create the provider credential directly in the `cert-manager` namespace after Big Bang creates it. Never render the credential through Helm values.

For example, a Cloudflare API token Secret is:

```bash
kubectl -n cert-manager create secret generic cloudflare-api-token \
  --from-literal=api-token="${CLOUDFLARE_API_TOKEN}"
```

Use a dedicated token restricted to DNS record changes for the delegated test zone. For another provider, use the Secret shape required by cert-manager's provider documentation.

### 6. Enable the Staging DNS-01 Issuer

Create an uncommitted ACME override file. Replace the email and zone, and add the DNS provider API host to `bb-common` outbound routes so the controller can reach it when the Big Bang Istio sidecar uses `REGISTRY_ONLY`:

```yaml
# acme-test-values.yaml
packages:
  cert-manager:
    values:
      bb-common:
        routes:
          outbound:
            cloudflare-api:
              enabled: true
              hosts:
                - api.cloudflare.com
      issuers:
        letsEncrypt:
          enabled: true
          environment: staging
          email: platform-team@example.mil
          solvers:
            - dns01:
                cloudflare:
                  apiTokenSecretRef:
                    name: cloudflare-api-token
                    key: api-token
              selector:
                dnsZones:
                  - acme-test.example.mil
```

For another provider, replace both the solver and the outbound API hosts. The chart already creates a ServiceEntry for the selected Let's Encrypt directory and a controller egress NetworkPolicy for TCP `443` and UDP/TCP `53`. DNS-01 uses the DNS egress to query authoritative nameservers during propagation checks. Provider-specific API destinations must still be supplied. Tighten the egress CIDRs when stable provider ranges are available.

Repeat the Big Bang Helm upgrade from step 4 with `acme-test-values.yaml` last so it has highest precedence:

```bash
cd "${BIGBANG_REPO_DIR}"
helm upgrade bigbang chart \
  --namespace bigbang \
  --values /path/to/registry-values.yaml \
  --values chart/ingress-certs.yaml \
  --values docs/reference/configs/example/policy-overrides-k3d.yaml \
  --values "${CERT_MANAGER_REPO_DIR}/tests/test-values.yaml" \
  --values /path/to/acme-test-values.yaml \
  --set-string "packages.cert-manager.git.branch=${CERT_MANAGER_GIT_REF}"
```

Wait for the staging issuer:

```bash
kubectl -n cert-manager wait \
  --for=condition=Ready \
  --timeout=300s \
  issuer/cert-manager-letsencrypt-staging
```

### 7. Request and Verify the Certificate

Run the package script with a name in the delegated test zone:

```bash
ACME_TEST_FQDN=cert-manager.acme-test.example.mil \
ACME_ISSUER_NAME=cert-manager-letsencrypt-staging \
ACME_ISSUER_KIND=Issuer \
NAMESPACE=cert-manager \
bash "${CERT_MANAGER_REPO_DIR}/chart/tests/scripts/cert_manager.sh"
```

Expected result:

- `issuer/cert-manager-letsencrypt-staging` reaches `Ready=True`.
- `certificate/test-acme-cert-<run-id>` reaches `Ready=True` while the script is running. The script derives `<run-id>` from the test pod hostname; set `RUN_ID` explicitly when running it manually.
- The script verifies the issuer uses the Let's Encrypt staging directory and that its related `Order` and `Challenge` reach `valid`.
- cert-manager creates `_acme-challenge.cert-manager.acme-test.example.mil` and removes it after validation.
- The related `Order` and `Challenge` complete without propagation, mesh egress, NetworkPolicy, image-pull, or admission errors.

The script removes only its run-scoped resources when it exits. Capture evidence in another terminal while it runs, or issue a separate retained test `Certificate` when durable evidence is required:

```bash
kubectl -n cert-manager get certificate,certificaterequest,order,challenge \
  -l cert-manager.io/test-run
kubectl -n cert-manager get events --sort-by=.lastTimestamp
kubectl -n cert-manager get policyreport
```

If issuance fails, collect:

```bash
kubectl -n cert-manager describe issuer cert-manager-letsencrypt-staging
kubectl -n cert-manager describe certificate -l cert-manager.io/test-run
kubectl -n cert-manager describe order
kubectl -n cert-manager describe challenge
kubectl -n cert-manager logs deployment/cert-manager --tail=200
kubectl -n cert-manager get policyreport -o yaml
```

Check Kyverno reports and admission events before adding an exception. Any required exception should target the specific generated resource shape; do not disable Kyverno or exempt the entire namespace merely to make the test pass.

## HTTP-01 With Big Bang Istio

HTTP-01 requires a public HTTP route for the exact requested FQDN. A workstation tunnel, `/etc/hosts` entry, private MetalLB address, or `sshuttle` route does not make the challenge reachable by Let's Encrypt.

The standard Big Bang `istioGateway` package creates an Istio `networking.istio.io/Gateway`. cert-manager's automatic HTTP-01 solvers create either a Kubernetes `Ingress` or a Gateway API `HTTPRoute`; they do not add a route to the existing Big Bang Istio `Gateway`. Do not assume that setting `ingressClassName: istio` is sufficient unless the deployed Istio control plane is explicitly configured to reconcile Kubernetes `Ingress` resources and that behavior has been verified.

Use HTTP-01 only when one of these routing paths is deliberately configured:

- Istio's Kubernetes Ingress controller is enabled, an `IngressClass` is present, and the generated solver `Ingress` reaches the public Big Bang gateway.
- Big Bang's Gateway API package and cert-manager Gateway API support are enabled, and the selected Gateway has a public port `80` listener that allows the temporary `HTTPRoute` from the certificate namespace.
- Environment-specific automation safely connects cert-manager's temporary solver Service to an existing public route.

The environment must also provide:

- A controlled test FQDN with public DNS pointing to the public listener.
- Public inbound TCP `80` through cloud security groups, host firewalls, the k3d host, and the Istio gateway.
- An Istio HTTP listener that does not redirect or otherwise prevent `/.well-known/acme-challenge/` from reaching the temporary solver Service.
- NetworkPolicy permission from the Istio gateway pods to the solver pods on port `8089`.
- Kyverno-compatible temporary `Ingress` or `HTTPRoute`, Service, and solver pod resources.

Configure the issuer with the solver that matches the verified routing path. For Gateway API, for example:

```yaml
packages:
  cert-manager:
    values:
      upstream:
        config:
          enableGatewayAPI: true
      issuers:
        letsEncrypt:
          enabled: true
          environment: staging
          email: platform-team@example.mil
          solvers:
            - http01:
                gatewayHTTPRoute:
                  parentRefs:
                    - name: public
                      namespace: istio-gateway
                      kind: Gateway
```

The `parentRefs` above are illustrative. Confirm the actual Gateway API object name, namespace, listener, `allowedRoutes`, load-balancer address, and public DNS before applying the values. The default Big Bang Istio `Gateway` is a different API and cannot be used as this reference.

When HTTP-01 routing is ready, use the same staged issuer upgrade and package test script described above. Evidence must include the generated solver route and a successful request to the challenge path through the public listener.

## Production and Ingress Certificates

The test certificate proves ACME issuance; it does not automatically replace the TLS Secret used by the Big Bang public gateway. The package test creates its Secret in `cert-manager`, while the standard gateway certificate is managed in the gateway namespace. Deliberately design Secret distribution, gateway references, renewal ownership, and Kyverno policy before using an issued certificate for ingress.

Do not switch this runbook to the production Let's Encrypt directory merely to obtain a browser-trusted certificate. First prove staging issuance, then separately review production DNS names, account-key retention, rate limits, Secret placement, and gateway rollout.

## Cleanup

Delete test certificate resources and provider credentials that are not intentionally retained:

```bash
kubectl -n cert-manager delete certificate -l cert-manager.io/test-run --ignore-not-found
kubectl -n cert-manager delete secret -l cert-manager.io/test-run --ignore-not-found
kubectl -n cert-manager delete secret cloudflare-api-token --ignore-not-found
```

Delete the ACME account Secret only when intentionally discarding the staging account identity:

```bash
kubectl -n cert-manager delete secret \
  cert-manager-letsencrypt-staging-account-key \
  --ignore-not-found
```

Use the matching `k3d-dev.sh` destroy command and options to remove infrastructure created by the umbrella script. Do not substitute `k3d cluster delete` when the script also provisioned cloud resources.

## Acceptance Criteria

An ACME test is accepted when:

- The test uses Let's Encrypt staging, not production.
- cert-manager runs with standard Big Bang Istio, NetworkPolicy, private-registry, and Kyverno controls enabled.
- No DNS-provider credentials are committed to Git or rendered from chart values; Registry1 credentials follow Big Bang's normal private-registry Secret handling.
- The ACME account key Secret is created by cert-manager and retained as sensitive runtime data when appropriate.
- The staging issuer reaches `Ready=True`.
- The test certificate reaches `Ready=True`.
- The related `Order` and `Challenge` complete successfully.
- Evidence includes relevant Certificate, CertificateRequest, Order, Challenge, event, and Kyverno policy output.

## Pipeline Decision

Let's Encrypt issuance is intentionally excluded from the default package pipeline. The pipeline should remain deterministic, credential-free, and independent of public DNS or third-party service availability. ACME testing should be run manually or in a separately provisioned environment with explicit DNS ownership and documented credential handling.
