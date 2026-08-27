import { HubConnectionState } from "@microsoft/signalr";
import { getCharterBookingHubUrl } from "../utils/hubBaseUrl";
import { createHubConnection } from "../utils/createHubConnection";
import { charterLog } from "../utils/charterDebugLog";

class CharterBookingHubClient {
  constructor() {
    this.connection = null;
    this.startPromise = null;
    this.assignedListeners = new Set();
    this.bookingChangedListeners = new Set();
    this.listMode = null;
    this.listRefCount = 0;
    this.detailJoins = new Map();
  }

  getAccessToken() {
    return localStorage.getItem("accessToken") || "";
  }

  attachLifecycleHandlers(connection) {
    connection.on("AssignedCharterBookingsChanged", () => {
      this.assignedListeners.forEach((listener) => listener());
    });

    connection.on("CharterBookingChanged", (event) => {
      charterLog("signalr-event-received", {
        eventType: "CharterBookingChanged",
        bookingId: event?.bookingId,
        bookingStatus: event?.bookingStatus,
        paymentStatus: event?.paymentStatus,
        occurredAt: event?.occurredAt || event?.timestamp,
        hasTickets: Array.isArray(event?.tickets),
        ticketCount: event?.tickets?.length,
      });
      this.bookingChangedListeners.forEach((listener) => listener(event));
    });

    connection.onreconnected(async () => {
      try {
        await this.rejoinActiveGroups();
      } catch (error) {
        console.warn("Charter hub rejoin after reconnect failed:", error);
      }
    });
  }

  async rejoinActiveGroups() {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return;

    if (this.listMode) {
      const method = this.listMode === "admin"
        ? "JoinAdminCharterBookings"
        : "JoinAssignedCharterBookings";
      await this.connection.invoke(method);
    }

    const bookingIds = [...this.detailJoins.keys()];
    await Promise.all(
      bookingIds.map((bookingId) => (
        this.connection.invoke("JoinCharterBooking", bookingId).catch((error) => {
          console.warn(`Charter hub rejoin booking ${bookingId} failed:`, error);
        })
      )),
    );
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

    this.connection = createHubConnection(getCharterBookingHubUrl(), () => this.getAccessToken());

    this.attachLifecycleHandlers(this.connection);

    this.startPromise = this.connection.start().catch((error) => {
      this.startPromise = null;
      this.connection = null;
      throw error;
    });

    await this.startPromise;
    return this.connection;
  }

  subscribeAssignedChanged(listener) {
    this.assignedListeners.add(listener);
    return () => this.assignedListeners.delete(listener);
  }

  subscribeBookingChanged(listener) {
    this.bookingChangedListeners.add(listener);
    return () => this.bookingChangedListeners.delete(listener);
  }

  async joinList(mode) {
    await this.ensureConnection();
    if (this.listMode === mode) {
      this.listRefCount += 1;
      return;
    }

    this.listMode = mode;
    this.listRefCount = 1;
    const method = mode === "admin" ? "JoinAdminCharterBookings" : "JoinAssignedCharterBookings";
    await this.connection.invoke(method);
  }

  async leaveList(mode) {
    if (this.listMode !== mode) return;
    this.listRefCount = Math.max(0, this.listRefCount - 1);
    if (this.listRefCount > 0) return;
    this.listMode = null;
  }

  async joinBooking(bookingId) {
    const key = String(bookingId || "");
    if (!key) return;

    await this.ensureConnection();
    const nextCount = (this.detailJoins.get(key) || 0) + 1;
    this.detailJoins.set(key, nextCount);
    if (nextCount === 1) {
      await this.connection.invoke("JoinCharterBooking", key);
    }
  }

  async leaveBooking(bookingId) {
    const key = String(bookingId || "");
    if (!key || !this.connection) return;

    const current = this.detailJoins.get(key) || 0;
    if (current <= 1) {
      this.detailJoins.delete(key);
      if (this.connection.state === HubConnectionState.Connected) {
        await this.connection.invoke("LeaveCharterBooking", key).catch(() => {});
      }
      return;
    }

    this.detailJoins.set(key, current - 1);
  }
}

export const charterBookingHub = new CharterBookingHubClient();
