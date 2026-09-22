-- +goose Up
CREATE TABLE releases (
    tag text PRIMARY KEY,
    chart_version text NOT NULL,
    domain text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE packages (
    release_tag text NOT NULL REFERENCES releases (tag),
    key text NOT NULL,
    enabled boolean NOT NULL,
    image_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    PRIMARY KEY (release_tag, key)
);

CREATE TABLE images (
    release_tag text NOT NULL REFERENCES releases (tag),
    image_id text NOT NULL,
    package_key text NOT NULL,
    name text NOT NULL,
    ref text NOT NULL DEFAULT '',
    registry text NOT NULL DEFAULT '',
    digest text NOT NULL DEFAULT '',
    when_kind text NOT NULL,
    signature text NOT NULL DEFAULT '',
    critical_count integer,
    high_count integer,
    ironbank text NOT NULL DEFAULT '',
    scanned boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    PRIMARY KEY (release_tag, image_id)
);

-- +goose Down
DROP TABLE images;
DROP TABLE packages;
DROP TABLE releases;
