package console

import (
	"bytes"
	"errors"
	"log"
	"os"
	"strings"
	"testing"

	"connectrpc.com/connect"
)

func TestInternalConnectionErrorsAreLogged(t *testing.T) {
	var buf bytes.Buffer
	log.SetOutput(&buf)
	defer log.SetOutput(os.Stderr)
	err := internalErr(errors.New("rename /run/genesis/x: no space left on device"), "The saved connection could not be removed. Try again.")
	if connect.CodeOf(err) != connect.CodeInternal || !strings.Contains(err.Error(), "could not be removed") || strings.Contains(err.Error(), "no space") {
		t.Fatalf("the user sees a fixed message, not the cause: %v", err)
	}
	if !strings.Contains(buf.String(), "no space left on device") {
		t.Fatalf("the cause must be logged for the operator: %q", buf.String())
	}
	if err := connectionErr(errors.New("database is down")); !strings.Contains(buf.String(), "database is down") || !strings.Contains(err.Error(), "Check the console logs") {
		t.Fatalf("connectionErr must log internal causes: %q / %v", buf.String(), err)
	}
}
