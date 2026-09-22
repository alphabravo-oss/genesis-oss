import { Code, ConnectError, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { ConsoleService } from "@/gen/console/v1/console_pb";
import { loginURL } from "./auth";

const transport = createConnectTransport({
  baseUrl: "",
  interceptors: [(next) => async (request) => {
    try {
      return await next(request);
    } catch (error) {
      if (ConnectError.from(error).code === Code.Unauthenticated && window.location.pathname !== "/login") window.location.replace(loginURL());
      throw error;
    }
  }],
});

export const consoleClient = createClient(ConsoleService, transport);
