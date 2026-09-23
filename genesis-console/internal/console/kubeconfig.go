package console

import (
	"bytes"
	"net"
	"net/url"
	"strings"

	"gopkg.in/yaml.v3"
)

// Kubeconfigs pasted into the UI. These run inside a container that has no
// access to the user's files or login plugins, so both are rejected here.

const maxKubeconfigBytes = 256 << 10

type kubeconfigError string

func (e kubeconfigError) Error() string { return string(e) }

const (
	errKubeconfigPlugin = kubeconfigError(`Cloud login plugins cannot run inside the console. Create a service-account kubeconfig (see "Service account for an external console" in the README).`)
	errKubeconfigFiles  = kubeconfigError("The kubeconfig refers to files on another machine. Run `kubectl config view --flatten --minify` and paste the result.")
	errKubeconfigEmpty  = kubeconfigError("The kubeconfig has no usable context.")
)

type preparedKubeconfig struct {
	Contexts  []string
	Context   string
	Server    string
	Namespace string
	Loopback  bool
	Warnings  []string
	Rendered  []byte
}

func named(items []any, name string) object {
	for _, item := range items {
		if str(obj(item)["name"]) == name {
			return obj(item)
		}
	}
	return nil
}

func prepareKubeconfig(raw []byte, context string, rewriteLoopback bool) (*preparedKubeconfig, error) {
	if len(raw) > maxKubeconfigBytes {
		return nil, kubeconfigError("The kubeconfig is too large.")
	}
	raw = bytes.TrimPrefix(raw, []byte("\ufeff"))
	var config object
	if err := yaml.Unmarshal(raw, &config); err != nil || config == nil {
		if err != nil {
			return nil, kubeconfigError("This is not a valid kubeconfig: it could not be read as YAML.")
		}
		return nil, errKubeconfigEmpty
	}
	contexts := list(config["contexts"])
	out := &preparedKubeconfig{}
	for _, item := range contexts {
		if name := str(obj(item)["name"]); name != "" {
			out.Contexts = append(out.Contexts, name)
		}
	}
	if context == "" {
		context = str(config["current-context"])
		if context == "" && len(out.Contexts) == 1 {
			context = out.Contexts[0]
		}
	}
	selected := named(contexts, context)
	details := obj(selected["context"])
	cluster := named(list(config["clusters"]), str(details["cluster"]))
	user := named(list(config["users"]), str(details["user"]))
	clusterBody, userBody := obj(cluster["cluster"]), obj(user["user"])
	if selected == nil || cluster == nil || user == nil || str(clusterBody["server"]) == "" {
		return nil, errKubeconfigEmpty
	}
	if userBody["exec"] != nil || userBody["auth-provider"] != nil {
		return nil, errKubeconfigPlugin
	}
	for _, key := range []string{"client-certificate", "client-key", "tokenFile"} {
		if str(userBody[key]) != "" {
			return nil, errKubeconfigFiles
		}
	}
	if str(clusterBody["certificate-authority"]) != "" {
		return nil, errKubeconfigFiles
	}
	if flag(clusterBody["insecure-skip-tls-verify"]) {
		out.Warnings = append(out.Warnings, "TLS verification is off for this cluster; the console cannot confirm it is talking to the right API server.")
	}
	server, err := url.Parse(str(clusterBody["server"]))
	if err != nil || server.Host == "" {
		return nil, kubeconfigError("The cluster's server address is not a valid URL.")
	}
	host, port := server.Hostname(), server.Port()
	if ip := net.ParseIP(host); strings.EqualFold(host, "localhost") || (ip != nil && (ip.IsLoopback() || ip.IsUnspecified())) {
		out.Loopback = true
		if rewriteLoopback {
			if port == "" {
				port = map[string]string{"http": "80"}[server.Scheme]
				if port == "" {
					port = "443"
				}
			}
			if clusterBody["tls-server-name"] == nil {
				clusterBody["tls-server-name"] = host
			}
			server.Host = net.JoinHostPort("host.docker.internal", port)
			clusterBody["server"] = server.String()
		}
	}
	out.Context = context
	out.Server = str(clusterBody["server"])
	out.Namespace = str(details["namespace"])
	out.Rendered, err = yaml.Marshal(object{
		"apiVersion": "v1", "kind": "Config", "current-context": context,
		"clusters": []any{object{"name": cluster["name"], "cluster": clusterBody}},
		"users":    []any{object{"name": user["name"], "user": userBody}},
		"contexts": []any{object{"name": context, "context": details}},
	})
	if err != nil {
		return nil, kubeconfigError("The kubeconfig could not be prepared.")
	}
	return out, nil
}
