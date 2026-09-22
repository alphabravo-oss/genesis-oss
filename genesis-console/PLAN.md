# Genesis Console, OSS

Read-only console for a Genesis snapshot. It lives in this workspace as `genesis-console/`, next to `genesis-engine` and `genesis-oss`. Its source and required data are packaged into the published OSS repository.

The OSS build observes. It does not install, upgrade, or apply. An enterprise build can add those controls on the same screens later.

## Deployment and baseline

The default baseline follows the confirmed installed Helm chart version when that catalog exists. An explicit version selection stays selected. The installed version, fetched Git revision, cluster context, namespace, observation time, and Helm state are separate facts; a downloaded source revision is not evidence of a successful deployment.

Archived generated umbrellas and profiles provide per-release configuration baselines. Recorded installation provenance selects the exact checksum and profile order; manual profiles change only the comparison. Missing baselines and unavailable observations remain unknown. See [README.md](README.md) for installation, permissions, and coverage limits.

## Overview and packages

Overview prioritizes readiness issues, differences from the selected standard, native Flux drift results, and findings for observed container digests. The coverage panel exposes unavailable data sources.

Packages has one table: Standard, Cluster configuration, Installed chart, Health, Difference from standard, and Flux runtime drift. Packages shows the full comparison standard and profiles; Overview summarizes them. Catalog selectors belong to image catalogs/comparisons and bulk scans. Services has no comparison panel. A package disabled by the standard can still appear as configured or deployed. Umbrella network policies are marked Included when confirmed. Package rows open dedicated pages at `/packages/<name>` with filter-preserving back links. Package details compare relevant safe values from the rendered baseline, resolved HelmRelease references/inline values, and installed child Helm values at the observed revision.

Configuration differences do not imply runtime drift. Only current Flux drift conditions are used, and controller exclusions remain in effect. No condition means Not checked.

Services discovers Ingress and Istio routes, including customized hosts, ports, and paths. Wildcards and unresolvable routes do not become guessed links.

## Scans

A scan runs when someone starts it from Images or Scans. The worker runs Trivy on public references, one image at a time, and writes the finding to Postgres by digest: when, Trivy database version, critical count, high count, and detailed findings across Critical, High, Medium, Low, and Unknown severities. Stored reports record full severity coverage; older reports remain readable and are labeled limited until rescanned. Another release that uses the same digest shows that finding. A failed image keeps any previous finding and keeps the pulled blobs so it can be retried.

Auto cleanup is off until it is turned on. After a finding is stored, cleanup deletes the pulled image blobs with `trivy clean --scan-cache` in the console cache directory. The catalog row and the finding stay. Clean images does the same thing for every pulled blob while no scan is running. The next scan of that digest downloads the image again.

## Images

Deployed images is the default view, with one row per observed digest (or configured reference when no digest is available). It shows unique image references, container counts, readiness, and package ownership. Image names link to dedicated detail pages with findings, references, digests, pods, and containers. Details preserve list filters on return and support scanning the image in place. Selection and scan counts use unique images; the backend verifies current pod inventory and scans each digest once. Scans stay on Images and update row progress/results through authenticated SSE, with polling during reconnection. Saved findings are matched by digest and returned once per image. Catalog differences are labeled separately from runtime drift, and unknown images remain visible.

Catalog tabs show the selected release's default-on, additional, unscanned, critical, and unavailable-source images. Catalog rows retain scan selection, findings, filtering, and full filtered CSV export. Tables render 50 rows per page. The scanning worker writes results to PostgreSQL.

## Stack

The [Technology Selection Guide](https://technology-selection-guide.aws.ablabs.io/) chooses the shape. Air-gap packaging and backup tooling are out of this app.

- Go service under `cmd/console` and `internal/console` (`handler.go`, `service.go`, `store.go`). Connect-RPC on port 8080. The contract is `proto/console/v1/console.proto`.
- PostgreSQL 16, pgx v5, and sqlc. Goose applies `internal/server/database/migrations` under a Postgres advisory lock. Startup reloads `genesis-engine/catalogs` into those tables. Scan findings live in the same database.
- React 19, Vite, Tailwind v4, TanStack Query, TanStack Table, react-router v7 Data Mode, Connect-Web 2. Native select and dialog elements handle release selection and search. The Astronomer-inspired shell has a sidebar with Collapse at the bottom, the observed cluster and installed version in the header, and a top-right user menu for sign-out and light, dark, or system appearance. Shared shell dimensions and theme tokens live in the global stylesheet. The dev server proxies `/console.v1.ConsoleService` to the API.
- Node 24. `pnpm` installs the frontend.

## Run

Production: `./scripts/up.sh` builds the authenticated production image and starts PostgreSQL with persistent volumes. Login sessions persist in PostgreSQL across backend restarts, expire after 12 hours, and are revoked on sign-out. `deploy/chart` provides an in-cluster service-account deployment. See the README for credentials, cluster connectivity, and namespace scope.

Development:

```bash
./scripts/dev.sh
```

The script starts Postgres 16 on `127.0.0.1:54329` (database `genesis_console`) when that container is missing, then the API and the Vite server. If 8080 or 5173 is already taken, it prints the ports it actually bound.

`DATABASE_URL` overrides the database. The default is `postgres://postgres:postgres@127.0.0.1:54329/genesis_console?sslmode=disable`.

Regenerate the contract with `buf generate` and the queries with `sqlc generate`.

## Later

Enterprise keeps these screens and adds deploy, upgrade, compare-and-apply, and private registry credentials. Those controls are absent here.
