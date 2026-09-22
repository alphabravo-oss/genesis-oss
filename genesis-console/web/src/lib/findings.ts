import type { Vulnerability } from "../gen/console/v1/console_pb";

export function hasFix(finding: Vulnerability) {
  return finding.fixed.trim().length > 0;
}

// A CVE may affect several packages; a fix for one does not fix them all.
export function fixableCount(findings: Vulnerability[]) {
  return new Set(findings.filter(hasFix).map((finding) => finding.id)).size;
}
