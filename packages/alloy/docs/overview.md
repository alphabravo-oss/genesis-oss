# Alloy

## Overview

This package contains an installation of Grafana Alloy using a Helm chart built by Big Bang.

## Grafana Alloy

[Grafana Alloy](https://github.com/grafana/k8s-monitoring-helm/tree/main/charts/k8s-monitoring) is an open-source observability collector that can collect, process, and forward metrics, logs, traces, and profiles. It is built on the OpenTelemetry Collector and is designed to integrate with Grafana's observability ecosystem.

## How it works

Grafana Alloy runs as a Kubernetes workload and collects telemetry data from configured sources. It processes the data through its component-based pipeline and forwards it to supported observability backends. For additional information on Grafana Alloy, please refer to the [Grafana Alloy documentation](https://github.com/grafana/k8s-monitoring-helm/tree/main/charts/k8s-monitoring/docs).