import { ConnectError } from "@connectrpc/connect";

export function errorText(err: unknown) {
  if (err instanceof ConnectError) return err.message;
  if (err instanceof Error) return err.message;
  return "The request failed";
}
