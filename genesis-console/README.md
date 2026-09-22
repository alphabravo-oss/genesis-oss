# Genesis Console

Read-only deployment inspection and comparison for Genesis. The plan is [PLAN.md](PLAN.md).

The API is Go and Connect-RPC (`proto/console/v1/console.proto`). Catalogs are loaded into PostgreSQL and read through sqlc. The page is React, and it calls that API with Connect-Web.

## Docker installation

From this directory in the workspace (with `genesis-engine/` beside it):

```bash
./scripts/up.sh
```

Open **http://127.0.0.1:8090**, user `admin`; the generated password is in `.local/console-password`. Docker Compose builds the production UI and Go server into one image and starts PostgreSQL. No host Go, Node, Helm, kubectl, or Trivy installation is needed. Docker Compose v2, curl, and OpenSSL are required. The image supports Linux amd64 and arm64. If the port is occupied, use `GENESIS_PORT=18091 ./scripts/up.sh`; the launcher checks that the host address actually reaches Genesis.

The service is authenticated, bound to localhost, runs as UID 65532 with a read-only filesystem, and has no Docker socket. Database and scan cache use named volumes. `.local/` contains private credentials and is excluded from Git and image builds. Do not delete its passwords while retaining the database volume. `docker compose down` stops the app and preserves data; `./scripts/up.sh` rebuilds/upgrades it. Back up PostgreSQL before upgrades; downgrade compatibility of database migrations is not guaranteed.

Sign in on the two-pane `/login` page with the configured console credentials. Successful login returns you to your original page. Sessions persist in PostgreSQL across backend restarts and use an HttpOnly, SameSite=Strict cookie with a 12-hour expiry. Signing out revokes the session immediately; changing the configured username or password invalidates existing sessions. Only hashes of session tokens are stored in PostgreSQL; passwords and session tokens are never stored in browser local storage. A database outage returns unavailable without clearing the cookie. Login attempts are limited to 10 per minute per connecting IP. A TLS reverse proxy should overwrite `X-Forwarded-Proto` with `https` so the cookie is marked Secure. HTTP Basic authentication is no longer used.

Without cluster credentials, catalogs and public-image scans work and deployment observations show unavailable. To connect a cluster, flatten its kubeconfig (requires host kubectl), then restart:

```bash
KUBECONFIG=/absolute/path/to/config python3 scripts/kubeconfig.py
GENESIS_KUBECONFIG="$PWD/.local/kubeconfig" ./scripts/up.sh
```

For a local cluster whose API is `https://127.0.0.1:PORT`, add `--server https://host.docker.internal:PORT` to the helper. It preserves the original TLS certificate name. The API must listen on a container-reachable interface. The helper embeds certificate files and refuses host credential plugins; cloud users need a scoped service-account kubeconfig or a derived image containing their provider's authentication plugin. Output files are created without overwriting existing credentials. Keep passing `GENESIS_KUBECONFIG` on subsequent starts to retain cluster access.

For direct image builds, run from the workspace root:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -f genesis-console/Dockerfile -t YOUR_REGISTRY/genesis-console:VERSION --push .
```

The image includes catalogs and immutable comparison baselines. It needs outbound registry access for scans. It does not package the Kubernetes stack inside Docker; Genesis workloads still run on Kubernetes.

To distribute a self-contained source bundle without dependency caches or credentials, run `python3 scripts/package.py`. Extract `dist/genesis-console.tar.gz` into an empty directory, then run `genesis-console/scripts/up.sh`. The bundle preserves the sibling data directory required by the Docker build. `helm package deploy/chart --destination dist` produces the separate Kubernetes chart; publish the image to your registry before using that chart.

## Kubernetes installation

`deploy/chart` installs the console, Service, cache PVC, probes, and read-only service account. Use an existing PostgreSQL database and an existing Secret named by `credentialsSecret`, with keys `database-url` and `console-password`. A secret can be created from local files without exposing values in command arguments:

```bash
kubectl create namespace genesis-console
kubectl -n genesis-console create secret generic genesis-console \
  --from-file=database-url=/private/path/database-url \
  --from-file=console-password=/private/path/console-password
helm upgrade --install console deploy/chart --namespace genesis-console \
  --set image.repository=YOUR_REGISTRY/genesis-console --set image.tag=VERSION \
  -f /private/path/console-values.yaml
kubectl -n genesis-console port-forward svc/console 8090:8080
```

Set `cluster.namespace`, `cluster.release`, and `cluster.releaseNamespaces` to the actual umbrella and child Helm release namespaces. All listed namespaces must already exist. The chart grants pod and route inventory reads cluster-wide; Secret/ConfigMap reads are limited to the listed namespaces, because Helm stores release values there. Those credentials can read other secrets in those namespaces too; use a dedicated service account. There are no cluster write grants. An in-cluster install uses its service account automatically and needs no mounted kubeconfig. Publish through a TLS reverse proxy if remote access is required; the supplied Service remains ClusterIP.

## Development

```bash
./scripts/dev.sh
```

The script prints the UI and API addresses. It uses Postgres on `127.0.0.1:54329`. The server reads `genesis-engine/catalogs` and archived umbrella values. `KUBECONFIG` selects a cluster. If it is unset and `~/.kube/genesis-k3d.yaml` exists, that file is used. The page does not change the cluster. The standalone Go server also serves `web/dist`; Vite is needed only for development. Without a password, the server refuses a non-loopback bind.

Checks (no running database or cluster required):

```bash
go test -race ./...
go vet ./...
pnpm --dir web test
pnpm --dir web build
```

Catalog pages load independently of cluster status. Filters stay in the URL and run locally; tables show 50 rows per page, and CSV exports every filtered row. Package settings load when their detail panel opens. Cluster reads run concurrently with a 10-second deadline and a 30-second cache. A failed refresh retains the last observation with its timestamp and a warning.

## Deployment inspection

The console confirms the installed Genesis version from `helm get metadata`, including release state and revision. A fetched Flux Git revision is shown separately. The baseline follows the installed version when that catalog exists; choosing a comparison version explicitly preserves that choice across pages.

Every page identifies the comparison standard (Genesis version plus ordered profiles) and the observed cluster's installed version. A cross-version notice explains that release changes can cause differences. The version-specific image catalog does not change with comparison profiles; Services shows live cluster routes.

- **Overview** shows deployment identity, readiness issues, differences from the selected standard, Flux drift results, and scan coverage for observed container digests.
- **Packages** separates Standard, Cluster configuration, Installed chart, Difference from standard, and Flux runtime drift. Opening a package compares enablement, chart sources, images, replicas, resources, storage, and ingress. Installed child-chart values are read at the observed Helm revision. Sensitive paths are omitted and URL credentials are stripped.
- **Images** starts with unique deployed images, grouped by observed digest (or configured reference when unavailable), including custom images. Open an image to see its own detail page with findings, references, digest, pods, and containers. The back link preserves the release and list filters. Select individual images or all filtered images, then **Scan selected**. Scans stay on this page: row status and finding counts update automatically. The image detail page uses the same live updates and also supports scanning that image. Deployed scans recheck the pod inventory, pin observed digests when available, and scan each digest only once regardless of replica count. Catalog tabs use the same inline scan workflow. Saved findings are matched to scanned digests, including images outside the catalog; unscanned images stay explicitly unscanned.
- **Services** discovers URLs from Kubernetes Ingress and Istio VirtualService/Gateway routes. It does not assume a domain or verify external reachability.

Install using `python3 scripts/install.py` in the generated Genesis OSS repository to record the baseline checksum, profile names/order, profile checksums, and whether custom value files were supplied. Metadata lives in Helm values and a ConfigMap in the same revision, so Helm rollback restores it. The console follows recorded profiles by default; manual selections on Packages affect comparison only. Older installs and direct Helm installs show **Not recorded**. Provenance verifies content consistency; it is not a signature, and it cannot reconstruct the filenames of preexisting custom values.

## Baseline and observation coverage

Configuration comparison uses `genesis-engine/baselines/<tag>/<sha256>/`, including umbrella templates, standard values, Genesis overrides, profiles, and package chart metadata. Sync archives each generated release; multiple baselines for one version are retained by checksum. All seven supplied catalog versions have archived baselines. Recorded installs select their exact checksum. An unavailable or modified archive produces an unknown comparison instead of silently comparing against today's files. Local unarchived source checkouts remain a development fallback.

Differences from the selected baseline can reflect release changes, selected profiles, or user customizations. Runtime drift is reported only when Flux supplies a current `Drifted` condition with drift detection enabled; older controllers or missing conditions show **Not checked**. Flux exclusions still apply. This is not an exhaustive comparison of every Kubernetes object or every chart value. Complex Helm `valuesFrom.targetPath` expressions are marked incomplete rather than guessed. Missing APIs, permissions, or values also remain explicitly unknown.

The API needs local `helm` (with `get metadata`) and `kubectl`, plus read access to Helm release storage, HelmReleases, GitRepositories, pods, Ingresses, Istio routes/gateways, and referenced Secrets/ConfigMaps. Raw values remain on the server. No cluster write commands are used.

| Variable | Default / purpose |
| --- | --- |
| `KUBECONFIG` | Explicit file(s); otherwise `~/.kube/genesis-k3d.yaml` if present, then native kubeconfig discovery |
| `GENESIS_NAMESPACE` | `bigbang`; namespace containing the umbrella and package HelmReleases |
| `GENESIS_RELEASE` | `bigbang`; umbrella Helm release name |
| `GENESIS_KUBE_VERSION` | `1.36.0`; Kubernetes version used for baseline rendering |
| `ADDR` / `PORT` | `127.0.0.1:8080` natively; container listens on `0.0.0.0:8080` with authentication |
| `DATABASE_URL` / `DATABASE_URL_FILE` | PostgreSQL connection; file takes precedence |
| `GENESIS_AUTH_USERNAME` | `admin` |
| `GENESIS_AUTH_PASSWORD` / `GENESIS_AUTH_PASSWORD_FILE` | Login password for UI/API session authentication; file takes precedence |
| `GENESIS_WEB_DIR` | `web/dist` natively, `/app/web` in the image |
| `GENESIS_DATA_DIR` / `GENESIS_BASELINE_DIR` | Packaged catalog/data root and optional baseline archive override |
| `GENESIS_TRIVY_CACHE` | Persistent scan/database cache; `/var/cache/genesis/trivy` in the image |

`GET /healthz` checks the process; `GET /readyz` checks PostgreSQL. Both are unauthenticated and expose no connection details. Kubernetes/Flux availability appears in observation coverage and does not block catalog access. Shutdown stops new HTTP requests and cancels background scans; interrupted scans are recovered on restart.

Scan changes are pushed through authenticated SSE at `GET /events/scans`, shared by Images and Scans. Reconnects refresh the saved state; polling is used while the stream is unavailable. Streams send 15-second heartbeats and recheck session validity. Reverse proxies must forward this route without response buffering or short request timeouts. Notifications are local to the console process; run one console replica with its scan worker. Cluster inventory still refreshes periodically. Findings are returned once per observed digest, not once per container replica. New scans collect every Trivy vulnerability severity: Critical, High, Medium, Low, and Unknown. Image details and scan history show all findings by default, with severity filters, search, pagination, and CSV export. Older scans are marked as limited coverage and need a rescan to collect the previously omitted severities. Image summary counts represent distinct vulnerabilities; the findings table lists affected packages and versions, so one vulnerability can appear in multiple rows. **Fixable** counts distinct vulnerabilities with a fixed version reported for at least one affected package. The **Fix availability** filter combines with severity and search; **Fixed in** shows Trivy’s reported versions. “No fix reported” means Trivy did not supply a fixed version, not that a fix is impossible. Updating a package requires rebuilding/updating the image; the console does not modify workloads.

Every new image scan also generates **CycloneDX JSON** and **SPDX JSON** SBOMs using Trivy. Both are converted from the same full report (including detected packages without known vulnerabilities), without pulling or scanning the image again. Download them from the image detail page. Exports include Trivy’s image and tool metadata and are saved atomically with the findings in PostgreSQL; restarts and scan-cache cleanup preserve them. Image lists carry only download IDs, not the SBOM bodies. Authenticated downloads use `GET /sbom/{scan-id}/cyclonedx` or `/sbom/{scan-id}/spdx-json`. Older scans need a rescan to generate SBOMs. If conversion fails, vulnerability results still save and the detail page explains how to retry. SBOM storage grows with scan history, so include it in PostgreSQL capacity planning and backups.

Every page identifies the **comparison standard** (Genesis OSS version and ordered manual/recorded profiles) and the **observed cluster** (context, installed version, Helm release, observation time). Cross-version comparisons warn that differences can come from release changes. Packages distinguish the selected standard, cluster configuration, installed charts/values, and Flux runtime drift; “Differs from standard” does not claim every difference is a user customization. Images and bulk scans use the selected version’s image catalog, which profiles do not change. Services remain a live cluster inventory. Changing comparison settings never modifies the cluster.

## Application chrome

The login layout follows [Astronomer’s canonical login page](https://github.com/alphabravo-oss/astronomer/blob/5961992098c8d8c72a5159e966359ad61838579d/frontend/src/routes/auth/login/index.tsx): equal desktop panes, a dark branded panel, and a centered 384px form. Genesis uses its own copy and green accents. Mobile shows the form and logo; credentials, password visibility, inline errors, and sign-out are functional.

The shell follows the Astronomer reference used by the neighboring admin UI: Inter body/navigation, JetBrains Mono code, a 16px base, 14px navigation, 240px expanded / 64px collapsed sidebar, and a 56px desktop header. Fonts are self-hosted with their licenses. Genesis keeps its own brand and theme colors. A vector favicon, early theme initialization, theme-aware browser color, safe-area insets, keyboard search/focus, and responsive navigation are included. The top-right user icon opens appearance settings (System, Light, Dark) and sign-out; Collapse/Expand is anchored in the sidebar footer. The account menu follows the [Astronomer top bar](https://github.com/alphabravo-oss/astronomer/blob/5961992098c8d8c72a5159e966359ad61838579d/frontend/src/components/layout/topbar.tsx). This is an adaptation, not a pixel-perfect copy: Genesis uses a compact mobile navigation rail and keeps Collapse at the bottom.

`web/src/index.css` owns colors, fonts, focus styles, safe-area handling, and shell dimensions. Components use these tokens through Tailwind v4; `ThemeProvider` owns appearance preferences. TanStack Query caches live cluster/jobs and receives SSE invalidations; the React Router shell loader owns release snapshots and revalidates after scans. TanStack Table provides the shared sorting, filtering, pagination, selection, and CSV table. No separate menu library or second styling system is required.

Verify every supplied profile against the actual generated chart (requires Helm):

```bash
CONSOLE_TEST_BASELINE="$(cd ../genesis-oss && pwd)" go test ./internal/console -run TestGeneratedBaseline
CONSOLE_TEST_BASELINES="$(cd ../genesis-engine/baselines && pwd)" go test ./internal/console -run 'TestRecordedBaselines|TestBaselineIntegrity'
CONSOLE_TEST_LIVE=1 go test ./internal/console -run TestLiveInspection -v
```

Use an absolute `CONSOLE_TEST_BASELINE` path when running all tests, because Go runs tests from each package directory.

Run persistent-session and HTTP integration tests with `CONSOLE_TEST_DATABASE_URL=postgres://... go test -race ./internal/httpserver`. They create and remove isolated schemas in the supplied PostgreSQL database and verify restart survival, revocation, expiry, credential changes, and database failures.

Validated on 2026-09-22:

- Linux arm64 Compose deployment and Linux amd64 server startup under emulation; both images include working Helm, kubectl, and Trivy.
- Real cluster inspection: installed 3.33.0, 16 HelmReleases, 109 containers, 14 discovered services; current and historical baselines rendered inside Docker.
- A public-image scan completed and persisted across container restarts. Trivy uses disk-backed scratch space and its normal database refresh behavior.
- The Kubernetes chart installed in an isolated namespace with PostgreSQL, probes, cache PVC, and service-account inspection. Scoped RBAC allowed reads and denied cluster writes/unrelated Secret reads. Test resources were removed afterward.
- Installer checksum failures, ordered profiles, custom values, and real Helm install/upgrade/rollback provenance were checked. Go race tests/vet, frontend tests/typecheck/build, and Helm lint passed.
- Browser checks covered reference geometry/fonts, dark/light colors, keyboard search and restored focus, profile navigation, authenticated deep links/assets, and 320/390/768/1440px layouts. Safe-area CSS is included; physical notched-device testing and pixel-diff certification were not performed.
