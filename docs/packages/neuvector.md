# NeuVector

NeuVector is the runtime security console. On `3.33.0` the controller, enforcer, and manager are 5.6.1. The UI is `neuvector.dev.genesis.local`. The bootstrap password is `changeme$!`.

| Image | Reference |
|---|---|
| Controller | `docker.io/neuvector/controller:5.6.1` |
| Enforcer | `docker.io/neuvector/enforcer:5.6.1` |
| Manager | `docker.io/neuvector/manager:5.6.1` |
| Scanner | `docker.io/neuvector/scanner:6` |
| Exporter | `docker.io/neuvector/prometheus-exporter:1-1.0.0` |

Upstream docs: [https://open-docs.neuvector.com/](https://open-docs.neuvector.com/)

The exporter chart prefixes its own registry onto `image.repository`. The overlay sets the repository to `neuvector/prometheus-exporter` and the registry to `docker.io`. The enforcer stays privileged, which is the upstream exception. On k3d, `fs.inotify.max_user_instances` has to be raised above 128 or the enforcer exits.
