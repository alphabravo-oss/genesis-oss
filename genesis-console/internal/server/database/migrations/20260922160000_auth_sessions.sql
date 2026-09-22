-- +goose Up
CREATE TABLE auth_sessions (
    token_hash bytea PRIMARY KEY,
    expires_at timestamptz NOT NULL
);

-- +goose Down
DROP TABLE auth_sessions;
