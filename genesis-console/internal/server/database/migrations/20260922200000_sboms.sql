-- +goose Up
ALTER TABLE findings
    ADD COLUMN sbom_cyclonedx bytea,
    ADD COLUMN sbom_spdx bytea,
    ADD COLUMN sbom_error text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE findings
    DROP COLUMN sbom_cyclonedx,
    DROP COLUMN sbom_spdx,
    DROP COLUMN sbom_error;
