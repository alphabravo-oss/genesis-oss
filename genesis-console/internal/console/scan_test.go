package console

import (
	"errors"
	"strings"
	"testing"

	"connectrpc.com/connect"
	consolev1 "github.com/alphabravo/genesis-console/gen/console/v1"
)

func TestDeployedScanSelection(t *testing.T) {
	digest := "sha256:" + strings.Repeat("a", 64)
	images := []*consolev1.RuntimeImage{
		{Namespace: "custom", Pod: "one", Container: "app", Ref: "localhost:5000/team/custom:v2", Digest: digest},
		{Namespace: "custom", Pod: "two", Container: "app", Ref: "localhost:5000/team/custom:latest", Digest: digest},
		{Namespace: "custom", Pod: "one", Container: "app", Init: true, Ref: "busybox:1.37"},
		{Namespace: "custom", Pod: "three", Container: "app", Ref: "localhost:5000/team/custom:v2", Digest: "sha256:" + strings.Repeat("b", 64)},
	}
	ids := []string{"custom/one/false/app", "custom/two/false/app", "custom/one/true/app", "custom/three/false/app", "custom/one/false/app"}
	items, err := deployedScanItems(images, ids)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 3 {
		t.Fatalf("expected three distinct images, got %v", items)
	}
	for i, ref := range []string{"localhost:5000/team/custom@" + digest, "docker.io/library/busybox:1.37", "localhost:5000/team/custom@sha256:" + strings.Repeat("b", 64)} {
		if items[i].Ref != ref || items[i].State != "queued" {
			t.Fatalf("target %d: %v, expected queued %s", i, items[i], ref)
		}
	}
	images[1].Ref = "mirror.example/team/custom:latest"
	items, err = deployedScanItems(images, []string{digest, "busybox:1.37"})
	if err != nil || len(items) != 2 || items[0].ImageId != digest || items[1].ImageId != "busybox:1.37" {
		t.Fatalf("unique image selection must match live digests and reference fallbacks: %v, %v", items, err)
	}
	items, err = deployedScanItems(images, ids[:2])
	if err != nil || len(items) != 1 {
		t.Fatalf("the same digest in another registry must not be rescanned: %v, %v", items, err)
	}
	for _, selection := range [][]string{nil, {"custom/gone/false/app"}, {ids[0], "https://arbitrary.example/image"}} {
		items, err := deployedScanItems(images, selection)
		if !errors.Is(err, errBadSelection) || len(items) != 0 || connect.CodeOf(scanErr(err)) != connect.CodeInvalidArgument {
			t.Fatalf("invalid/stale selections must fail atomically: %v, %v", items, err)
		}
	}
	images[0].Ref = ""
	if _, err := deployedScanItems(images, ids[:1]); !errors.Is(err, errBadSelection) {
		t.Fatalf("missing image reference: %v", err)
	}
	if connect.CodeOf(scanErr(errPodInventory)) != connect.CodeFailedPrecondition {
		t.Fatal("unavailable inventory must be an actionable precondition error")
	}
}
