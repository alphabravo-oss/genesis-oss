# Loki

Loki runs as a monolith. Alloy ships logs to it. Grafana has a Loki datasource.

| Image | Reference |
|---|---|
| Loki | `docker.io/grafana/loki:3.7.7` |

Upstream docs: [https://grafana.com/docs/loki/latest/](https://grafana.com/docs/loki/latest/)

A check that the path works is a query through Grafana, `{namespace="monitoring"}`, against that datasource.
