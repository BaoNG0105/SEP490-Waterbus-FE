import {
  getTrackingServerTime as apiGetTrackingServerTime,
  getLatestBoatLocations as apiGetLatestBoatLocations,
  getLatestBoatLocation as apiGetLatestBoatLocation,
  getLatestTripLocation as apiGetLatestTripLocation,
} from "../api/trackingApi";
import { normalizeBoatLocation, normalizeBoatLocationList } from "../utils/boatTracking";
import { isServerClockSynchronized, syncServerTime } from "../utils/serverClock";

const SERVER_CLOCK_SYNC_INTERVAL_MS = 60 * 1000;
let serverClockSyncPromise = null;
let lastServerClockSyncAt = 0;

/** Một request dùng chung nếu nhiều phần của Live Tracking cùng khởi tạo. */
export const syncTrackingServerClock = ({ force = false } = {}) => {
  const now = Date.now();
  if (
    !force
    && isServerClockSynchronized()
    && now - lastServerClockSyncAt < SERVER_CLOCK_SYNC_INTERVAL_MS
  ) {
    return Promise.resolve(true);
  }
  if (serverClockSyncPromise) return serverClockSyncPromise;

  serverClockSyncPromise = apiGetTrackingServerTime()
    .then(({ serverTime, requestStartedAt, responseReceivedAt }) => {
      const synced = syncServerTime(serverTime, requestStartedAt, responseReceivedAt);
      if (!synced) throw new Error("Backend returned an invalid serverTime.");
      lastServerClockSyncAt = Date.now();
      return true;
    })
    .finally(() => {
      serverClockSyncPromise = null;
    });

  return serverClockSyncPromise;
};

export const fetchLatestBoatLocations = async () => {
  const data = await apiGetLatestBoatLocations();
  return normalizeBoatLocationList(data);
};

export const fetchLatestBoatLocation = async (boatCode) => {
  const data = await apiGetLatestBoatLocation(boatCode);
  return normalizeBoatLocation(data);
};

/**
 * GPS theo chuyến: boat + latestLocation + hasLiveLocationForTrip.
 * - hasLiveLocationForTrip=true → GPS đúng chuyến hiện tại
 * - false → có GPS nhưng không gắn đúng trip
 * - latestLocation=null → tàu chưa gửi GPS
 */
export const fetchLatestTripTracking = async (tripId) => {
  const data = await apiGetLatestTripLocation(tripId);
  const raw = data?.data && typeof data.data === "object" ? data.data : data;
  if (!raw || typeof raw !== "object") return null;

  const latestLocationRaw = raw.latestLocation ?? raw.LatestLocation ?? null;
  const latestLocation = latestLocationRaw
    ? (normalizeBoatLocation(latestLocationRaw) || latestLocationRaw)
    : null;
  const boat = raw.boat ?? raw.Boat ?? null;
  const hasLive = raw.hasLiveLocationForTrip ?? raw.HasLiveLocationForTrip;

  return {
    tripId: raw.tripId ?? raw.TripId ?? tripId,
    tripCode: raw.tripCode ?? raw.TripCode ?? null,
    boat,
    latestLocation,
    hasLiveLocationForTrip: hasLive === true || String(hasLive || "").toLowerCase() === "true",
    raw,
  };
};
