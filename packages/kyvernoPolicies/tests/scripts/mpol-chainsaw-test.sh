#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# mpol-chainsaw-test.sh — Live-cluster integration tests for BB MPol templates
# ---------------------------------------------------------------------------
#
# Renders each celPoliciesBeta MutatingPolicy via helm template, applies it
# to the cluster so the Kyverno webhook has time to reconcile, then runs its
# chainsaw test suite. Chainsaw exercises good/bad fixtures and asserts the
# mutation outcome.
#
# Prerequisites:
#   - helm, yq, chainsaw, kubectl on PATH
#   - A running cluster with Kyverno installed (MPol CRD available)
#
# Test discovery:
#   Auto-discovers chart/tests/mpol/**/chainsaw-test/ directories. Each must
#   have a sibling kyverno-test/kyverno-test.yaml to provide the policy name.
#
# Values-key resolution:
#   One values key can produce multiple named MPols (e.g.
#   update-automountserviceaccounttokens-cel renders both the Pod MPol by
#   that name and a -serviceaccounts variant). The script strips the
#   `-serviceaccounts` / `-controllers` suffix to find the shared values key.
#
# Rendered artifacts:
#   Each test gets a transient policy.yaml rendered next to chainsaw-test/.
#   All rendered files are cleaned up on exit (even on failure) via trap.
#
# Usage: tests/scripts/mpol-chainsaw-test.sh [policy-name]
#   policy-name: optional; if given, only that policy's chainsaw test runs.
#                Must match the directory name under chart/tests/mpol/.
# ---------------------------------------------------------------------------
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHART_DIR="${REPO_ROOT}/chart"
TESTS_DIR="${REPO_ROOT}/chart/tests/mpol"
TEST_VALUES="${REPO_ROOT}/tests/test-values.yaml"

FILTER="${1:-}"

failures=0
tested=0
rendered_files=()

cleanup() {
  for f in "${rendered_files[@]}"; do
    rm -f "${f}"
  done
}
trap cleanup EXIT

for test_dir in $(find "${TESTS_DIR}" -name 'chainsaw-test' -type d 2>/dev/null); do
  policy_dir="$(dirname "${test_dir}")"

  if [[ -n "${FILTER}" && "$(basename "${policy_dir}")" != "${FILTER}" ]]; then
    continue
  fi

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
    --namespace kyverno \
    --values <(yq "{\"celPoliciesBeta\": (.kyvernoPolicies.values.celPoliciesBeta | pick([\"${values_key}\"]))}" "${TEST_VALUES}") \
    --set "celPoliciesBeta.${values_key}.enabled=true" \
    | yq "select((.kind == \"MutatingPolicy\" or .kind == \"PolicyException\") and (.metadata.name | test(\"^${values_key}\")))" \
    > "${rendered}"
  rendered_files+=("${rendered}")

  if [[ ! -s "${rendered}" ]]; then
    echo "ERROR: helm template produced no MutatingPolicy for ${policy_name}"
    failures=$((failures + 1))
    continue
  fi

  if chainsaw test --apply-timeout 30s --delete-timeout 30s "${test_dir}"; then
    echo "    PASS: ${policy_name}"
  else
    echo "    FAIL: ${policy_name}"
    failures=$((failures + 1))
  fi

  tested=$((tested + 1))
done

if [[ "${tested}" -eq 0 ]]; then
  if [[ -n "${FILTER}" ]]; then
    echo "ERROR: no MPol chainsaw-test directory matched '${FILTER}' under ${TESTS_DIR}"
  else
    echo "ERROR: no MPol chainsaw-test directories found under ${TESTS_DIR}"
  fi
  exit 1
fi

echo ""
echo "==> ${tested} MPol chainsaw test(s) run, ${failures} failure(s)"

if [[ "${failures}" -gt 0 ]]; then
  exit 1
fi
