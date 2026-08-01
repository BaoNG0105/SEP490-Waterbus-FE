import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLatestBoatLocation, fetchLatestBoatLocations } from "../services/trackingService";
import { trackingHub } from "../services/trackingHubClient";
import { upsertBoatLocationMap, loadStickyBoatLocationMap } from "../utils/boatTracking";

/**
 * Azure SoT:
 * - SignalR boatLocation = chính (áp ngay)
 * - REST /tracking/boats/latest = fallback / đồng bộ
 * - Không đọc Neon / Live /api/snapshot
 */
const POLL_WHEN_HUB_LIVE_MS = 5000;
const POLL_WHEN_HUB_DOWN_MS = 3000;
/** List /boats/latest hay thiếu ETA — bổ sung GET /boats/{code}/latest cho tàu đang chạy. */
const ETA_ENRICH_MS = 8000;

/**
 * Live boat positions: SignalR chính + REST poll chậm hơn + dừng khi tab ẩn.
 */
export function useLiveBoatTracking({ enabled = true } = {}) {
  const [boatsById, setBoatsById] = useState(() => loadStickyBoatLocationMap());
  const [connectionMode, setConnectionMode] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const pollTimerRef = useRef(null);
  const etaTimerRef = useRef(null);
  const activeRef = useRef(false);
  const hubLiveRef = useRef(false);
  const inFlightRef = useRef(false);
  const etaInFlightRef = useRef(false);
  const boatsByIdRef = useRef(boatsById);
  boatsByIdRef.current = boatsById;

  const applyLocations = useCallback((locations) => {
    setBoatsById((prev) => {
      let next = prev;
      (locations || []).forEach((loc) => {
        next = upsertBoatLocationMap(next, loc);
      });
      return next === prev ? prev : next;
    });
  }, []);

  /** Hub: apply ngay, không đợi rAF. */
  const applyOneLocation = useCallback((payload) => {
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [payload];
    const locs = items.filter(Boolean);
    if (!locs.length) return;
    setBoatsById((prev) => {
      let next = prev;
      locs.forEach((loc) => {
        next = upsertBoatLocationMap(next, loc);
      });
      return next === prev ? prev : next;
    });
  }, []);

  const loadLatest = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return null;
    if (typeof document !== "undefined" && document.hidden) return null;
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

  /** Lấy ETA/nextStation từ GPS qua endpoint từng tàu (list thường null). */
  const enrichMovingEtaFromGps = useCallback(async () => {
    if (etaInFlightRef.current || !activeRef.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const rows = [...boatsByIdRef.current.values()].filter((b) => {
      if (b?.fromSticky) return false;
      const moving = String(b?.status || "").toLowerCase() === "moving"
        || (Number.isFinite(Number(b?.speed)) && Number(b.speed) >= 1.2);
      if (!moving) return false;
      const code = String(b?.boatCode || "").trim();
      if (!code) return false;
      return true;
    });
    if (!rows.length) return;

    etaInFlightRef.current = true;
    try {
      const results = await Promise.allSettled(
        rows.map((b) => fetchLatestBoatLocation(String(b.boatCode).trim())),
      );
      if (!activeRef.current) return;
      const locs = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);
      if (locs.length) applyLocations(locs);
    } catch (error) {
      console.warn("GPS ETA enrich failed:", error);
    } finally {
      etaInFlightRef.current = false;
    }
  }, [applyLocations]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (etaTimerRef.current) {
      window.clearInterval(etaTimerRef.current);
      etaTimerRef.current = null;
    }
  }, []);

  const resolvePollMs = useCallback(
    () => (hubLiveRef.current ? POLL_WHEN_HUB_LIVE_MS : POLL_WHEN_HUB_DOWN_MS),
    [],
  );

  const startPolling = useCallback((intervalMs) => {
    stopPolling();
    if (typeof document !== "undefined" && document.hidden) return;

    const ms = Number(intervalMs) > 0 ? Number(intervalMs) : resolvePollMs();
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      loadLatest({ silent: true }).catch(() => {
        if (activeRef.current && !hubLiveRef.current) {
          setConnectionMode("offline");
        }
      });
    };
    tick();
    pollTimerRef.current = window.setInterval(tick, ms);
    enrichMovingEtaFromGps();
    etaTimerRef.current = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      enrichMovingEtaFromGps();
    }, ETA_ENRICH_MS);
  }, [loadLatest, stopPolling, enrichMovingEtaFromGps, resolvePollMs]);

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
        startPolling(POLL_WHEN_HUB_LIVE_MS);
      } else if (status === "reconnecting" || status === "offline") {
        hubLiveRef.current = false;
        setConnectionMode("polling");
        startPolling(POLL_WHEN_HUB_DOWN_MS);
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

      // Poll fallback ngay; khi hub live sẽ nới interval lên 5s.
      startPolling(POLL_WHEN_HUB_DOWN_MS);

      try {
        await trackingHub.acquire();
        if (cancelled || !activeRef.current) {
          trackingHub.release();
          return;
        }
        hubLiveRef.current = true;
        setConnectionMode("live");
        startPolling(POLL_WHEN_HUB_LIVE_MS);
      } catch (error) {
        const aborted = error?.name === "AbortError"
          || /stop\(\) was called|cancelled|aborted/i.test(String(error?.message || error));
        if (!aborted) {
          console.warn("Tracking hub unavailable — REST poll only:", error);
        }
        if (!cancelled && activeRef.current) {
          hubLiveRef.current = false;
          setConnectionMode("polling");
          startPolling(POLL_WHEN_HUB_DOWN_MS);
        }
      }
    };

    boot();

    const onFocus = () => {
      if (!activeRef.current) return;
      if (document.hidden) return;
      loadLatest({ silent: true }).catch(() => {});
      startPolling(resolvePollMs());
    };
    const onVisibility = () => {
      if (!activeRef.current) return;
      if (document.visibilityState === "hidden") {
        stopPolling();
        return;
      }
      onFocus();
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
      trackingHub.release();
    };
  }, [enabled, applyOneLocation, loadLatest, startPolling, stopPolling, resolvePollMs]);

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
