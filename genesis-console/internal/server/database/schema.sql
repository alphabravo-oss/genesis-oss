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

CREATE TABLE findings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    digest text NOT NULL,
    ref text NOT NULL,
    db_version text NOT NULL,
    critical_count integer NOT NULL,
    high_count integer NOT NULL,
    cves text NOT NULL,
    sbom_cyclonedx bytea,
    sbom_spdx bytea,
    sbom_error text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX findings_digest_created ON findings (digest, created_at DESC);

CREATE TABLE scan_jobs (
    id text PRIMARY KEY,
    release_tag text NOT NULL,
    scope text NOT NULL,
    state text NOT NULL,
    total integer NOT NULL,
    done integer NOT NULL DEFAULT 0,
    failed integer NOT NULL DEFAULT 0,
    skipped integer NOT NULL DEFAULT 0,
    error text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz
);

CREATE TABLE scan_job_items (
    job_id text NOT NULL REFERENCES scan_jobs (id),
    image_id text NOT NULL,
    ref text NOT NULL,
    digest text NOT NULL DEFAULT '',
    state text NOT NULL,
    error text NOT NULL DEFAULT '',
    PRIMARY KEY (job_id, image_id)
);

CREATE TABLE scan_settings (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    auto_clean boolean NOT NULL DEFAULT false
);

CREATE TABLE auth_sessions (
    token_hash bytea PRIMARY KEY,
    expires_at timestamptz NOT NULL
);
