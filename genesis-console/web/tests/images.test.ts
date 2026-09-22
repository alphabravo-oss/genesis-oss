import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { ImageRowSchema, RuntimeImageSchema, ScanItemSchema, ScanJobSchema, VulnerabilitySchema } from "../src/gen/console/v1/console_pb.ts";
import { applyScanResult, groupDeployedImages, imageHref, imageScan } from "../src/lib/images.ts";

test("image links keep exact image identities and the release/filter context", () => {
  const search = new URLSearchParams("tag=3.33.0&follow=deployed&view=all&img.q=app&profiles=first,second");
  for (const source of ["deployed", "catalog"] as const) {
    for (const id of ["sha256:" + "a".repeat(64), "registry/team/app:latest", "package/image%2Fvariant"]) {
      const url = new URL(imageHref(source, id, search), "http://localhost");
      assert.equal(url.pathname.split("/").length, 4);
      assert.equal(decodeURIComponent(url.pathname.split("/")[3]), id);
      assert.equal(url.searchParams.toString(), search.toString());
      assert.equal(url.pathname.split("/")[2], source);
    }
  }
});

test("deployed images group replicas and aliases, while separating different digests of the same tag", () => {
  const rows = [
    { ref: "registry/app:latest", digest: "sha256:aaa", pod: "one", namespace: "team-a", packageKey: "app" },
    { ref: "registry/app:latest", digest: "sha256:aaa", pod: "two", namespace: "team-a", packageKey: "app" },
    { ref: "mirror/app:v2", digest: "sha256:aaa", pod: "three", namespace: "team-b", packageKey: "custom" },
    { ref: "registry/app:latest", digest: "sha256:bbb", pod: "four" },
    { ref: "busybox:1.37", pod: "five" },
    { ref: "busybox:1.37", pod: "six", init: true },
  ].map((row) => create(RuntimeImageSchema, row));
  const groups = groupDeployedImages(rows);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((image) => image.id), ["sha256:aaa", "sha256:bbb", "busybox:1.37"]);
  assert.deepEqual(groups.map((image) => image.containers.length), [3, 1, 2]);
  assert.deepEqual(groups[0].references, ["registry/app:latest", "mirror/app:v2"]);
  assert.deepEqual(groups[0].packages, ["app", "custom"]);
  assert.deepEqual(groups[0].namespaces, ["team-a", "team-b"]);
  assert.equal(groups.flatMap((image) => image.containers).length, rows.length);
});

test("live progress follows the scanned digest, including queued images, without crossing deployed versions", () => {
  const first = "sha256:" + "a".repeat(64), second = "sha256:" + "b".repeat(64);
  const images = groupDeployedImages([first, second].map((digest) => create(RuntimeImageSchema, { digest, ref: "registry/app:latest" })));
  const job = create(ScanJobSchema, { scope: "deployed", items: [{ imageId: first, ref: "registry/app@" + first, state: "queued" }] });
  assert.equal(imageScan(images[0], job), job.items[0]);
  assert.equal(imageScan(images[1], job), undefined);
  job.items[0].state = "succeeded";
  job.items[0].digest = "registry/app@" + first;
  assert.equal(imageScan(images[1], job), undefined);
  const catalog = create(ImageRowSchema, { id: "same-id" });
  const otherRelease = create(ScanJobSchema, { tag: "3.32.0", items: [{ imageId: "same-id", state: "running" }] });
  assert.equal(imageScan(catalog, otherRelease, "3.33.0"), undefined);
  assert.equal(imageScan(catalog, otherRelease, "3.32.0"), otherRelease.items[0]);
});

test("new scan results replace old counts and CVEs; failures preserve prior findings", () => {
  const previous = create(ImageRowSchema, { scanned: true, critical: 1, cves: ["CVE-old"], vulnerabilities: [create(VulnerabilitySchema, { id: "CVE-old" })] });
  assert.equal(applyScanResult(previous, create(ScanItemSchema, { state: "failed", error: "registry unavailable" })), previous);
  const clean = applyScanResult(previous, create(ScanItemSchema, { state: "succeeded", findingsAvailable: true, allSeverities: true, scannedAt: "2026-09-22T00:00:00Z" }));
  assert.equal(clean.scanned, true);
  assert.equal(clean.critical, 0);
  assert.equal(clean.allSeverities, true);
  assert.deepEqual(clean.cves, []);
  assert.deepEqual(clean.vulnerabilities, []);
  const [group] = groupDeployedImages([create(RuntimeImageSchema, { digest: "sha256:aaa", scanned: true })], [create(ImageRowSchema, { id: "sha256:aaa", vulnerabilities: previous.vulnerabilities, scannedAt: clean.scannedAt, allSeverities: true })]);
  assert.deepEqual(group.vulnerabilities, previous.vulnerabilities);
  assert.equal(group.scannedAt, clean.scannedAt);
  assert.equal(group.allSeverities, true);
});
