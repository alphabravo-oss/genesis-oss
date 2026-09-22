import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useScanEvents() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const events = new EventSource("/events/scans");
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["job"] });
    };
    events.addEventListener("scans", () => { setConnected(true); refresh(); });
    events.onerror = () => { setConnected(false); refresh(); };
    return () => events.close();
  }, [queryClient]);
  return connected;
}
