# Prometheus Operator CRDs

## Overview

The `prometheus-operator-crds` Helm chart is a dedicated chart that contains only the Custom Resource Definitions (CRDs) required by the Prometheus Operator. These CRDs define the structure and validation rules for custom Kubernetes resources used to declaratively configure Prometheus monitoring components.

## Why Separate CRDs into a Dedicated Chart?

This design enables proper dependency management for Big Bang applications. By installing CRDs first, applications can safely create custom resources like ServiceMonitors even before the `monitoring` chart deploys the Prometheus Operator.

This separation also provides flexibility in tooling choices—the CRDs can be used independently of Prometheus itself. For example, if you prefer Alloy as your metrics collection agent, you can install the CRDs and create ServiceMonitor resources without deploying the full Prometheus stack.