import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { useSelector } from "react-redux";
import { isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { useLiveIncidents } from "../../../hooks/useLiveIncidents";
import { fetchActiveBoatsByServiceType, fetchAllBoats } from "../../../services/boatService";
import { fetchAllTrips, filterAttachableTripsForBoat, pickActiveTripForBoat, toDdMmYyyy } from "../../../services/tripService";
import { fetchManagerUsers } from "../../../services/userService";
import {
  assignManagerToIncident,
  closeIncident,
  delayAffectsFollowingTrips,
  DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES,
  dispatchReplacementBoat,
  fetchResolvedIncidents,
  getApiErrorMessage,
  getDispatchReplacementErrorMessage,
  getIncidentTypeLabel,
  getReplacementMissionCopy,
  getSeverityLabel,
  incidentNeedsReplacementBoat,
  incidentShowsReplacementBoatField,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  normalizeReplacementMissionType,
  reportIncident,
  resolveIncidentOnboardCount,
} from "../../../services/incidentService";
import { notify, showToast } from "../../../utils/swalToast";

const pickTripPassengerHint = (trip) => {
  if (!trip || typeof trip !== "object") return null;
  const keys = [
    "onboardPassengerCount", "OnboardPassengerCount",
    "passengerCount", "PassengerCount",
    "activeTicketCount", "ActiveTicketCount",
  ];
  for (const key of keys) {
    const n = Number(trip[key]);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return null;
};

const EMPTY_RESCUE_FORM = {
  incidentId: "",
  incidentBoatId: "",
  incidentBoatCode: "",
  incidentDescription: "",
  tripId: "",
  activeTicketCount: 0,
  onboardPassengerCount: 0,
  futurePassengerCount: 0,
  replacementMissionType: "None",
  replacementTargetStationName: "",
  replacementDelayMinutes: null,
  replacementEstimatedResumeAt: null,
  rescueBoatId: "",
  replacementBoatId: "",
  delayMinutes: 0,
  note: "",
};

const boatServiceType = (boat) => String(boat?.serviceType || boat?.ServiceType || "Passenger");

const formatWhen = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

const severityClass = (severity) => {
  const key = String(severity || "").toLowerCase();
  if (key === "critical" || key === "high") {
    return "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300";
  }
  if (key === "medium") {
    return "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200";
  }
  return "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300";
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

export function IncidentManagement({
  embedded: _embedded = false,
  hideReport = false,
  viewTabs = null,
} = {}) {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const isAdmin = isAdminUser(user);
  const isManager = isManagerUser(user);
  const isStaff = isStaffUser(user);
  // BE RBAC: Admin/Manager/Staff báo sự cố; chỉ Admin gán QL; Admin/Manager điều tàu + đóng.
  const canReport = (isAdmin || isManager || isStaff) && !hideReport;
  const canAssignManager = isAdmin;
  const canDispatchRescue = isAdmin || isManager;
  const canResolveIncident = isAdmin || isManager;
  const {
    incidents,
    connectionMode,
    errorMsg,
    isInitialLoading,
    refresh,
  } = useLiveIncidents({ enabled: true, toast: true });

  const [boats, setBoats] = useState([]);
  const [rescueBoats, setRescueBoats] = useState([]);
  const [passengerBoats, setPassengerBoats] = useState([]);
  const [trips, setTrips] = useState([]);
  const [managers, setManagers] = useState([]);
  const [query, setQuery] = useState("");
  const [listTab, setListTab] = useState("open"); // open | history
  const [historyIncidents, setHistoryIncidents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [busyId, setBusyId] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState({
    boatId: "",
    tripId: "",
    incidentType: "MechanicalFailure",
    severity: "High",
    description: "",
  });
  const [rescueForm, setRescueForm] = useState(EMPTY_RESCUE_FORM);
  const [managerForm, setManagerForm] = useState({
    incidentId: "",
    managerUserId: "",
  });
  const [resolveForm, setResolveForm] = useState({
    incidentId: "",
    boatCode: "",
    resolutionNote: "",
    boatStatus: "UnderMaintenance",
    tripStatus: "",
  });

  useEffect(() => {
    fetchAllBoats()
      .then((data) => setBoats(unwrapList(data)))
      .catch((error) => console.error("Failed to load boats for incidents:", error));

    fetchActiveBoatsByServiceType("Rescue")
      .then((data) => setRescueBoats(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Failed to load rescue boats:", error));

    fetchActiveBoatsByServiceType("Passenger")
      .then((data) => setPassengerBoats(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Failed to load passenger boats:", error));

    fetchAllTrips({
      operatingDate: toDdMmYyyy((() => {
        const now = new Date();
        const pad2 = (n) => String(n).padStart(2, "0");
        return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      })()),
    })
      .then((data) => setTrips(unwrapList(data)))
      .catch((error) => console.error("Failed to load trips for incidents:", error));
  }, []);

  useEffect(() => {
    if (!canAssignManager) return undefined;
    fetchManagerUsers()
      .then((data) => setManagers(Array.isArray(data) ? data : []))
      .catch((error) => console.error("Failed to load managers:", error));
    return undefined;
  }, [canAssignManager]);

  const loadHistory = async ({ silent = false } = {}) => {
    if (!silent) setHistoryLoading(true);
    try {
      const list = await fetchResolvedIncidents();
      setHistoryIncidents(Array.isArray(list) ? list : []);
      setHistoryError("");
      return list;
    } catch (error) {
      console.error("Failed to load incident history:", error);
      setHistoryError(getApiErrorMessage(error) || error?.message || "");
      throw error;
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (listTab !== "history") return undefined;
    loadHistory().catch(() => {});
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi tab lịch sử
  }, [listTab]);

  // Prefetch nhẹ để badge Lịch sử có số.
  useEffect(() => {
    loadHistory({ silent: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const excludeIncidentBoat = (list) => list.filter((boat) => {
    const id = String(boat.boatId || boat.id || "");
    return id && id !== String(rescueForm.incidentBoatId || "");
  });

  const rescueCandidateBoats = useMemo(() => {
    const fromApi = excludeIncidentBoat(rescueBoats);
    if (fromApi.length) return fromApi;
    return excludeIncidentBoat(boats.filter((boat) => {
      const status = String(boat.status || "Active").toLowerCase();
      return status === "active" && boatServiceType(boat).toLowerCase() === "rescue";
    }));
  }, [rescueBoats, boats, rescueForm.incidentBoatId]);

  const replacementCandidateBoats = useMemo(() => {
    const blocked = new Set([
      String(rescueForm.incidentBoatId || ""),
      String(rescueForm.rescueBoatId || ""),
    ].filter(Boolean));

    const filterBlocked = (list) => list.filter((boat) => {
      const id = String(boat.boatId || boat.id || "");
      return id && !blocked.has(id);
    });

    const fromApi = filterBlocked(passengerBoats);
    if (fromApi.length) return fromApi;
    return filterBlocked(boats.filter((boat) => {
      const status = String(boat.status || "Active").toLowerCase();
      return status === "active" && boatServiceType(boat).toLowerCase() !== "rescue";
    }));
  }, [passengerBoats, boats, rescueForm.incidentBoatId, rescueForm.rescueBoatId]);

  const needsReplacementBoat = incidentNeedsReplacementBoat({
    replacementMissionType: rescueForm.replacementMissionType,
    activeTicketCount: rescueForm.activeTicketCount,
    onboardPassengerCount: rescueForm.onboardPassengerCount,
    futurePassengerCount: rescueForm.futurePassengerCount,
  });
  const showReplacementField = incidentShowsReplacementBoatField({
    replacementMissionType: rescueForm.replacementMissionType,
    activeTicketCount: rescueForm.activeTicketCount,
    onboardPassengerCount: rescueForm.onboardPassengerCount,
    futurePassengerCount: rescueForm.futurePassengerCount,
  });
  const missionCopy = getReplacementMissionCopy({
    replacementMissionType: rescueForm.replacementMissionType,
    replacementTargetStationName: rescueForm.replacementTargetStationName,
    activeTicketCount: rescueForm.activeTicketCount,
    onboardPassengerCount: rescueForm.onboardPassengerCount,
    futurePassengerCount: rescueForm.futurePassengerCount,
  }, lang);
  const delaySpreads = delayAffectsFollowingTrips(rescueForm.delayMinutes);

  const selectedBoat = useMemo(
    () => boats.find((boat) => String(boat.boatId || boat.id) === String(reportForm.boatId)) || null,
    [boats, reportForm.boatId],
  );

  const boatById = useMemo(() => {
    const map = new Map();
    boats.forEach((boat) => {
      const id = String(boat.boatId || boat.id || "");
      if (id) map.set(id, boat);
    });
    return map;
  }, [boats]);

  const enrichedIncidents = useMemo(
    () => incidents.map((incident) => {
      const boat = boatById.get(String(incident.boatId || ""));
      if (!boat) return incident;
      return {
        ...incident,
        boatCode: incident.boatCode || boat.boatCode || boat.code || "",
        boatName: incident.boatName || boat.boatName || boat.name || "",
      };
    }),
    [incidents, boatById],
  );

  const enrichedHistory = useMemo(
    () => historyIncidents.map((incident) => {
      const boat = boatById.get(String(incident.boatId || ""));
      if (!boat) return incident;
      return {
        ...incident,
        boatCode: incident.boatCode || boat.boatCode || boat.code || "",
        boatName: incident.boatName || boat.boatName || boat.name || "",
      };
    }),
    [historyIncidents, boatById],
  );

  const tripsForSelectedBoat = useMemo(
    () => filterAttachableTripsForBoat(trips, selectedBoat),
    [trips, selectedBoat],
  );

  // Chọn tàu → tự gắn chuyến đang chạy / sắp chạy trong ngày (nếu có).
  useEffect(() => {
    if (!reportForm.boatId || !selectedBoat) return;
    if (reportForm.tripId) return;
    const best = pickActiveTripForBoat(trips, selectedBoat);
    if (!best?.tripId) return;
    setReportForm((prev) => (
      prev.boatId === reportForm.boatId && !prev.tripId
        ? { ...prev, tripId: best.tripId }
        : prev
    ));
  }, [reportForm.boatId, reportForm.tripId, selectedBoat, trips]);

  const filtered = useMemo(() => {
    const source = listTab === "history" ? enrichedHistory : enrichedIncidents;
    const q = query.trim().toLowerCase();
    const matched = !q
      ? source
      : source.filter((item) =>
        String(item.boatCode || "").toLowerCase().includes(q)
        || String(item.description || "").toLowerCase().includes(q)
        || String(item.incidentType || "").toLowerCase().includes(q)
        || String(item.managerName || "").toLowerCase().includes(q)
        || String(item.rescueBoatCode || "").toLowerCase().includes(q)
        || String(item.rescueBoatName || "").toLowerCase().includes(q)
        || String(item.resolutionNote || "").toLowerCase().includes(q),
      );

    if (listTab !== "history") return matched;
    return [...matched].sort((a, b) => {
      const ta = Date.parse(String(a.resolvedAt || a.occurredAt || 0)) || 0;
      const tb = Date.parse(String(b.resolvedAt || b.occurredAt || 0)) || 0;
      return tb - ta;
    });
  }, [enrichedIncidents, enrichedHistory, listTab, query]);

  const stats = useMemo(() => {
    const open = enrichedIncidents.length;
    const high = enrichedIncidents.filter((item) => {
      const s = String(item.severity || "").toLowerCase();
      return s === "high" || s === "critical";
    }).length;
    const rescued = enrichedIncidents.filter((item) =>
      item.rescueBoatId || item.rescueBoatCode || item.rescueBoatName,
    ).length;
    const unassigned = enrichedIncidents.filter((item) => !item.managerName && !item.managerUserId).length;
    return { open, high, rescued, unassigned, history: enrichedHistory.length };
  }, [enrichedIncidents, enrichedHistory]);

  const handleReport = async (event) => {
    event.preventDefault();
    if (!reportForm.boatId) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn tàu" : "Select boat",
        text: lang === "VN" ? "boatId là bắt buộc." : "boatId is required.",
      });
      return;
    }
    setBusyId("report");
    try {
      const boat = boats.find((item) => String(item.boatId || item.id) === String(reportForm.boatId));
      const best = pickActiveTripForBoat(trips, boat);
      const tripId = reportForm.tripId || best?.tripId || null;
      await reportIncident({
        boatId: reportForm.boatId,
        tripId,
        incidentType: reportForm.incidentType,
        severity: reportForm.severity,
        description: reportForm.description.trim(),
        occurredAt: new Date().toISOString(),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã báo sự cố" : "Incident reported",
        text: tripId
          ? (lang === "VN" ? `Đã gắn chuyến ${best?.tripCode || tripId}` : `Linked trip ${best?.tripCode || tripId}`)
          : undefined,
      });
      setShowReport(false);
      setReportForm({
        boatId: "",
        tripId: "",
        incidentType: "MechanicalFailure",
        severity: "High",
        description: "",
      });
      await refresh();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Báo sự cố thất bại" : "Report failed",
        text: getApiErrorMessage(error),
      });
    } finally {
      setBusyId("");
    }
  };

  const handleAssignManager = async (event) => {
    event.preventDefault();
    if (!managerForm.incidentId || !managerForm.managerUserId) return;
    setBusyId(managerForm.incidentId);
    try {
      await assignManagerToIncident(managerForm.incidentId, managerForm.managerUserId);
      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã gán Manager" : "Manager assigned",
      });
      setManagerForm({ incidentId: "", managerUserId: "" });
      await refresh();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Gán Manager thất bại" : "Assign manager failed",
        text: getApiErrorMessage(error),
      });
    } finally {
      setBusyId("");
    }
  };

  const handleRescue = async (event) => {
    event.preventDefault();
    if (!rescueForm.incidentId) return;

    if (!rescueForm.rescueBoatId) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn tàu cứu hộ" : "Select rescue boat",
        text: lang === "VN" ? "rescueBoatId là bắt buộc." : "rescueBoatId is required.",
      });
      return;
    }

    if (needsReplacementBoat && !rescueForm.replacementBoatId) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn tàu thay thế" : "Select replacement boat",
        text: lang === "VN"
          ? "Sự cố có chuyến (tripId) — bắt buộc chọn tàu Passenger thay thế."
          : "Incident has a trip — replacement passenger boat is required.",
      });
      return;
    }

    if (
      rescueForm.rescueBoatId
      && rescueForm.replacementBoatId
      && String(rescueForm.rescueBoatId) === String(rescueForm.replacementBoatId)
    ) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Tàu trùng nhau" : "Duplicate boats",
        text: lang === "VN"
          ? "Tàu thay thế không được trùng tàu cứu hộ."
          : "Replacement boat cannot be the same as the rescue boat.",
      });
      return;
    }

    if (
      rescueForm.rescueBoatId
      && String(rescueForm.rescueBoatId) === String(rescueForm.incidentBoatId || "")
    ) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Tàu không hợp lệ" : "Invalid boat",
        text: lang === "VN"
          ? "Tàu cứu hộ không được trùng tàu sự cố."
          : "Rescue boat cannot be the incident boat.",
      });
      return;
    }

    setBusyId(rescueForm.incidentId);
    try {
      const delayRaw = Number(rescueForm.delayMinutes);
      await dispatchReplacementBoat(rescueForm.incidentId, {
        rescueBoatId: rescueForm.rescueBoatId,
        replacementBoatId: (needsReplacementBoat || rescueForm.replacementBoatId)
          ? (rescueForm.replacementBoatId || null)
          : null,
        delayMinutes: (needsReplacementBoat || rescueForm.replacementBoatId)
          ? (Number.isFinite(delayRaw) ? Math.trunc(delayRaw) : 30)
          : 0,
        note: rescueForm.note.trim() || (needsReplacementBoat
          ? (lang === "VN" ? "Điều tàu thay thế" : "Dispatch replacement boat")
          : (lang === "VN" ? "Điều tàu cứu hộ kéo tàu lỗi về" : "Dispatch rescue to tow broken boat")),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã điều tàu cứu hộ" : "Rescue boat assigned",
      });
      setRescueForm(EMPTY_RESCUE_FORM);
      // Refetch theo spec BE: incident + schedule (+ boats); Live Tracking tự poll GPS.
      const day = toDdMmYyyy(new Date());
      const opsDay = toOperationsScheduleDate();
      await Promise.all([
        refresh(),
        fetchResolvedIncidents().then((list) => setHistoryIncidents(Array.isArray(list) ? list : [])).catch(() => {}),
        fetchAllBoats().then((data) => setBoats(unwrapList(data))).catch(() => {}),
        fetchAllTrips({ fromDate: day, toDate: day }).then((data) => setTrips(unwrapList(data))).catch(() => {}),
        fetchOperationsSchedule({ fromDate: opsDay, toDate: opsDay }).catch(() => {}),
      ]);
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Điều tàu thất bại" : "Dispatch failed",
        text: getDispatchReplacementErrorMessage(error, lang),
      });
    } finally {
      setBusyId("");
    }
  };

  const handleResolve = async (event) => {
    event.preventDefault();
    if (!resolveForm.incidentId || !resolveForm.resolutionNote.trim()) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Thiếu ghi chú" : "Note required",
        text: lang === "VN" ? "resolutionNote là bắt buộc." : "resolutionNote is required.",
      });
      return;
    }
    setBusyId(resolveForm.incidentId);
    try {
      // Backup khi GPS chưa gọi rescue-mission-completed.
      // BE: boat → UnderMaintenance, tripStatus null (không bắt buộc đổi trip).
      await closeIncident(resolveForm.incidentId, {
        resolutionNote: resolveForm.resolutionNote.trim(),
        boatStatus: resolveForm.boatStatus || "UnderMaintenance",
        tripStatus: resolveForm.tripStatus ? resolveForm.tripStatus : null,
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã đóng sự cố" : "Incident resolved",
      });
      setResolveForm({
        incidentId: "",
        boatCode: "",
        resolutionNote: "",
        boatStatus: "UnderMaintenance",
        tripStatus: "",
      });
      await refresh();
      if (listTab === "history") {
        await loadHistory({ silent: true }).catch(() => {});
      } else {
        // Prefetch history so count/tab sẵn sàng sau khi đóng.
        loadHistory({ silent: true }).catch(() => {});
      }
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Đóng sự cố thất bại" : "Resolve failed",
        text: getApiErrorMessage(error),
      });
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-6 font-body animate-fade-in pb-10 px-2 sm:px-0">
      <div className="flex flex-col items-start justify-between gap-4 rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-headline text-xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 md:text-2xl">
            {lang === "VN" ? "Sự cố / Cứu hộ" : "Incidents / Rescue"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {lang === "VN"
              ? (hideReport
                ? "Đang mở · lịch sử cứu hộ · điều cứu · đóng. Báo sự cố trên Bản đồ."
                : "Đang mở · lịch sử cứu hộ · điều cứu · đóng sự cố.")
              : (hideReport
                ? "Open · rescue history · dispatch · resolve. Report on the Live map."
                : "Open · rescue history · dispatch · resolve.")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {viewTabs}
          {canReport ? (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-3 text-xs font-headline font-black uppercase tracking-widest text-slate-900 shadow-md transition hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-sm font-bold" aria-hidden>report</span>
              {lang === "VN" ? "Báo sự cố" : "Report"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="inline-flex rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => {
            setListTab("open");
            setExpandedIds(new Set());
          }}
          className={`rounded-xl px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider transition ${
            listTab === "open"
              ? "bg-white text-[#124757] shadow-sm dark:bg-slate-800 dark:text-yellow-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          {lang === "VN" ? `Đang mở (${stats.open})` : `Open (${stats.open})`}
        </button>
        <button
          type="button"
          onClick={() => {
            setListTab("history");
            setExpandedIds(new Set());
          }}
          className={`rounded-xl px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider transition ${
            listTab === "history"
              ? "bg-white text-[#124757] shadow-sm dark:bg-slate-800 dark:text-yellow-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          {lang === "VN" ? `Lịch sử (${stats.history})` : `History (${stats.history})`}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: lang === "VN" ? "Đang mở" : "Open", value: stats.open, icon: "emergency" },
          { label: lang === "VN" ? "Cao / Nghiêm trọng" : "High / Critical", value: stats.high, icon: "priority_high" },
          { label: lang === "VN" ? "Đã điều cứu" : "Rescue assigned", value: stats.rescued, icon: "directions_boat" },
          { label: lang === "VN" ? "Chưa gán QL" : "No manager", value: stats.unassigned, icon: "person_off" },
        ].map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[#124757] dark:border-slate-700 dark:bg-slate-900 dark:text-yellow-400">
              <span className="material-symbols-outlined text-2xl">{card.icon}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {card.label}
              </span>
              <h3 className="mt-0.5 font-headline text-xl font-black text-[#124757] dark:text-white">
                {card.value}
              </h3>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-3.5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-4">
        <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 focus-within:ring-[#124757]/35 dark:bg-slate-900 dark:ring-slate-700">
          <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden>search</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={lang === "VN" ? "Tìm mã tàu / mô tả…" : "Search boat / description…"}
            className="w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
        </label>
        {listTab === "history" && historyError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {historyError}
          </div>
        ) : null}
        {listTab === "open" && errorMsg ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {errorMsg}
          </div>
        ) : null}
        {listTab === "history" ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => loadHistory().catch(() => {})}
              disabled={historyLoading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden>refresh</span>
              {lang === "VN" ? "Tải lại lịch sử" : "Refresh history"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        {(listTab === "open" ? isInitialLoading : historyLoading) ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm font-medium text-slate-400">
            {listTab === "history"
              ? (lang === "VN" ? "Chưa có lịch sử cứu hộ / sự cố đã đóng." : "No rescue / resolved incident history yet.")
              : (lang === "VN" ? "Không có sự cố đang Open." : "No open incidents.")}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {filtered.map((item) => {
              const id = String(item.incidentId || "");
              const open = expandedIds.has(id);
              const rescueLabel = item.rescueBoatName || item.rescueBoatCode
                || (item.rescueBoatId ? String(item.rescueBoatId).slice(0, 8) : "");
              const replaceLabel = item.replacementBoatName || item.replacementBoatCode
                || (item.replacementBoatId ? String(item.replacementBoatId).slice(0, 8) : "");
              const whenLabel = listTab === "history"
                ? formatWhen(item.resolvedAt || item.occurredAt)
                : formatWhen(item.occurredAt);

              const toggleExpand = () => {
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              };

              const openRescueModal = () => {
                const ticketCount = Number(item.activeTicketCount) || 0;
                const tripHint = item.tripId
                  ? pickTripPassengerHint(
                    trips.find((t) => String(t.tripId || t.id) === String(item.tripId)),
                  )
                  : null;
                const onboardCount = Math.max(
                  resolveIncidentOnboardCount(item),
                  tripHint || 0,
                );
                const enriched = {
                  ...item,
                  onboardPassengerCount: onboardCount,
                  activeTicketCount: Math.max(ticketCount, tripHint || 0),
                };
                const mission = normalizeReplacementMissionType(item.replacementMissionType);
                const needsReplace = incidentNeedsReplacementBoat(enriched);
                const suggestedDelay = Number.isFinite(Number(item.replacementDelayMinutes))
                  ? Number(item.replacementDelayMinutes)
                  : (needsReplace ? 30 : 0);
                setRescueForm({
                  incidentId: item.incidentId,
                  incidentBoatId: item.boatId || "",
                  incidentBoatCode: item.boatCode || "",
                  incidentDescription: item.description || "",
                  tripId: item.tripId || "",
                  activeTicketCount: enriched.activeTicketCount,
                  onboardPassengerCount: onboardCount,
                  futurePassengerCount: Number(item.futurePassengerCount) || 0,
                  replacementMissionType: mission,
                  replacementTargetStationName: item.replacementTargetStationName || "",
                  replacementDelayMinutes: item.replacementDelayMinutes ?? null,
                  replacementEstimatedResumeAt: item.replacementEstimatedResumeAt || null,
                  rescueBoatId: "",
                  replacementBoatId: "",
                  delayMinutes: suggestedDelay,
                  note: lang === "VN"
                    ? (needsReplace
                      ? `Điều tàu cứu hộ và tàu thay thế cho ${item.boatCode || ""}`
                      : `Điều tàu cứu hộ cho ${item.boatCode || ""}`)
                    : (needsReplace
                      ? `Dispatch rescue and replacement for ${item.boatCode || ""}`
                      : `Dispatch rescue for ${item.boatCode || ""}`),
                });
                fetchActiveBoatsByServiceType("Rescue")
                  .then((data) => setRescueBoats(Array.isArray(data) ? data : []))
                  .catch(() => {});
                if (needsReplace || incidentShowsReplacementBoatField(enriched)) {
                  fetchActiveBoatsByServiceType("Passenger")
                    .then((data) => setPassengerBoats(Array.isArray(data) ? data : []))
                    .catch(() => {});
                }
              };

              return (
                <div key={id} className="bg-white dark:bg-slate-800">
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={toggleExpand}
                      aria-expanded={open}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                      title={open
                        ? (lang === "VN" ? "Thu gọn" : "Collapse")
                        : (lang === "VN" ? "Xem chi tiết" : "Show details")}
                    >
                      <span className={`material-symbols-outlined text-[20px] transition-transform ${open ? "rotate-90" : ""}`}>
                        chevron_right
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 dark:text-white">
                          {item.boatCode || "—"}
                        </p>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {getIncidentTypeLabel(item.incidentType, lang)}
                        </span>
                        <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wider ring-1 ${severityClass(item.severity)}`}>
                          {getSeverityLabel(item.severity, lang)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">
                        {item.description || "—"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {listTab === "history"
                          ? (lang === "VN" ? "Đóng lúc" : "Resolved")
                          : (lang === "VN" ? "Thời điểm" : "When")}
                      </p>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {whenLabel}
                      </p>
                    </div>

                    {listTab === "open" ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {canAssignManager ? (
                          <button
                            type="button"
                            disabled={busyId === item.incidentId}
                            onClick={() => setManagerForm({
                              incidentId: item.incidentId,
                              managerUserId: item.managerUserId || "",
                            })}
                            className="rounded-xl bg-violet-50 px-2.5 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-violet-700 ring-1 ring-violet-200 transition hover:bg-violet-100 disabled:opacity-50 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30"
                          >
                            {lang === "VN" ? "Gán QL" : "Manager"}
                          </button>
                        ) : null}
                        {canDispatchRescue ? (
                          <button
                            type="button"
                            disabled={busyId === item.incidentId}
                            onClick={openRescueModal}
                            className="rounded-xl bg-sky-50 px-2.5 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-sky-700 ring-1 ring-sky-200 transition hover:bg-sky-100 disabled:opacity-50 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30"
                          >
                            {lang === "VN" ? "Cứu hộ" : "Rescue"}
                          </button>
                        ) : null}
                        {canResolveIncident ? (
                          <button
                            type="button"
                            disabled={busyId === item.incidentId}
                            onClick={() => setResolveForm({
                              incidentId: item.incidentId,
                              boatCode: item.boatCode || "",
                              resolutionNote: lang === "VN"
                                ? "Tàu đã được kéo về bến và chuyển sang bảo trì."
                                : "Boat towed to dock and moved to maintenance.",
                              boatStatus: "UnderMaintenance",
                              tripStatus: "",
                            })}
                            className="rounded-xl bg-emerald-50 px-2.5 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                          >
                            {lang === "VN" ? "Đóng" : "Resolve"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {open ? (
                    <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900/40">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {lang === "VN" ? "Chuyến" : "Trip"}
                          </p>
                          <p className="mt-1 break-all text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {item.tripCode || (item.tripId ? String(item.tripId) : "—")}
                          </p>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {lang === "VN" ? "Cứu hộ" : "Rescue"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {rescueLabel || "—"}
                          </p>
                          {item.rescueDispatchedAt ? (
                            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                              {formatWhen(item.rescueDispatchedAt)}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {lang === "VN" ? "Thay thế" : "Replacement"}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {replaceLabel || "—"}
                          </p>
                          {item.replacementEstimatedResumeAt ? (
                            <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                              ETA {formatWhen(item.replacementEstimatedResumeAt)}
                              {Number.isFinite(Number(item.replacementDelayMinutes))
                                ? ` · ${item.replacementDelayMinutes}p`
                                : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Manager
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {item.managerName || (item.managerUserId ? String(item.managerUserId).slice(0, 8) : "—")}
                          </p>
                        </div>
                        {listTab === "open" ? (
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {lang === "VN" ? "Khách ảnh hưởng" : "Passengers"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {(lang === "VN" ? "Vé" : "Tickets")}: {item.activeTicketCount ?? 0}
                              {" · "}
                              {(lang === "VN" ? "Trên tàu" : "Onboard")}: {resolveIncidentOnboardCount(item)}
                              {" · "}
                              {(lang === "VN" ? "Chặng sau" : "Later")}: {item.futurePassengerCount ?? 0}
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              {lang === "VN" ? "Ghi chú đóng" : "Resolution note"}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {item.resolutionNote || "—"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleReport}
            className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800"
          >
            <h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Báo sự cố tàu" : "Report boat incident"}
            </h2>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Boat *</span>
              <select
                required
                value={reportForm.boatId}
                onChange={(e) => {
                  const boatId = e.target.value;
                  const boat = boats.find((item) => String(item.boatId || item.id) === String(boatId));
                  const best = pickActiveTripForBoat(trips, boat);
                  setReportForm((prev) => ({
                    ...prev,
                    boatId,
                    tripId: best?.tripId || "",
                  }));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#124757]/30 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">{lang === "VN" ? "Chọn tàu" : "Select boat"}</option>
                {boats
                  .filter((boat) => boatServiceType(boat).toLowerCase() !== "rescue")
                  .map((boat) => (
                  <option key={boat.boatId || boat.id} value={boat.boatId || boat.id}>
                    {boat.boatCode || boat.code} · {boat.boatName || boat.name || ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Chuyến (tuỳ chọn)" : "Trip (optional)"}
              </span>
              <select
                value={reportForm.tripId}
                disabled={!reportForm.boatId}
                onChange={(e) => setReportForm((prev) => ({ ...prev, tripId: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">
                  {lang === "VN" ? "Không gắn chuyến" : "No trip"}
                </option>
                {tripsForSelectedBoat.map((trip) => (
                  <option key={trip.tripId || trip.id} value={trip.tripId || trip.id}>
                    {trip.tripCode || trip.tripId}
                    {(trip.tripStatus || trip.status) ? ` · ${trip.tripStatus || trip.status}` : ""}
                  </option>
                ))}
              </select>
              {reportForm.boatId && tripsForSelectedBoat.length === 0 ? (
                <p className="text-[11px] font-medium text-slate-400">
                  {lang === "VN"
                    ? "Không có chuyến đang chạy — vẫn báo và điều cứu hộ được."
                    : "No active trip — you can still report and dispatch rescue."}
                </p>
              ) : null}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Type</span>
                <select
                  value={reportForm.incidentType}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, incidentType: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  {INCIDENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {lang === "VN" ? item.labelVn : item.labelEn}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Severity</span>
                <select
                  value={reportForm.severity}
                  onChange={(e) => setReportForm((prev) => ({ ...prev, severity: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  {INCIDENT_SEVERITIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {lang === "VN" ? item.labelVn : item.labelEn}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Mô tả" : "Description"}
              </span>
              <textarea
                required
                rows={3}
                value={reportForm.description}
                onChange={(e) => setReportForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <p className="text-[11px] font-medium text-slate-400">
              {lang === "VN"
                ? "Người báo cáo = tài khoản đang đăng nhập (reportedBy)."
                : "Reporter = currently signed-in user (reportedBy)."}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowReport(false)}
                className="rounded-2xl px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={busyId === "report"}
                className="rounded-2xl bg-rose-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50"
              >
                {lang === "VN" ? "Gửi báo cáo" : "Submit"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {managerForm.incidentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleAssignManager}
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800"
          >
            <h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Gán Manager xử lý" : "Assign manager"}
            </h2>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Manager</span>
              <select
                required
                value={managerForm.managerUserId}
                onChange={(e) => setManagerForm((prev) => ({ ...prev, managerUserId: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">{lang === "VN" ? "Chọn Manager" : "Select manager"}</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName || manager.email || manager.id}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setManagerForm({ incidentId: "", managerUserId: "" })}
                className="rounded-2xl px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-violet-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:brightness-110"
              >
                {lang === "VN" ? "Gán" : "Assign"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {rescueForm.incidentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRescue}
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800"
          >
            <h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Điều tàu cứu hộ" : "Assign rescue boat"}
            </h2>
            <p className="text-[11px] font-medium text-slate-500">
              {rescueForm.incidentBoatCode || "—"}
              {" · "}
              {lang === "VN" ? "Vé active" : "Active tickets"}: {rescueForm.activeTicketCount}
              {" · "}
              {lang === "VN" ? "Trên tàu" : "Onboard"}: {resolveIncidentOnboardCount(rescueForm)}
              {" · "}
              {lang === "VN" ? "Chặng sau" : "Future"}: {rescueForm.futurePassengerCount}
            </p>
            <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-200 dark:ring-slate-700">
              <span className="block text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 mb-1">
                {normalizeReplacementMissionType(rescueForm.replacementMissionType)}
              </span>
              {missionCopy}
            </p>
            {normalizeReplacementMissionType(rescueForm.replacementMissionType) === "PassengerRecoveryRequired" ? (
              <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30">
                {lang === "VN"
                  ? "BE thiếu dữ liệu chặng khách — kiểm tra thủ công trước khi chọn tàu thay thế."
                  : "BE lacks passenger segment data — verify manually before choosing a replacement boat."}
              </p>
            ) : null}
            {!rescueForm.tripId ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:ring-slate-700">
                {lang === "VN"
                  ? "Chưa gắn chuyến · Chỉ là sự cố tàu — điều tàu cứu hộ kéo về, không cần tàu thay thế."
                  : "No trip · Boat-only incident — dispatch rescue to tow; no replacement needed."}
              </p>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Tàu cứu hộ (kéo) *" : "Rescue boat *"}
              </span>
              <select
                required
                value={rescueForm.rescueBoatId}
                onChange={(e) => {
                  const nextRescueId = e.target.value;
                  setRescueForm((prev) => ({
                    ...prev,
                    rescueBoatId: nextRescueId,
                    replacementBoatId: String(prev.replacementBoatId) === String(nextRescueId)
                      ? ""
                      : prev.replacementBoatId,
                  }));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="">{lang === "VN" ? "Chọn tàu Rescue" : "Select Rescue boat"}</option>
                {rescueCandidateBoats.map((boat) => (
                  <option key={boat.boatId || boat.id} value={boat.boatId || boat.id}>
                    {boat.boatCode || boat.code} · {boat.boatName || boat.name || ""}
                  </option>
                ))}
              </select>
              {rescueCandidateBoats.length === 0 ? (
                <p className="text-[11px] font-medium text-amber-600">
                  {lang === "VN"
                    ? "Chưa có tàu Active + serviceType=Rescue."
                    : "No Active Rescue boats available."}
                </p>
              ) : null}
            </label>
            {showReplacementField ? (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {needsReplacementBoat
                    ? (lang === "VN" ? "Tàu thay thế (chở khách) *" : "Replacement passenger boat *")
                    : (lang === "VN" ? "Tàu thay thế (tuỳ chọn)" : "Replacement boat (optional)")}
                </span>
                <select
                  required={needsReplacementBoat}
                  value={rescueForm.replacementBoatId}
                  onChange={(e) => setRescueForm((prev) => ({ ...prev, replacementBoatId: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="">{lang === "VN" ? "Chọn tàu Passenger" : "Select Passenger boat"}</option>
                  {replacementCandidateBoats.map((boat) => (
                    <option key={boat.boatId || boat.id} value={boat.boatId || boat.id}>
                      {boat.boatCode || boat.code} · {boat.boatName || boat.name || ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:ring-slate-700">
                {lang === "VN"
                  ? "Mission None — chỉ điều tàu cứu hộ (replacementBoatId = null)."
                  : "Mission None — rescue only (replacementBoatId = null)."}
              </p>
            )}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Delay (phút) — Manager nhập" : "Delay (min) — Manager input"}
              </span>
              <input
                type="number"
                min={0}
                disabled={!showReplacementField}
                value={rescueForm.delayMinutes}
                onChange={(e) => setRescueForm((prev) => ({ ...prev, delayMinutes: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
              />
              {showReplacementField ? (
                <p className="text-[11px] font-medium text-slate-400">
                  {delaySpreads
                    ? (lang === "VN"
                      ? `≥ ${DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES} phút: ảnh hưởng chuyến hiện tại + các chuyến sau cùng tàu/tuyến trong ngày (xem operations/schedule).`
                      : `≥ ${DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES} min: affects current + later same-boat/route trips today (see operations/schedule).`)
                    : (lang === "VN"
                      ? `< ${DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES} phút: chỉ ảnh hưởng chuyến hiện tại.`
                      : `< ${DELAY_AFFECTS_FOLLOWING_TRIPS_MINUTES} min: only the current trip is affected.`)}
                </p>
              ) : null}
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Note</span>
              <textarea
                rows={2}
                value={rescueForm.note}
                onChange={(e) => setRescueForm((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescueForm(EMPTY_RESCUE_FORM)}
                className="rounded-2xl px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={
                  !rescueForm.rescueBoatId
                  || (needsReplacementBoat && !rescueForm.replacementBoatId)
                }
                className="rounded-2xl bg-sky-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50"
              >
                {lang === "VN" ? "Điều tàu" : "Dispatch"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {resolveForm.incidentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleResolve}
            className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800"
          >
            <h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Đóng sự cố" : "Resolve incident"}
            </h2>
            <p className="rounded-2xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:ring-slate-700">
              {lang === "VN"
                ? "Dùng khi GPS chưa báo hoàn tất kéo cứu. Luồng chuẩn: GPS kéo về bến xong thì sự cố tự đóng và tàu chuyển sang bảo trì."
                : "Use if GPS has not reported tow completion. Main flow: after GPS finishes towing to dock, the incident closes and the boat moves to maintenance."}
            </p>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Ghi chú xử lý *" : "Resolution note *"}
              </span>
              <textarea
                required
                rows={3}
                value={resolveForm.resolutionNote}
                onChange={(e) => setResolveForm((prev) => ({ ...prev, resolutionNote: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Boat status</span>
                <select
                  value={resolveForm.boatStatus}
                  onChange={(e) => setResolveForm((prev) => ({ ...prev, boatStatus: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="UnderMaintenance">UnderMaintenance</option>
                  <option value="Incident">Incident</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Trip status</span>
                <select
                  value={resolveForm.tripStatus}
                  onChange={(e) => setResolveForm((prev) => ({ ...prev, tripStatus: e.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="">{lang === "VN" ? "Để trống (mặc định hệ thống)" : "Leave empty (system default)"}</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveForm((prev) => ({ ...prev, incidentId: "", boatCode: "" }))}
                className="rounded-2xl px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:brightness-110"
              >
                {lang === "VN" ? "Xác nhận đóng" : "Confirm resolve"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
