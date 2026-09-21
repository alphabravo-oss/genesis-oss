#!/bin/bash
# ---------------------------------------------------------------------------
# _helpers.sh — Shared helpers for gluon bbtest scripts
# ---------------------------------------------------------------------------
# Gluon will "execute" this file as a script — the only top-level side effect
# is a timestamp log (see bottom). Test scripts source this file and call the
# functions they need.
#
# Usage (from a test script):
#   source "$(dirname "$0")/_helpers.sh"
#   preflight_vpol
# ---------------------------------------------------------------------------

# --- Colors ---------------------------------------------------------------
_RED='\033[0;31m'
_GRN='\033[0;32m'
_YEL='\033[0;33m'
_CYN='\033[0;36m'
_NC='\033[0m'

# --- Preflight checks ----------------------------------------------------

# Verify that all listed binaries are on PATH. Exits non-zero with a clear
# message if any are missing.
preflight_require_binaries() {
  local missing=()
  for bin in "$@"; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      missing+=("$bin")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo -e "${_RED}PREFLIGHT FAIL${_NC}: missing required binaries: ${missing[*]}"
    echo "Expected in devops-tester:1.1 — is the correct bbtest image configured?"
    exit 1
  fi
}

# Verify that grep supports -E (extended regex) and -o (only matching).
# BusyBox grep supports these; GNU grep -P (Perl) is NOT guaranteed.
preflight_require_grep_extended() {
  if ! echo "test123" | grep -oE '[0-9]+' >/dev/null 2>&1; then
    echo -e "${_RED}PREFLIGHT FAIL${_NC}: grep does not support -oE (extended regex)"
    exit 1
  fi
}

# Run all standard preflight checks for VPol test scripts.
preflight_vpol() {
  preflight_require_binaries kubectl kyverno chainsaw jq
  preflight_require_grep_extended
}

# --- Fixture reconstruction -----------------------------------------------
# ConfigMap keys use __ as path separator (e.g. tests__vpol__foo__kyverno-test__bar.yaml).
# Strip the leading tests__<kind>__ prefix and recreate the nested directory tree.
#
# Usage: reconstruct_fixtures <mount_dir> <work_dir> <prefix>
#   mount_dir: ConfigMap mount (e.g. /vpol, /mpol)
#   work_dir:  destination for reconstructed tree
#   prefix:    path prefix to strip (e.g. "tests/vpol/", "tests/mpol/")
reconstruct_fixtures() {
  local mount_dir="${1}" work_dir="${2}" prefix="${3}"
  if [[ ! -d "${mount_dir}" ]]; then
    echo -e "${_RED}ERROR: fixture mount ${mount_dir} does not exist${_NC}" >&2
    return 1
  fi
  if [[ -z "$(ls -A "${mount_dir}" 2>/dev/null)" ]]; then
    echo -e "${_YEL}WARNING: fixture mount ${mount_dir} is empty${_NC}" >&2
    return 0
  fi
  mkdir -p "${work_dir}"
  for key_file in "${mount_dir}"/*; do
    key="$(basename "${key_file}")"
    rel_path="${key//__//}"
    rel_path="${rel_path#"${prefix}"}"
    target="${work_dir}/${rel_path}"
    mkdir -p "$(dirname "${target}")"
    cp "${key_file}" "${target}"
  done
}

# --- Policy quiet/restore helpers ----------------------------------------
# Patch all CPols/VPols to Audit before tests, restore after.
# Prevents cross-policy interference during targeted enforce/deny testing.

# Poll multiple VPol bindings in a single loop instead of waiting for each
# one sequentially. With N bindings the old approach could block for up to
# N*TIMEOUT seconds; this caps it at TIMEOUT total.
#
# How it works: each tick we check every still-pending binding. If its
# validationActions[0] matches the target, we log success and drop it from the
# list. Once the list is empty (or we hit the timeout) we stop.
#
# Usage: wait_for_vpol_bindings ACTION TIMEOUT NAME [NAME ...]
wait_for_vpol_bindings() {
  local action=$1
  local timeout=$2
  shift 2
  local -a pending=("$@")

  if [[ ${#pending[@]} -eq 0 ]]; then return 0; fi

  echo -e "  waiting for ${#pending[@]} vpol binding(s) to reconcile..."
  local elapsed=0
  while [[ ${#pending[@]} -gt 0 && "$elapsed" -le "$timeout" ]]; do
    # Check every binding that hasn't reconciled yet
    local -a still_waiting=()
    for name in "${pending[@]}"; do
      local current
      current=$(kubectl get validatingadmissionpolicybinding "$name" \
        -o jsonpath='{.spec.validationActions[0]}' 2>/dev/null || true)
      if [[ "$current" = "$action" ]]; then
        echo -e "    ${name}: ${_GRN}OK${_NC} (${elapsed}s)"
      else
        still_waiting+=("$name")
      fi
    done
    # Replace pending with only the bindings that aren't ready yet
    pending=("${still_waiting[@]}")
    if [[ ${#pending[@]} -gt 0 ]]; then
      ((elapsed+=1))
      sleep 1
    fi
  done

  # Anything still in the list never reconciled within the timeout
  for name in "${pending[@]}"; do
    echo -e "    ${name}: ${_YEL}TIMEOUT${_NC} (binding may still have stale action)"
  done
}

# Patch all CPols to Audit. Populates SAVED_CPOL_ACTIONS for restore_cpols.
quiet_cpols() {
  declare -gA SAVED_CPOL_ACTIONS
  local all_cpols
  all_cpols=$(kubectl get cpol --no-headers -o custom-columns=":metadata.name" 2>/dev/null || true)
  if [[ -z "$all_cpols" ]]; then return 0; fi

  echo -e "${_CYN}Setup: Set all cpols to Audit${_NC}"
  for cpol in $all_cpols; do
    local current
    # Empty output means the field isn't set — Audit is the correct default.
    # A non-zero exit is an API error; don't guess, fail so we don't silently
    # downgrade an Enforce policy to Audit with no restore.
    if ! current=$(kubectl get cpol "$cpol" -o jsonpath='{.spec.validationFailureAction}' 2>&1); then
      echo -e "${_RED}ERROR: could not read ${cpol}: ${current}${_NC}"
      return 1
    fi
    current="${current:-Audit}"
    SAVED_CPOL_ACTIONS[$cpol]="$current"
    if [ "$current" != "Audit" ]; then
      if ! kubectl patch cpol "$cpol" -p '{"spec":{"validationFailureAction":"Audit"}}' --type=merge; then
        echo -e "${_RED}ERROR: could not quiet ${cpol}, aborting${_NC}"
        return 1
      fi
    fi
  done
}

# Restore CPol validationFailureActions from SAVED_CPOL_ACTIONS.
# Called from EXIT traps; continues on failure.
restore_cpols() {
  local saved_count
  set +u
  saved_count=${#SAVED_CPOL_ACTIONS[@]}
  set -u
  if [[ ${saved_count} -eq 0 ]]; then return 0; fi
  echo -e "${_CYN}Cleanup: Restore cpol validationFailureActions${_NC}"
  for cpol in "${!SAVED_CPOL_ACTIONS[@]}"; do
    local original="${SAVED_CPOL_ACTIONS[$cpol]}"
    if [ "$original" != "Audit" ]; then
      if ! kubectl patch cpol "$cpol" \
           -p "{\"spec\":{\"validationFailureAction\":\"${original}\"}}" --type=merge; then
        echo -e "${_YEL}Cleanup: could not restore ${cpol}, continuing${_NC}"
      fi
    fi
  done
}

# Patch all VPols to Audit and poll bindings until reconciled.
# Populates SAVED_VPOL_ACTIONS for restore_vpols.
quiet_vpols() {
  declare -gA SAVED_VPOL_ACTIONS
  local all_vpols
  all_vpols=$(kubectl get vpol --no-headers -o custom-columns=":metadata.name" 2>/dev/null || true)
  if [[ -z "$all_vpols" ]]; then return 0; fi

  echo -e "${_CYN}Setup: Set all vpols to Audit${_NC}"
  for vpol in $all_vpols; do
    local current
    if ! current=$(kubectl get vpol "$vpol" -o jsonpath='{.spec.validationActions[0]}' 2>&1); then
      echo -e "${_RED}ERROR: could not read ${vpol}: ${current}${_NC}"
      return 1
    fi
    current="${current:-Audit}"
    SAVED_VPOL_ACTIONS[$vpol]="$current"
    if [ "$current" != "Audit" ]; then
      # JSON patch (not merge) because validationActions is an array —
      # merge-patch appends to arrays instead of replacing them.
      if ! kubectl patch vpol "$vpol" --type=json \
           -p '[{"op":"replace","path":"/spec/validationActions","value":["Audit"]}]'; then
        echo -e "${_RED}ERROR: could not quiet ${vpol}, aborting${_NC}"
        return 1
      fi
    fi
  done

  # Collect the VPols we actually patched above — only those need a binding
  # wait. VPols that were already Audit didn't change, so their bindings are
  # already correct.
  local -a changed=()
  for vpol in $all_vpols; do
    if [ "${SAVED_VPOL_ACTIONS[$vpol]}" != "Audit" ]; then
      changed+=("$vpol")
    fi
  done
  wait_for_vpol_bindings "Audit" 120 "${changed[@]}"
}

# Restore VPol validationActions and remove stale matchConditions from SAVED_VPOL_ACTIONS.
# Called from EXIT traps; continues on failure.
# Parallel chainsaw tests add a scope-to-test-ns matchCondition that must be cleaned up
# explicitly — chainsaw's built-in cleanup may not fully remove it on partial failure.
restore_vpols() {
  local saved_count
  set +u
  saved_count=${#SAVED_VPOL_ACTIONS[@]}
  set -u
  if [[ ${saved_count} -eq 0 ]]; then return 0; fi
  echo -e "${_CYN}Cleanup: Restore vpol validationActions${_NC}"
  for vpol in "${!SAVED_VPOL_ACTIONS[@]}"; do
    local original="${SAVED_VPOL_ACTIONS[$vpol]}"
    if ! kubectl patch vpol "$vpol" --type=json \
         -p "[{\"op\":\"replace\",\"path\":\"/spec/validationActions\",\"value\":[\"${original}\"]}]"; then
      echo -e "${_YEL}Cleanup: could not restore ${vpol}, continuing with matchCondition cleanup${_NC}"
    fi
    # Remove scope-to-test-ns matchCondition left by parallel chainsaw tests.
    # Uses grep to find the index, then JSON patch to delete it. No-op if absent.
    # A stale scope-to-test-ns would limit policy enforcement to the test namespace,
    # so we log loudly on failure rather than suppressing errors.
    local idx
    idx=$(kubectl get vpol "$vpol" \
      -o jsonpath='{range .spec.matchConditions[*]}{.name}{"\n"}{end}' \
      | grep -n '^scope-to-test-ns$' | head -1 | cut -d: -f1) || true
    if [[ -n "$idx" ]]; then
      local zero_idx=$((idx - 1))
      if ! kubectl patch vpol "$vpol" --type=json \
           -p "[{\"op\":\"remove\",\"path\":\"/spec/matchConditions/${zero_idx}\"}]"; then
        echo -e "${_RED}WARNING: failed to remove stale scope-to-test-ns from ${vpol} at index ${zero_idx}${_NC}"
        echo -e "${_RED}  This matchCondition may limit enforcement to the test namespace only!${_NC}"
      fi
    fi
  done
}

# Append a matchCondition that can never match so MPols stay out of the VPol
# chainsaw phase. We run MPol chainsaw in a second phase and remove this guard
# first. Why-not-what: `add-default-capability-drop-cel` can "fix" bad
# `require-drop-all-capabilities-cel` fixtures before the deny assertion runs.
# Quieting MPols for the VPol phase preserves clean live validation signals.
quiet_mpols() {
  declare -ga QUIETED_MPOLS
  QUIETED_MPOLS=()
  local all_mpols
  all_mpols=$(kubectl get mpol --no-headers -o custom-columns=":metadata.name" 2>/dev/null || true)
  if [[ -z "$all_mpols" ]]; then return 0; fi

  echo -e "${_CYN}Setup: Quiet mpols during VPol chainsaw phase${_NC}"
  for mpol in $all_mpols; do
    local patch
    if kubectl get mpol "$mpol" -o jsonpath='{.spec.matchConditions}' 2>/dev/null | grep -q .; then
      patch='[{"op":"add","path":"/spec/matchConditions/-","value":{"name":"disable-during-vpol-phase","expression":"has(object.metadata.namespace) && object.metadata.namespace == \"__bb-never-match__\""}}]'
    else
      patch='[{"op":"add","path":"/spec/matchConditions","value":[{"name":"disable-during-vpol-phase","expression":"has(object.metadata.namespace) && object.metadata.namespace == \"__bb-never-match__\""}]}]'
    fi
    local patch_output
    if ! patch_output=$(kubectl patch mpol "$mpol" --type=json -p "$patch" 2>&1); then
      echo -e "${_RED}ERROR: could not quiet ${mpol}, aborting${_NC}"
      echo "$patch_output"
      return 1
    fi
    QUIETED_MPOLS+=("$mpol")
  done
}

restore_mpols() {
  if ! declare -p QUIETED_MPOLS >/dev/null 2>&1; then return 0; fi
  local quieted_count
  set +u
  quieted_count=${#QUIETED_MPOLS[@]}
  set -u
  if [[ ${quieted_count} -eq 0 ]]; then return 0; fi
  echo -e "${_CYN}Cleanup: Restore mpol matchConditions${_NC}"
  for mpol in "${QUIETED_MPOLS[@]}"; do
    local idxs
    idxs=$(kubectl get mpol "$mpol" \
      -o jsonpath='{range .spec.matchConditions[*]}{.name}{"\n"}{end}' \
      | grep -n '^disable-during-vpol-phase$' | cut -d: -f1 | sort -rn) || true
    if [[ -n "$idxs" ]]; then
      local idx
      while read -r idx; do
        [[ -z "$idx" ]] && continue
        local zero_idx=$((idx - 1))
        local patch_output
        if ! patch_output=$(kubectl patch mpol "$mpol" --type=json \
             -p "[{\"op\":\"remove\",\"path\":\"/spec/matchConditions/${zero_idx}\"}]" 2>&1); then
          echo -e "${_YEL}Cleanup: could not restore ${mpol}, continuing${_NC}"
          echo "$patch_output"
          break
        fi
      done <<< "$idxs"
    fi
    # Remove scope-to-test-ns matchCondition left by parallel chainsaw tests.
    # A stale scope-to-test-ns would limit the mutator to the (now-deleted)
    # chainsaw namespace, so we log loudly on failure.
    local scope_idx
    scope_idx=$(kubectl get mpol "$mpol" \
      -o jsonpath='{range .spec.matchConditions[*]}{.name}{"\n"}{end}' \
      | grep -n '^scope-to-test-ns$' | head -1 | cut -d: -f1) || true
    if [[ -n "$scope_idx" ]]; then
      local zero_idx=$((scope_idx - 1))
      if ! kubectl patch mpol "$mpol" --type=json \
           -p "[{\"op\":\"remove\",\"path\":\"/spec/matchConditions/${zero_idx}\"}]"; then
        echo -e "${_RED}WARNING: failed to remove stale scope-to-test-ns from ${mpol} at index ${zero_idx}${_NC}"
        echo -e "${_RED}  This matchCondition may limit the mutator to the test namespace only!${_NC}"
      fi
    fi
  done
  QUIETED_MPOLS=()
}

QUIET_CPOLS_DURING_CEL_TESTS=(
  "add-default-capability-drop"
  "add-default-securitycontext"
)

# Add a precondition to each rule in the QUIET_CPOLS_DURING_CEL_TESTS allowlist
# that skips chainsaw-* namespaces. CPol mutate rules ignore
# validationFailureAction (which only governs validate rules), so quiet_cpols
# can't defang them. Populates SAVED_CPOL_MUTATE_PRECONDITIONS for
# restore_mutating_cpols.
quiet_mutating_cpols() {
  declare -gA SAVED_CPOL_MUTATE_PRECONDITIONS

  echo -e "${_CYN}Setup: Patch mutating cpols to skip chainsaw-* namespaces${_NC}"
  local skip_pc
  # shellcheck disable=SC2016
  skip_pc='{"all":[{"key":"{{ starts_with(request.namespace || `\"\"`, `\"chainsaw-\"`) }}","operator":"Equals","value":false}]}'

  for cpol in "${QUIET_CPOLS_DURING_CEL_TESTS[@]}"; do
    if ! kubectl get cpol "$cpol" >/dev/null 2>&1; then
      continue
    fi
    local rule_indices
    rule_indices=$(kubectl get cpol "$cpol" -o json \
      | jq -r '[.spec.rules[] | has("mutate")] | to_entries[] | select(.value) | .key')
    for idx in $rule_indices; do
      local key="${cpol}/${idx}"
      # Save current preconditions; jq returns 'null' if absent.
      SAVED_CPOL_MUTATE_PRECONDITIONS[$key]=$(kubectl get cpol "$cpol" -o json \
        | jq -c ".spec.rules[$idx].preconditions // null")
      # `replace` if the field already exists, otherwise `add`. Tried in that
      # order because `replace` errors when the path is absent.
      if ! kubectl patch cpol "$cpol" --type=json \
           -p "[{\"op\":\"replace\",\"path\":\"/spec/rules/${idx}/preconditions\",\"value\":${skip_pc}}]" 2>/dev/null; then
        if ! kubectl patch cpol "$cpol" --type=json \
             -p "[{\"op\":\"add\",\"path\":\"/spec/rules/${idx}/preconditions\",\"value\":${skip_pc}}]"; then
          echo -e "${_RED}ERROR: could not patch ${cpol} rule ${idx}, aborting${_NC}"
          return 1
        fi
      fi
    done
  done
}

# Restore CPol mutate-rule preconditions from SAVED_CPOL_MUTATE_PRECONDITIONS.
# Called from EXIT traps; continues on failure.
restore_mutating_cpols() {
  if ! declare -p SAVED_CPOL_MUTATE_PRECONDITIONS >/dev/null 2>&1; then return 0; fi
  local saved_count
  set +u
  saved_count=${#SAVED_CPOL_MUTATE_PRECONDITIONS[@]}
  set -u
  if [[ ${saved_count} -eq 0 ]]; then return 0; fi
  echo -e "${_CYN}Cleanup: Restore mutating cpol preconditions${_NC}"
  for key in "${!SAVED_CPOL_MUTATE_PRECONDITIONS[@]}"; do
    local cpol="${key%/*}"
    local idx="${key##*/}"
    local original="${SAVED_CPOL_MUTATE_PRECONDITIONS[$key]}"
    if [[ "$original" == "null" || -z "$original" ]]; then
      if ! kubectl patch cpol "$cpol" --type=json \
           -p "[{\"op\":\"remove\",\"path\":\"/spec/rules/${idx}/preconditions\"}]" 2>/dev/null; then
        echo -e "${_YEL}Cleanup: could not remove preconditions on ${cpol} rule ${idx}, continuing${_NC}"
      fi
    else
      if ! kubectl patch cpol "$cpol" --type=json \
           -p "[{\"op\":\"replace\",\"path\":\"/spec/rules/${idx}/preconditions\",\"value\":${original}}]"; then
        echo -e "${_YEL}Cleanup: could not restore preconditions on ${cpol} rule ${idx}, continuing${_NC}"
      fi
    fi
  done
  unset SAVED_CPOL_MUTATE_PRECONDITIONS
}

# --- Timing ----------------------------------------------------------------
# Prints a UTC timestamp each time a script sources this file (or when gluon
# runs it directly). Diff consecutive timestamps to measure script duration.
echo -e "${_CYN}$(date -u '+%Y-%m-%dT%H:%M:%SZ') — ${BASH_SOURCE[0]##*/} sourced by ${0##*/}${_NC}"
