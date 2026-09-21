{{/*
This helpers file is used to support backwards compatibility with the dashboards imported from upstream kube-prometheus-stack sync_grafana_dashboards.py script
Only named templates that are required for the dashboards have been added to this helper
Source: https://github.com/prometheus-community/helm-charts/blob/main/charts/kube-prometheus-stack/templates/_helpers.tpl
*/}}

{{- define "kube-prometheus-stack.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 50 | trimSuffix "-" -}}
{{- end }}

{{- define "kube-prometheus-stack.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "kube-prometheus-stack-grafana.namespace" -}}
  {{- if .Values.grafana.namespaceOverride -}}
    {{- .Values.grafana.namespaceOverride -}}
  {{- else -}}
    {{- .Release.Namespace -}}
  {{- end -}}
{{- end -}}

{{/* Allow Kubernetes component job names used by the synced dashboards to be overridden. */}}
{{- define "kube-prometheus-stack-kubelet.name" -}}
{{- default "kubelet" .Values.kubelet.jobNameOverride -}}
{{- end -}}

{{- define "kube-prometheus-stack-kube-controller-manager.name" -}}
{{- default "kube-controller-manager" .Values.kubeControllerManager.jobNameOverride -}}
{{- end -}}

{{- define "kube-prometheus-stack-kube-scheduler.name" -}}
{{- default "kube-scheduler" .Values.kubeScheduler.jobNameOverride -}}
{{- end -}}

{{- define "kube-prometheus-stack-kube-proxy.name" -}}
{{- default "kube-proxy" .Values.kubeProxy.jobNameOverride -}}
{{- end -}}

{{- define "kube-prometheus-stack-kube-apiserver.name" -}}
{{- default "apiserver" .Values.kubeApiServer.jobNameOverride -}}
{{- end -}}

{{/* Configure the destination folder for Grafana operator dashboards. */}}
{{- define "kube-prometheus-stack.grafana.operator.folder" }}
{{- $folder := .Values.grafana.operator.folder }}
{{- $folderUID := .Values.grafana.operator.folderUID }}
{{- $folderRef := .Values.grafana.operator.folderRef }}
{{- if not (or
  (and $folder (not $folderUID) (not $folderRef))
  (and (not $folder) $folderUID (not $folderRef))
  (and (not $folder) (not $folderUID) $folderRef)
) }}
{{- fail "grafana.operator: only one of folder, folderUID, or folderRef must be set" }}
{{- end }}
{{- if $folder }}
folder: {{ $folder | quote }}
{{- else if $folderUID }}
folderUID: {{ $folderUID | quote }}
{{- else if $folderRef }}
folderRef: {{ $folderRef | quote }}
{{- end }}
{{- end }}

{{- define "kube-prometheus-stack.chartref" -}}
{{- replace "+" "_" .Chart.Version | printf "%s-%s" .Chart.Name -}}
{{- end }}

{{- define "kube-prometheus-stack.labels" }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: "{{ replace "+" "_" .Chart.Version }}"
app.kubernetes.io/part-of: {{ template "kube-prometheus-stack.name" . }}
chart: {{ template "kube-prometheus-stack.chartref" . }}
release: {{ $.Release.Name | quote }}
heritage: {{ $.Release.Service | quote }}
{{- if .Values.commonLabels}}
{{ toYaml .Values.commonLabels }}
{{- end }}
{{- end }}

{{/*
Find hostname from uri
*/}}
{{- define "grafana.hostnameFromUri" -}}
{{- $match := . | toString | regexFind "//.*" -}}
{{- $hostWithPort := regexSplit "/" ($match | trimAll "//") -1 -}}
{{- $host := regexSplit ":" (first $hostWithPort) -1 -}}
{{- printf "%s" (first $host) -}}
{{- end -}}
