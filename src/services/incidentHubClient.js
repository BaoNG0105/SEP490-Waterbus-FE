import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { getIncidentsHubUrl } from "../utils/hubBaseUrl";
import { buildHubConnectionOptions } from "../utils/hubConnectionOptions";

class IncidentHubClient {
  constructor() {
    this.connection = null;
    this.startPromise = null;
    this.updatedListeners = new Set();
    this.rescueListeners = new Set();
    this.statusListeners = new Set();
  }

  getAccessToken() {
    return localStorage.getItem("accessToken") || "";
  }

  notifyStatus(status) {
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (error) {
        console.warn("Incident hub status listener error:", error);
      }
    });
  }

  emitUpdated(payload) {
    this.updatedListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn("IncidentUpdated listener error:", error);
      }
    });
  }

  emitRescue(payload) {
    this.rescueListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn("RescueDispatched listener error:", error);
      }
    });
  }

  attachLifecycleHandlers(connection) {
    const onUpdated = (payload) => this.emitUpdated(payload);
    const onRescue = (payload) => this.emitRescue(payload);

    connection.on("IncidentUpdated", onUpdated);
    connection.on("incidentUpdated", onUpdated);
    connection.on("incidentupdated", onUpdated);

    connection.on("RescueDispatched", onRescue);
    connection.on("rescueDispatched", onRescue);
    connection.on("rescuedispatched", onRescue);

    connection.onreconnecting(() => this.notifyStatus("reconnecting"));
    connection.onreconnected(() => this.notifyStatus("live"));
    connection.onclose(() => this.notifyStatus("offline"));
  }

  async ensureConnection() {
    if (this.connection?.state === HubConnectionState.Connected) {
      return this.connection;
    }

    if (
      this.connection
      && (this.connection.state === HubConnectionState.Connecting
        || this.connection.state === HubConnectionState.Reconnecting)
      && this.startPromise
    ) {
      await this.startPromise;
      if (this.connection?.state === HubConnectionState.Connected) {
        return this.connection;
      }
    }

    if (this.startPromise) {
      await this.startPromise;
      if (this.connection?.state === HubConnectionState.Connected) {
        return this.connection;
      }
    }

    if (this.connection) {
      try {
        await this.connection.stop();
      } catch {
        // ignore
      }
      this.connection = null;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(getIncidentsHubUrl(), buildHubConnectionOptions(() => this.getAccessToken()))
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .build();

    this.attachLifecycleHandlers(this.connection);

    this.startPromise = this.connection.start().catch((error) => {
      this.startPromise = null;
      this.connection = null;
      this.notifyStatus("offline");
      throw error;
    });

    await this.startPromise;
    this.notifyStatus("live");
    return this.connection;
  }

  subscribeIncidentUpdated(listener) {
    this.updatedListeners.add(listener);
    return () => this.updatedListeners.delete(listener);
  }

  subscribeRescueDispatched(listener) {
    this.rescueListeners.add(listener);
    return () => this.rescueListeners.delete(listener);
  }

  subscribeStatus(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async start() {
    return this.ensureConnection();
  }

  async stop() {
    if (!this.connection) return;
    try {
      await this.connection.stop();
    } catch {
      // ignore
    }
    this.connection = null;
    this.startPromise = null;
    this.notifyStatus("offline");
  }
}

export const incidentHub = new IncidentHubClient();
