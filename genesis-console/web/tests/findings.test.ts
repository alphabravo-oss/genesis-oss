import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { ImageRowSchema, VulnerabilitySchema } from "../src/gen/console/v1/console_pb.ts";
import { fixableCount, hasFix, scanSeverityCounts, vulnerabilityCounts } from "../src/lib/findings.ts";

test("fix availability follows reported fixed versions, across every severity and package", () => {
  const rows = [
    { id: "CVE-1", severity: "CRITICAL", packageName: "one", fixed: "2.0, 3.0" },
    { id: "CVE-1", severity: "CRITICAL", packageName: "two", fixed: "2.1" },
    { id: "CVE-1", severity: "CRITICAL", packageName: "three" },
    { id: "CVE-2", severity: "LOW", fixed: "1.2" },
    { id: "CVE-3", severity: "UNKNOWN", fixed: " " },
    { id: "CVE-4", severity: "MEDIUM" },
  ].map((row) => create(VulnerabilitySchema, row));
  assert.equal(fixableCount(rows), 2);
  assert.equal(rows.filter(hasFix).length, 3);
  assert.equal(rows.filter((row) => !hasFix(row)).length, 3);
  assert.equal(fixableCount([]), 0);
});

test("severity counts deduplicate vulnerabilities at their highest severity and preserve scan coverage", () => {
  const rows = [
    { id: "CVE-1", severity: "HIGH", packageName: "one" },
    { id: "CVE-1", severity: "CRITICAL", packageName: "two" },
    { id: "CVE-1", severity: "LOW", packageName: "three" },
    { id: "CVE-2", severity: "HIGH" },
    { id: "CVE-3", severity: " medium " },
    { id: "CVE-4", severity: "LOW" },
    { id: "CVE-5", severity: "unexpected" },
  ].map((row) => create(VulnerabilitySchema, row));
  assert.deepEqual(vulnerabilityCounts(rows), [1, 1, 1, 1, 1]);
  const image = create(ImageRowSchema, { scanned: true, allSeverities: true, vulnerabilities: rows });
  assert.deepEqual(scanSeverityCounts(image), [1, 1, 1, 1, 1]);
  assert.deepEqual(scanSeverityCounts({ ...image, scanned: false }), [null, null, null, null, null]);
  assert.deepEqual(scanSeverityCounts({ ...image, vulnerabilities: [] }), [0, 0, 0, 0, 0]);
  assert.deepEqual(scanSeverityCounts({ ...image, allSeverities: false, vulnerabilities: [], critical: 2, high: 3 }), [2, 3, null, null, null]);
});
