import type { ConnectionInfo } from "../gen/console/v1/console_pb";

export type FormInput = { name: string; kubeconfig: string; context: string; rewrite: boolean };

export function sourceLabel(info: Pick<ConnectionInfo, "name" | "source"> | undefined, context: string) {
  if (!info) return context;
  if (info.source === "saved") return info.name;
  if (info.source === "environment") return context ? `${context} · set by deployment` : "Set by deployment";
  if (info.source === "in-cluster") return context || "In-cluster service account";
  return context || "Not connected";
}

// A test result only applies to exactly the input that was tested.
export function sameInput(a: FormInput, b: FormInput) {
  return a.name.trim() === b.name.trim() && a.kubeconfig === b.kubeconfig && a.context === b.context && a.rewrite === b.rewrite;
}
