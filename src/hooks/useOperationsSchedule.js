import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchOperationsSchedule,
  indexOperationsScheduleByBoat,
  toOperationsScheduleDate,
} from "../services/operationsService";
import { trackingHub } from "../services/trackingHubClient";
import { normalizeDwellCountdown } from "../utils/boatTracking";

const POLL_MS = 4000;

const movementFromStopEvent = (event) => {
  const key = String(event || "").trim().toLowerCase();
  if (key === "arrived") return "AtStation";
  if (key === "arriving") return "Arriving";
  if (key === "departed") return "Departed";
  return null;
};

/**
 * Lịch vận hành trong ngày (movementStatus + remainingDistance + latest lat/lng).
 * Poll operations/schedule; tripStopUpdated → patch ngay + refetch.
 * @param {{ enabled?: boolean, serviceType?: string }} options
 *   serviceType: booking | bus | sightseeing | charter | all
 */
export function useOperationsSchedule({ enabled = true, serviceType } = {}) {
  const [entries, setEntries] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [lastTripStop, setLastTripStop] = useState(null);
  const activeRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const day = toOperationsScheduleDate();
      const list = await fetchOperationsSchedule({
        fromDate: day,
        toDate: day,
        serviceType,
      });
      if (!activeRef.current) return list;
      setEntries(list);
      if (!silent) setErrorMsg("");
      return list;
    } catch (error) {
      console.error("Failed to load operations schedule:", error);
      if (!silent && activeRef.current) {
        setErrorMsg(error?.response?.data?.message || error?.message || "Failed to load schedule.");
      }
      throw error;
    } finally {
      inFlightRef.current = false;
      if (activeRef.current) setIsLoading(false);
    }
  }, [serviceType]);

  const applyTripStopPayload = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return;
    const event = String(payload.event || payload.Event || "").trim();
    if (!event) return;

    const boatCode = String(payload.boatCode || payload.BoatCode || "").trim();
    const boatId = String(payload.boatId || payload.BoatId || "").trim();
    const stationName = String(payload.stationName || payload.StationName || "").trim();
    const stationCode = String(payload.stationCode || payload.StationCode || "").trim();
    const movementStatus = movementFromStopEvent(event);
    const dwellCountdown = normalizeDwellCountdown(payload);
    const eventKey = String(event).toLowerCase();

    setLastTripStop({
      event,
      boatCode,
      boatId,
      stationName,
      stationCode,
      tripId: payload.tripId || payload.TripId || null,
      tripCode: payload.tripCode || payload.TripCode || null,
      occurredAt: payload.occurredAt || payload.OccurredAt || Date.now(),
      lat: payload.lat ?? payload.Lat ?? null,
      lng: payload.lng ?? payload.Lng ?? null,
      dwellCountdown: eventKey === "departed" ? null : dwellCountdown,
    });

    setEntries((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((row) => {
        const sameBoat = (boatCode && String(row.boatCode || "").toUpperCase() === boatCode.toUpperCase())
          || (boatId && String(row.boatId || "") === boatId);
        if (!sameBoat) return row;
        changed = true;
        const arrived = eventKey === "arrived";
        const departed = eventKey === "departed";
        return {
          ...row,
          lastStopEvent: event,
          movementStatus: movementStatus || row.movementStatus,
          currentStationName: arrived || departed
            ? (stationName || row.currentStationName)
            : row.currentStationName,
          currentStationCode: arrived || departed
            ? (stationCode || row.currentStationCode)
            : row.currentStationCode,
          nextStationName: eventKey === "arriving"
            ? (stationName || row.nextStationName)
            : row.nextStationName,
          nextStationCode: eventKey === "arriving"
            ? (stationCode || row.nextStationCode)
            : row.nextStationCode,
          tripId: payload.tripId || payload.TripId || row.tripId,
          tripCode: payload.tripCode || payload.TripCode || row.tripCode,
          dwellCountdown: departed
            ? null
            : (dwellCountdown ?? row.dwellCountdown),
        };
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false;
      setEntries([]);
      setIsLoading(false);
      return undefined;
    }

    activeRef.current = true;
    setIsLoading(true);
    load({ silent: false }).catch(() => {});

    const timer = window.setInterval(() => {
      load({ silent: true }).catch(() => {});
    }, POLL_MS);

    const onFocus = () => load({ silent: true }).catch(() => {});
    window.addEventListener("focus", onFocus);

    const unsubTripStop = trackingHub.subscribeTripStopUpdated((payload) => {
      if (!activeRef.current) return;
      applyTripStopPayload(payload);
      // Refetch để timeline / ETA đầy đủ theo DB.
      load({ silent: true }).catch(() => {});
    });

    const unsubTripDelay = trackingHub.subscribeTripDelayUpdated((payload) => {
      if (!activeRef.current || !payload) return;
      // BE tính delay — FE chỉ patch field rồi refetch schedule.
      setEntries((prev) => {
        if (!Array.isArray(prev) || !prev.length) return prev;
        const tripId = String(payload.tripId || payload.TripId || "").trim();
        const boatId = String(payload.boatId || payload.BoatId || "").trim();
        const boatCode = String(payload.boatCode || payload.BoatCode || "").trim();
        const delayInfo = payload.delayInfo || payload.DelayInfo;
        const delayMinutes = Number(
          payload.totalDelayMinutes
          ?? payload.delayMinutes
          ?? delayInfo?.delayMinutes,
        );
        let changed = false;
        const next = prev.map((row) => {
          const sameTrip = tripId && String(row.tripId || "") === tripId;
          const sameBoat = (boatId && String(row.boatId || "") === boatId)
            || (boatCode && String(row.boatCode || "").toUpperCase() === boatCode.toUpperCase());
          if (!sameTrip && !sameBoat) return row;
          changed = true;
          return {
            ...row,
            delayMinutes: Number.isFinite(delayMinutes) ? delayMinutes : row.delayMinutes,
            delayReason: delayInfo?.reason || payload.reason || row.delayReason,
            adjustedStartAt: payload.adjustedDepartureTime
              || payload.adjustedStartAt
              || row.adjustedStartAt,
            adjustedEndAt: payload.adjustedArrivalTime
              || payload.adjustedEndAt
              || row.adjustedEndAt,
            isDelayActive: Boolean(delayInfo?.isDelayActive ?? payload.isDelayActive),
            delayStartedAt: delayInfo?.delayStartedAt
              || payload.delayStartedAt
              || row.delayStartedAt,
          };
        });
        return changed ? next : prev;
      });
      load({ silent: true }).catch(() => {});
    });

    trackingHub.acquire().catch(() => {});

    return () => {
      activeRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      unsubTripStop();
      unsubTripDelay();
      trackingHub.release();
    };
  }, [enabled, load, applyTripStopPayload]);

  const byBoatKey = useMemo(() => indexOperationsScheduleByBoat(entries), [entries]);

  return {
    entries,
    byBoatKey,
    errorMsg,
    isLoading,
    lastTripStop,
    refresh: () => load({ silent: false }),
  };
}
