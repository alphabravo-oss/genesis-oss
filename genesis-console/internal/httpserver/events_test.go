package httpserver

import (
	"bufio"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alphabravo/genesis-console/internal/console"
)

func readEvent(t *testing.T, reader *bufio.Reader) string {
	t.Helper()
	var event strings.Builder
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			t.Fatal(err)
		}
		if line == "\n" {
			return event.String()
		}
		event.WriteString(line)
	}
}

func TestScanEvents(t *testing.T) {
	scanner := console.NewScanner(nil, "")
	server := httptest.NewServer(newAuthentication("", "", nil).scanEvents(scanner.Changes))
	t.Cleanup(server.Close)
	client := &http.Client{Timeout: 3 * time.Second}
	connect := func() *bufio.Reader {
		response, err := client.Get(server.URL)
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { response.Body.Close() })
		if response.Header.Get("Content-Type") != "text/event-stream" || response.Header.Get("X-Accel-Buffering") != "no" {
			t.Fatal("stream headers missing")
		}
		reader := bufio.NewReader(response.Body)
		if event := readEvent(t, reader); !strings.Contains(event, "retry: 2000") || !strings.Contains(event, "event: scans") {
			t.Fatal("connections must immediately resync", event)
		}
		return reader
	}
	first, second := connect(), connect()
	scanner.Wake()
	for _, reader := range []*bufio.Reader{first, second} {
		if event := readEvent(t, reader); event != "event: scans\ndata: {}\n" {
			t.Fatal("change not broadcast", event)
		}
	}
	connect() // Reconnection resyncs even if a notification was missed.
}
