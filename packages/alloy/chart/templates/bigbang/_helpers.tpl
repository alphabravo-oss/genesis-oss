{{/*
Bigbang labels
*/}}
{{- define "bigbang.labels" -}}
app: {{ include "alloy-operator.name" . }}
{{- if .Chart.AppVersion }}
version: {{ .Chart.AppVersion | quote }}
{{- end }}
{{- end }}
