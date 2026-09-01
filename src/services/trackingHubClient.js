import { HubConnectionState } from "@microsoft/signalr";
import { getTrackingHubUrl } from "../utils/hubBaseUrl";
import { createHubConnection } from "../utils/createHubConnection";

const RELEASE_DEBOUNCE_MS = 800;

class TrackingHubClient {
  constructor() {
    this.connection = null;
    this.startPromise = null;
    this.refCount = 0;
    this.releaseTimer = null;
    this.locationListeners = new Set();
    this.tripStopListeners = new Set();
    this.tripDelayListeners = new Set();
    this.statusListeners = new Set();
    /** boatId → refCount (JoinBoat) */
    this.boatJoins = new Map();
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

    const forwardTripStop = (payload) => {
      this.tripStopListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.warn("Tracking hub tripStopUpdated listener error:", error);
        }
      });
    };

    const forwardTripDelay = (payload) => {
      this.tripDelayListeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.warn("Tracking hub tripDelayUpdated listener error:", error);
        }
      });
    };

    connection.on("boatLocation", forward);
    connection.on("BoatLocation", forward);
    connection.on("boatlocation", forward);
    connection.on("boatLocationUpdated", forward);
    connection.on("BoatLocationUpdated", forward);

    // BE sẽ broadcast khi GPS gọi stop event (Arriving/Arrived/Departed).
    connection.on("tripStopUpdated", forwardTripStop);
    connection.on("TripStopUpdated", forwardTripStop);

    connection.on("tripDelayUpdated", forwardTripDelay);
    connection.on("TripDelayUpdated", forwardTripDelay);

    connection.onreconnecting(() => this.notifyStatus("reconnecting"));
    connection.onreconnected(() => {
      this.notifyStatus("live");
      this.rejoinActiveBoats().catch((error) => {
        console.warn("Tracking hub rejoin boats failed:", error);
      });
    });
    connection.onclose(() => {
      this.notifyStatus("offline");
      // Vite proxy → Azure hay ECONNRESET; auto-reconnect hết retry thì tự nối lại nếu vẫn còn subscriber.
      if (this.refCount <= 0) return;
      if (this.connection !== connection) return;
      this.connection = null;
      this.startPromise = null;
      window.setTimeout(() => {
        if (this.refCount <= 0 || this.connection) return;
        this.ensureConnection().catch(() => {});
      }, 1500);
    });
  }

  async rejoinActiveBoats() {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;
    const boatIds = [...this.boatJoins.keys()];
    await Promise.all(
      boatIds.map((boatId) => (
        this.connection.invoke("JoinBoat", boatId).catch((error) => {
          console.warn(`Tracking hub rejoin JoinBoat ${boatId} failed:`, error);
        })
      )),
    );
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

    const connection = createHubConnection(getTrackingHubUrl(), () => this.getAccessToken());

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
    await this.rejoinActiveBoats();
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

  /**
   * Join group theo boatId khi mở trip detail / live tracking.
   * Ref-count để nhiều màn hình cùng boat không leave sớm.
   */
  async joinBoat(boatId) {
    const key = String(boatId || "").trim();
    if (!key) return;

    await this.acquire();
    const nextCount = (this.boatJoins.get(key) || 0) + 1;
    this.boatJoins.set(key, nextCount);
    if (nextCount === 1 && this.connection?.state === HubConnectionState.Connected) {
      try {
        await this.connection.invoke("JoinBoat", key);
      } catch (error) {
        console.warn(`JoinBoat ${key} failed:`, error);
      }
    }
  }

  async leaveBoat(boatId) {
    const key = String(boatId || "").trim();
    if (!key) return;

    const current = this.boatJoins.get(key) || 0;
    if (current <= 1) {
      this.boatJoins.delete(key);
      if (this.connection?.state === HubConnectionState.Connected) {
        await this.connection.invoke("LeaveBoat", key).catch(() => {});
      }
    } else {
      this.boatJoins.set(key, current - 1);
    }
    this.release();
  }

  subscribeBoatLocation(listener) {
    this.locationListeners.add(listener);
    return () => this.locationListeners.delete(listener);
  }

  subscribeTripStopUpdated(listener) {
    this.tripStopListeners.add(listener);
    return () => this.tripStopListeners.delete(listener);
  }

  subscribeTripDelayUpdated(listener) {
    this.tripDelayListeners.add(listener);
    return () => this.tripDelayListeners.delete(listener);
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
    this.boatJoins.clear();
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
