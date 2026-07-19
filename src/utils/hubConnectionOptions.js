import { HttpTransportType } from "@microsoft/signalr";

/**
 * Options chung cho SignalR qua Vite proxy → Azure.
 * withCredentials + ARRAffinity cookie (proxy rewrite Domain) để tránh 404 connection id.
 *
 * Azure hub này chỉ advertise SSE + LongPolling (không có WebSockets).
 * Dùng SSE trước — tránh LongPolling POST hay 404 khi sticky session lệch.
 */
export const buildHubConnectionOptions = (getAccessToken) => ({
  accessTokenFactory: () => getAccessToken() || "",
  withCredentials: true,
  transport: HttpTransportType.ServerSentEvents,
});
