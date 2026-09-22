-- +goose Up
CREATE TABLE findings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    digest text NOT NULL,
    ref text NOT NULL,
    db_version text NOT NULL,
    critical_count integer NOT NULL,
    high_count integer NOT NULL,
    cves text NOT NULL,
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

INSERT INTO scan_settings (singleton, auto_clean) VALUES (true, false);

-- +goose Down
DROP TABLE scan_job_items;
DROP TABLE scan_jobs;
DROP TABLE findings;
DROP TABLE scan_settings;
