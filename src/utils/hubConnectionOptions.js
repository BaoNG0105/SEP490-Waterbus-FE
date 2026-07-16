import { HttpTransportType } from "@microsoft/signalr";

/**
 * Options chung cho SignalR qua Vite proxy → Azure.
 * withCredentials + ARRAffinity cookie (proxy rewrite Domain) để tránh 404 connection id.
 */
export const buildHubConnectionOptions = (getAccessToken) => ({
  accessTokenFactory: () => getAccessToken() || "",
  withCredentials: true,
  // Ưu tiên WebSockets; tránh LongPolling POST hay 404 khi sticky session lệch.
  transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
});
