package console

import (
	"errors"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

const sampleKubeconfig = `apiVersion: v1
kind: Config
current-context: k3d-genesis
clusters:
- name: k3d-genesis
  cluster:
    server: https://127.0.0.1:6443
    certificate-authority-data: Q0E=
- name: other
  cluster:
    server: https://other.example:6443
users:
- name: admin@k3d-genesis
  user:
    client-certificate-data: Q0VSVA==
    client-key-data: S0VZ
- name: other-user
  user:
    token: abc
contexts:
- name: k3d-genesis
  context: {cluster: k3d-genesis, user: admin@k3d-genesis}
- name: other
  context: {cluster: other, user: other-user, namespace: tools}
`

func TestPrepareKubeconfigSelectsContext(t *testing.T) {
	got, err := prepareKubeconfig([]byte(sampleKubeconfig), "", false)
	if err != nil {
		t.Fatal(err)
	}
	if got.Context != "k3d-genesis" || got.Server != "https://127.0.0.1:6443" || !got.Loopback || len(got.Contexts) != 2 {
		t.Fatalf("unexpected default selection: %+v", got)
	}
	other, err := prepareKubeconfig([]byte(sampleKubeconfig), "other", false)
	if err != nil {
		t.Fatal(err)
	}
	if other.Server != "https://other.example:6443" || other.Loopback || other.Namespace != "tools" {
		t.Fatalf("unexpected explicit selection: %+v", other)
	}
	var rendered object
	if err := yaml.Unmarshal(other.Rendered, &rendered); err != nil {
		t.Fatal(err)
	}
	if len(list(rendered["clusters"])) != 1 || len(list(rendered["users"])) != 1 || str(rendered["current-context"]) != "other" {
		t.Fatalf("rendered kubeconfig must hold only the selected context: %s", other.Rendered)
	}
	if strings.Contains(string(other.Rendered), "Q0VSVA==") {
		t.Fatal("rendered kubeconfig leaked another context's credentials")
	}
}

func TestPrepareKubeconfigRejects(t *testing.T) {
	cases := map[string]struct{ input, context, want string }{
		"exec plugin":      {strings.Replace(sampleKubeconfig, "token: abc", "exec: {command: aws}", 1), "other", "Cloud login plugins"},
		"auth provider":    {strings.Replace(sampleKubeconfig, "token: abc", "auth-provider: {name: gcp}", 1), "other", "Cloud login plugins"},
		"client cert path": {strings.Replace(sampleKubeconfig, "client-certificate-data: Q0VSVA==", "client-certificate: /home/me/cert.pem", 1), "", "refers to files"},
		"ca path":          {strings.Replace(sampleKubeconfig, "certificate-authority-data: Q0E=", "certificate-authority: /ca.crt", 1), "", "refers to files"},
		"token file":       {strings.Replace(sampleKubeconfig, "token: abc", "tokenFile: /var/run/token", 1), "other", "refers to files"},
		"missing context":  {sampleKubeconfig, "nope", "no usable context"},
		"not yaml":         {"{{{", "", "not a valid kubeconfig"},
		"empty":            {"apiVersion: v1\nkind: Config\n", "", "no usable context"},
		"too large":        {strings.Repeat("#", maxKubeconfigBytes+1), "", "too large"},
	}
	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := prepareKubeconfig([]byte(c.input), c.context, false)
			var user kubeconfigError
			if !errors.As(err, &user) || !strings.Contains(err.Error(), c.want) {
				t.Fatalf("want %q, got %v", c.want, err)
			}
		})
	}
}

func TestPrepareKubeconfigInsecureWarns(t *testing.T) {
	input := strings.Replace(sampleKubeconfig, "certificate-authority-data: Q0E=", "insecure-skip-tls-verify: true", 1)
	got, err := prepareKubeconfig([]byte(input), "", false)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Warnings) != 1 || !strings.Contains(got.Warnings[0], "TLS verification is off") {
		t.Fatalf("want an insecure warning: %v", got.Warnings)
	}
}

func TestPrepareKubeconfigLoopback(t *testing.T) {
	for server, want := range map[string]string{
		"https://127.0.0.1:6443": "https://host.docker.internal:6443",
		"https://localhost:6443": "https://host.docker.internal:6443",
		"https://[::1]:6443":     "https://host.docker.internal:6443",
		"https://127.0.0.1":      "https://host.docker.internal:443",
		"https://[::1]":          "https://host.docker.internal:443",
		"http://127.0.0.1":       "http://host.docker.internal:80",
		"https://LOCALHOST:6443": "https://host.docker.internal:6443",
	} {
		input := strings.Replace(sampleKubeconfig, "https://127.0.0.1:6443", server, 1)
		got, err := prepareKubeconfig([]byte(input), "", true)
		if err != nil {
			t.Fatal(err)
		}
		var rendered object
		yaml.Unmarshal(got.Rendered, &rendered)
		cluster := obj(obj(list(rendered["clusters"])[0])["cluster"])
		if got.Server != want || str(cluster["server"]) != want || str(cluster["tls-server-name"]) == "" || !got.Loopback {
			t.Fatalf("%s: got %+v / %v", server, got, cluster)
		}
	}
}

func TestPrepareKubeconfigCRLF(t *testing.T) {
	input := "\ufeff" + strings.ReplaceAll(sampleKubeconfig, "\n", "\r\n")
	if _, err := prepareKubeconfig([]byte(input), "", false); err != nil {
		t.Fatal(err)
	}
}
