import assert from "node:assert/strict";
import { test } from "node:test";
import { create } from "@bufbuild/protobuf";
import { VulnerabilitySchema } from "../src/gen/console/v1/console_pb.ts";
import { fixableCount, hasFix } from "../src/lib/findings.ts";

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
