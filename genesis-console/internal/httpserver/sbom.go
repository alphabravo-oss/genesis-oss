package httpserver

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/alphabravo/genesis-console/internal/server/database/db"
	"github.com/jackc/pgx/v5"
)

func sbomDownload(queries *db.Queries) http.Handler {
	return http.TimeoutHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		format := r.PathValue("format")
		if err != nil || id <= 0 || (format != "cyclonedx" && format != "spdx-json") {
			http.NotFound(w, r)
			return
		}
		document, err := queries.GetSBOM(r.Context(), db.GetSBOMParams{ID: id, Format: format})
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && len(document) == 0) {
			http.Error(w, "No SBOM saved for this scan. Rescan the image to generate one.", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "SBOM download is unavailable. Try again.", http.StatusServiceUnavailable)
			return
		}
		contentType, suffix := "application/vnd.cyclonedx+json", "cdx.json"
		if format == "spdx-json" {
			contentType, suffix = "application/spdx+json", "spdx.json"
		}
		w.Header().Set("Content-Type", contentType)
		w.Header().Set("Content-Disposition", `attachment; filename="genesis-scan-`+strconv.FormatInt(id, 10)+`.`+suffix+`"`)
		w.Write(document)
	}), 30*time.Second, "SBOM download timed out")
}
