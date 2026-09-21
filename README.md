# Genesis

Genesis is a public, version-for-version open build of [Big Bang](https://repo1.dso.mil/big-bang/bigbang). A Genesis tag deploys the same default-on package set that Big Bang pins for that release, using anonymously pullable public images.

This repository is the `genesis-oss` edition. It is generated. The durable edits live in the Genesis engine. The next sync overwrites hand edits in this tree.

**Built by [AlphaBravo](https://alphabravo.io).** License: Apache-2.0.

## This edition

| | |
|---|---|
| Visibility | Public. GitHub org `alphabravo-oss`, repository `genesis-oss`. |
| Images | Anonymously pullable public images. |
| Conformance | Relaxed. Pods start and the default UIs answer. Posture may be softer than upstream Big Bang. |
| UI | A light management UI comes after the stack is up. |
| First tag | `3.33.0`, after the k3d deploy works. |

Iron Bank image names and security contexts stay in the engine catalog as data. This edition pulls public images at deploy time.

## Tracking

Genesis tags match Big Bang tags. `3.33.0` is the first tag. `3.28.0` through `3.32.0` follow after that deploy works, then each later Big Bang release.

Genesis is an independent project that tracks those upstream tags. It is a separate product from Platform One and from Big Bang. It carries no Platform One approval, no Iron Bank equivalence, and no DoD compliance claim. Images in this edition are the public upstream images.

Upstream chart `LICENSE` files ship with the generated snapshot and stay Apache-2.0.

## What you install

The install entrypoint is the umbrella chart in this repo. Package charts for the default-on set are snapshotted beside it. Addons that Big Bang ships disabled stay disabled. Deploys use no Registry1 pull secret and no image from `registry1.dso.mil` or `registry.dso.mil`.

## Status

The `3.33.0` snapshot is not generated yet. The cluster spike uses this repo as local git. The public GitHub remote is created in phase 7.
