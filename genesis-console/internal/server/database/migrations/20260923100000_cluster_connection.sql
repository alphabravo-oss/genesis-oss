-- +goose Up
-- OSS keeps one connection. The kubeconfig is AES-256-GCM ciphertext (nonce first);
-- the key lives outside the database.
CREATE TABLE cluster_connection (
    id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name text NOT NULL,
    context text NOT NULL,
    server text NOT NULL,
    kubeconfig bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE cluster_connection;
