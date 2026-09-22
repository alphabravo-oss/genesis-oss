-- name: CreateAuthSession :exec
-- Replace the browser's previous session and keep at most 128 recent sessions.
WITH removed AS (
    DELETE FROM auth_sessions
    WHERE expires_at <= now()
       OR token_hash = sqlc.arg(old_hash)::bytea
       OR token_hash IN (
           SELECT token_hash FROM auth_sessions ORDER BY expires_at DESC OFFSET 127
       )
)
INSERT INTO auth_sessions (token_hash, expires_at)
VALUES (sqlc.arg(token_hash), sqlc.arg(expires_at));

-- name: ValidAuthSession :one
SELECT EXISTS (
    SELECT 1 FROM auth_sessions
    WHERE token_hash = $1 AND expires_at > now()
);

-- name: DeleteAuthSession :exec
DELETE FROM auth_sessions WHERE token_hash = $1;
