<p align="center">
  <img src="logo.svg" alt="Genesis" width="480">
</p>

# Genesis

Operator guide: [docs/README.md](docs/README.md).

Genesis is a public, version-for-version open build of [Big Bang](https://repo1.dso.mil/big-bang/bigbang). A Genesis tag deploys the same default-on package set that Big Bang pins for that release, using anonymously pullable public images.

This repository is the `genesis-oss` edition. It is generated. The durable edits live in the Genesis engine. The next sync overwrites hand edits in this tree.

**Built by [AlphaBravo](https://alphabravo.io).** License: Apache-2.0.

## This edition

| | |
|---|---|
| Visibility | Public. GitHub org `alphabravo-oss`, repository `genesis-oss`. |
| Images | Anonymously pullable public images. |
| Conformance | Relaxed. Pods start and the default UIs answer. Posture may be softer than upstream Big Bang. |
| UI | Packaged read-only console: deployment inspection, baseline comparison, and image scans. See [Console](docs/console.md). |
| Versions | `3.28.0` through `3.33.0`, published 2026-09-21. See [Releases](#releases). |

Iron Bank image names and security contexts stay in the engine catalog as data. This edition pulls public images at deploy time.

## Releases

Three kinds of tag are published here. Each is a GitHub Release, and [CHANGELOG.md](CHANGELOG.md) lists them all.

| Tag | What it is | When to use it |
|---|---|---|
| `X.Y.Z` | Genesis for Big Bang `X.Y.Z`: the same default-on packages, with public images. | Install or upgrade to a Big Bang version. |
| `X.Y.Z+genesis.N` | A Genesis patch on the same Big Bang `X.Y.Z`: fixes to Genesis defaults, profiles, or generation. The umbrella chart version stays `X.Y.Z`. | Prefer the highest `N` for your Big Bang version. |
| `console-vX.Y.Z` | The [console](docs/console.md), versioned on its own. Publishes `ghcr.io/alphabravo-oss/genesis-console` and the chart at `oci://ghcr.io/alphabravo-oss/charts/genesis-console`. | Install or upgrade the console. Any console release reads every Genesis version it has catalogs for. |

The Latest release is the newest Genesis version, including its patches. A clone of `main` is the newest snapshot. For an older version, check out its tag, for example `git checkout 3.31.0`. `3.28.0` through `3.32.0` are the support window behind `3.33.0`. A weekday workflow opens an issue when Big Bang publishes a newer release.

Genesis is an independent project that tracks those upstream tags. It is a separate product from Platform One and from Big Bang. It carries no Platform One approval, no Iron Bank equivalence, and no DoD compliance claim. Images in this edition are the public upstream images.

Upstream chart `LICENSE` files ship with the generated snapshot and stay Apache-2.0.

## What you install

The [console](docs/console.md) is included in `genesis-console/`. Run `./genesis-console/scripts/up.sh` from this checkout to build and start it with Docker Compose, or install the published chart in a cluster: `helm upgrade --install console oci://ghcr.io/alphabravo-oss/charts/genesis-console --version 1.0.0` (see `genesis-console/README.md` for the credentials Secret). Its catalogs and archived comparison baselines are included under `genesis-engine/`.

The Kubernetes install entrypoint is the umbrella chart in this repo. Package charts for the default-on set are snapshotted beside it. Addons that Big Bang ships disabled stay disabled. Deploys use no Registry1 pull secret and no image from `registry1.dso.mil` or `registry.dso.mil`.

## Status

This tree is the generated `3.33.0` snapshot. The engine can regenerate it. Hand edits here are overwritten on the next sync.
