package console

import (
	"context"
	"fmt"
	"path/filepath"

	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool, q: db.New(pool)}
}

func (s *Store) Reload(ctx context.Context) (int, error) {
	releases := loadAll()
	if len(releases) == 0 {
		engine, _ := roots()
		return 0, fmt.Errorf("no catalogs under %s", filepath.Join(engine, "catalogs"))
	}
	for _, release := range releases {
		tx, err := s.pool.Begin(ctx)
		if err != nil {
			return 0, err
		}
		if err := writeRelease(ctx, s.q.WithTx(tx), release); err != nil {
			_ = tx.Rollback(ctx)
			return 0, err
		}
		if err := tx.Commit(ctx); err != nil {
			return 0, err
		}
	}
	return len(releases), nil
}

func writeRelease(ctx context.Context, q *db.Queries, release loadedRelease) error {
	if err := q.UpsertRelease(ctx, db.UpsertReleaseParams{
		Tag: release.Tag, ChartVersion: release.ChartVersion, Domain: release.Domain,
	}); err != nil {
		return err
	}
	if err := q.SoftDeletePackages(ctx, release.Tag); err != nil {
		return err
	}
	if err := q.SoftDeleteImages(ctx, release.Tag); err != nil {
		return err
	}
	for _, pkg := range release.Packages {
		if err := q.UpsertPackage(ctx, db.UpsertPackageParams{
			ReleaseTag: release.Tag, Key: pkg.Key, Enabled: pkg.Enabled, ImageCount: pkg.Images,
		}); err != nil {
			return err
		}
	}
	for _, img := range release.Images {
		id := img.ID
		if id == "" {
			id = img.Name
		}
		if err := q.UpsertImage(ctx, db.UpsertImageParams{
			ReleaseTag: release.Tag, ImageID: id, PackageKey: img.Package, Name: img.Name,
			Ref: img.Ref, Registry: img.Registry, Digest: img.Digest, WhenKind: img.When,
			Signature: img.Signature, CriticalCount: img.Critical, HighCount: img.High,
			Ironbank: img.Ironbank, Scanned: img.Scanned,
		}); err != nil {
			return err
		}
	}
	return nil
}
