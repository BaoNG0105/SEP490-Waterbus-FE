import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchOpenIncidents, normalizeIncident } from "../services/incidentService";
import { incidentHub } from "../services/incidentHubClient";
import { showToast } from "../utils/swalToast";

/**
 * Open incidents: REST initial → SignalR IncidentUpdated / RescueDispatched → refetch.
 */
export function useLiveIncidents({ enabled = true, toast = true } = {}) {
  const [incidents, setIncidents] = useState([]);
  const [connectionMode, setConnectionMode] = useState("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const activeRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  const loadOpen = useCallback(async ({ silent = false, announceNew = false } = {}) => {
    try {
      const list = (await fetchOpenIncidents()).filter((item) => {
        const status = String(item.resolutionStatus || "Open").toLowerCase();
        return status === "open";
      });
      if (!activeRef.current) return list;

      if (announceNew && toast) {
        const prev = knownIdsRef.current;
        list.forEach((item) => {
          if (!prev.has(item.incidentId)) {
            showToast({
              icon: "warning",
              title: "Sự cố mới",
              text: `${item.boatCode || "Tàu"} · ${item.incidentType || "Incident"}`,
              timer: 4500,
            });
          }
        });
      }

      knownIdsRef.current = new Set(list.map((item) => item.incidentId));
      // BE GET Open = nguồn sự thật. Không giữ rescue* cũ (tránh SOS còn “cứu WB_001” sau khi đã xong).
      setIncidents(list);
      if (!silent) setErrorMsg("");
      return list;
    } catch (error) {
      console.error("Failed to load open incidents:", error);
      if (!silent && activeRef.current) {
        setErrorMsg(error?.response?.data?.message || error?.message || "Failed to load incidents.");
      }
      throw error;
    }
  }, [toast]);

  const upsertOne = useCallback((payload) => {
    const normalized = normalizeIncident(payload);
    if (!normalized) {
      loadOpen({ silent: true, announceNew: true }).catch(() => {});
      return;
    }

    setIncidents((prev) => {
      const open = String(normalized.resolutionStatus || "Open").toLowerCase() === "open";
      const without = prev.filter((item) => item.incidentId !== normalized.incidentId);
      if (!open) {
        if (toast && prev.some((item) => item.incidentId === normalized.incidentId)) {
          showToast({
            icon: "success",
            title: "Sự cố đã đóng",
            text: `${normalized.boatCode || "Tàu"} · Resolved (GPS/BE)`,
            timer: 4000,
          });
        }
        knownIdsRef.current.delete(normalized.incidentId);
        return without;
      }
      const isNew = !prev.some((item) => item.incidentId === normalized.incidentId);
      if (isNew && toast) {
        showToast({
          icon: "warning",
          title: "Sự cố cập nhật",
          text: `${normalized.boatCode || "Tàu"} · ${normalized.incidentType || "Incident"}`,
          timer: 4500,
        });
      }
      knownIdsRef.current.add(normalized.incidentId);
      return [normalized, ...without];
    });
  }, [loadOpen, toast]);

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false;
      setConnectionMode("offline");
      return undefined;
    }

    activeRef.current = true;
    let cancelled = false;

    const unsubUpdated = incidentHub.subscribeIncidentUpdated((payload) => {
      if (!activeRef.current) return;
      upsertOne(payload);
      // BE có thể chỉ gửi id — refetch để chắc.
      loadOpen({ silent: true, announceNew: false }).catch(() => {});
    });

    const unsubRescue = incidentHub.subscribeRescueDispatched((payload) => {
      if (!activeRef.current) return;
      if (toast) {
        const rescue = payload?.rescueBoatCode || payload?.RescueBoatCode || "";
        const boat = payload?.boatCode || payload?.BoatCode || "";
        showToast({
          icon: "info",
          title: "Đã điều tàu cứu hộ",
          text: [boat && `SC: ${boat}`, rescue && `Cứu: ${rescue}`].filter(Boolean).join(" · ") || "Rescue dispatched",
          timer: 4000,
        });
      }
      // Không optimistic ghi Open giả — chờ GET Open (tránh SOS dính nhiệm vụ cũ).
      loadOpen({ silent: true }).catch(() => {});
    });

    const unsubStatus = incidentHub.subscribeStatus((status) => {
      if (!activeRef.current) return;
      if (status === "live") setConnectionMode("live");
      else if (status === "offline" || status === "reconnecting") setConnectionMode("polling");
    });

    const boot = async () => {
      setIsInitialLoading(true);
      setConnectionMode("loading");
      try {
        await loadOpen({ silent: false });
      } catch {
        if (!cancelled) setConnectionMode("offline");
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }

      if (cancelled || !activeRef.current) return;

      try {
        await incidentHub.acquire();
        if (cancelled || !activeRef.current) {
          incidentHub.release();
          return;
        }
        if (!cancelled && activeRef.current) setConnectionMode("live");
      } catch (error) {
        const aborted = error?.name === "AbortError"
          || /stop\(\) was called|cancelled|aborted/i.test(String(error?.message || error));
        if (!aborted) {
          console.warn("Incidents hub unavailable — REST only:", error);
        }
        if (!cancelled && activeRef.current) setConnectionMode("polling");
      }
    };

    boot();

    const poll = window.setInterval(() => {
      if (!activeRef.current) return;
      loadOpen({ silent: true, announceNew: true }).catch(() => {});
    }, 8000);

    return () => {
      cancelled = true;
      activeRef.current = false;
      unsubUpdated();
      unsubRescue();
      unsubStatus();
      window.clearInterval(poll);
      incidentHub.release();
    };
  }, [enabled, loadOpen, upsertOne, toast]);

  const openBoatIds = useMemo(() => {
    const ids = new Set();
    incidents.forEach((item) => {
      if (item.boatId) ids.add(String(item.boatId));
      if (item.boatCode) ids.add(String(item.boatCode));
    });
    return ids;
  }, [incidents]);

  return {
    incidents,
    openBoatIds,
    connectionMode,
    errorMsg,
    isInitialLoading,
    refresh: () => loadOpen({ silent: false }),
  };
}
