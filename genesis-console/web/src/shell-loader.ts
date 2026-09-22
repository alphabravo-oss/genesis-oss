import type { LoaderFunctionArgs } from "react-router";
import { create } from "@bufbuild/protobuf";
import {
  ClusterStatusSchema,
  type ClusterStatus,
  type ReleaseDetail,
  type ReleaseSummary,
  type ScanJob,
} from "@/gen/console/v1/console_pb";
import { consoleClient } from "@/lib/connect";
import { getSession } from "@/lib/auth";

export type ShellData = {
  authRequired: boolean;
  releases: ReleaseSummary[];
  tag: string;
  detail: ReleaseDetail | null;
  cluster: ClusterStatus;
  loadedAt: string;
  fetchedAt: number;
  autoClean: boolean;
  jobs: ScanJob[];
};

const emptyCluster = create(ClusterStatusSchema, { connected: false });

export async function shellLoader({ request }: LoaderFunctionArgs): Promise<ShellData> {
  const options = { signal: request.signal };
  const [listed, settings, jobs, session] = await Promise.all([
    consoleClient.listReleases({}, options),
    consoleClient.getScanSettings({}, options),
    consoleClient.listScanJobs({}, options),
    getSession(request.signal),
  ]);
  const releases = listed.releases;
  const requested = new URL(request.url).searchParams.get("tag");
  const known = requested != null && releases.some((release) => release.tag === requested);
  const tag = known && requested ? requested : (releases.at(-1)?.tag ?? "");
  if (!tag) {
    return {
      authRequired: session.required,
      releases,
      tag: "",
      detail: null,
      cluster: emptyCluster,
      loadedAt: listed.loadedAt,
      fetchedAt: Date.now(),
      autoClean: false,
      jobs: [],
    };
  }
  // Read findings after the jobs snapshot so a completed job's results are included.
  const detail = await consoleClient.getRelease({ tag }, options);
  return {
    authRequired: session.required,
    releases,
    tag,
    detail,
    cluster: emptyCluster,
    loadedAt: listed.loadedAt,
    fetchedAt: Date.now(),
    autoClean: settings.autoClean,
    jobs: jobs.jobs,
  };
}
