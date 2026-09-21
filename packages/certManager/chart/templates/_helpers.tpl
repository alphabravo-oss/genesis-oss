{{- define "cert-manager.webhookServiceName" -}}
{{- printf "%s-webhook" (default "cert-manager" .Values.upstream.fullnameOverride) -}}
{{- end -}}

{{- define "cert-manager.labels" -}}
app.kubernetes.io/name: cert-manager
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "cert-manager.issuerLabels" -}}
{{- $labels := fromYaml (include "cert-manager.labels" .root) -}}
{{- toYaml (merge $labels (default dict .labels)) -}}
{{- end -}}

{{- define "cert-manager.issuerKind" -}}
{{- .scope -}}
{{- end -}}

{{- define "cert-manager.issuerNamespace" -}}
{{- if eq .scope "Issuer" }}
namespace: {{ .root.Release.Namespace | quote }}
{{- end }}
{{- end -}}

{{- define "cert-manager.selfSignedIssuerName" -}}
{{- if .Values.issuers.selfSigned.name -}}
{{- .Values.issuers.selfSigned.name -}}
{{- else -}}
{{- printf "%s-selfsigned" .Release.Name -}}
{{- end -}}
{{- end -}}

{{- define "cert-manager.letsEncryptIssuerSuffix" -}}
{{- $suffix := .Values.issuers.letsEncrypt.environment -}}
{{- if .Values.issuers.letsEncrypt.server -}}
{{- $suffix = "custom" -}}
{{- end -}}
{{- printf "-letsencrypt-%s" $suffix -}}
{{- end -}}

{{- define "cert-manager.letsEncryptIssuerName" -}}
{{- if .Values.issuers.letsEncrypt.name -}}
{{- .Values.issuers.letsEncrypt.name -}}
{{- else -}}
{{- $suffix := include "cert-manager.letsEncryptIssuerSuffix" . -}}
{{- printf "%s%s" .Release.Name $suffix -}}
{{- end -}}
{{- end -}}

{{- define "cert-manager.letsEncryptServer" -}}
{{- if .Values.issuers.letsEncrypt.server -}}
{{- .Values.issuers.letsEncrypt.server -}}
{{- else if eq .Values.issuers.letsEncrypt.environment "production" -}}
https://acme-v02.api.letsencrypt.org/directory
{{- else -}}
https://acme-staging-v02.api.letsencrypt.org/directory
{{- end -}}
{{- end -}}

{{- define "cert-manager.letsEncryptServerHost" -}}
{{- $url := urlParse (include "cert-manager.letsEncryptServer" .) -}}
{{- lower (regexReplaceAll ":443$" (get $url "host") "") -}}
{{- end -}}

{{- define "cert-manager.gatewayAPIEnabled" -}}
{{- $enabled := dig "config" "enableGatewayAPI" false .Values.upstream -}}
{{- range (default (list) .Values.upstream.extraArgs) -}}
{{- if or (eq . "--enable-gateway-api") (eq . "--enable-gateway-api=true") -}}
{{- $enabled = true -}}
{{- else if eq . "--enable-gateway-api=false" -}}
{{- $enabled = false -}}
{{- end -}}
{{- end -}}
{{- $enabled -}}
{{- end -}}

{{- define "cert-manager.letsEncryptAccountSecretName" -}}
{{- if .Values.issuers.letsEncrypt.privateKeySecretName -}}
{{- .Values.issuers.letsEncrypt.privateKeySecretName -}}
{{- else -}}
{{- printf "%s-account-key" (include "cert-manager.letsEncryptIssuerName" .) -}}
{{- end -}}
{{- end -}}

{{- define "cert-manager.hasHTTP01Solver" -}}
{{- $found := false -}}
{{- range .Values.issuers.letsEncrypt.solvers -}}
{{- if hasKey . "http01" -}}
{{- $found = true -}}
{{- end -}}
{{- end -}}
{{- $found -}}
{{- end -}}

{{- define "cert-manager.hasDNS01Solver" -}}
{{- $found := false -}}
{{- range .Values.issuers.letsEncrypt.solvers -}}
{{- if hasKey . "dns01" -}}
{{- $found = true -}}
{{- end -}}
{{- end -}}
{{- $found -}}
{{- end -}}

{{- define "cert-manager.validateSelfSignedIssuer" -}}
{{- if not (kindIs "map" .Values.issuers) -}}
{{- fail "issuers must be an object containing selfSigned and letsEncrypt" -}}
{{- end -}}
{{- if .Values.issuers.selfSigned.enabled -}}
{{- if not (has .Values.issuers.selfSigned.scope (list "Issuer" "ClusterIssuer")) -}}
{{- fail "issuers.selfSigned.scope must be Issuer or ClusterIssuer" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "cert-manager.validateLetsEncryptIssuer" -}}
{{- if not (kindIs "map" .Values.issuers) -}}
{{- fail "issuers must be an object containing selfSigned and letsEncrypt" -}}
{{- end -}}
{{- if .Values.issuers.letsEncrypt.enabled -}}
{{- $acme := .Values.issuers.letsEncrypt -}}
{{- if not (has $acme.scope (list "Issuer" "ClusterIssuer")) -}}
{{- fail "issuers.letsEncrypt.scope must be Issuer or ClusterIssuer" -}}
{{- end -}}
{{- if not (has $acme.environment (list "staging" "production")) -}}
{{- fail "issuers.letsEncrypt.environment must be staging or production" -}}
{{- end -}}
{{- if $acme.server -}}
{{- $url := urlParse $acme.server -}}
{{- $host := get $url "host" -}}
{{- if or (ne (get $url "scheme") "https") (not (regexMatch "^[[:alnum:]]([[:alnum:]-]*[[:alnum:]])?(\\.[[:alnum:]]([[:alnum:]-]*[[:alnum:]])?)*(:443)?$" $host)) (get $url "userinfo") (get $url "fragment") -}}
{{- fail "issuers.letsEncrypt.server must use HTTPS with a hostname on port 443" -}}
{{- end -}}
{{- end -}}
{{- if empty $acme.email -}}
{{- fail "issuers.letsEncrypt.email is required when Let's Encrypt is enabled" -}}
{{- end -}}
{{- if empty $acme.solvers -}}
{{- fail "issuers.letsEncrypt.solvers must contain at least one HTTP-01 or DNS-01 solver" -}}
{{- end -}}
{{- range $index, $solver := $acme.solvers -}}
{{- $http := hasKey $solver "http01" -}}
{{- $dns := hasKey $solver "dns01" -}}
{{- if eq $http $dns -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d] must contain exactly one of http01 or dns01" $index) -}}
{{- end -}}
{{- if $dns -}}
{{- $dnsConfig := default dict (get $solver "dns01") -}}
{{- $providers := 0 -}}
{{- range $provider := list "acmeDNS" "akamai" "azureDNS" "cloudDNS" "cloudflare" "digitalocean" "rfc2136" "route53" "webhook" -}}
{{- if hasKey $dnsConfig $provider -}}
{{- if not (kindIs "map" (get $dnsConfig $provider)) -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d].dns01.%s must be an object" $index $provider) -}}
{{- end -}}
{{- $providers = add1 $providers -}}
{{- end -}}
{{- end -}}
{{- if ne $providers 1 -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d].dns01 must contain exactly one provider configuration" $index) -}}
{{- end -}}
{{- end -}}
{{- if $http -}}
{{- $httpConfig := default dict (get $solver "http01") -}}
{{- $ingress := hasKey $httpConfig "ingress" -}}
{{- $gateway := hasKey $httpConfig "gatewayHTTPRoute" -}}
{{- if eq $ingress $gateway -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d].http01 must contain exactly one of ingress or gatewayHTTPRoute" $index) -}}
{{- end -}}
{{- if $ingress -}}
{{- $ingressConfig := default dict (get $httpConfig "ingress") -}}
{{- $options := 0 -}}
{{- range list "ingressClassName" "class" "name" -}}
{{- if hasKey $ingressConfig . -}}
{{- $options = add1 $options -}}
{{- end -}}
{{- end -}}
{{- if ne $options 1 -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d].http01.ingress must set exactly one of ingressClassName, class, or name" $index) -}}
{{- end -}}
{{- end -}}
{{- if and $gateway (ne (include "cert-manager.gatewayAPIEnabled" $) "true") -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d] uses gatewayHTTPRoute but Gateway API is not enabled" $index) -}}
{{- end -}}
{{- if $gateway -}}
{{- $gatewayConfig := default dict (get $httpConfig "gatewayHTTPRoute") -}}
{{- if and (empty (get $gatewayConfig "parentRefs")) (empty (get $gatewayConfig "labels")) -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d].http01.gatewayHTTPRoute must set parentRefs or labels" $index) -}}
{{- end -}}
{{- end -}}
{{- $routeKey := ternary "ingress" "gatewayHTTPRoute" $ingress -}}
{{- $routeConfig := default dict (get $httpConfig $routeKey) -}}
{{- $labelSets := list (dig "podTemplate" "metadata" "labels" dict $routeConfig) -}}
{{- if $ingress -}}
{{- $labelSets = append $labelSets (dig "ingressTemplate" "metadata" "labels" dict $routeConfig) -}}
{{- else -}}
{{- $labelSets = append $labelSets (default dict (get $routeConfig "labels")) -}}
{{- end -}}
{{- range $labels := $labelSets -}}
{{- range list "acme.cert-manager.io/http01-solver" "acme.cert-manager.io/http-domain" "acme.cert-manager.io/http-token" -}}
{{- if hasKey $labels . -}}
{{- fail (printf "issuers.letsEncrypt.solvers[%d] may not override reserved acme.cert-manager.io/http-* labels" $index) -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "cert-manager.validateIssuerNames" -}}
{{- if not (kindIs "map" .Values.issuers) -}}
{{- fail "issuers must be an object containing selfSigned and letsEncrypt" -}}
{{- end -}}
{{- $selfSigned := .Values.issuers.selfSigned -}}
{{- $acme := .Values.issuers.letsEncrypt -}}
{{- if and $selfSigned.enabled $acme.enabled (eq $selfSigned.scope $acme.scope) (eq (include "cert-manager.selfSignedIssuerName" .) (include "cert-manager.letsEncryptIssuerName" .)) -}}
{{- fail "issuers.selfSigned and issuers.letsEncrypt must not use the same scope and name" -}}
{{- end -}}
{{- if $acme.enabled -}}
{{- $secretName := include "cert-manager.letsEncryptAccountSecretName" . -}}
{{- if gt (len $secretName) 253 -}}
{{- fail "the generated Let's Encrypt account Secret name exceeds 253 characters; set issuers.letsEncrypt.privateKeySecretName" -}}
{{- end -}}
{{- end -}}
{{- end -}}
