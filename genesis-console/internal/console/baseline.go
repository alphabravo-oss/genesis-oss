package console

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type baselineManifest struct {
	SchemaVersion int               `json:"schemaVersion"`
	Tag           string            `json:"tag"`
	SHA256        string            `json:"sha256"`
	Files         map[string]string `json:"files"`
}

func baselineRoot(tag, checksum string) string {
	engine, _ := roots()
	directory := os.Getenv("GENESIS_BASELINE_DIR")
	if directory == "" {
		directory = filepath.Join(engine, "baselines")
	}
	if !releaseTag.MatchString(tag) {
		return ""
	}
	if checksum == "" {
		var index struct {
			SHA256 string `json:"sha256"`
		}
		raw, _ := os.ReadFile(filepath.Join(directory, tag, "index.json"))
		if json.Unmarshal(raw, &index) == nil {
			checksum = index.SHA256
		}
	}
	if len(checksum) == 64 && hexDigest(checksum) == checksum {
		return filepath.Join(directory, tag, checksum)
	}
	// Source development checkouts may not have been archived yet.
	return filepath.Join(filepath.Dir(engine), "genesis-oss")
}

func verifyBaseline(root, tag string) (*baselineManifest, error) {
	raw, err := os.ReadFile(filepath.Join(root, "baseline.json"))
	if os.IsNotExist(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var manifest baselineManifest
	if err = json.Unmarshal(raw, &manifest); err != nil {
		return nil, err
	}
	if manifest.SchemaVersion != 1 || manifest.Tag != tag || len(manifest.SHA256) != 64 || len(manifest.Files) == 0 {
		return nil, fmt.Errorf("invalid baseline manifest")
	}
	// An extra template changes rendering just as surely as an edited template.
	for _, directory := range []string{"umbrella", "profiles"} {
		err := filepath.WalkDir(filepath.Join(root, directory), func(name string, entry fs.DirEntry, err error) error {
			if os.IsNotExist(err) && directory != "umbrella" {
				return nil
			}
			if err != nil {
				return err
			}
			if entry.Type()&os.ModeSymlink != 0 {
				return fmt.Errorf("baseline contains a symlink: %s", name)
			}
			if entry.IsDir() {
				return nil
			}
			rel, _ := filepath.Rel(root, name)
			rel = filepath.ToSlash(rel)
			input := directory == "umbrella" || filepath.Dir(rel) == "profiles" && filepath.Ext(name) == ".yaml"
			if input && manifest.Files[rel] == "" {
				return fmt.Errorf("unrecorded baseline file: %s", rel)
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	charts, _ := filepath.Glob(filepath.Join(root, "packages", "*", "chart", "Chart.yaml"))
	for _, name := range charts {
		rel, _ := filepath.Rel(root, name)
		if manifest.Files[filepath.ToSlash(rel)] == "" {
			return nil, fmt.Errorf("unrecorded package metadata: %s", rel)
		}
	}
	keys := make([]string, 0, len(manifest.Files))
	for key := range manifest.Files {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	hash := sha256.New()
	for _, key := range keys {
		if !filepath.IsLocal(key) || strings.Contains(key, "\\") {
			return nil, fmt.Errorf("invalid baseline path")
		}
		if info, err := os.Lstat(filepath.Join(root, key)); err != nil || !info.Mode().IsRegular() {
			return nil, fmt.Errorf("baseline input is not a regular file: %s", key)
		}
		file, err := os.ReadFile(filepath.Join(root, key))
		if err != nil {
			return nil, err
		}
		sum := sha256.Sum256(file)
		digest := hex.EncodeToString(sum[:])
		if digest != manifest.Files[key] {
			return nil, fmt.Errorf("baseline file changed: %s", key)
		}
		fmt.Fprintf(hash, "%s\x00%s\n", key, digest)
	}
	if hex.EncodeToString(hash.Sum(nil)) != manifest.SHA256 {
		return nil, fmt.Errorf("baseline manifest checksum mismatch")
	}
	for _, key := range []string{"umbrella/Chart.yaml", "umbrella/values.yaml", "umbrella/values-genesis.yaml"} {
		if manifest.Files[key] == "" {
			return nil, fmt.Errorf("baseline manifest missing %s", key)
		}
	}
	return &manifest, nil
}

// Provenance is install metadata, not a signature or an authenticity claim.
func (s *Service) inspectionBaseline(ctx context.Context, snapshot *clusterSnapshot, tag string, profiles []string, recorded bool) (*comparisonBaseline, []string, *consolev1.InstallationProvenance) {
	p := &consolev1.InstallationProvenance{Status: "Not recorded", Note: "This installation predates provenance recording or was installed directly with Helm."}
	record := obj(snapshot.values["genesisProvenance"])
	checksum := ""
	valid := false
	if record != nil {
		p.Tag = str(record["tag"])
		p.BaselineSha256 = str(record["baselineSha256"])
		p.CustomValues = flag(record["customValues"])
		for _, item := range list(record["profiles"]) {
			p.Profiles = append(p.Profiles, str(item))
		}
		valid = fmt.Sprint(record["schemaVersion"]) == "1" && p.Tag == str(snapshot.metadata["version"]) && str(snapshot.metadata["status"]) == "deployed" && len(p.BaselineSha256) == 64 && hexDigest(p.BaselineSha256) == p.BaselineSha256 && validateComparison(p.Tag, p.Profiles) == nil
		if valid {
			p.Status = "Recorded"
			p.Note = "Recorded by the Genesis installer; baseline content has not been verified yet."
			if p.Tag == tag {
				checksum = p.BaselineSha256
			}
			if recorded {
				profiles = p.Profiles
			}
		} else {
			p.Status = "Invalid"
			p.Note = "Installation metadata does not match the deployed Helm revision; recorded profiles were not applied."
		}
	}
	b := s.baseline(ctx, tag, profiles, checksum)
	if valid && p.Tag == tag {
		if b.manifest == nil || b.err != "" {
			p.Status = "Unavailable"
			p.Note = "The recorded baseline is not available or failed integrity verification."
		} else if b.manifest.SHA256 != p.BaselineSha256 {
			p.Status = "Mismatch"
			p.Note = "The available baseline does not match the recorded installation."
			b = &comparisonBaseline{err: p.Note, profiles: b.profiles}
		} else {
			matched := true
			for _, profile := range p.Profiles {
				if expected := b.manifest.Files["profiles/"+profile+".yaml"]; expected == "" || expected != str(at(record, "profileSha256", profile)) {
					matched = false
				}
			}
			if matched {
				p.Status = "Verified"
				p.Note = "Recorded baseline and profile checksums match the archived files."
			} else {
				p.Status = "Mismatch"
				p.Note = "Recorded profile checksums differ from the archived files."
				b = &comparisonBaseline{err: p.Note, profiles: b.profiles}
			}
		}
	}
	return b, profiles, p
}
