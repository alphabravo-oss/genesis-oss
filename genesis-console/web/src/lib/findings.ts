import type { ImageRow, Vulnerability } from "../gen/console/v1/console_pb";

export const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };

// Count each vulnerability once, at its highest reported severity across packages.
export function vulnerabilityCounts(findings: Vulnerability[]) {
  const byId = new Map<string, number>();
  for (const finding of findings) {
    const rank = severityRank[finding.severity.trim().toUpperCase()] ?? 0;
    byId.set(finding.id, Math.max(byId.get(finding.id) ?? 0, rank));
  }
  const counts = [0, 0, 0, 0, 0];
  for (const rank of byId.values()) counts[4 - rank]++;
  return counts;
}

export function scanSeverityCounts(image: Pick<ImageRow, "scanned" | "allSeverities" | "critical" | "high" | "vulnerabilities">): (number | null)[] {
  if (!image.scanned) return severities.map(() => null);
  return image.allSeverities ? vulnerabilityCounts(image.vulnerabilities) : [image.critical, image.high, null, null, null];
}

export function hasFix(finding: Vulnerability) {
  return finding.fixed.trim().length > 0;
}

// A CVE may affect several packages; a fix for one does not fix them all.
export function fixableCount(findings: Vulnerability[]) {
  return new Set(findings.filter(hasFix).map((finding) => finding.id)).size;
}
