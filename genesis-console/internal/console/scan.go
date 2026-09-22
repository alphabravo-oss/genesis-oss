package console

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5"
)

var (
	errBadScope     = errors.New("scope must be deployed, selected, default-on, or public")
	errBadSelection = errors.New("invalid scan selection")
	errPodInventory = errors.New("pod inventory unavailable; check cluster connectivity and permissions")
	errBusy         = errors.New("a scan is still running")
)

type Scanner struct {
	store    *Store
	cacheDir string
	wake     chan struct{}
	mu       sync.Mutex
	changes  chan struct{}
}

func NewScanner(store *Store, cacheDir string) *Scanner {
	return &Scanner{store: store, cacheDir: cacheDir, wake: make(chan struct{}, 1), changes: make(chan struct{})}
}

// ponytail: process-local notifications; use PostgreSQL LISTEN/NOTIFY for multiple console replicas.
func (s *Scanner) Changes() <-chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.changes
}

func (s *Scanner) changed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	close(s.changes)
	s.changes = make(chan struct{})
}

func (s *Scanner) Interrupt(ctx context.Context) error {
	if err := s.store.q.InterruptItems(ctx); err != nil {
		return err
	}
	return s.store.q.InterruptJobs(ctx)
}

func (s *Scanner) Wake() {
	s.changed()
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

func (s *Scanner) Loop(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		s.drain(ctx)
		select {
		case <-ctx.Done():
			return
		case <-s.wake:
		case <-ticker.C:
		}
	}
}

func (s *Scanner) drain(ctx context.Context) {
	for ctx.Err() == nil {
		id, err := s.store.q.NextQueuedJob(ctx)
		if errors.Is(err, pgx.ErrNoRows) {
			return
		}
		if err != nil {
			log.Printf("scan queue: %v", err)
			return
		}
		n, err := s.store.q.MarkJobRunning(ctx, id)
		if err != nil {
			log.Printf("scan claim %s: %v", id, err)
			return
		}
		if n == 0 {
			continue
		}
		s.runJob(ctx, id)
	}
}

func (s *Scanner) runJob(ctx context.Context, id string) {
	items, err := s.store.q.ListJobItems(ctx, id)
	if err != nil {
		log.Printf("scan items %s: %v", id, err)
		return
	}
	var done, failed, skipped int32
	for _, item := range items {
		if item.State == "skipped" {
			skipped++
		}
	}
	_ = s.store.q.TouchJob(ctx, db.TouchJobParams{ID: id, Done: skipped, Failed: failed, Skipped: skipped})
	s.changed()
	cleanNote := ""
	for _, item := range items {
		if item.State != "queued" {
			continue
		}
		if ctx.Err() != nil {
			_ = s.store.q.UpdateJobItem(ctx, db.UpdateJobItemParams{
				JobID: id, ImageID: item.ImageID, State: "failed", Error: "interrupted", Digest: item.Digest,
			})
			failed++
			continue
		}
		_ = s.store.q.UpdateJobItem(ctx, db.UpdateJobItemParams{
			JobID: id, ImageID: item.ImageID, State: "running", Digest: item.Digest,
		})
		s.changed()
		log.Printf("scan %s %s", id, item.Ref)
		report, scanErr := scanRef(ctx, s.cacheDir, item.Ref)
		if scanErr != nil {
			_ = s.store.q.UpdateJobItem(ctx, db.UpdateJobItemParams{
				JobID: id, ImageID: item.ImageID, State: "failed", Error: scanErr.Error(), Digest: item.Digest,
			})
			failed++
			done++
			_ = s.store.q.TouchJob(ctx, db.TouchJobParams{ID: id, Done: done + skipped, Failed: failed, Skipped: skipped})
			s.changed()
			continue
		}
		version := trivyDBVersion(ctx, s.cacheDir)
		if report.Findings == nil {
			report.Findings = []finding{}
		}
		payload, _ := json.Marshal(savedFindings{AllSeverities: true, Findings: report.Findings})
		if err := s.store.q.InsertFinding(ctx, db.InsertFindingParams{
			Digest: report.Digest, Ref: item.Ref, DbVersion: version,
			CriticalCount: report.Critical, HighCount: report.High, Cves: string(payload),
		}); err != nil {
			_ = s.store.q.UpdateJobItem(ctx, db.UpdateJobItemParams{
				JobID: id, ImageID: item.ImageID, State: "failed", Error: err.Error(), Digest: report.Digest,
			})
			failed++
			done++
			_ = s.store.q.TouchJob(ctx, db.TouchJobParams{ID: id, Done: done + skipped, Failed: failed, Skipped: skipped})
			s.changed()
			continue
		}
		_ = s.store.q.UpdateJobItem(ctx, db.UpdateJobItemParams{
			JobID: id, ImageID: item.ImageID, State: "succeeded", Digest: report.Digest,
		})
		done++
		_ = s.store.q.TouchJob(ctx, db.TouchJobParams{ID: id, Done: done + skipped, Failed: failed, Skipped: skipped})
		s.changed()
		auto, err := s.store.q.GetSettings(ctx)
		if err == nil && auto {
			if err := cleanScanCache(ctx, s.cacheDir); err != nil {
				cleanNote = err.Error()
				log.Printf("scan cleanup %s: %v", id, err)
			}
		}
	}
	state := "succeeded"
	if failed > 0 {
		state = "failed"
	}
	_ = s.store.q.FinishJob(ctx, db.FinishJobParams{
		ID: id, State: state, Done: done + skipped, Failed: failed, Skipped: skipped, Error: cleanNote,
	})
	s.changed()
	log.Printf("scan %s %s done=%d failed=%d skipped=%d", id, state, done, failed, skipped)
}

func (s *Service) StartScan(ctx context.Context, tag, scope string, ids []string) (*consolev1.ScanJob, error) {
	switch scope {
	case "deployed", "selected", "default-on", "public":
	default:
		return nil, errBadScope
	}
	if _, err := trivyPath(); err != nil {
		return nil, err
	}
	detail, err := s.Get(ctx, tag)
	if err != nil {
		return nil, err
	}
	wanted := map[string]bool{}
	for _, id := range ids {
		wanted[id] = true
	}
	var items []*consolev1.ScanItem
	if scope == "deployed" {
		inventoryCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		raw, err := kubectl(inventoryCtx, "get", "pods", "-A", "-o", "json")
		if err != nil {
			return nil, errPodInventory
		}
		pods, err := decodeObjects(raw)
		if err != nil {
			return nil, errPodInventory
		}
		images, _ := runtimeImages(&clusterSnapshot{objects: map[string][]object{"Pods": pods}}, tag)
		items, err = deployedScanItems(images, ids)
		if err != nil {
			return nil, err
		}
	} else {
		for _, img := range detail.Images {
			switch scope {
			case "selected":
				if !wanted[img.Id] {
					continue
				}
			case "default-on":
				if img.When != "default-on" {
					continue
				}
			}
			state := "queued"
			if img.Ref == "" {
				state = "skipped"
			}
			items = append(items, &consolev1.ScanItem{ImageId: img.Id, Ref: img.Ref, State: state})
		}
	}
	if scope == "selected" && len(items) == 0 {
		return nil, fmt.Errorf("%w: none of the selected images are in %s", errBadSelection, tag)
	}
	id, err := newID()
	if err != nil {
		return nil, err
	}
	tx, err := s.store.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	q := s.store.q.WithTx(tx)
	if err := q.InsertJob(ctx, db.InsertJobParams{
		ID: id, ReleaseTag: tag, Scope: scope, State: "queued", Total: int32(len(items)),
	}); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	for _, item := range items {
		if err := q.InsertJobItem(ctx, db.InsertJobItemParams{
			JobID: id, ImageID: item.ImageId, Ref: item.Ref, State: item.State,
		}); err != nil {
			_ = tx.Rollback(ctx)
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	if s.scans != nil {
		s.scans.Wake()
	}
	return s.GetScanJob(ctx, id)
}

func deployedScanItems(images []*consolev1.RuntimeImage, ids []string) ([]*consolev1.ScanItem, error) {
	if len(ids) == 0 {
		return nil, fmt.Errorf("%w: select at least one image", errBadSelection)
	}
	wanted := make(map[string]bool, len(ids))
	for _, id := range ids {
		wanted[id] = true
	}
	seen := map[string]bool{}
	var items []*consolev1.ScanItem
	for _, image := range images {
		id := image.Digest
		if id == "" {
			id = image.Ref
		}
		// Accept container IDs from clients opened before image grouping was added.
		containerID := fmt.Sprintf("%s/%s/%t/%s", image.Namespace, image.Pod, image.Init, image.Container)
		if !wanted[id] && !wanted[containerID] {
			continue
		}
		delete(wanted, id)
		delete(wanted, containerID)
		if image.Ref == "" {
			return nil, fmt.Errorf("%w: container %s has no image reference", errBadSelection, id)
		}
		ref := normalizedImage(image.Ref)
		key := ref
		if digest := hexDigest(image.Digest); len(digest) == 64 {
			ref = imageRepository(ref) + "@sha256:" + digest
			key = digest
		}
		if !seen[key] {
			items = append(items, &consolev1.ScanItem{ImageId: id, Ref: ref, State: "queued"})
			seen[key] = true
		}
	}
	if len(wanted) > 0 {
		return nil, fmt.Errorf("%w: selected images are no longer deployed; refresh Images and select again", errBadSelection)
	}
	return items, nil
}

func (s *Service) ListScanJobs(ctx context.Context) ([]*consolev1.ScanJob, error) {
	rows, err := s.store.q.ListJobs(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*consolev1.ScanJob, 0, len(rows))
	for _, row := range rows {
		out = append(out, jobProto(row, nil))
	}
	return out, nil
}

func (s *Service) GetScanJob(ctx context.Context, id string) (*consolev1.ScanJob, error) {
	row, err := s.store.q.GetJob(ctx, id)
	if err != nil {
		return nil, err
	}
	items, err := s.store.q.ListJobItems(ctx, id)
	if err != nil {
		return nil, err
	}
	job := jobProto(row, items)
	// Resolve by the scanned digest, including images outside the release catalog.
	if job.Done > job.Failed+job.Skipped {
		rows, err := s.store.q.LatestFindings(ctx)
		if err != nil {
			return nil, err
		}
		idx := indexFindings(rows)
		for _, item := range job.Items {
			if found, ok := idx.match(item.Digest, ""); ok && item.State == "succeeded" {
				image := &consolev1.ImageRow{}
				applyFinding(image, found)
				item.Vulnerabilities = image.Vulnerabilities
				item.FindingsAvailable = true
				item.Critical = image.Critical
				item.High = image.High
				item.ScannedAt = image.ScannedAt
				item.AllSeverities = image.AllSeverities
			}
		}
	}
	return job, nil
}

func (s *Service) ScanSettings(ctx context.Context) (bool, error) {
	return s.store.q.GetSettings(ctx)
}

func (s *Service) SetAutoClean(ctx context.Context, auto bool) error {
	return s.store.q.SetAutoClean(ctx, auto)
}

func (s *Service) CleanImages(ctx context.Context) error {
	active, err := s.store.q.CountActiveJobs(ctx)
	if err != nil {
		return err
	}
	if active > 0 {
		return errBusy
	}
	if s.scans == nil {
		return errors.New("scanner is not configured")
	}
	return cleanScanCache(ctx, s.scans.cacheDir)
}

func jobProto(row db.ScanJob, items []db.ListJobItemsRow) *consolev1.ScanJob {
	job := &consolev1.ScanJob{
		Id: row.ID, Tag: row.ReleaseTag, Scope: row.Scope, State: row.State,
		Total: row.Total, Done: row.Done, Failed: row.Failed, Skipped: row.Skipped,
		Error: row.Error, StartedAt: stamp(row.CreatedAt), FinishedAt: stamp(row.FinishedAt),
	}
	for _, item := range items {
		job.Items = append(job.Items, &consolev1.ScanItem{
			ImageId: item.ImageID, Ref: item.Ref, Digest: item.Digest, State: item.State, Error: item.Error,
		})
	}
	return job
}

func newID() (string, error) {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf[:]), nil
}
