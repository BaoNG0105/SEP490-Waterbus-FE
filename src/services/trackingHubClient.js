import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { getTrackingHubUrl } from "../utils/hubBaseUrl";
import { buildHubConnectionOptions } from "../utils/hubConnectionOptions";

const RELEASE_DEBOUNCE_MS = 800;

class TrackingHubClient {
  constructor() {
    this.connection = null;
    this.startPromise = null;
    this.refCount = 0;
    this.releaseTimer = null;
    this.locationListeners = new Set();
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
        console.warn("Tracking hub status listener error:", error);
      }
    });
  }

  attachLifecycleHandlers(connection) {
    const forward = (payload) => {
      this.locationListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.warn("Tracking hub boatLocation listener error:", error);
        }
      });
    };

    connection.on("boatLocation", forward);
    connection.on("BoatLocation", forward);
    connection.on("boatlocation", forward);

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
        // start thất bại — thử tạo connection mới bên dưới
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

    const connection = new HubConnectionBuilder()
      .withUrl(getTrackingHubUrl(), buildHubConnectionOptions(() => this.getAccessToken()))
      .withAutomaticReconnect([0, 1000, 2000, 5000, 10000])
      .build();

    this.connection = connection;
    this.attachLifecycleHandlers(connection);

    this.startPromise = connection.start().then(() => {
      if (this.connection !== connection) {
        // Đã bị replace/stop trong lúc start (Strict Mode) — bỏ qua.
        return null;
      }
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
      const err = new Error("Tracking hub start cancelled");
      err.name = "AbortError";
      throw err;
    }
    return connection;
  }

  /** Giữ connection sống qua Strict Mode remount. */
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

  subscribeBoatLocation(listener) {
    this.locationListeners.add(listener);
    return () => this.locationListeners.delete(listener);
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

  get isConnected() {
    return this.connection?.state === HubConnectionState.Connected;
  }
}

export const trackingHub = new TrackingHubClient();
