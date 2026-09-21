#!/bin/bash
#Get release name from hostname and determine pod for deployment
release_name=$(echo $HOSTNAME | awk -F "-wait-job" '{print $1}')

#Make sure deployment is ready to avoid getting previous pod
kubectl wait deploy $release_name --for=condition=Available -n istio-gateway --timeout=30s && echo "Gateway deployment ready"

pod_name=$(kubectl get po -l app.kubernetes.io/name=$release_name -n istio-gateway -o jsonpath='{.items[0].metadata.name}')

#Parse image tag from pod and app version from deployment for comparison
app_version=$(kubectl get deploy $release_name -n istio-gateway -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}')
image=$(kubectl get po $pod_name -n istio-gateway -o jsonpath='{.spec.containers[0].image}')
image_tag=$(echo $image | awk -F ":" '{print $2}')

if [[ "$image_tag" == "$app_version" ]]; then 
  echo "Image tag and app versions match!"; 
else
  while [[ ($(kubectl get deploy istiod -n istio-system -o jsonpath='{.metadata.labels.app\.kubernetes\.io/version}') != "$app_version") && elapsed_time -lt 60 ]]; do
    echo "Waiting for istiod to upgrade..."
    sleep 5
    elapsed_time=$((elapsed_time+5))
  done
  kubectl wait deploy istiod --for=condition=Available -n istio-system --timeout=30s && echo "Istiod deployment completed"
  kubectl rollout restart deploy $release_name -n istio-gateway
  kubectl wait deploy $release_name --for=condition=Available -n istio-gateway --timeout=30s && echo "Gateway deployment rolled to update image"
fi