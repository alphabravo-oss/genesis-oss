# Testing Kyverno Policies

## How tests run

CI runs tests in two stages:

1. **Helm unit tests** (`helm unittest`) — run early in CI without a cluster. Fast, offline validation of template rendering.
2. **Gluon bbtest scripts** (`helm test`) — run inside a single pod against a live cluster. Three flavors:
   - *CPol integration tests* (legacy) — kubectl-based, must stay until their CPols are deleted at the end of the CEL migration
   - *CEL policy kyverno CLI tests* (`01_test-cel-kyverno.sh`) — offline CEL evaluation that could run without a cluster, but packaged into gluon for practical CI reasons. Discovers both VPols and MPols.
   - *CEL policy chainsaw integration tests* (`06_test-cel-chainsaw.sh`) — live admission tests against deployed VPols and MPols. Runs all tests in parallel with namespace-scoped isolation.

   Gluon executes scripts in lexicographic filename order with `set -e` — any failure stops the pod. Use filename prefixes to control execution order.

## Test values

CI layers the Big Bang umbrella's `tests/test-values.yaml` under this repo's `tests/test-values.yaml`. Many CPol tests depend on policy parameters (allowed paths, allowed capabilities, etc.) that only the umbrella provides — a bare `helm install` will see test failures that don't reproduce in CI. Use [`docs/dev-overrides.yaml`](dev-overrides.yaml) to get equivalent coverage locally:

```shell
helm upgrade -i kyverno-policies chart/ -n kyverno -f docs/dev-overrides.yaml
helm test kyverno-policies -n kyverno --timeout 10m
```

Test scripts toggle `validationFailureAction` on CPols/VPols via `kubectl patch` in `_helpers.sh`. After a test run, `kubectl patch` leaves a competing field-manager entry that blocks the next bare `helm upgrade`. Fix: pass `--force-conflicts` on the next `helm upgrade`, or use the Flux-based install mode (see below) which applies `--force` by default.

Set `validationFailureAction: Audit` for all validation policies under test. This lets Kyverno capture all violations in a policy report rather than stopping at the first one.

## CPol tests (legacy)

The `05_test-cpols.sh` script tests ClusterPolicies by patching each to Enforce one at a time, applying test manifests from `chart/tests/manifests/`, and checking admission results. Test manifests use `kyverno-policies-bbtest/*` annotations to declare expected outcomes — see any manifest file for the schema (e.g. `chart/tests/manifests/disallow-privileged-containers.yaml`).

These tests stay as long as the CPols they cover exist. Remove each test only when its CPol is deleted.

## VPol / MPol / CEL policy tests

ValidatingPolicy and MutatingPolicy templates have three layers of testing, each catching different classes of bugs:

1. **Helm unit tests** — Fast, offline. Verify template rendering (values, helpers, guards, YAML structure). Run via `helm unittest chart/ -f "unittests/**/*_test.yaml"`.
2. **Kyverno CLI tests** — Offline CEL evaluation. Verify that CEL expressions admit/reject (VPol) or mutate (MPol) resources correctly. No cluster needed, runs in ~2s. Run one policy via `kyverno test chart/tests/<kind>/<policy>/kyverno-test --detailed-results`.
3. **Chainsaw integration tests** — Live cluster. Deploy the policy, create good/bad resources, verify admission webhook behavior end-to-end. `06_test-cel-chainsaw.sh` quiets all CPols and VPols before running. It also quiets MPols during the VPol/GPol phase, then restores them and runs MPol chainsaw as a second phase. Why: mutating policies can "fix" resources that live VPol suites expect to be denied. Run one policy via `chainsaw test --apply-timeout 30s --delete-timeout 30s chart/tests/<kind>/<policy>/chainsaw-test`.

The kyverno CLI test is the fastest gate — if CEL expressions are broken, it fails before chainsaw burns time on live admission.

### When to write a chainsaw test

Chainsaw tests are slow (~60-150s each) and fragile (chainsaw 0.2.14 hard-fails on transient API server blips). Most VPols don't need one -- the kyverno CLI test already proves the CEL expression is correct offline. Chainsaw only adds value when it exercises a **distinct admission pattern** that the CLI can't cover.

| Admission pattern | Representative policy | Chainsaw? | Why |
|---|---|---|---|
| Boolean securityContext field | `disallow-privileged-containers-cel` | Yes | Proves VPol-to-webhook pipeline works |
| Resource quantity comparison | `require-cpu-limit-cel` | Yes | `quantity()` through admission is a different code path |
| Second boolean field check | `disallow-privilege-escalation-cel` | No | Same pattern as privileged-containers |
| Label/annotation validation | TBD | No | Same admit/deny mechanic, different field |
| First MutatingPolicy | `add-default-securitycontext-cel` | Yes | Mutating admission is a separate code path |
| Mutation over multiple pod container lists | `add-default-capability-drop-cel` | Yes | Proves webhook mutation across `containers`, `initContainers`, and `ephemeralContainers`; keep the permutation-heavy logic offline |
| First GeneratingPolicy | TBD | Yes | Generating is a separate code path |

**Rule of thumb:** if the new policy's CEL expression uses the same operators and resource shape as a policy that already has chainsaw coverage, skip the chainsaw test. Add one only when the admission pattern is genuinely new. For MPols, "new" can mean a different mutation target shape at admission time, but keep that live suite small and push permutations down to `kyverno test`.

### What live chainsaw assertions should earn their place

For Pod-matching VPols, bias toward small live suites and keep controller
coverage offline unless the live signal is genuinely better.

- Keep live assertions for:
  - bad Pod deny-on-create
  - good Pod allow
  - good controller allow, when that proves autogen wiring without retry churn
  - runtime side effects such as GPol clone behavior
- Prefer `kyverno test` for:
  - bad controller or autogen negative coverage
  - fixture permutations that only restate CEL logic already proven offline

Why: live negative controller applies have proven brittle under Chainsaw retry
churn. A bad Deployment can slip past the initial create, then fail later with
`object has been modified`, invalid Pod update errors, or apply timeouts. That
is not a clean admission-deny signal. When `kyverno test` already covers the
same autogen/controller failure, keep the live suite focused on the cleaner
signals above.

### Chainsaw fixture hygiene

- If a live bad controller assertion is redundant with existing `kyverno test`
  coverage, delete it rather than trying to stabilize it with more retries,
  patches, or sleeps.
- Keep `podcontroller-good.yaml` only when the positive live controller signal
  still proves something worth the time and maintenance cost.
- Use `template: false` only when the suite must opt out of Chainsaw templating.
  If the reason is not obvious from the file, leave a short comment.

### Test fixture conventions

- VPol fixtures live in `chart/tests/vpol/<policy-name>/kyverno-test/` and `chainsaw-test/`.
- MPol fixtures live in `chart/tests/mpol/<policy-name>/kyverno-test/` and `chainsaw-test/`.
- Fixtures are **plain YAML, not Helm templates** — they're packaged into a ConfigMap verbatim.
- **Chainsaw fixtures must use `registry1.dso.mil` images** (e.g. `ubi9-micro`) to pass `restrict-image-registries` in CI. Kyverno CLI fixtures use dummy image names since they never pull.

### What to test where

Policy-specific behavior (CEL expressions, pass/fail or mutation on specific resources) belongs in each policy's `kyverno-test/` fixtures. Shared helper behavior (`allContainers` concatenation, enable guards, `validationActions` mapping, `excludeNamespaces`, etc.) is tested once in `chart/unittests/vpol-shared-helpers_test.yaml` against a test fixture template.

The `allContainers` helper concatenates `containers + initContainers + ephemeralContainers`. Behavioral coverage for all three container types lives in `disallow-privileged-containers-cel/kyverno-test/resource.yaml` — it's the representative VPol for the helper. New VPols don't need to duplicate ephemeralContainers fixtures unless their CEL expression handles container types differently.
