import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchOperationsSchedule,
  indexOperationsScheduleByBoat,
  toOperationsScheduleDate,
} from "../services/operationsService";

const POLL_MS = 4000;

/**
 * Lịch vận hành trong ngày (movementStatus + remainingDistance + latest lat/lng).
 * FE không gọi GPS hook — chỉ GET /api/operations/schedule.
 */
export function useOperationsSchedule({ enabled = true } = {}) {
  const [entries, setEntries] = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const activeRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const day = toOperationsScheduleDate();
      const list = await fetchOperationsSchedule({ fromDate: day, toDate: day });
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

    return () => {
      activeRef.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, load]);

  const byBoatKey = useMemo(() => indexOperationsScheduleByBoat(entries), [entries]);

  return {
    entries,
    byBoatKey,
    errorMsg,
    isLoading,
    refresh: () => load({ silent: false }),
  };
}
