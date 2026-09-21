#!/bin/bash
# ---------------------------------------------------------------------------
# test-cel-chainsaw.sh — Live admission tests inside the gluon bbtest pod
# ---------------------------------------------------------------------------
# Discovers deployed ValidatingPolicies, MutatingPolicies, and
# GeneratingPolicies, reconstructs fixture directories from ConfigMap
# mounts, then runs `chainsaw test` for the deployed CEL policies.
#
# This script temporarily patches live policies in-cluster during the test:
# - quiet_cpols / quiet_vpols keep unrelated validation policies from blocking
#   fixture resources
# - quiet_mpols keeps mutating policies from "fixing" resources that VPol live
#   suites expect to be denied
#
# VPol + GPol run first while MPols are quiet, then MPols run in a second
# phase after restore_mpols. Combining the phases in one script still avoids
# duplicate quiet_cpols/quiet_vpols cycles (~2 min overhead each).
#
# Prerequisites (provided by devops-tester:1.1):
#   bash, kubectl, chainsaw, jq
# ---------------------------------------------------------------------------
set -euo pipefail

if [[ "${CHAINSAW_ENABLED:-true}" != "true" ]]; then
  echo "Chainsaw disabled via bbtests.chainsawEnabled=false; skipping."
  exit 0
fi

source "$(dirname "$0")/_helpers.sh"
preflight_vpol

# --- Reconstruct fixtures from ConfigMap mounts ----------------------------

VPOL_MOUNT="/vpol"
VPOL_WORKDIR="/test/vpol-chainsaw"
reconstruct_fixtures "${VPOL_MOUNT}" "${VPOL_WORKDIR}" "tests/vpol/"

MPOL_MOUNT="/mpol"
MPOL_WORKDIR="/test/mpol-chainsaw"
reconstruct_fixtures "${MPOL_MOUNT}" "${MPOL_WORKDIR}" "tests/mpol/"

GPOL_MOUNT="/gpol"
GPOL_WORKDIR="/test/gpol-chainsaw"
reconstruct_fixtures "${GPOL_MOUNT}" "${GPOL_WORKDIR}" "tests/gpol/"

# --- Discover deployed policies -------------------------------------------
# Fail hard on API errors so we never silently exit 0 with zero tests run.
# A missing CRD (server doesn't have resource type) is a legitimate skip —
# the chart may not deploy VPol/MPol/GPol CRDs on older kyverno versions.

VPOL_DEPLOYED=$(kubectl get validatingpolicies -A -o jsonpath='{.items[*].metadata.name}' 2>&1) || {
  # CRD not installed is a legitimate skip; any other error is fatal.
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

# --- Collect test dirs by policy kind -------------------------------------

vpol_test_dirs=()
mpol_test_dirs=()
gpol_test_dirs=()
extract_errors=0

for policy_name in ${VPOL_DEPLOYED}; do
  chainsaw_test_dir="${VPOL_WORKDIR}/${policy_name}/chainsaw-test"
  if [[ ! -d "${chainsaw_test_dir}" ]]; then
    echo "SKIP: no chainsaw-test fixtures for ${policy_name}"
    continue
  fi

  policy_file="${VPOL_WORKDIR}/${policy_name}/policy.yaml"
  kubectl get validatingpolicy "${policy_name}" -o yaml > "${policy_file}"

  if [[ ! -s "${policy_file}" ]]; then
    echo "ERROR: kubectl get produced empty output for ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi

  vpol_test_dirs+=("${chainsaw_test_dir}")
done

# --- Collect test dirs for MPols ------------------------------------------
# MPols run in a second phase after restore_mpols. This keeps mutating policies
# from "fixing" resources that a VPol live suite expects to be denied.

for policy_name in ${MPOL_DEPLOYED}; do
  chainsaw_test_dir="${MPOL_WORKDIR}/${policy_name}/chainsaw-test"
  if [[ ! -d "${chainsaw_test_dir}" ]]; then
    echo "SKIP: no chainsaw-test fixtures for ${policy_name}"
    continue
  fi

  policy_file="${MPOL_WORKDIR}/${policy_name}/policy.yaml"
  kubectl get mutatingpolicy "${policy_name}" -o yaml > "${policy_file}"

  if [[ ! -s "${policy_file}" ]]; then
    echo "ERROR: kubectl get produced empty output for ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi

  mpol_test_dirs+=("${chainsaw_test_dir}")
done

# --- Collect test dirs for GPols ------------------------------------------
# GPols don't need quiet/restore — generation doesn't block other resources.

for policy_name in ${GPOL_DEPLOYED}; do
  chainsaw_test_dir="${GPOL_WORKDIR}/${policy_name}/chainsaw-test"
  if [[ ! -d "${chainsaw_test_dir}" ]]; then
    # GPols are opt-in per policy just like VPols and MPols. If one is
    # deployed but its fixture dir is missing, fail closed so CI cannot go
    # green with silent test coverage gaps. Unlike the older VPol/MPol
    # fixture sets, GPol coverage starts from a clean slate, so be strict
    # now rather than grandfathering in skip-on-missing behavior.
    echo "ERROR: no chainsaw-test fixtures for deployed gpol ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi

  policy_file="${GPOL_WORKDIR}/${policy_name}/policy.yaml"
  kubectl get generatingpolicy "${policy_name}" -o yaml > "${policy_file}"

  if [[ ! -s "${policy_file}" ]]; then
    echo "ERROR: kubectl get produced empty output for ${policy_name}"
    extract_errors=$((extract_errors + 1))
    continue
  fi

  gpol_test_dirs+=("${chainsaw_test_dir}")
done

if [[ "${extract_errors}" -gt 0 ]]; then
  echo "FAIL: ${extract_errors} policy extraction(s) failed — refusing to run with incomplete coverage"
  exit 1
fi

# --- Quiet policies and settle webhooks before running chainsaw -----------
# Defang all CPols and VPols so they don't block chainsaw's test resources.
# Namespace-scoped Deny (matchConditions) isolates each VPol test, but other
# VPols not under test could still reject fixtures. quiet_vpols catches that.
quiet_cpols
quiet_vpols
quiet_mpols
quiet_mutating_cpols
trap 'restore_mutating_cpols; restore_mpols; restore_vpols; restore_cpols' EXIT
# On upgrade jobs, CPols start at Enforce. quiet_cpols patches the resources
# to Audit, but the kyverno admission webhook reloads asynchronously. Without
# a settle window, chainsaw can fire before the webhook sees Audit and the old
# Enforce action rejects test fixtures. Clean install doesn't hit this because
# CPols start at Audit from test-values.yaml.
#
# There's no API to poll "has the webhook reloaded this policy" for v1 CPols
# (unlike VPol bindings which have a pollable spec). A fixed settle window is
# the standard approach in kyverno's own test suites.
echo -e "${_CYN}Waiting for webhook to reconcile policy patches...${_NC}"
sleep 5

# --- Run VPol, then GPol, then MPol chainsaw after restore -----------------

if [[ ${#vpol_test_dirs[@]} -eq 0 && ${#mpol_test_dirs[@]} -eq 0 && ${#gpol_test_dirs[@]} -eq 0 ]]; then
  echo "FAIL: no chainsaw-test directories found for any deployed policy."
  echo "  Either the test ConfigMap is missing fixture dirs, or no VPol/MPol/GPol"
  echo "  policies are deployed. Check VPOL_DEPLOYED='${VPOL_DEPLOYED}',"
  echo "  MPOL_DEPLOYED='${MPOL_DEPLOYED}', and GPOL_DEPLOYED='${GPOL_DEPLOYED}'"
  echo "  against the ConfigMap contents."
  exit 1
fi

# Run VPol live tests first while MPols are quiet.
if [[ ${#vpol_test_dirs[@]} -gt 0 ]]; then
  echo "==> chainsaw: running ${#vpol_test_dirs[@]} vpol test(s)"
  if ! chainsaw test --parallel 8 --apply-timeout 30s --delete-timeout 30s "${vpol_test_dirs[@]}"; then
    echo "==> ${#vpol_test_dirs[@]} vpol chainsaw test(s) run, FAILURES detected"
    exit 1
  fi
  echo "==> ${#vpol_test_dirs[@]} vpol chainsaw test(s) run, 0 failures"
fi

# Run GPol live tests next, still while MPols are quiet.
if [[ ${#gpol_test_dirs[@]} -gt 0 ]]; then
  echo "==> chainsaw: running ${#gpol_test_dirs[@]} gpol test(s)"
  if ! chainsaw test --parallel 1 --apply-timeout 30s --delete-timeout 30s "${gpol_test_dirs[@]}"; then
    echo "==> ${#gpol_test_dirs[@]} gpol chainsaw test(s) run, FAILURES detected"
    exit 1
  fi
  echo "==> ${#gpol_test_dirs[@]} gpol chainsaw test(s) run, 0 failures"
fi

# Re-enable MPols, give the webhook time to reconcile, then run their suites.
# restore_mpols clears QUIETED_MPOLS so the EXIT trap becomes a no-op for MPols
# after this point. Why-not-what: normal success path wants MPols live again
# before chainsaw runs, but error paths still need best-effort restore.
restore_mpols
if [[ ${#mpol_test_dirs[@]} -gt 0 ]]; then
  echo -e "${_CYN}Waiting for mpol webhook to reconcile restored matchConditions...${_NC}"
  sleep 5
  echo "==> chainsaw: running ${#mpol_test_dirs[@]} mpol test(s)"
  if ! chainsaw test --parallel 8 --apply-timeout 30s --delete-timeout 30s "${mpol_test_dirs[@]}"; then
    echo "==> ${#mpol_test_dirs[@]} mpol chainsaw test(s) run, FAILURES detected"
    exit 1
  fi
  echo "==> ${#mpol_test_dirs[@]} mpol chainsaw test(s) run, 0 failures"
fi

# No explicit restore here -- the EXIT trap (above) handles both normal and
# error exits. Gluon runs scripts as top-level bash processes, so EXIT
# always fires. The only skip case is SIGKILL, which would skip explicit
# restore too. See 05_test-cpols.sh for the same pattern.
