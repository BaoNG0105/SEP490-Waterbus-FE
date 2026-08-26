import { useCallback, useEffect, useRef } from "react";
import { charterBookingHub } from "../services/charterBookingHubClient";
import { charterLog } from "../utils/charterDebugLog";

const REFRESH_DEBOUNCE_MS = 500;

export function useCharterBookingDetailHub({ enabled, bookingId, onRefresh }) {
  const refreshRef = useRef(onRefresh);
  const debounceRef = useRef(null);
  const bookingIdRef = useRef(String(bookingId || ""));

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    bookingIdRef.current = String(bookingId || "");
  }, [bookingId]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      charterLog("payos-callback-refresh", { bookingId: bookingIdRef.current });
      refreshRef.current?.();
    }, REFRESH_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const currentBookingId = String(bookingId || "");
    if (!enabled || !currentBookingId) return undefined;

    charterLog("payos-callback-page", {
      url: window.location.href,
      bookingId: currentBookingId,
    });

    let active = true;

    const unsubscribe = charterBookingHub.subscribeBookingChanged((event) => {
      if (!active) return;
      if (String(event?.bookingId || "") === bookingIdRef.current) {
        charterLog("signalr-triggered-refresh", {
          eventType: event?.eventType || "CharterBookingChanged",
          bookingId: event?.bookingId,
          bookingStatus: event?.bookingStatus,
          paymentStatus: event?.paymentStatus,
          occurredAt: event?.occurredAt || event?.timestamp,
        });
        scheduleRefresh();
      }
    });

    charterBookingHub.joinBooking(currentBookingId).catch((error) => {
      console.warn("Charter booking detail hub join failed:", error);
    });

    const handleFocus = () => scheduleRefresh();
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      charterBookingHub.leaveBooking(currentBookingId).catch(() => {});
    };
  }, [bookingId, enabled, scheduleRefresh]);
}
