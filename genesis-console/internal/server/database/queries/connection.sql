-- name: GetClusterConnection :one
SELECT name, context, server, kubeconfig, updated_at FROM cluster_connection WHERE id = 1;

-- name: SaveClusterConnection :exec
INSERT INTO cluster_connection (id, name, context, server, kubeconfig)
VALUES (1, $1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, context = EXCLUDED.context, server = EXCLUDED.server,
    kubeconfig = EXCLUDED.kubeconfig, updated_at = now();

-- name: DeleteClusterConnection :exec
DELETE FROM cluster_connection WHERE id = 1;
