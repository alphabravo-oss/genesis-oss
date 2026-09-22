-- name: LatestFindings :many
SELECT DISTINCT ON (digest)
    digest,
    ref,
    db_version,
    critical_count,
    high_count,
    cves,
    created_at
FROM findings
ORDER BY digest, created_at DESC;

-- name: InsertFinding :exec
INSERT INTO findings (digest, ref, db_version, critical_count, high_count, cves)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: InsertJob :exec
INSERT INTO scan_jobs (id, release_tag, scope, state, total)
VALUES ($1, $2, $3, $4, $5);

-- name: InsertJobItem :exec
INSERT INTO scan_job_items (job_id, image_id, ref, state)
VALUES ($1, $2, $3, $4);

-- name: ListJobs :many
SELECT id, release_tag, scope, state, total, done, failed, skipped, error, created_at, finished_at
FROM scan_jobs
ORDER BY created_at DESC
LIMIT 30;

-- name: GetJob :one
SELECT id, release_tag, scope, state, total, done, failed, skipped, error, created_at, finished_at
FROM scan_jobs
WHERE id = $1;

-- name: ListJobItems :many
SELECT image_id, ref, digest, state, error
FROM scan_job_items
WHERE job_id = $1
ORDER BY image_id;

-- name: NextQueuedJob :one
SELECT id
FROM scan_jobs
WHERE state = 'queued'
ORDER BY created_at
LIMIT 1;

-- name: MarkJobRunning :execrows
UPDATE scan_jobs
SET state = 'running'
WHERE id = $1 AND state = 'queued';

-- name: ListQueuedItems :many
SELECT image_id, ref, digest, state, error
FROM scan_job_items
WHERE job_id = $1 AND state = 'queued'
ORDER BY image_id;

-- name: UpdateJobItem :exec
UPDATE scan_job_items
SET state = $3, error = $4, digest = $5
WHERE job_id = $1 AND image_id = $2;

-- name: FinishJob :exec
UPDATE scan_jobs
SET state = $2, done = $3, failed = $4, skipped = $5, error = $6, finished_at = now()
WHERE id = $1;

-- name: TouchJob :exec
UPDATE scan_jobs
SET done = $2, failed = $3, skipped = $4
WHERE id = $1;

-- name: InterruptJobs :exec
UPDATE scan_jobs
SET state = 'failed', error = 'interrupted', finished_at = now()
WHERE state IN ('queued', 'running');

-- name: InterruptItems :exec
UPDATE scan_job_items
SET state = 'failed', error = 'interrupted'
WHERE state IN ('queued', 'running');

-- name: CountActiveJobs :one
SELECT count(*)::int AS count
FROM scan_jobs
WHERE state IN ('queued', 'running');

-- name: GetSettings :one
SELECT auto_clean
FROM scan_settings
WHERE singleton;

-- name: SetAutoClean :exec
UPDATE scan_settings
SET auto_clean = $1
WHERE singleton;
