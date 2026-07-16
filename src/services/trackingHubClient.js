import { HubConnectionBuilder, HubConnectionState } from "@microsoft/signalr";
import { getTrackingHubUrl } from "../utils/hubBaseUrl";
import { buildHubConnectionOptions } from "../utils/hubConnectionOptions";

class TrackingHubClient {
  constructor() {
    this.connection = null;
    this.startPromise = null;
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

    // BE có thể dùng casing khác nhau.
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
        // ignore dispose errors
      }
      this.connection = null;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(getTrackingHubUrl(), buildHubConnectionOptions(() => this.getAccessToken()))
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

  subscribeBoatLocation(listener) {
    this.locationListeners.add(listener);
    return () => this.locationListeners.delete(listener);
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

  get isConnected() {
    return this.connection?.state === HubConnectionState.Connected;
  }
}

export const trackingHub = new TrackingHubClient();
