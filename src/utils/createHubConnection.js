import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { buildHubConnectionOptions } from "./hubConnectionOptions";

/**
 * Tạo hub SignalR chung.
 * LogLevel.Warning: ẩn dòng Information "WebSocket connected … access_token=…" (lộ JWT).
 */
export const createHubConnection = (hubUrl, getAccessToken) =>
  new HubConnectionBuilder()
    .withUrl(hubUrl, buildHubConnectionOptions(getAccessToken))
    .configureLogging(LogLevel.Warning)
    .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
    .build();
