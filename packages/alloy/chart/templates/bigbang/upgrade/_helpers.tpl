{{- define "alloy.shouldDeployUpgradeResources" -}}
{{- $upgradeVersion := "2.0.16-bb.1" -}}

{{- if and .Values.autoRollingUpgrade.enabled .Release.IsUpgrade -}}
  {{- $helmRelease := lookup "helm.toolkit.fluxcd.io/v2" "HelmRelease" "bigbang" "alloy" -}}
  {{- if and $helmRelease (hasKey $helmRelease "status") (hasKey $helmRelease.status "history") -}}
    {{- $history := $helmRelease.status.history -}}
    {{- if and $history (gt (len $history) 0) -}}
      {{- $currentVersion := index $history 0 "chartVersion" -}}
      {{- if semverCompare (print "<" $upgradeVersion) $currentVersion -}}
        true
      {{- end -}}
    {{- end -}}
  {{- end -}}
{{- end -}}

{{- end -}}