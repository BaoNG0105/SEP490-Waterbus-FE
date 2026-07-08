import { useCallback, useEffect, useRef } from "react";
import { charterBookingHub } from "../services/charterBookingHubClient";

export function useCharterBookingListHub({ enabled, listMode, onRefresh }) {
  const refreshRef = useRef(onRefresh);
  const debounceRef = useRef(null);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      refreshRef.current?.();
    }, 300);
  }, []);

  useEffect(() => {
    if (!enabled || !listMode) return undefined;

    let active = true;

    const unsubscribe = charterBookingHub.subscribeAssignedChanged(() => {
      if (active) scheduleRefresh();
    });

    charterBookingHub.joinList(listMode).catch((error) => {
      console.warn("Charter booking list hub join failed:", error);
    });

    const handleFocus = () => scheduleRefresh();
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      charterBookingHub.leaveList(listMode).catch(() => {});
    };
  }, [enabled, listMode, scheduleRefresh]);
}
