import type { ClusterStatus, ScanJob } from "@/gen/console/v1/console_pb";
import type { ShellData } from "@/shell-loader";

export type ShellContext = ShellData & {
  cluster: ClusterStatus;
  jobs: ScanJob[];
  scanEventsConnected: boolean;
  useRecordedProfiles: boolean;
  selection: Record<string, string>;
  clusterPending: boolean;
  clusterError: string;
};
