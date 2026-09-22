import type { ImageRow, RuntimeImage, ScanItem, ScanJob, Vulnerability } from "../gen/console/v1/console_pb";

export function imageHref(source: "deployed" | "catalog", id: string, search: URLSearchParams) {
  return `/images/${source}/${encodeURIComponent(id)}${search.size ? `?${search}` : ""}`;
}

export type DeployedImage = RuntimeImage & {
  id: string;
  references: string[];
  packages: string[];
  namespaces: string[];
  containers: RuntimeImage[];
  vulnerabilities: Vulnerability[];
  scannedAt: string;
};

export function groupDeployedImages(images: RuntimeImage[], findings: ImageRow[] = []): DeployedImage[] {
  const groups = new Map<string, DeployedImage>();
  const saved = new Map(findings.map((image) => [image.id, image]));
  for (const image of images) {
    // A mutable tag can have multiple deployed digests. Keep those versions separate.
    const id = image.digest || image.ref;
    let group = groups.get(id);
    if (!group) {
      group = { ...image, id, references: [], packages: [], namespaces: [], containers: [], vulnerabilities: saved.get(id)?.vulnerabilities ?? [], scannedAt: saved.get(id)?.scannedAt ?? "" };
      groups.set(id, group);
    }
    group.containers.push(image);
    if (!group.references.includes(image.ref)) group.references.push(image.ref);
    if (!group.packages.includes(image.packageKey)) group.packages.push(image.packageKey);
    if (!group.namespaces.includes(image.namespace)) group.namespaces.push(image.namespace);
  }
  return [...groups.values()];
}

function digest(value: string) {
  return value.match(/(?:^|sha256:)([a-f0-9]{12,64})$/i)?.[1].toLowerCase() ?? "";
}

export function imageScan(image: ImageRow | DeployedImage, job?: ScanJob, catalogTag?: string): ScanItem | undefined {
  return job?.items.find((item) => {
    if (catalogTag && job.tag === catalogTag && item.imageId === image.id) return true;
    const observed = digest(image.digest);
    const target = digest(item.digest) || digest(item.ref) || digest(item.imageId);
    if (observed && target) return observed.startsWith(target) || target.startsWith(observed);
    if (job.scope === "deployed" && item.imageId === image.id) return true;
    return ("references" in image ? image.references : [image.ref]).includes(item.ref) && Boolean(item.ref);
  });
}

export function applyScanResult<T extends ImageRow | DeployedImage>(image: T, item?: ScanItem): T {
  if (!item?.findingsAvailable) return image;
  return { ...image, scanned: true, critical: item.critical, high: item.high, scannedAt: item.scannedAt, vulnerabilities: item.vulnerabilities, cves: [...new Set(item.vulnerabilities.map((v) => v.id))] };
}
