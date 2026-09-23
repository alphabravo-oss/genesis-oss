package console

import (
	"context"
	"sort"
	"sync"
	"time"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
)

type Service struct {
	store         *Store
	scans         *Scanner
	loadedAt      time.Time
	clusterMu     sync.Mutex
	clusterCache  *clusterSnapshot
	clusterRead   time.Time
	baselineMu    sync.Mutex
	baselineKey   string
	baselineCache *comparisonBaseline
}

func NewService(store *Store, scans *Scanner) *Service {
	return &Service{store: store, scans: scans}
}

func (s *Service) LoadedAt() string {
	if s.loadedAt.IsZero() {
		return ""
	}
	return s.loadedAt.UTC().Format(time.RFC3339)
}

func (s *Service) Reload(ctx context.Context) (int, error) {
	n, err := s.store.Reload(ctx)
	if err != nil {
		return 0, err
	}
	s.loadedAt = time.Now().UTC()
	return n, nil
}

func (s *Service) List(ctx context.Context) ([]*consolev1.ReleaseSummary, error) {
	rows, err := s.store.q.ListReleases(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*consolev1.ReleaseSummary, 0, len(rows))
	for _, row := range rows {
		out = append(out, &consolev1.ReleaseSummary{
			Tag: row.Tag, ChartVersion: row.ChartVersion, Enabled: row.Enabled, Disabled: row.Disabled,
		})
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, tag string) (*consolev1.ReleaseDetail, error) {
	release, err := s.store.q.GetRelease(ctx, tag)
	if err != nil {
		return nil, err
	}
	pkgs, err := s.store.q.ListPackages(ctx, tag)
	if err != nil {
		return nil, err
	}
	imgs, err := s.store.q.ListImages(ctx, tag)
	if err != nil {
		return nil, err
	}
	foundRows, err := s.store.q.LatestFindings(ctx)
	if err != nil {
		return nil, err
	}
	found := indexFindings(foundRows)
	detail := &consolev1.ReleaseDetail{
		Tag: release.Tag, ChartVersion: release.ChartVersion, Domain: release.Domain,
	}
	for _, pkg := range pkgs {
		detail.Packages = append(detail.Packages, &consolev1.PackageTile{
			Key: pkg.Key, Enabled: pkg.Enabled, Images: pkg.ImageCount,
		})
	}
	sort.Slice(detail.Packages, func(i, j int) bool {
		if detail.Packages[i].Enabled != detail.Packages[j].Enabled {
			return detail.Packages[i].Enabled
		}
		return detail.Packages[i].Key < detail.Packages[j].Key
	})
	rollup := map[string]int32{}
	for _, img := range imgs {
		label := registryLabel(img.Registry)
		if img.Ref == "" {
			label = "No public source"
		}
		rollup[label]++
		row := &consolev1.ImageRow{
			Id: img.ImageID, PackageKey: img.PackageKey, Name: img.Name, Ref: img.Ref,
			Registry: label, Digest: img.Digest, When: img.WhenKind, Signature: img.Signature,
			Ironbank: img.Ironbank,
		}
		if match, ok := found.match(img.Digest, img.Ref); ok {
			applyFinding(row, match)
		}
		detail.Images = append(detail.Images, row)
	}
	sort.Slice(detail.Images, func(i, j int) bool {
		aDefault := detail.Images[i].When == "default-on"
		bDefault := detail.Images[j].When == "default-on"
		if aDefault != bDefault {
			return aDefault
		}
		if detail.Images[i].PackageKey != detail.Images[j].PackageKey {
			return detail.Images[i].PackageKey < detail.Images[j].PackageKey
		}
		return detail.Images[i].Name < detail.Images[j].Name
	})
	names := make([]string, 0, len(rollup))
	for name := range rollup {
		names = append(names, name)
	}
	sort.Slice(names, func(i, j int) bool { return rollup[names[i]] > rollup[names[j]] })
	for _, name := range names {
		detail.Registries = append(detail.Registries, &consolev1.RegistryCount{Name: name, Count: rollup[name]})
	}
	return detail, nil
}

// ResetCluster drops the cached observation so the next read uses the current connection.
func (s *Service) ResetCluster() {
	s.clusterMu.Lock()
	defer s.clusterMu.Unlock()
	s.clusterCache = nil
}
