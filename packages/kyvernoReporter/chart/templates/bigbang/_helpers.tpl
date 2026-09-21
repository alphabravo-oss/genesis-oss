{{/*
Find hostname from uri
*/}}
{{- define "kyvernoReporter.hostnameFromUri" -}}
{{- $match := . | toString | regexFind "//.*" -}}
{{- $hostWithPort := regexSplit "/" ($match | trimAll "//") -1 -}}
{{- $host := regexSplit ":" (first $hostWithPort) -1 -}}
{{- printf "%s" (first $host) -}}
{{- end -}}
