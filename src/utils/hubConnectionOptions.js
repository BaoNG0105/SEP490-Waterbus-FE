import { HttpTransportType } from "@microsoft/signalr";

/**
 * Options chung cho SignalR qua Vite proxy → Azure.
 * withCredentials + ARRAffinity cookie (proxy rewrite Domain) để tránh 404 connection id.
 *
 * Ưu tiên WebSockets (thấp latency); fallback SSE nếu Azure không WS.
 */
export const buildHubConnectionOptions = (getAccessToken) => ({
  accessTokenFactory: () => getAccessToken() || "",
  withCredentials: true,
  transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
});
