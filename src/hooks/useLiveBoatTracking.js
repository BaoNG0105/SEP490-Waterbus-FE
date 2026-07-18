import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLatestBoatLocations } from "../services/trackingService";
import { trackingHub } from "../services/trackingHubClient";
import { upsertBoatLocationMap } from "../utils/boatTracking";

/** Poll REST khi không có hub. Khi Live chỉ backup nếu SignalR im lâu. */
const POLL_FALLBACK_MS = 2000;
const POLL_LIVE_BACKUP_MS = 2000;
const HUB_STALE_MS = 6000;

/**
 * Live boat positions: REST initial → SignalR boatLocation → poll khi cần.
 */
export function useLiveBoatTracking({ enabled = true } = {}) {
  const [boatsById, setBoatsById] = useState(() => new Map());
  const [connectionMode, setConnectionMode] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const pollTimerRef = useRef(null);
  const activeRef = useRef(false);
  const hubLiveRef = useRef(false);
  const lastHubEventAtRef = useRef(0);
  const pendingBatchRef = useRef(null);
  const rafRef = useRef(0);
  const inFlightRef = useRef(false);

  const flushPending = useCallback(() => {
    rafRef.current = 0;
    const batch = pendingBatchRef.current;
    pendingBatchRef.current = null;
    if (!batch?.length) return;
    setBoatsById((prev) => {
      let next = prev;
      batch.forEach((loc) => {
        next = upsertBoatLocationMap(next, loc);
      });
      return next === prev ? prev : next;
    });
  }, []);

  const applyLocations = useCallback((locations) => {
    setBoatsById((prev) => {
      let next = prev;
      (locations || []).forEach((loc) => {
        // REST backup: upsertBoatLocationMap đã bỏ packet cũ hơn recordedAt.
        next = upsertBoatLocationMap(next, loc);
      });
      return next === prev ? prev : next;
    });
  }, []);

  const applyOneLocation = useCallback((payload) => {
    lastHubEventAtRef.current = Date.now();
    if (!pendingBatchRef.current) pendingBatchRef.current = [];
    // SignalR = GPS realtime — luôn đưa vào batch, không lọc tọa độ phía FE.
    pendingBatchRef.current.push(payload);
    if (!rafRef.current) {
      rafRef.current = window.requestAnimationFrame(flushPending);
    }
  }, [flushPending]);

  const loadLatest = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return null;
    inFlightRef.current = true;
    try {
      const list = await fetchLatestBoatLocations();
      if (!activeRef.current) return list;
      applyLocations(list);
      if (!silent) setErrorMsg("");
      return list;
    } catch (error) {
      console.error("Failed to load latest boat locations:", error);
      if (!silent && activeRef.current) {
        setErrorMsg(error?.response?.data?.message || error?.message || "Failed to load boat locations.");
      }
      throw error;
    } finally {
      inFlightRef.current = false;
    }
  }, [applyLocations]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback((intervalMs, { liveBackup = false } = {}) => {
    stopPolling();
    pollTimerRef.current = window.setInterval(() => {
      // Live + hub vừa đẩy event thì khỏi spam REST.
      if (
        liveBackup
        && hubLiveRef.current
        && Date.now() - lastHubEventAtRef.current < HUB_STALE_MS
      ) {
        return;
      }
      loadLatest({ silent: true }).catch(() => {
        if (activeRef.current && !hubLiveRef.current) {
          setConnectionMode("offline");
        }
      });
    }, intervalMs);
  }, [loadLatest, stopPolling]);

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false;
      stopPolling();
      setConnectionMode("offline");
      return undefined;
    }

    activeRef.current = true;
    let cancelled = false;

    const unsubscribeLocation = trackingHub.subscribeBoatLocation((payload) => {
      if (!activeRef.current) return;
      applyOneLocation(payload);
    });

    const unsubscribeStatus = trackingHub.subscribeStatus((status) => {
      if (!activeRef.current) return;
      if (status === "live") {
        hubLiveRef.current = true;
        setConnectionMode("live");
        setErrorMsg("");
        startPolling(POLL_LIVE_BACKUP_MS, { liveBackup: true });
      } else if (status === "reconnecting" || status === "offline") {
        hubLiveRef.current = false;
        setConnectionMode("polling");
        startPolling(POLL_FALLBACK_MS);
      }
    });

    const boot = async () => {
      setIsInitialLoading(true);
      setConnectionMode("loading");

      try {
        await loadLatest({ silent: false });
      } catch {
        if (!cancelled) setConnectionMode("offline");
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }

      if (cancelled || !activeRef.current) return;

      try {
        await trackingHub.start();
        if (cancelled || !activeRef.current) return;
        hubLiveRef.current = true;
        lastHubEventAtRef.current = Date.now();
        setConnectionMode("live");
        startPolling(POLL_LIVE_BACKUP_MS, { liveBackup: true });
      } catch (error) {
        console.warn("Tracking hub unavailable — falling back to polling:", error);
        if (!cancelled && activeRef.current) {
          hubLiveRef.current = false;
          setConnectionMode("polling");
          startPolling(POLL_FALLBACK_MS);
        }
      }
    };

    boot();

    const onFocus = () => {
      if (!activeRef.current) return;
      loadLatest({ silent: true }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      activeRef.current = false;
      unsubscribeLocation();
      unsubscribeStatus();
      stopPolling();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      trackingHub.stop().catch(() => {});
    };
  }, [enabled, applyOneLocation, loadLatest, startPolling, stopPolling]);

  const boats = useMemo(
    () => [...boatsById.values()].sort((a, b) =>
      String(a.boatCode).localeCompare(String(b.boatCode), undefined, { sensitivity: "base" }),
    ),
    [boatsById],
  );

  return {
    boats,
    boatsById,
    connectionMode,
    errorMsg,
    isInitialLoading,
    refresh: () => loadLatest({ silent: false }),
  };
}
