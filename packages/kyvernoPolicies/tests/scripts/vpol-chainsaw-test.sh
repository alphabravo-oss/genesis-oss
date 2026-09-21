#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# vpol-chainsaw-test.sh — Live-cluster integration tests for BB VPol templates
# ---------------------------------------------------------------------------
#
# Renders each celPoliciesBeta ValidatingPolicy via helm template, then runs
# its chainsaw test suite against a real cluster. Chainsaw applies the VPol,
# patches it to Deny, waits for the webhook, then creates good/bad resources
# to verify admission behavior end-to-end.
#
# Prerequisites:
#   - helm, yq, chainsaw on PATH
#   - A running cluster with Kyverno installed (VPol CRD available)
#   - No other enforcing policies that would reject the test fixtures
#     (uninstall kyverno-policies chart or set all CPols to Audit first)
#
# Test discovery:
#   Auto-discovers chart/tests/vpol/**/chainsaw-test/ directories. Each must have
#   a sibling kyverno-test/kyverno-test.yaml to provide the policy name.
#
# Values-key resolution:
#   One values key can produce multiple named VPols (e.g.
#   disallow-auto-mount-service-account-token-cel renders both the Pod VPol by
#   that name and a -serviceaccounts variant). The script strips the
#   `-serviceaccounts` / `-controllers` suffix to find the shared values key.
#
# Rendered artifacts:
#   Each test gets a transient policy.yaml rendered next to chainsaw-test/.
#   All rendered files are cleaned up on exit (even on failure) via trap.
#
# Usage: tests/scripts/vpol-chainsaw-test.sh [policy-name]
#   policy-name: optional; if given, only that policy's chainsaw test runs.
#                Must match the directory name under chart/tests/vpol/.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHART_DIR="${REPO_ROOT}/chart"
TESTS_DIR="${REPO_ROOT}/chart/tests/vpol"
TEST_VALUES="${REPO_ROOT}/tests/test-values.yaml"

FILTER="${1:-}"

failures=0
tested=0
rendered_files=()

# Clean up rendered policy.yaml files on exit, even if the script fails.
cleanup() {
  for f in "${rendered_files[@]}"; do
    rm -f "${f}"
  done
}
trap cleanup EXIT

# --- Main loop: discover and run each chainsaw test -----------------------

for test_dir in $(find "${TESTS_DIR}" -name 'chainsaw-test' -type d 2>/dev/null); do
  policy_dir="$(dirname "${test_dir}")"

  if [[ -n "${FILTER}" && "$(basename "${policy_dir}")" != "${FILTER}" ]]; then
    continue
  fi

  # The policy name comes from the sibling kyverno-test.yaml, which is the
  # single source of truth shared by both the kyverno CLI and chainsaw tests.
  kyverno_test="${policy_dir}/kyverno-test/kyverno-test.yaml"
  if [[ ! -f "${kyverno_test}" ]]; then
    echo "SKIP: no kyverno-test/kyverno-test.yaml alongside ${test_dir}"
    continue
  fi

  policy_name="$(yq '.metadata.name' "${kyverno_test}")"
  if [[ -z "${policy_name}" || "${policy_name}" == "null" ]]; then
    echo "ERROR: could not extract policy name from ${kyverno_test}"
    failures=$((failures + 1))
    continue
  fi

  values_key="${policy_name%-serviceaccounts}"
  values_key="${values_key%-controllers}"

  echo "==> Chainsaw test: ${policy_name} (values key: ${values_key})"

  rendered="${policy_dir}/policy.yaml"
  helm template kp "${CHART_DIR}" \
    --values <(yq "{\"celPoliciesBeta\": (.kyvernoPolicies.values.celPoliciesBeta | pick([\"${values_key}\"]))}" "${TEST_VALUES}") \
    --set "celPoliciesBeta.${values_key}.enabled=true" \
    | yq "select(.kind == \"ValidatingPolicy\" and (.metadata.name | test(\"^${values_key}\")))" \
    > "${rendered}"
  rendered_files+=("${rendered}")

  if [[ ! -s "${rendered}" ]]; then
    echo "ERROR: helm template produced no ValidatingPolicy for ${policy_name}"
    failures=$((failures + 1))
    continue
  fi

  # Run the chainsaw test. Chainsaw creates a temp namespace, applies the
  # rendered VPol, patches it to Deny, then exercises good/bad fixtures.
  if chainsaw test "${test_dir}"; then
    echo "    PASS: ${policy_name}"
  else
    echo "    FAIL: ${policy_name}"
    failures=$((failures + 1))
  fi

  tested=$((tested + 1))
done

# --- Summary --------------------------------------------------------------

if [[ "${tested}" -eq 0 ]]; then
  if [[ -n "${FILTER}" ]]; then
    echo "ERROR: no VPol chainsaw-test directory matched '${FILTER}' under ${TESTS_DIR}"
  else
    echo "ERROR: no VPol chainsaw-test directories found under ${TESTS_DIR}"
  fi
  exit 1
fi

echo ""
echo "==> ${tested} VPol chainsaw test(s) run, ${failures} failure(s)"

if [[ "${failures}" -gt 0 ]]; then
  exit 1
fi
