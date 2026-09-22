package console

import (
	"strconv"
	"strings"
	"time"

	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5/pgtype"
)

type findingIndex struct {
	byFull   map[string]db.LatestFindingsRow
	byPrefix map[string]db.LatestFindingsRow
	byRef    map[string]db.LatestFindingsRow
}

func indexFindings(rows []db.LatestFindingsRow) findingIndex {
	idx := findingIndex{
		byFull:   map[string]db.LatestFindingsRow{},
		byPrefix: map[string]db.LatestFindingsRow{},
		byRef:    map[string]db.LatestFindingsRow{},
	}
	for _, row := range rows {
		hex := hexDigest(row.Digest)
		if hex != "" {
			if prev, ok := idx.byFull[hex]; !ok || later(row.CreatedAt, prev.CreatedAt) {
				idx.byFull[hex] = row
			}
			if len(hex) >= 12 {
				prefix := hex[:12]
				if prev, ok := idx.byPrefix[prefix]; !ok || later(row.CreatedAt, prev.CreatedAt) {
					idx.byPrefix[prefix] = row
				}
			}
		}
		if row.Ref != "" {
			if prev, ok := idx.byRef[row.Ref]; !ok || later(row.CreatedAt, prev.CreatedAt) {
				idx.byRef[row.Ref] = row
			}
		}
	}
	return idx
}

func later(a, b pgtype.Timestamptz) bool {
	if !a.Valid {
		return false
	}
	if !b.Valid {
		return true
	}
	return a.Time.After(b.Time)
}

func digestHit(imageDigest, findingDigest string) bool {
	a, b := hexDigest(imageDigest), hexDigest(findingDigest)
	if a == "" || b == "" {
		return false
	}
	return strings.HasPrefix(b, a) || strings.HasPrefix(a, b)
}

func (idx findingIndex) match(imageDigest, ref string) (db.LatestFindingsRow, bool) {
	hex := hexDigest(imageDigest)
	if hex != "" {
		if row, ok := idx.byFull[hex]; ok {
			return row, true
		}
		if len(hex) >= 12 {
			if row, ok := idx.byPrefix[hex[:12]]; ok && digestHit(hex, row.Digest) {
				return row, true
			}
		}
		return db.LatestFindingsRow{}, false
	}
	row, ok := idx.byRef[ref]
	return row, ok
}

func applyFinding(row *consolev1.ImageRow, found db.LatestFindingsRow) {
	row.Scanned = true
	row.Critical = found.CriticalCount
	row.High = found.HighCount
	row.DbVersion = found.DbVersion
	if found.SbomAvailable {
		row.SbomId = strconv.FormatInt(found.ID, 10)
	}
	row.SbomError = found.SbomError
	if found.CreatedAt.Valid {
		row.ScannedAt = found.CreatedAt.Time.UTC().Format(time.RFC3339)
	}
	findings, allSeverities := decodeFindings(found.Cves)
	row.AllSeverities = allSeverities
	for _, item := range findings {
		row.Cves = append(row.Cves, item.ID)
		row.Vulnerabilities = append(row.Vulnerabilities, &consolev1.Vulnerability{
			Id: item.ID, Severity: item.Severity, PackageName: item.Pkg,
			Installed: item.Installed, Fixed: item.Fixed, Title: item.Title, Url: item.URL,
		})
	}
}

func stamp(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339)
}
