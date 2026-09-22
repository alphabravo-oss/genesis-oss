# Console

Genesis Console is the read-only deployment and image-scan UI. Its source, Docker package, and required catalog/baseline data are included in this repository. From a fresh clone:

```bash
git clone https://github.com/alphabravo-oss/genesis-oss.git
cd genesis-oss
./genesis-console/scripts/up.sh
```

Open http://127.0.0.1:8090 and use the Genesis sign-in page with username `admin` and the generated password in `genesis-console/.local/console-password`. The two-pane login uses a session cookie that survives backend restarts; sign-out is in the sidebar. Images are grouped by digest, and scans update their rows through SSE without leaving the page. Clicking an image opens its detail page with findings, references, digest, and the containers using it. Fixable counts and a fix-availability filter use Trivy’s reported fixed versions. Each new scan also saves CycloneDX and SPDX JSON SBOMs for download on the image detail page; both include detected packages without known vulnerabilities and survive restarts and scan-cache cleanup. Older scans need a rescan to add an SBOM.

The package includes the built web UI, API, Helm, kubectl, Trivy, catalogs, and archived baselines. PostgreSQL and scan cache persist in Docker volumes. The [console README](../genesis-console/README.md) documents container-reachable kubeconfigs, authentication, and the optional Kubernetes chart with a scoped read-only service account. Genesis workloads continue to run on Kubernetes; Docker packages the console and its database. `genesis-engine/` in this repository contains the console's catalog and baseline data, not the generator source.

The installed version comes from Helm metadata. The fetched Flux Git revision is a separate observation. New installs made with `scripts/install.py` record baseline and profile checksums; the console verifies and follows those profiles automatically. Older installations show **Not recorded** and permit manual profile selection. Manual selection changes only the comparison.

**Configured differences** compare selected safe settings with the standard plus profiles. **Runtime drift** is reported only from a current Flux drift condition when detection is enabled. Missing permissions, unsupported reference expressions, missing baselines, and unavailable APIs stay unknown. This is not an exhaustive audit of every Kubernetes resource, a cryptographic authenticity check, or a conformance certification. The Overview coverage panel explains what was read.

Secret/ConfigMap reads are needed for Helm release records and referenced values. Scope them to the umbrella and child release namespaces. Cluster writes are never granted. Raw values remain on the server and sensitive fields are omitted from comparison output. Public image scans require outbound registry access; no Docker socket is mounted.
