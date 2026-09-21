<!-- Warning: Do not manually edit this file. See notes on gluon + helm-docs at the end of this file for more information. -->
# kyverno-policies

![Version: 3.3.4-bb.65](https://img.shields.io/badge/Version-3.3.4--bb.65-informational?style=flat-square) ![AppVersion: v1.13.2](https://img.shields.io/badge/AppVersion-v1.13.2-informational?style=flat-square) ![Maintenance Track: bb_integrated](https://img.shields.io/badge/Maintenance_Track-bb_integrated-green?style=flat-square)

Collection of Kyverno security and best-practice policies for Kyverno

## Upstream References

- <https://kyverno.io/policies/>
- <https://github.com/kyverno/policies>

## Upstream Release Notes

- [Find our upstream chart's CHANGELOG here](https://repo1.dso.mil/big-bang/product/packages/kyverno-policies/-/blob/main/CHANGELOG.md)
- [and our upstream application release notes here](https://repo1.dso.mil/big-bang/product/packages/kyverno-policies/-/releases)

## Learn More

- [Application Overview](docs/overview.md)
- [Other Documentation](docs/)

## Pre-Requisites

- Kubernetes Cluster deployed
- Kubernetes config installed in `~/.kube/config`
- Helm installed

Install Helm

https://helm.sh/docs/intro/install/

## Deployment

- Clone down the repository
- cd into directory

```bash
helm install kyverno-policies chart/
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| enabled | bool | `true` | Enable policy deployments |
| validationFailureAction | string | `""` | Override all policies' validation failure action with "Audit" or "Enforce".  If blank, uses policy setting. |
| failurePolicy | string | `"Fail"` | API server behavior if the webhook fails to respond ('Ignore', 'Fail') For more info: https://kyverno.io/docs/policy-types/cluster-policy/policy-settings/ |
| background | bool | `true` | Policies background mode |
| kyvernoVersion | string | `"autodetect"` | Kyverno version The default of "autodetect" will try to determine the currently installed version from the deployment |
| webhookTimeoutSeconds | int | `30` | Override all policies' time to wait for admission webhook to respond.  If blank, uses policy setting or default (10).  Range is 1 to 30. |
| exclude | object | `{"any":[{"resources":{"namespaces":["kube-system"]}}]}` | Adds an exclusion to all policies.  This is merged with any policy-specific excludes.  See https://kyverno.io/docs/policy-types/cluster-policy/policy-rules/ for fields. |
| excludeContainers | list | `[]` | Adds an excludeContainers to all policies.  This is merged with any policy-specific excludeContainers. |
| autogenControllers | string | `"Deployment,ReplicaSet,DaemonSet,StatefulSet"` | Customize the target Pod controllers for the auto-generated rules. (Eg. `none`, `Deployment`, `DaemonSet,Deployment,StatefulSet`) For more info https://kyverno.io/docs/policy-types/cluster-policy/autogen/. |
| customLabels | object | `{}` | Additional labels to apply to all policies. |
| policyPreconditions | object | `{}` | Add preconditions to individual policies. Policies with multiple rules can have individual rules excluded by using the name of the rule as the key in the `policyPreconditions` map. |
| policies.sample | object | `{"enabled":false,"exclude":{},"match":{},"parameters":{"excludeContainers":[]},"validationFailureAction":"Audit","webhookTimeoutSeconds":""}` | Sample policy showing values that can be added to any policy |
| policies.sample.enabled | bool | `false` | Controls policy deployment |
| policies.sample.validationFailureAction | string | `"Audit"` | Controls if a validation policy rule failure should disallow (Enforce) or allow (Audit) the admission |
| policies.sample.webhookTimeoutSeconds | string | `""` | Specifies the maximum time in seconds allowed to apply this policy. Default is 10. Range is 1 to 30. |
| policies.sample.match | object | `{}` | Defines when this policy's rules should be applied.  This completely overrides any default matches. |
| policies.sample.exclude | object | `{}` | Defines when this policy's rules should not be applied.  This completely overrides any default excludes. |
| policies.sample.parameters | object | `{"excludeContainers":[]}` | Policy specific parameters that are added to the configMap for the policy rules |
| policies.sample.parameters.excludeContainers | list | `[]` | Adds a container exclusion (by name) to a specific policy.  This is merged with any global excludeContainers. |
| policies.block-ephemeral-containers.enabled | bool | `true` |  |
| policies.block-ephemeral-containers.validationFailureAction | string | `"Enforce"` |  |
| policies.clone-configs | object | `{"enabled":false,"generateExisting":false,"parameters":{"clone":[]}}` | Clone existing configMap or secret in new Namespaces |
| policies.clone-configs.parameters.clone | list | `[]` | ConfigMap or Secrets that should be cloned.  Each item requres the kind, name, and namespace of the resource to clone |
| policies.disallow-annotations | object | `{"enabled":false,"parameters":{"disallow":[]},"validationFailureAction":"Audit"}` | Prevent specified annotations on pods |
| policies.disallow-annotations.parameters.disallow | list | `[]` | List of annotations disallowed on pods.  Entries can be just a "key", or a quoted "key: value".  Wildcards '*' and '?' are supported. |
| policies.disallow-deprecated-apis | object | `{"enabled":true,"validationFailureAction":"Audit"}` | Prevent resources that use deprecated or removed APIs (through Kubernetes 1.26) |
| policies.disallow-host-namespaces | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Prevent use of the host namespace (PID, IPC, Network) by pods |
| policies.disallow-image-tags | object | `{"enabled":true,"parameters":{"disallow":["latest"]},"validationFailureAction":"Enforce"}` | Prevent container images with specified tags.  Also, requires images to have a tag. |
| policies.disallow-istio-injection-bypass | object | `{"enabled":false,"validationFailureAction":"Audit"}` | Prevent the `sidecar.istio.io/inject: false` label on pods. |
| policies.disallow-labels | object | `{"enabled":false,"parameters":{"disallow":[]},"validationFailureAction":"Audit"}` | Prevent specified labels on pods |
| policies.disallow-labels.parameters.disallow | list | `[]` | List of labels disallowed on pods.  Entries can be just a "key", or a quoted "key: value".  Wildcards '*' and '?' are supported. |
| policies.disallow-namespaces | object | `{"enabled":true,"parameters":{"disallow":["default"]},"validationFailureAction":"Enforce"}` | Prevent pods from using the listed namespaces |
| policies.disallow-namespaces.parameters.disallow | list | `["default"]` | List of namespaces to deny pod deployment |
| policies.disallow-nodeport-services | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Prevent services of the type NodePort |
| policies.disallow-pod-exec | object | `{"enabled":false,"validationFailureAction":"Audit"}` | Prevent the use of `exec` or `attach` on pods |
| policies.disallow-privilege-escalation | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Prevent privilege escalation on pods |
| policies.disallow-auto-mount-service-account-token | object | `{"enabled":true,"validationFailureAction":"Audit"}` | Prevent Automounting of Kubernetes API Credentials on Pods and Service Accounts |
| policies.disallow-privileged-containers | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Prevent containers that run as privileged |
| policies.disallow-selinux-options | object | `{"enabled":true,"parameters":{"disallow":["user","role"]},"validationFailureAction":"Enforce"}` | Prevent specified SELinux options from being used on pods. |
| policies.disallow-selinux-options.parameters.disallow | list | `["user","role"]` | List of selinux options that are not allowed.  Valid values include `level`, `role`, `type`, and `user`. Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards |
| policies.disallow-tolerations | object | `{"enabled":false,"parameters":{"disallow":[{"key":"node-role.kubernetes.io/master"}]},"validationFailureAction":"Audit"}` | Prevent tolerations that bypass specified taints |
| policies.disallow-tolerations.parameters.disallow | list | `[{"key":"node-role.kubernetes.io/master"}]` | List of taints to protect from toleration.  Each entry can have `key`, `value`, and/or `effect`.  Wildcards '*' and '?' can be used If key, value, or effect are not defined, they are ignored in the policy rule |
| policies.disallow-rbac-on-default-serviceaccounts | object | `{"enabled":false,"exclude":{"any":[{"resources":{"name":"system:service-account-issuer-discovery"}}]},"validationFailureAction":"Audit"}` | Prevent additional RBAC permissions on default service accounts |
| policies.require-annotations | object | `{"enabled":false,"parameters":{"require":[]},"validationFailureAction":"Audit"}` | Require specified annotations on all pods |
| policies.require-annotations.parameters.require | list | `[]` | List of annotations required on all pods.  Entries can be just a "key", or a quoted "key: value".  Wildcards '*' and '?' are supported. |
| policies.require-cpu-limit | object | `{"enabled":false,"parameters":{"require":["<10"]},"validationFailureAction":"Audit"}` | Require containers have CPU limits defined and within the specified range |
| policies.require-cpu-limit.parameters.require | list | `["<10"]` | CPU limitations (only one required condition needs to be met).  The following operators are valid: >, <, >=, <=, !, \|, &. |
| policies.require-drop-all-capabilities | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Requires containers to drop all Linux capabilities |
| policies.require-image-signature | object | `{"enabled":false,"parameters":{"require":[{"attestors":[{"count":1,"entries":[{"keys":{"ctlog":{"ignoreSCT":true},"publicKeys":"-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtQDv69q1kyiogpxvIVjh\neNMLsI1GTLm+BuLWJN2rq4AA4k3+I7WqdvA1tKJ218DyXExljI3NTD4J5BnLeB6y\nWDvnTPXVu+pNj9W7Az0uyD73/WsMV1QR5VEzWMdMz+ZnN8IGd4JFl9p2N21YBD1R\nY93+K4XgrZ/iSRk+mGBAs87UpF1ku/nru0H2+XwJtoV7pLrrai/pLdQeRh5Ogg9J\nz5qHer9EnZne6eBnZedvpf7bqfRt0Fqqk0pTzLQm4oFD3HnxdJUPt9ccoPx0IyF0\nrB01a53LBTeRXeUcHd5BpwhwgkIm2insbDIp+lBKjUfq4CfqRQcXLLUgtRUij6ke\nQfD7jgI9chBxbVE1U5Mc/RgftXuVGQzx1OrjenD4wIH4whtP1abTg6XLxqjgkgqq\nEJy5kUpv+ut0n1RBiIdH6wYXDum90fq4qQl+gHaER0bOYAQTCIFRrhrWJ8Qxj4uL\nxI+O5KgLX3TanMtfE7e2A86uzxiHBxEW4+AF2IMXuLviIQKc9z+/p93psfQ9nXXj\nB5i6qFWkF0BMuWibB8e+HHWRKLfNWXGdfLraoMPKwCrJWhYQ+8SRrqR+gbSNWbEM\nVardcwrQZ7NP7KIedquYQnfJ3ukbYikKgdBovGStFEPLaKKiYJiD5UIQhZ51SDdA\nk+PgLW7CzKW4u2+WLdjfalkCAwEAAQ==\n-----END PUBLIC KEY-----","rekor":{"ignoreTlog":true,"url":""}}}]}],"imageReferences":["registry1.dso.mil/ironbank/*"],"mutateDigest":false,"verifyDigest":false}]},"validationFailureAction":"Audit"}` | Require specified images to be signed and verified |
| policies.require-image-signature.parameters.require | list | `[{"attestors":[{"count":1,"entries":[{"keys":{"ctlog":{"ignoreSCT":true},"publicKeys":"-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAtQDv69q1kyiogpxvIVjh\neNMLsI1GTLm+BuLWJN2rq4AA4k3+I7WqdvA1tKJ218DyXExljI3NTD4J5BnLeB6y\nWDvnTPXVu+pNj9W7Az0uyD73/WsMV1QR5VEzWMdMz+ZnN8IGd4JFl9p2N21YBD1R\nY93+K4XgrZ/iSRk+mGBAs87UpF1ku/nru0H2+XwJtoV7pLrrai/pLdQeRh5Ogg9J\nz5qHer9EnZne6eBnZedvpf7bqfRt0Fqqk0pTzLQm4oFD3HnxdJUPt9ccoPx0IyF0\nrB01a53LBTeRXeUcHd5BpwhwgkIm2insbDIp+lBKjUfq4CfqRQcXLLUgtRUij6ke\nQfD7jgI9chBxbVE1U5Mc/RgftXuVGQzx1OrjenD4wIH4whtP1abTg6XLxqjgkgqq\nEJy5kUpv+ut0n1RBiIdH6wYXDum90fq4qQl+gHaER0bOYAQTCIFRrhrWJ8Qxj4uL\nxI+O5KgLX3TanMtfE7e2A86uzxiHBxEW4+AF2IMXuLviIQKc9z+/p93psfQ9nXXj\nB5i6qFWkF0BMuWibB8e+HHWRKLfNWXGdfLraoMPKwCrJWhYQ+8SRrqR+gbSNWbEM\nVardcwrQZ7NP7KIedquYQnfJ3ukbYikKgdBovGStFEPLaKKiYJiD5UIQhZ51SDdA\nk+PgLW7CzKW4u2+WLdjfalkCAwEAAQ==\n-----END PUBLIC KEY-----","rekor":{"ignoreTlog":true,"url":""}}}]}],"imageReferences":["registry1.dso.mil/ironbank/*"],"mutateDigest":false,"verifyDigest":false}]` | List of images that must be signed and the public key to verify.  Use `kubectl explain clusterpolicy.spec.rules.verifyImages` for fields. |
| policies.require-istio-on-namespaces | object | `{"enabled":false,"validationFailureAction":"Audit"}` | Require Istio sidecar injection label on namespaces |
| policies.require-labels | object | `{"enabled":true,"parameters":{"require":["app.kubernetes.io/name","app.kubernetes.io/instance","app.kubernetes.io/version"]},"validationFailureAction":"Audit"}` | Require specified labels to be on all pods |
| policies.require-labels.parameters.require | list | `["app.kubernetes.io/name","app.kubernetes.io/instance","app.kubernetes.io/version"]` | List of labels required on all pods.  Entries can be just a "key", or a quoted "key: value".  Wildcards '*' and '?' are supported. See https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/#labels See https://helm.sh/docs/chart_best_practices/labels/#standard-labels |
| policies.require-memory-limit | object | `{"enabled":false,"parameters":{"require":["<64Gi"]},"validationFailureAction":"Audit"}` | Require containers have memory limits defined and within the specified range |
| policies.require-memory-limit.parameters.require | list | `["<64Gi"]` | Memory limitations (only one required condition needs to be met).  Can use standard Kubernetes resource units (e.g. Mi, Gi).  The following operators are valid: >, <, >=, <=, !, \|, &. |
| policies.add-default-capability-drop | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | This policy will mutate a Pod to set `spec.(initEphemeralC\|c)ontainers[].securityContext.capabilities.drop` to 'ALL' if it is not already set. |
| policies.add-default-securitycontext | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | This policy will mutate a Pod to set `runAsNonRoot`, `runAsUser`, `runAsGroup`, and `fsGroup` fields within the Pod securityContext if they are not already set. |
| policies.require-non-root-group | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Require containers to run with non-root group |
| policies.require-non-root-user | object | `{"enabled":true,"validationFailureAction":"Enforce"}` | Require containers to run as non-root user |
| policies.require-probes | object | `{"enabled":false,"parameters":{"require":["readinessProbe","livenessProbe"]},"validationFailureAction":"Audit"}` | Require specified probes on pods |
| policies.require-probes.parameters.require | list | `["readinessProbe","livenessProbe"]` | List of probes that are required on pods.  Valid values are `readinessProbe`, `livenessProbe`, and `startupProbe`. |
| policies.require-requests-equal-limits | object | `{"enabled":false,"validationFailureAction":"Audit"}` | Require CPU and memory requests equal limits for guaranteed quality of service |
| policies.require-ro-rootfs | object | `{"enabled":false,"validationFailureAction":"Audit"}` | Require containers set root filesystem to read-only |
| policies.restrict-apparmor | object | `{"enabled":true,"parameters":{"allow":["runtime/default","localhost/*"]},"validationFailureAction":"Enforce"}` | Restricts pods that use AppArmor to specified profiles |
| policies.restrict-apparmor.parameters.allow | list | `["runtime/default","localhost/*"]` | List of allowed AppArmor profiles Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards/#baseline |
| policies.restrict-external-ips | object | `{"enabled":true,"parameters":{"allow":[]},"validationFailureAction":"Enforce"}` | Restrict services with External IPs to a specified list (CVE-2020-8554) |
| policies.restrict-external-ips.parameters.allow | list | `[]` | List of external IPs allowed in services.  Must be an IP address.  Use the wildcard `?*` to support subnets (e.g. `192.168.0.?*`) |
| policies.restrict-external-names | object | `{"enabled":true,"parameters":{"allow":[]},"validationFailureAction":"Enforce"}` | Restrict services with External Names to a specified list (CVE-2020-8554) |
| policies.restrict-external-names.parameters.allow | list | `[]` | List of external names allowed in services.  Must be a lowercase RFC-1123 hostname. |
| policies.restrict-capabilities | object | `{"enabled":true,"parameters":{"allow":["NET_BIND_SERVICE"]},"validationFailureAction":"Enforce"}` | Restrict Linux capabilities added to containers to the specified list |
| policies.restrict-capabilities.parameters.allow | list | `["NET_BIND_SERVICE"]` | List of capabilities that are allowed to be added Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted See https://man7.org/linux/man-pages/man7/capabilities.7.html for list of capabilities.  The `CAP_` prefix is removed in Kubernetes names. |
| policies.restrict-group-id | object | `{"enabled":false,"parameters":{"allow":[">=1000"]},"validationFailureAction":"Audit"}` | Restrict container group IDs to specified ranges NOTE: Using require-non-root-group will force runAsGroup to be defined |
| policies.restrict-group-id.parameters.allow | list | `[">=1000"]` | Allowed group IDs / ranges.  The following operators are valid: ">, <, >=, <=, !, \|, &." For a lower and upper limit, use ">=min & <=max" |
| policies.restrict-host-path-mount | object | `{"enabled":true,"parameters":{"allow":[]},"validationFailureAction":"Enforce"}` | Restrict the paths that can be mounted by hostPath volumes to the allowed list.  HostPath volumes are normally disallowed.  If exceptions are made, the path(s) should be restricted. |
| policies.restrict-host-path-mount.parameters.allow | list | `[]` | List of allowed paths for hostPath volumes to mount |
| policies.restrict-host-path-mount-pv.enabled | bool | `true` |  |
| policies.restrict-host-path-mount-pv.validationFailureAction | string | `"Enforce"` |  |
| policies.restrict-host-path-mount-pv.parameters.allow | list | `[]` | List of allowed paths for hostPath volumes to mount |
| policies.restrict-host-path-write | object | `{"enabled":true,"parameters":{"allow":[]},"validationFailureAction":"Enforce"}` | Restrict the paths that can be mounted as read/write by hostPath volumes to the allowed list.  HostPath volumes, if allowed, should normally be mounted as read-only.  If exceptions are made, the path(s) should be restricted. |
| policies.restrict-host-path-write.parameters.allow | list | `[]` | List of allowed paths for hostPath volumes to mount as read/write |
| policies.restrict-host-ports | object | `{"enabled":true,"parameters":{"allow":[]},"validationFailureAction":"Enforce"}` | Restrict host ports in containers to the specified list |
| policies.restrict-host-ports.parameters.allow | list | `[]` | List of allowed host ports |
| policies.restrict-image-registries | object | `{"enabled":true,"parameters":{"allow":["registry1.dso.mil","registry.dso.mil"]},"validationFailureAction":"Enforce"}` | Restricts container images to registries in the specified list |
| policies.restrict-image-registries.parameters.allow | list | `["registry1.dso.mil","registry.dso.mil"]` | List of allowed registries that images may use |
| policies.restrict-proc-mount | object | `{"enabled":true,"parameters":{"allow":["Default"]},"validationFailureAction":"Enforce"}` | Restrict mounting /proc to the specified mask |
| policies.restrict-proc-mount.parameters.allow | list | `["Default"]` | List of allowed proc mount values.  Valid values are `Default` and `Unmasked`. Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards |
| policies.restrict-seccomp | object | `{"enabled":true,"parameters":{"allow":["RuntimeDefault","Localhost"]},"validationFailureAction":"Enforce"}` | Restrict seccomp profiles to the specified list |
| policies.restrict-seccomp.parameters.allow | list | `["RuntimeDefault","Localhost"]` | List of allowed seccomp profiles.  Valid values are `Localhost`, `RuntimeDefault`, and `Unconfined` Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted |
| policies.restrict-selinux-type | object | `{"enabled":true,"parameters":{"allow":["container_t","container_init_t","container_kvm_t"]},"validationFailureAction":"Enforce"}` | Restrict SELinux types to the specified list. |
| policies.restrict-selinux-type.parameters.allow | list | `["container_t","container_init_t","container_kvm_t"]` | List of allowed values for the `type` field Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards |
| policies.restrict-sysctls | object | `{"enabled":true,"parameters":{"allow":["kernel.shm_rmid_forced","net.ipv4.ip_local_port_range","net.ipv4.ip_unprivileged_port_start","net.ipv4.tcp_syncookies","net.ipv4.ping_group_range","net.ipv4.ip_local_reserved_ports","net.ipv4.tcp_keepalive_time","net.ipv4.tcp_fin_timeout","net.ipv4.tcp_keepalive_intvl","net.ipv4.tcp_keepalive_probes"]},"validationFailureAction":"Enforce"}` | Restrict sysctls to the specified list |
| policies.restrict-sysctls.parameters.allow | list | `["kernel.shm_rmid_forced","net.ipv4.ip_local_port_range","net.ipv4.ip_unprivileged_port_start","net.ipv4.tcp_syncookies","net.ipv4.ping_group_range","net.ipv4.ip_local_reserved_ports","net.ipv4.tcp_keepalive_time","net.ipv4.tcp_fin_timeout","net.ipv4.tcp_keepalive_intvl","net.ipv4.tcp_keepalive_probes"]` | List of allowed sysctls. Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards |
| policies.restrict-user-id | object | `{"enabled":false,"parameters":{"allow":[">=1000"]},"validationFailureAction":"Audit"}` | Restrict user IDs to the specified ranges NOTE: Using require-non-root-user will force runAsUser to be defined |
| policies.restrict-user-id.parameters.allow | list | `[">=1000"]` | Allowed user IDs / ranges.  The following operators are valid: >, <, >=, <=, !, \|, &. For a lower and upper limit, use ">=min & <=max" |
| policies.restrict-volume-types | object | `{"enabled":true,"parameters":{"allow":["configMap","csi","downwardAPI","emptyDir","ephemeral","persistentVolumeClaim","projected","secret"]},"validationFailureAction":"Enforce"}` | Restrict the volume types to the specified list |
| policies.restrict-volume-types.parameters.allow | list | `["configMap","csi","downwardAPI","emptyDir","ephemeral","persistentVolumeClaim","projected","secret"]` | List of allowed Volume types.  Valid values are the volume types listed here: https://kubernetes.io/docs/concepts/storage/volumes/#volume-types Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted |
| policies.update-image-pull-policy | object | `{"enabled":false,"parameters":{"update":[{"to":"Always"}]}}` | Updates the image pull policy on containers |
| policies.update-image-pull-policy.parameters.update | list | `[{"to":"Always"}]` | List of image pull policy updates.  `from` contains the pull policy value to replace.  If `from` is blank, it matches everything.  `to` contains the new pull policy to use.  Must be one of `Always`, `Never`, or `IfNotPresent`. |
| policies.update-image-registry | object | `{"enabled":false,"parameters":{"update":[]}}` | Updates an existing image registry with a new registry in containers (e.g. proxy) |
| policies.update-image-registry.parameters.update | list | `[]` | List of registry updates.  `from` contains the registry to replace. `to` contains the new registry to use. |
| policies.update-automountserviceaccounttokens-default | object | `{"enabled":false}` | List of namespaces to explictly disable mounting the serviceaccount token |
| policies.update-automountserviceaccounttokens | object | `{"enabled":false}` | Namespace-scoped ServiceAccount hardening and Pod allow/deny exceptions. Omit serviceAccounts to match all ServiceAccounts in a namespace. |
| celPoliciesBeta | object | `{"add-default-capability-drop-cel":{"enabled":false},"add-default-securitycontext-cel":{"enabled":false,"parameters":{"fsGroup":65534,"runAsGroup":65534,"runAsNonRoot":true,"runAsUser":65534}},"autogenControllers":"","background":"","block-ephemeral-containers-cel":{"enabled":false,"validationFailureAction":""},"clone-configs-cel":{"enabled":false,"generateExisting":false,"parameters":{"clone":[]},"synchronize":true},"disallow-annotations-cel":{"enabled":false,"parameters":{"disallow":[]},"validationFailureAction":""},"disallow-auto-mount-service-account-token-cel":{"enabled":false,"validationFailureAction":""},"disallow-deprecated-apis-cel":{"enabled":false,"validationFailureAction":""},"disallow-host-namespaces-cel":{"enabled":false,"validationFailureAction":""},"disallow-image-tags-cel":{"enabled":false,"parameters":{"disallow":["latest"]},"validationFailureAction":""},"disallow-istio-injection-bypass-cel":{"enabled":false,"validationFailureAction":""},"disallow-labels-cel":{"enabled":false,"parameters":{"disallow":[]},"validationFailureAction":""},"disallow-namespaces-cel":{"autogenControllers":"Deployment,ReplicaSet,DaemonSet,StatefulSet,Job,CronJob","enabled":false,"parameters":{"disallow":["default"]},"validationFailureAction":""},"disallow-nodeport-services-cel":{"enabled":false,"validationFailureAction":""},"disallow-privilege-escalation-cel":{"enabled":false,"validationFailureAction":""},"disallow-privileged-containers-cel":{"enabled":false,"validationFailureAction":""},"disallow-selinux-options-cel":{"enabled":false,"parameters":{"disallow":["user","role"]},"validationFailureAction":""},"excludeContainers":[],"excludeNamespaces":[],"mpolFailurePolicy":"","require-annotations-cel":{"enabled":false,"parameters":{"require":[]},"validationFailureAction":""},"require-cpu-limit-cel":{"enabled":false,"parameters":{"maxCPU":"10"},"validationFailureAction":""},"require-drop-all-capabilities-cel":{"enabled":false,"validationFailureAction":""},"require-istio-on-namespaces-cel":{"enabled":false,"validationFailureAction":""},"require-labels-cel":{"enabled":false,"parameters":{"require":[]},"validationFailureAction":""},"require-memory-limit-cel":{"enabled":false,"parameters":{"maxMemory":"64Gi"},"validationFailureAction":""},"require-non-root-group-cel":{"enabled":false,"validationFailureAction":""},"require-non-root-user-cel":{"enabled":false,"validationFailureAction":""},"require-probes-cel":{"autogenControllers":"DaemonSet,Deployment,StatefulSet","enabled":false,"parameters":{"livenessProbe":true,"readinessProbe":true,"startupProbe":false},"validationFailureAction":""},"require-ro-rootfs-cel":{"enabled":false,"validationFailureAction":""},"restrict-external-ips-cel":{"enabled":false,"parameters":{"allow":[]},"validationFailureAction":""},"restrict-external-names-cel":{"enabled":false,"parameters":{"allow":[]},"validationFailureAction":""},"restrict-image-registries-cel":{"enabled":false,"parameters":{"allow":[]},"validationFailureAction":""},"restrict-proc-mount-cel":{"enabled":false,"parameters":{"default":true,"unmasked":false},"validationFailureAction":""},"restrict-seccomp-cel":{"enabled":false,"parameters":{"localhost":true,"runtimeDefault":true,"unconfined":false},"validationFailureAction":""},"restrict-sysctls-cel":{"enabled":false,"parameters":{"allow":["kernel\\.shm_rmid_forced","net\\.ipv4\\.ip_local_port_range","net\\.ipv4\\.ip_unprivileged_port_start","net\\.ipv4\\.tcp_syncookies","net\\.ipv4\\.ping_group_range","net\\.ipv4\\.ip_local_reserved_ports","net\\.ipv4\\.tcp_keepalive_time","net\\.ipv4\\.tcp_fin_timeout","net\\.ipv4\\.tcp_keepalive_intvl","net\\.ipv4\\.tcp_keepalive_probes"]},"validationFailureAction":""},"restrict-volume-types-cel":{"enabled":false,"parameters":{"allow":["configMap","csi","downwardAPI","emptyDir","ephemeral","persistentVolumeClaim","projected","secret"]},"validationFailureAction":""},"update-automountserviceaccounttokens-cel":{"autogenControllers":"Deployment,StatefulSet","enabled":false},"vpolFailurePolicy":"","webhookTimeoutSeconds":""}` | Policies with no tunables omit the parameters key entirely. |
| celPoliciesBeta.vpolFailurePolicy | string | `""` | and we have a clearer picture of the shared vs kind-specific config surface. |
| celPoliciesBeta.mpolFailurePolicy | string | `""` | explicit during migration. See vpolFailurePolicy comment for consolidation plan. |
| celPoliciesBeta.background | string | `""` | Background scanning (true/false). Empty = falls through to top-level .Values.background. |
| celPoliciesBeta.webhookTimeoutSeconds | string | `""` | Webhook timeout 1-30s. Empty = falls through to top-level .Values.webhookTimeoutSeconds. |
| celPoliciesBeta.autogenControllers | string | `""` | Autogen controller list. Same comma-separated CamelCase format as top-level. Empty = falls through to top-level .Values.autogenControllers. |
| celPoliciesBeta.excludeNamespaces | list | `[]` | subjects, roles), use per-policy matchConditions with CEL expressions. |
| celPoliciesBeta.excludeContainers | list | `[]` | Merged with per-policy excludeContainers. CEL equivalent of top-level .Values.excludeContainers. |
| celPoliciesBeta.add-default-capability-drop-cel | object | `{"enabled":false}` | Add default capability drops when absent (MutatingPolicy) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.add-default-securitycontext-cel | object | `{"enabled":false,"parameters":{"fsGroup":65534,"runAsGroup":65534,"runAsNonRoot":true,"runAsUser":65534}}` | Add default pod securityContext fields when absent (MutatingPolicy) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.add-default-securitycontext-cel.parameters.runAsNonRoot | bool | `true` | Default pod securityContext values (applied only when field is absent) |
| celPoliciesBeta.block-ephemeral-containers-cel | object | `{"enabled":false,"validationFailureAction":""}` | Block ephemeral (debug) containers (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.block-ephemeral-containers-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.clone-configs-cel | object | `{"enabled":false,"generateExisting":false,"parameters":{"clone":[]},"synchronize":true}` | Clone ConfigMaps/Secrets into new namespaces (GeneratingPolicy) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.clone-configs-cel.parameters.clone | list | `[]` | ConfigMaps or Secrets to clone. Same structure as the CPol clone-configs policy. When `enabled` is true, this list must be non-empty or templating fails. |
| celPoliciesBeta.clone-configs-cel.generateExisting | bool | `false` | Whether to retroactively clone into existing namespaces |
| celPoliciesBeta.clone-configs-cel.synchronize | bool | `true` | Keep cloned resources in sync with the source |
| celPoliciesBeta.disallow-annotations-cel | object | `{"enabled":false,"parameters":{"disallow":[]},"validationFailureAction":""}` | Disallow specified annotations on all pods (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-annotations-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-annotations-cel.parameters.disallow | list | `[]` | Annotations disallowed on all pods. Each entry has a `key` (RE2 regex) and an optional `value` (RE2 regex). Both are auto-anchored with ^ and $. If `value` is omitted, any pod with a matching key is rejected regardless of value. |
| celPoliciesBeta.disallow-deprecated-apis-cel | object | `{"enabled":false,"validationFailureAction":""}` | Disallow deprecated Kubernetes APIs (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-deprecated-apis-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-auto-mount-service-account-token-cel | object | `{"enabled":false,"validationFailureAction":""}` | Prevent automounting of Kubernetes API credentials on Pods and ServiceAccounts (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-auto-mount-service-account-token-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-host-namespaces-cel | object | `{"enabled":false,"validationFailureAction":""}` | Disallow host namespaces (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-host-namespaces-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-image-tags-cel | object | `{"enabled":false,"parameters":{"disallow":["latest"]},"validationFailureAction":""}` | Disallow specified image tags on container images (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-image-tags-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-image-tags-cel.parameters.disallow | list | `["latest"]` | Image tags disallowed on every container. Match is exact and case-sensitive; an image is rejected if it ends with `:<tag>` for any entry. Empty list keeps only the require-tag check active. |
| celPoliciesBeta.disallow-istio-injection-bypass-cel | object | `{"enabled":false,"validationFailureAction":""}` | Disallow Istio sidecar injection bypass (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-istio-injection-bypass-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-labels-cel | object | `{"enabled":false,"parameters":{"disallow":[]},"validationFailureAction":""}` | Disallow specified labels on all pods (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-labels-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-labels-cel.parameters.disallow | list | `[]` | Labels disallowed on all pods. Each entry has a `key` (RE2 regex) and an optional `value` (RE2 regex). Both are auto-anchored with ^ and $. If `value` is omitted, any pod with a matching key is rejected regardless of value. |
| celPoliciesBeta.disallow-namespaces-cel | object | `{"autogenControllers":"Deployment,ReplicaSet,DaemonSet,StatefulSet,Job,CronJob","enabled":false,"parameters":{"disallow":["default"]},"validationFailureAction":""}` | Disallow workloads in specified namespaces (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-namespaces-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-namespaces-cel.autogenControllers | string | `"Deployment,ReplicaSet,DaemonSet,StatefulSet,Job,CronJob"` | Default autogen list adds Job and CronJob so workload kinds the CPol matched directly are still covered. |
| celPoliciesBeta.disallow-namespaces-cel.parameters.disallow | list | `["default"]` | Namespace names workloads must not be deployed into. Match is exact. |
| celPoliciesBeta.disallow-nodeport-services-cel | object | `{"enabled":false,"validationFailureAction":""}` | Disallow NodePort Services (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-nodeport-services-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-privilege-escalation-cel | object | `{"enabled":false,"validationFailureAction":""}` | Disallow privilege escalation on containers (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-privilege-escalation-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-privileged-containers-cel | object | `{"enabled":false,"validationFailureAction":""}` | Prevent containers that run as privileged (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-privileged-containers-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-selinux-options-cel | object | `{"enabled":false,"parameters":{"disallow":["user","role"]},"validationFailureAction":""}` | Disallow specified SELinux options (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.disallow-selinux-options-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.disallow-selinux-options-cel.parameters.disallow | list | `["user","role"]` | SELinux option fields to disallow. Valid values: user, role, type, level. Defaults from https://kubernetes.io/docs/concepts/security/pod-security-standards |
| celPoliciesBeta.restrict-proc-mount-cel | object | `{"enabled":false,"parameters":{"default":true,"unmasked":false},"validationFailureAction":""}` | Restrict mounting /proc to the specified mask (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-proc-mount-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-proc-mount-cel.parameters.default | bool | `true` | Allow containers to set `procMount: Default`. |
| celPoliciesBeta.restrict-proc-mount-cel.parameters.unmasked | bool | `false` | Allow containers to set `procMount: Unmasked`. |
| celPoliciesBeta.restrict-seccomp-cel | object | `{"enabled":false,"parameters":{"localhost":true,"runtimeDefault":true,"unconfined":false},"validationFailureAction":""}` | Restrict seccomp profile types to the specified list (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-seccomp-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-seccomp-cel.parameters.localhost | bool | `true` | Allow pods and containers to set `seccompProfile.type: Localhost`. |
| celPoliciesBeta.restrict-seccomp-cel.parameters.runtimeDefault | bool | `true` | Allow pods and containers to set `seccompProfile.type: RuntimeDefault`. |
| celPoliciesBeta.restrict-seccomp-cel.parameters.unconfined | bool | `false` | Allow pods and containers to set `seccompProfile.type: Unconfined`. |
| celPoliciesBeta.restrict-sysctls-cel | object | `{"enabled":false,"parameters":{"allow":["kernel\\.shm_rmid_forced","net\\.ipv4\\.ip_local_port_range","net\\.ipv4\\.ip_unprivileged_port_start","net\\.ipv4\\.tcp_syncookies","net\\.ipv4\\.ping_group_range","net\\.ipv4\\.ip_local_reserved_ports","net\\.ipv4\\.tcp_keepalive_time","net\\.ipv4\\.tcp_fin_timeout","net\\.ipv4\\.tcp_keepalive_intvl","net\\.ipv4\\.tcp_keepalive_probes"]},"validationFailureAction":""}` | Restrict sysctls to the specified list (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-sysctls-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-sysctls-cel.parameters.allow | list | `["kernel\\.shm_rmid_forced","net\\.ipv4\\.ip_local_port_range","net\\.ipv4\\.ip_unprivileged_port_start","net\\.ipv4\\.tcp_syncookies","net\\.ipv4\\.ping_group_range","net\\.ipv4\\.ip_local_reserved_ports","net\\.ipv4\\.tcp_keepalive_time","net\\.ipv4\\.tcp_fin_timeout","net\\.ipv4\\.tcp_keepalive_intvl","net\\.ipv4\\.tcp_keepalive_probes"]` | List of allowed sysctls as RE2 regex patterns (auto-anchored ^...$). Example: "net\\.ipv4\\..+" to allow any sysctl under net.ipv4. Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards |
| celPoliciesBeta.require-annotations-cel | object | `{"enabled":false,"parameters":{"require":[]},"validationFailureAction":""}` | Require specified annotations on all pods (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-annotations-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-annotations-cel.parameters.require | list | `[]` | Annotations required on all pods. Each entry has a `key` (RE2 regex) and an optional `value` (RE2 regex). Both are auto-anchored with ^ and $. If `value` is omitted, any non-empty value is accepted. |
| celPoliciesBeta.require-cpu-limit-cel | object | `{"enabled":false,"parameters":{"maxCPU":"10"},"validationFailureAction":""}` | Require containers have CPU limits defined (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-cpu-limit-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-cpu-limit-cel.parameters.maxCPU | string | `"10"` | not a tight limit. Set to empty string to disable the upper-bound check. |
| celPoliciesBeta.require-drop-all-capabilities-cel | object | `{"enabled":false,"validationFailureAction":""}` | Require containers to drop all Linux capabilities (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-drop-all-capabilities-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-istio-on-namespaces-cel | object | `{"enabled":false,"validationFailureAction":""}` | Require Istio sidecar injection label on namespaces (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-istio-on-namespaces-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-labels-cel | object | `{"enabled":false,"parameters":{"require":[]},"validationFailureAction":""}` | Require specified labels on all pods (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-labels-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-labels-cel.parameters.require | list | `[]` | Labels required on all pods. Each entry has a `key` (RE2 regex) and an optional `value` (RE2 regex). Both are auto-anchored with ^ and $. If `value` is omitted, any non-empty value is accepted. |
| celPoliciesBeta.require-memory-limit-cel | object | `{"enabled":false,"parameters":{"maxMemory":"64Gi"},"validationFailureAction":""}` | Require containers have memory limits defined (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-memory-limit-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-memory-limit-cel.parameters.maxMemory | string | `"64Gi"` | Upper bound on memory limits. Rejects containers requesting more than this. Default "64Gi" approximates the CPol's "<64Gi" ceiling (VPol uses <=, so exactly 64Gi is allowed unlike the CPol's strict <64Gi). Not a tight limit. Set to empty string to disable the upper-bound check. |
| celPoliciesBeta.require-non-root-group-cel | object | `{"enabled":false,"validationFailureAction":""}` | Require containers run with non-root group IDs (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-non-root-group-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-non-root-user-cel | object | `{"enabled":false,"validationFailureAction":""}` | Require containers run as non-root user (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-non-root-user-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-probes-cel | object | `{"autogenControllers":"DaemonSet,Deployment,StatefulSet","enabled":false,"parameters":{"livenessProbe":true,"readinessProbe":true,"startupProbe":false},"validationFailureAction":""}` | Require liveness/readiness probes on containers (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-probes-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.require-probes-cel.parameters.readinessProbe | bool | `true` | Require readinessProbe on all containers |
| celPoliciesBeta.require-probes-cel.parameters.livenessProbe | bool | `true` | Require livenessProbe on all containers |
| celPoliciesBeta.require-probes-cel.parameters.startupProbe | bool | `false` | Require startupProbe on all containers |
| celPoliciesBeta.require-ro-rootfs-cel | object | `{"enabled":false,"validationFailureAction":""}` | Require containers run with a read-only root filesystem (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.require-ro-rootfs-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-external-ips-cel | object | `{"enabled":false,"parameters":{"allow":[]},"validationFailureAction":""}` | Restrict services with External IPs to an allow-list (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-external-ips-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-external-ips-cel.parameters.allow | list | `[]` | List of RE2 regex patterns (auto-anchored ^...$). Example: "192\\.168\\.0\\..+" to allow any IP in 192.168.0.0/24. |
| celPoliciesBeta.restrict-external-names-cel | object | `{"enabled":false,"parameters":{"allow":[]},"validationFailureAction":""}` | Restrict services with External Names to an allow-list (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-external-names-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-external-names-cel.parameters.allow | list | `[]` | List of allowed external names as RE2 regex patterns (auto-anchored ^...$). Plain strings remain exact matches. Empty, missing, null, or empty-string input denies all ExternalName Services. |
| celPoliciesBeta.restrict-image-registries-cel | object | `{"enabled":false,"parameters":{"allow":[]},"validationFailureAction":""}` | Restricts container images to registries in the specified list (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-image-registries-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-image-registries-cel.parameters.allow | list | `[]` | List of allowed registries that images may use |
| celPoliciesBeta.restrict-volume-types-cel | object | `{"enabled":false,"parameters":{"allow":["configMap","csi","downwardAPI","emptyDir","ephemeral","persistentVolumeClaim","projected","secret"]},"validationFailureAction":""}` | Restrict volume types to the specified list (VPol) -cel suffix avoids name collision with the CPol during migration |
| celPoliciesBeta.restrict-volume-types-cel.validationFailureAction | string | `""` | Empty string falls through to the global validationFailureAction |
| celPoliciesBeta.restrict-volume-types-cel.parameters.allow | list | `["configMap","csi","downwardAPI","emptyDir","ephemeral","persistentVolumeClaim","projected","secret"]` | List of allowed Volume types.  Valid values are the volume types listed here: https://kubernetes.io/docs/concepts/storage/volumes/#volume-types Defaults pulled from https://kubernetes.io/docs/concepts/security/pod-security-standards/#restricted |
| celPoliciesBeta.update-automountserviceaccounttokens-cel | object | `{"autogenControllers":"Deployment,StatefulSet","enabled":false}` | names are interpreted as anchored RE2 regexes. |
| celPoliciesBeta.update-automountserviceaccounttokens-cel.autogenControllers | string | `"Deployment,StatefulSet"` | Pinned to the kinds covered by the legacy ClusterPolicy. Override only if you also want DaemonSet / Job / CronJob template coverage. |
| additionalPolicies | object | `{"samplePolicy":{"annotations":{"policies.kyverno.io/category":"Examples","policies.kyverno.io/description":"This sample policy blocks pods from deploying into the 'default' namespace.","policies.kyverno.io/severity":"low","policies.kyverno.io/subject":"Pod","policies.kyverno.io/title":"Sample Policy"},"enabled":false,"kind":"ClusterPolicy","namespace":"","spec":{"rules":[{"match":{"any":[{"resources":{"kinds":["Pods"]}}]},"name":"sample-rule","validate":{"message":"Using 'default' namespace is not allowed.","pattern":{"metadata":{"namespace":"!default"}}}}]}}}` | Adds custom policies.  See https://kyverno.io/docs/introduction/quick-start/ . |
| additionalPolicies.samplePolicy | object | `{"annotations":{"policies.kyverno.io/category":"Examples","policies.kyverno.io/description":"This sample policy blocks pods from deploying into the 'default' namespace.","policies.kyverno.io/severity":"low","policies.kyverno.io/subject":"Pod","policies.kyverno.io/title":"Sample Policy"},"enabled":false,"kind":"ClusterPolicy","namespace":"","spec":{"rules":[{"match":{"any":[{"resources":{"kinds":["Pods"]}}]},"name":"sample-rule","validate":{"message":"Using 'default' namespace is not allowed.","pattern":{"metadata":{"namespace":"!default"}}}}]}}` | Name of the policy.  Addtional policies can be added by adding a key. |
| additionalPolicies.samplePolicy.enabled | bool | `false` | Controls policy deployment |
| additionalPolicies.samplePolicy.kind | string | `"ClusterPolicy"` | Kind of policy.  Currently, "ClusterPolicy" and "Policy" are supported. |
| additionalPolicies.samplePolicy.namespace | string | `""` | If kind is "Policy", which namespace to target.  The namespace must already exist. |
| additionalPolicies.samplePolicy.annotations | object | `{"policies.kyverno.io/category":"Examples","policies.kyverno.io/description":"This sample policy blocks pods from deploying into the 'default' namespace.","policies.kyverno.io/severity":"low","policies.kyverno.io/subject":"Pod","policies.kyverno.io/title":"Sample Policy"}` | Policy annotations to add |
| additionalPolicies.samplePolicy.annotations."policies.kyverno.io/title" | string | `"Sample Policy"` | Human readable name of policy |
| additionalPolicies.samplePolicy.annotations."policies.kyverno.io/category" | string | `"Examples"` | Category of policy.  Arbitrary. |
| additionalPolicies.samplePolicy.annotations."policies.kyverno.io/severity" | string | `"low"` | Severity of policy if a violation occurs.  Choose "critical", "high", "medium", "low". |
| additionalPolicies.samplePolicy.annotations."policies.kyverno.io/subject" | string | `"Pod"` | Type of resource policy applies to (e.g. Pod, Service, Namespace) |
| additionalPolicies.samplePolicy.annotations."policies.kyverno.io/description" | string | `"This sample policy blocks pods from deploying into the 'default' namespace."` | Description of what the policy does, why it is important, and what items are allowed or unallowed. |
| additionalPolicies.samplePolicy.spec | object | `{"rules":[{"match":{"any":[{"resources":{"kinds":["Pods"]}}]},"name":"sample-rule","validate":{"message":"Using 'default' namespace is not allowed.","pattern":{"metadata":{"namespace":"!default"}}}}]}` | Policy specification.  See `kubectl explain clusterpolicies.spec` |
| additionalPolicies.samplePolicy.spec.rules | list | `[{"match":{"any":[{"resources":{"kinds":["Pods"]}}]},"name":"sample-rule","validate":{"message":"Using 'default' namespace is not allowed.","pattern":{"metadata":{"namespace":"!default"}}}}]` | Policy rules.  At least one is required |
| additionalPolicyExceptions | string | `nil` | Adds additional policyExceptions.  See https://kyverno.io/docs/policy-types/validating-policy/#exceptions |
| istio | object | `{"enabled":false}` | BigBang Istio Toggle and Configuration |
| bbtests | object | `{"chainsawEnabled":false,"enabled":false,"imagePullSecret":"private-registry","kyvernoCliEnabled":true,"legacyEnabled":true,"scripts":{"additionalVolumeMounts":[{"mountPath":"/yaml","name":"kyverno-policies-bbtest-manifests"},{"mountPath":"/vpol","name":"kyverno-policies-bbtest-vpol"},{"mountPath":"/mpol","name":"kyverno-policies-bbtest-mpol"},{"mountPath":"/gpol","name":"kyverno-policies-bbtest-gpol"},{"mountPath":"/.kube/cache","name":"kyverno-policies-bbtest-kube-cache"}],"additionalVolumes":[{"configMap":{"name":"kyverno-policies-bbtest-manifests"},"name":"kyverno-policies-bbtest-manifests"},{"configMap":{"name":"kyverno-policies-bbtest-vpol"},"name":"kyverno-policies-bbtest-vpol"},{"configMap":{"name":"kyverno-policies-bbtest-mpol"},"name":"kyverno-policies-bbtest-mpol"},{"configMap":{"name":"kyverno-policies-bbtest-gpol"},"name":"kyverno-policies-bbtest-gpol"},{"emptyDir":{},"name":"kyverno-policies-bbtest-kube-cache"}],"envs":{"CHAINSAW_ENABLED":"{{ .Values.bbtests.chainsawEnabled }}","CPOL_ACTIONS":"{{ $pairs := list }}{{ range $k, $v := .Values.policies }}{{ if $v.enabled }}{{ $action := default (dig $k \"validationFailureAction\" \"Audit\" $.Values.policies) $.Values.validationFailureAction }}{{ $pairs = append $pairs (printf \"%s=%s\" $k $action) }}{{ end }}{{ end }}{{ join \" \" $pairs }}","ENABLED_CPOLS":"{{ $p := list }}{{ range $k, $v := .Values.policies }}{{ if $v.enabled }}{{ $p = append $p $k }}{{ end }}{{ end }}{{ join \" \" $p }}","IMAGE_PULL_SECRET":"{{ .Values.bbtests.imagePullSecret }}","KYVERNO_CLI_TESTS_ENABLED":"{{ .Values.bbtests.kyvernoCliEnabled }}","LEGACY_TESTS_ENABLED":"{{ .Values.bbtests.legacyEnabled }}"},"image":"registry1.dso.mil/ironbank/big-bang/devops-tester:1.1","permissions":{"apiGroups":[""],"resources":["configmaps","namespaces"],"verbs":["create","delete","list","get"]}}}` | Reserved values for Big Bang test automation |
| waitJob.enabled | bool | `true` |  |
| waitJob.kind | string | `"ClusterRole"` |  |
| waitJob.permissions.apiGroups[0] | string | `"kyverno.io"` |  |
| waitJob.permissions.resources[0] | string | `"clusterpolicies"` |  |
| waitJob.permissions.resources[1] | string | `"policies"` |  |

## Contributing

Please see the [contributing guide](./CONTRIBUTING.md) if you are interested in contributing.

---

_This file is programatically generated using `helm-docs` and some BigBang-specific templates. The `gluon` repository has [instructions for regenerating package READMEs](https://repo1.dso.mil/big-bang/product/packages/gluon/-/blob/master/docs/bb-package-readme.md)._

