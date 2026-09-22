package httpserver

import (
	"fmt"
	"net/http"
	"time"
)

func (a *authentication) scanEvents(changes func() <-chan struct{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Accel-Buffering", "no")
		controller := http.NewResponseController(w)
		write := func(message string) bool {
			_ = controller.SetWriteDeadline(time.Now().Add(5 * time.Second))
			defer controller.SetWriteDeadline(time.Time{})
			if _, err := fmt.Fprint(w, message); err != nil {
				return false
			}
			return controller.Flush() == nil
		}
		// Subscribe before the initial invalidation so reconnects cannot miss a change.
		changed := changes()
		if !write("retry: 2000\nevent: scans\ndata: {}\n\n") {
			return
		}
		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()
		for {
			message := ": keepalive\n\n"
			select {
			case <-r.Context().Done():
				return
			case <-changed:
				changed = changes()
				message = "event: scans\ndata: {}\n\n"
			case <-heartbeat.C:
			}
			// Expired/revoked sessions and database failures also close existing streams.
			if ok, err := a.authenticated(r); err != nil || !ok {
				return
			}
			if !write(message) {
				return
			}
		}
	}
}
