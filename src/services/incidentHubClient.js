import { HubConnectionState } from "@microsoft/signalr";
import { getIncidentsHubUrl } from "../utils/hubBaseUrl";
import { createHubConnection } from "../utils/createHubConnection";

const RELEASE_DEBOUNCE_MS = 800;

class IncidentHubClient {
  constructor() {
    this.connection = null;
    this.startPromise = null;
    this.refCount = 0;
    this.releaseTimer = null;
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
    const onResolved = (payload) => this.emitUpdated(payload);

    connection.on("IncidentUpdated", onUpdated);
    connection.on("incidentUpdated", onUpdated);
    connection.on("incidentupdated", onUpdated);

    connection.on("IncidentResolved", onResolved);
    connection.on("incidentResolved", onResolved);
    connection.on("incidentresolved", onResolved);

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

    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // retry below
      }
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

    const connection = createHubConnection(getIncidentsHubUrl(), () => this.getAccessToken());

    this.connection = connection;
    this.attachLifecycleHandlers(connection);

    this.startPromise = connection.start().then(() => {
      if (this.connection !== connection) return null;
      this.notifyStatus("live");
      return connection;
    }).catch((error) => {
      if (this.connection === connection) {
        this.connection = null;
      }
      this.startPromise = null;
      const aborted = error?.name === "AbortError"
        || /stop\(\) was called|aborted/i.test(String(error?.message || error));
      if (!aborted) this.notifyStatus("offline");
      throw error;
    });

    const started = await this.startPromise;
    this.startPromise = null;
    if (!started || this.connection !== connection) {
      const err = new Error("Incidents hub start cancelled");
      err.name = "AbortError";
      throw err;
    }
    return connection;
  }

  async acquire() {
    if (this.releaseTimer) {
      window.clearTimeout(this.releaseTimer);
      this.releaseTimer = null;
    }
    this.refCount += 1;
    try {
      return await this.ensureConnection();
    } catch (error) {
      this.refCount = Math.max(0, this.refCount - 1);
      throw error;
    }
  }

  release() {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount > 0) return;
    if (this.releaseTimer) window.clearTimeout(this.releaseTimer);
    this.releaseTimer = window.setTimeout(() => {
      this.releaseTimer = null;
      if (this.refCount === 0) {
        this.stop().catch(() => {});
      }
    }, RELEASE_DEBOUNCE_MS);
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
    return this.acquire();
  }

  async stop() {
    const connection = this.connection;
    this.connection = null;
    this.startPromise = null;
    if (!connection) return;
    try {
      await connection.stop();
    } catch {
      // ignore
    }
    this.notifyStatus("offline");
  }
}

export const incidentHub = new IncidentHubClient();
