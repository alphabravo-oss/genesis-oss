-- name: ListReleases :many
SELECT
    r.tag,
    r.chart_version,
    COALESCE((
        SELECT count(*)::int FROM packages p
        WHERE p.release_tag = r.tag AND p.enabled AND p.deleted_at IS NULL
    ), 0)::int AS enabled,
    COALESCE((
        SELECT count(*)::int FROM packages p
        WHERE p.release_tag = r.tag AND NOT p.enabled AND p.deleted_at IS NULL
    ), 0)::int AS disabled
FROM releases r
WHERE r.deleted_at IS NULL
ORDER BY r.tag;

-- name: GetRelease :one
SELECT tag, chart_version, domain
FROM releases
WHERE tag = $1 AND deleted_at IS NULL;

-- name: ListPackages :many
SELECT key, enabled, image_count
FROM packages
WHERE release_tag = $1 AND deleted_at IS NULL
ORDER BY key;

-- name: ListImages :many
SELECT
    image_id,
    package_key,
    name,
    ref,
    registry,
    digest,
    when_kind,
    signature,
    critical_count,
    high_count,
    ironbank,
    scanned
FROM images
WHERE release_tag = $1 AND deleted_at IS NULL
ORDER BY package_key, name;

-- name: UpsertRelease :exec
INSERT INTO releases (tag, chart_version, domain)
VALUES ($1, $2, $3)
ON CONFLICT (tag) DO UPDATE
SET chart_version = EXCLUDED.chart_version,
    domain = EXCLUDED.domain,
    deleted_at = NULL;

-- name: SoftDeletePackages :exec
UPDATE packages
SET deleted_at = now()
WHERE release_tag = $1 AND deleted_at IS NULL;

-- name: SoftDeleteImages :exec
UPDATE images
SET deleted_at = now()
WHERE release_tag = $1 AND deleted_at IS NULL;

-- name: UpsertPackage :exec
INSERT INTO packages (release_tag, key, enabled, image_count)
VALUES ($1, $2, $3, $4)
ON CONFLICT (release_tag, key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    image_count = EXCLUDED.image_count,
    deleted_at = NULL;

-- name: UpsertImage :exec
INSERT INTO images (
    release_tag, image_id, package_key, name, ref, registry, digest,
    when_kind, signature, critical_count, high_count, ironbank, scanned
) VALUES (
    $1, $2, $3, $4, $5, $6, $7,
    $8, $9, $10, $11, $12, $13
)
ON CONFLICT (release_tag, image_id) DO UPDATE
SET package_key = EXCLUDED.package_key,
    name = EXCLUDED.name,
    ref = EXCLUDED.ref,
    registry = EXCLUDED.registry,
    digest = EXCLUDED.digest,
    when_kind = EXCLUDED.when_kind,
    signature = EXCLUDED.signature,
    critical_count = EXCLUDED.critical_count,
    high_count = EXCLUDED.high_count,
    ironbank = EXCLUDED.ironbank,
    scanned = EXCLUDED.scanned,
    deleted_at = NULL;
