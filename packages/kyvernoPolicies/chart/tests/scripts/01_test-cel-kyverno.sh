#!/bin/bash
# ---------------------------------------------------------------------------
# test-cel-kyverno.sh — Offline CEL evaluation inside the gluon bbtest pod
# ---------------------------------------------------------------------------
# Discovers deployed ValidatingPolicies, MutatingPolicies, and
# GeneratingPolicies, extracts them via kubectl, then runs `kyverno test`
# against fixtures mounted from the vpol, mpol, and gpol ConfigMaps in a
# single batched invocation.
#
# Prerequisites (provided by devops-tester:1.1):
#   bash, kubectl, kyverno, jq
# ---------------------------------------------------------------------------
set -euo pipefail

if [[ "${KYVERNO_CLI_TESTS_ENABLED:-true}" != "true" ]]; then
  echo "Kyverno CLI tests disabled via bbtests.kyvernoCliEnabled=false; skipping."
  exit 0
fi

source "$(dirname "$0")/_helpers.sh"
preflight_vpol

# --- Reconstruct fixtures from ConfigMap mounts ----------------------------

reconstruct_fixtures "/vpol" "/test/vpol-kyverno" "tests/vpol/"
reconstruct_fixtures "/mpol" "/test/mpol-kyverno" "tests/mpol/"
reconstruct_fixtures "/gpol" "/test/gpol-kyverno" "tests/gpol/"

# --- Discover deployed policies -------------------------------------------
# Fail hard on API errors so we never silently exit 0 with zero tests run.
# A missing CRD (server doesn't have resource type) is a legitimate skip —
# the chart may not deploy VPol/MPol/GPol CRDs on older kyverno versions.

VPOL_DEPLOYED=$(kubectl get validatingpolicies -A -o jsonpath='{.items[*].metadata.name}' 2>&1) || {
  if [[ "${VPOL_DEPLOYED}" == *"the server doesn't have a resource type"* ]]; then
    VPOL_DEPLOYED=""
  else
    echo -e "${_RED}ERROR: could not list ValidatingPolicies: ${VPOL_DEPLOYED}${_NC}"; exit 1
  fi
}
MPOL_DEPLOYED=$(kubectl get mutatingpolicies -A -o jsonpath='{.items[*].metadata.name}' 2>&1) || {
  if [[ "${MPOL_DEPLOYED}" == *"the server doesn't have a resource type"* ]]; then
    MPOL_DEPLOYED=""
  else
    echo -e "${_RED}ERROR: could not list MutatingPolicies: ${MPOL_DEPLOYED}${_NC}"; exit 1
  fi
}
GPOL_DEPLOYED=$(kubectl get generatingpolicies -A -o jsonpath='{.items[*].metadata.name}' 2>&1) || {
  if [[ "${GPOL_DEPLOYED}" == *"the server doesn't have a resource type"* ]]; then
    GPOL_DEPLOYED=""
  else
    echo -e "${_RED}ERROR: could not list GeneratingPolicies: ${GPOL_DEPLOYED}${_NC}"; exit 1
  fi
}

if [[ -z "${VPOL_DEPLOYED}" && -z "${MPOL_DEPLOYED}" && -z "${GPOL_DEPLOYED}" ]]; then
  echo "SKIP: no ValidatingPolicies, MutatingPolicies, or GeneratingPolicies deployed — nothing to test"
  exit 0
fi

# --- Collect test dirs, extracting each deployed policy --------------------

test_dirs=()
extract_errors=0

for policy_name in ${VPOL_DEPLOYED}; do
  kyverno_test_dir="/test/vpol-kyverno/${policy_name}/kyverno-test"
  if [[ ! -d "${kyverno_test_dir}" ]]; then
    echo "SKIP: no kyverno-test fixtures for vpol ${policy_name}"
    continue
  fi
  policy_file="/test/vpol-kyverno/${policy_name}/policy.yaml"
  extract_vpols_with_prefix "${policy_name}" "${policy_file}"
  if [[ ! -s "${policy_file}" ]]; then
    echo "ERROR: kubectl get produced empty output for vpol ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi
  test_dirs+=("${kyverno_test_dir}")
done

for policy_name in ${MPOL_DEPLOYED}; do
  kyverno_test_dir="/test/mpol-kyverno/${policy_name}/kyverno-test"
  if [[ ! -d "${kyverno_test_dir}" ]]; then
    echo "SKIP: no kyverno-test fixtures for mpol ${policy_name}"
    continue
  fi
  policy_file="/test/mpol-kyverno/${policy_name}/policy.yaml"
  kubectl get mutatingpolicy "${policy_name}" -o yaml > "${policy_file}"
  if [[ ! -s "${policy_file}" ]]; then
    echo "ERROR: kubectl get produced empty output for mpol ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi
  test_dirs+=("${kyverno_test_dir}")
done

for policy_name in ${GPOL_DEPLOYED}; do
  kyverno_test_dir="/test/gpol-kyverno/${policy_name}/kyverno-test"
  if [[ ! -d "${kyverno_test_dir}" ]]; then
    # GPols are opt-in per policy just like VPols and MPols. If one is
    # deployed but its fixture dir is missing, fail closed so CI cannot go
    # green with silent test coverage gaps. Unlike the older VPol/MPol
    # fixture sets, GPol coverage starts from a clean slate, so be strict
    # now rather than grandfathering in skip-on-missing behavior.
    echo "ERROR: no kyverno-test fixtures for deployed gpol ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi
  policy_file="/test/gpol-kyverno/${policy_name}/policy.yaml"
  kubectl get generatingpolicy "${policy_name}" -o yaml > "${policy_file}"
  if [[ ! -s "${policy_file}" ]]; then
    echo "ERROR: kubectl get produced empty output for gpol ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi
  test_dirs+=("${kyverno_test_dir}")
done

# --- Fail if any policy extractions failed --------------------------------

if [[ "${extract_errors}" -gt 0 ]]; then
  echo "FAIL: ${extract_errors} policy extraction(s) failed — refusing to run with incomplete coverage"
  exit 1
fi

# --- Run kyverno test in one batched invocation ----------------------------

if [[ ${#test_dirs[@]} -eq 0 ]]; then
  echo "FAIL: no kyverno-test fixtures matched any deployed policy"
  exit 1
fi

echo "==> kyverno test: running ${#test_dirs[@]} suite(s)"
if kyverno test "${test_dirs[@]}" --detailed-results; then
  echo "==> ${#test_dirs[@]} kyverno test suite(s) run, 0 failures"
else
  echo "==> ${#test_dirs[@]} kyverno test suite(s) run, FAILURES detected"
  exit 1
fi
