import { isLiveHookConfigured, postLiveIncidentHook } from "../api/liveIncidentHookApi";
import { getLatestBoatLocations } from "../api/trackingApi";
import { normalizeBoatLocationList } from "../utils/boatTracking";

export { isLiveHookConfigured };

const toCoord = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Lấy lat/lng hiện tại của tàu từ tracking (khuyến nghị gửi kèm IncidentCreated / RescueDispatched).
 */
export const resolveBoatCoords = async (boatCode, fallback = {}) => {
  const code = String(boatCode || "").trim();
  let lat = toCoord(fallback.lat ?? fallback.latitude);
  let lng = toCoord(fallback.lng ?? fallback.longitude);

  if ((lat == null || lng == null) && code) {
    try {
      const raw = await getLatestBoatLocations();
      const list = normalizeBoatLocationList(raw);
      const hit = list.find((boat) => String(boat.boatCode || "").toLowerCase() === code.toLowerCase());
      if (hit) {
        lat = toCoord(hit.latitude);
        lng = toCoord(hit.longitude);
      }
    } catch (error) {
      console.warn("Live hook: không lấy được coords từ tracking:", error);
    }
  }

  return { lat, lng };
};

const notifySafely = async (payload, label) => {
  if (!isLiveHookConfigured()) {
    console.info(`[Live hook] skip ${label} — chưa cấu hình VITE_LIVE_*`);
    return { skipped: true };
  }
  try {
    const data = await postLiveIncidentHook(payload);
    return { ok: true, data };
  } catch (error) {
    console.warn(`[Live hook] ${label} failed:`, error);
    return { ok: false, error };
  }
};

/** 1) Báo sự cố → Live marker đỏ */
export const notifyLiveIncidentCreated = async ({
  boatCode,
  description,
  lat,
  lng,
  incidentId,
}) => {
  const coords = await resolveBoatCoords(boatCode, { lat, lng });
  const payload = {
    event: "IncidentCreated",
    boatCode: String(boatCode || "").trim(),
    description: description || "",
  };
  if (incidentId) payload.incidentId = incidentId;
  if (coords.lat != null) payload.lat = coords.lat;
  if (coords.lng != null) payload.lng = coords.lng;
  return notifySafely(payload, "IncidentCreated");
};

/** 2) Điều tàu cứu → Live kéo replacementBoatCode tới hiện trường */
export const notifyLiveRescueDispatched = async ({
  incidentId,
  boatCode,
  replacementBoatCode,
  lat,
  lng,
}) => {
  const coords = await resolveBoatCoords(boatCode, { lat, lng });
  const payload = {
    event: "RescueDispatched",
    incidentId: incidentId || undefined,
    boatCode: String(boatCode || "").trim(),
    replacementBoatCode: String(replacementBoatCode || "").trim(),
  };
  if (coords.lat != null) payload.lat = coords.lat;
  if (coords.lng != null) payload.lng = coords.lng;
  return notifySafely(payload, "RescueDispatched");
};

/** 3) Đóng sự cố */
export const notifyLiveIncidentResolved = async ({
  incidentId,
  boatCode,
  boatStatus = "Active",
}) => {
  return notifySafely({
    event: "IncidentResolved",
    incidentId: incidentId || undefined,
    boatCode: String(boatCode || "").trim(),
    boatStatus: boatStatus || "Active",
  }, "IncidentResolved");
};
