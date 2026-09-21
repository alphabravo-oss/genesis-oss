#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[0;33m'
CYN='\033[0;36m'
NC='\033[0m'

NAMESPACE="kyverno-bbtest"
SECRET_NAME="kyverno-bbtest-secret"
POLICY_NAME="sync-secrets"

cleanup() {
  local rc=$?
  echo "Clean Up"
  kubectl delete secret $SECRET_NAME -n $NAMESPACE --ignore-not-found || true
  kubectl delete -f /yaml/$POLICY_NAME.yaml --ignore-not-found || true
  kubectl delete secret $SECRET_NAME -n kyverno --ignore-not-found || true
  kubectl delete namespace $NAMESPACE --ignore-not-found || true
  if [ $rc -eq 0 ]; then
    echo -e "TEST: ${GRN}PASS${NC}"
  else
    echo -e "TEST: ${RED}FAIL${NC}"
  fi
}
trap cleanup EXIT

#ensure namespace does not already exist
kubectl delete namespace $NAMESPACE --ignore-not-found

echo "Test: Copy secret to new namespace"
echo "Step 1: Create secret to be copied"

kubectl get secret $SECRET_NAME -n kyverno 2> /dev/null || kubectl create secret generic -n kyverno $SECRET_NAME \
    --from-literal=username='username' \
    --from-literal=password='password'

#Double check if secret exists:
kubectl get secret $SECRET_NAME -n kyverno

echo "Step 2: Apply kyverno policy"
kubectl apply -f /yaml/$POLICY_NAME.yaml

# if run locally in kyverno/chart/tests/scripts directory run:
# kubectl apply -f ../manifests/sync-secrets.yaml

kubectl wait --timeout=60s --for='jsonpath={.status.conditionStatus.ready}=true' GeneratingPolicy/$POLICY_NAME
echo "$POLICY_NAME is ready"
# wait 5 seconds for the webhook to pick up the policy
sleep 5

echo "Step 3: Check if the secret was created in new namespace"

kubectl create namespace $NAMESPACE
kubectl wait --timeout=30s --for='jsonpath={.status.phase}=Active' Namespace/$NAMESPACE

timeout 120s /bin/sh -c "until kubectl get secret $SECRET_NAME -n $NAMESPACE 2> /dev/null; do sleep 5; done"
echo "$SECRET_NAME succesfully created in $NAMESPACE"
