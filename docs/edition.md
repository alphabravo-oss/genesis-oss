# This edition

A Genesis tag tracks one Big Bang tag. `3.33.0` installs the same default-on packages Big Bang enables for `3.33.0`. The container images are public images from Docker Hub, Quay, ghcr, `registry.k8s.io`, and `registry.gitlab.com`.

The conformance profile is relaxed. Pods start and the default UIs answer. Kyverno still enforces the user, filesystem, capability, and privilege rules that the public images can satisfy. `restrict-image-registries` allows the public registries above. NeuVector keeps the privileged and host-namespace exceptions the upstream chart already allows. Grafana runs as UID 472, which is the public image user.

`values-genesis.yaml` is the file that selects those images. The package charts still contain their upstream defaults. Install with that values file.

Packages Big Bang leaves disabled stay out of the default install. Where a public image exists, it is listed in [Add-on images](packages/addons.md). Optional profiles turn a few of those packages on. See [Profiles](profiles.md).

Genesis is an independent project. It tracks Big Bang tags. A tag here carries the upstream chart license, Apache-2.0.
