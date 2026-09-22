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
| First tag | `3.33.0`, after the k3d deploy works. |

Iron Bank image names and security contexts stay in the engine catalog as data. This edition pulls public images at deploy time.

## Tracking

Genesis tags match Big Bang tags. Each tag is also a GitHub Release. A clone of `main` is the newest snapshot. An older version is that release's tag, for example `git checkout 3.31.0`. `3.33.0` is the newest release. `3.28.0` through `3.32.0` are the support window behind it.

Genesis is an independent project that tracks those upstream tags. It is a separate product from Platform One and from Big Bang. It carries no Platform One approval, no Iron Bank equivalence, and no DoD compliance claim. Images in this edition are the public upstream images.

Upstream chart `LICENSE` files ship with the generated snapshot and stay Apache-2.0.

## What you install

The [console](docs/console.md) is included in `genesis-console/`. Run `./genesis-console/scripts/up.sh` from this checkout to build and start it with Docker Compose. Its required catalogs and archived comparison baselines are included under `genesis-engine/`.

The Kubernetes install entrypoint is the umbrella chart in this repo. Package charts for the default-on set are snapshotted beside it. Addons that Big Bang ships disabled stay disabled. Deploys use no Registry1 pull secret and no image from `registry1.dso.mil` or `registry.dso.mil`.

## Status

This tree is the generated `3.33.0` snapshot. The engine can regenerate it. Hand edits here are overwritten on the next sync.
