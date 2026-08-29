import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Info, LifeBuoy, X } from "lucide-react";
import { useApp } from "../../../context/AppContext";
import { FormSelect } from "../../../components/FormSelect";
import { useSelector } from "react-redux";
import { isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { useLiveIncidents } from "../../../hooks/useLiveIncidents";
import { RequiredStar } from "../../../utils/requiredStar";
import { fetchActiveBoatsByServiceType, fetchAllBoats } from "../../../services/boatService";
import { fetchAllTrips, filterAttachableTripsForBoat, pickActiveTripForBoat, toDdMmYyyy } from "../../../services/tripService";
import {
  closeIncident,
  dispatchReplacementBoat,
  fetchAvailableReplacementBoats,
  fetchIncidentDispatchPlan,
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
import { fetchOperationsSchedule, toOperationsScheduleDate } from "../../../services/operationsService";

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
  hideReport = false,
  viewTabs = null,
} = {}) {
  const { lang } = useApp();
  const { user } = useSelector((state) => state.auth);
  const isAdmin = isAdminUser(user);
  const isManager = isManagerUser(user);
  const isStaff = isStaffUser(user);
  // Admin/Manager/Staff báo sự cố; Admin/Manager điều tàu cứu hộ và đóng sự cố.
  const canReport = (isAdmin || isManager || isStaff) && !hideReport;
  const canDispatchRescue = isAdmin || isManager;
  const canResolveIncident = isAdmin || isManager;
  const {
    incidents,
    errorMsg,
    isInitialLoading,
    refresh,
  } = useLiveIncidents({ enabled: true, toast: true });

  const [boats, setBoats] = useState([]);
  const [rescueBoats, setRescueBoats] = useState([]);
  const [passengerBoats, setPassengerBoats] = useState([]);
  const [trips, setTrips] = useState([]);
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
  const [dispatchPlan, setDispatchPlan] = useState(null);
  const [dispatchPlanLoading, setDispatchPlanLoading] = useState(false);
  const [dispatchPlanError, setDispatchPlanError] = useState("");
  const [availableReplacementBoats, setAvailableReplacementBoats] = useState([]);
  const [replacementBoatLoadError, setReplacementBoatLoadError] = useState("");
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
    loadHistory().catch(() => { });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ khi đổi tab lịch sử
  }, [listTab]);

  // Prefetch nhẹ để badge Lịch sử có số.
  useEffect(() => {
    loadHistory({ silent: true }).catch(() => { });
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

    return filterBlocked(availableReplacementBoats);
  }, [availableReplacementBoats, rescueForm.incidentBoatId, rescueForm.rescueBoatId]);

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
  const hasNextTrips = Boolean(dispatchPlan?.hasNextTrips ?? dispatchPlan?.HasNextTrips);
  const nextTrips = unwrapList(dispatchPlan?.nextTrips ?? dispatchPlan?.NextTrips);
  const requiresPassengerReplacement = Boolean(
    dispatchPlan?.requiresPassengerReplacement ?? dispatchPlan?.RequiresPassengerReplacement,
  );
  const requiresReplacementOrDelay = Boolean(
    dispatchPlan?.requiresReplacementOrDelay ?? dispatchPlan?.RequiresReplacementOrDelay,
  );
  const replacementListEmpty = hasNextTrips && !dispatchPlanLoading && !replacementBoatLoadError && replacementCandidateBoats.length === 0;
  const delayMinutes = Number(rescueForm.delayMinutes);
  const hasValidDelay = Number.isFinite(delayMinutes) && delayMinutes > 0;
  const mustEnterDelay = hasNextTrips && !rescueForm.replacementBoatId && !requiresPassengerReplacement;

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
      const rescueBoat = boatById.get(String(incident.rescueBoatId || ""));
      const replacementBoat = boatById.get(String(incident.replacementBoatId || ""));
      return {
        ...incident,
        boatCode: incident.boatCode || boat?.boatCode || boat?.code || "",
        boatName: incident.boatName || boat?.boatName || boat?.name || "",
        rescueBoatCode: incident.rescueBoatCode || rescueBoat?.boatCode || rescueBoat?.code || "",
        rescueBoatName: incident.rescueBoatName || rescueBoat?.boatName || rescueBoat?.name || "",
        replacementBoatCode: incident.replacementBoatCode || replacementBoat?.boatCode || replacementBoat?.code || "",
        replacementBoatName: incident.replacementBoatName || replacementBoat?.boatName || replacementBoat?.name || "",
      };
    }),
    [incidents, boatById],
  );

  const enrichedHistory = useMemo(
    () => historyIncidents.map((incident) => {
      const boat = boatById.get(String(incident.boatId || ""));
      const rescueBoat = boatById.get(String(incident.rescueBoatId || ""));
      const replacementBoat = boatById.get(String(incident.replacementBoatId || ""));
      return {
        ...incident,
        boatCode: incident.boatCode || boat?.boatCode || boat?.code || "",
        boatName: incident.boatName || boat?.boatName || boat?.name || "",
        rescueBoatCode: incident.rescueBoatCode || rescueBoat?.boatCode || rescueBoat?.code || "",
        rescueBoatName: incident.rescueBoatName || rescueBoat?.boatName || rescueBoat?.name || "",
        replacementBoatCode: incident.replacementBoatCode || replacementBoat?.boatCode || replacementBoat?.code || "",
        replacementBoatName: incident.replacementBoatName || replacementBoat?.boatName || replacementBoat?.name || "",
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

    if (requiresPassengerReplacement && !rescueForm.replacementBoatId) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Chọn tàu thay thế" : "Select replacement boat",
        text: lang === "VN"
          ? "Các khách bị ảnh hưởng bắt buộc phải được bố trí tàu thay thế."
          : "Affected passengers require a replacement boat.",
      });
      return;
    }

    if (mustEnterDelay && !hasValidDelay) {
      notify({
        icon: "warning",
        title: lang === "VN" ? "Nhập thời gian trễ" : "Enter delay",
        text: lang === "VN"
          ? "Không chọn tàu thay thế thì cần nhập thời gian trễ lớn hơn 0 phút cho các chuyến kế tiếp."
          : "Enter a delay greater than 0 minutes when no replacement boat is selected.",
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
      await dispatchReplacementBoat(rescueForm.incidentId, {
        rescueBoatId: rescueForm.rescueBoatId,
        replacementBoatId: rescueForm.replacementBoatId || null,
        delayMinutes: hasNextTrips && !rescueForm.replacementBoatId ? Math.trunc(delayMinutes) : 0,
        note: rescueForm.note.trim() || (lang === "VN"
          ? "Điều tàu cứu hộ và xử lý các chuyến kế tiếp"
          : "Dispatch rescue and handle following trips"),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã điều tàu cứu hộ" : "Rescue boat assigned",
      });
      setRescueForm(EMPTY_RESCUE_FORM);
      setDispatchPlan(null);
      setAvailableReplacementBoats([]);
      // Refetch theo spec BE: incident + schedule (+ boats); Live Tracking tự poll GPS.
      const day = toDdMmYyyy(new Date());
      const opsDay = toOperationsScheduleDate();
      await Promise.all([
        refresh(),
        fetchResolvedIncidents().then((list) => setHistoryIncidents(Array.isArray(list) ? list : [])).catch(() => { }),
        fetchAllBoats().then((data) => setBoats(unwrapList(data))).catch(() => { }),
        fetchAllTrips({ fromDate: day, toDate: day }).then((data) => setTrips(unwrapList(data))).catch(() => { }),
        fetchOperationsSchedule({ fromDate: opsDay, toDate: opsDay }).catch(() => { }),
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
        await loadHistory({ silent: true }).catch(() => { });
      } else {
        // Prefetch history so count/tab sẵn sàng sau khi đóng.
        loadHistory({ silent: true }).catch(() => { });
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
          className={`rounded-xl px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider transition ${listTab === "open"
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
          className={`rounded-xl px-4 py-2 text-[11px] font-headline font-black uppercase tracking-wider transition ${listTab === "history"
              ? "bg-white text-[#124757] shadow-sm dark:bg-slate-800 dark:text-yellow-400"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
        >
          {lang === "VN" ? `Lịch sử (${stats.history})` : `History (${stats.history})`}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: lang === "VN" ? "Đang mở" : "Open", value: stats.open },
          { label: lang === "VN" ? "Cao / Nghiêm trọng" : "High / Critical", value: stats.high },
          { label: lang === "VN" ? "Đã điều cứu" : "Rescue assigned", value: stats.rescued },
          { label: lang === "VN" ? "Chưa gán QL" : "No manager", value: stats.unassigned },
        ].map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800"
          >
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
              onClick={() => loadHistory().catch(() => { })}
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
              : (lang === "VN" ? "Không có sự cố nào." : "No incidents yet.")}
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
                  delayMinutes: 0,
                  note: lang === "VN"
                    ? (needsReplace
                      ? `Điều tàu cứu hộ và tàu thay thế cho ${item.boatCode || ""}`
                      : `Điều tàu cứu hộ cho ${item.boatCode || ""}`)
                    : (needsReplace
                      ? `Dispatch rescue and replacement for ${item.boatCode || ""}`
                      : `Dispatch rescue for ${item.boatCode || ""}`),
                });
                setDispatchPlan(null);
                setDispatchPlanError("");
                setAvailableReplacementBoats([]);
                setReplacementBoatLoadError("");
                setDispatchPlanLoading(true);
                fetchActiveBoatsByServiceType("Rescue")
                  .then((data) => setRescueBoats(Array.isArray(data) ? data : []))
                  .catch(() => { });
                fetchIncidentDispatchPlan(item.incidentId)
                  .then(async (plan) => {
                    setDispatchPlan(plan || null);
                    setRescueForm((prev) => {
                      if (String(prev.incidentId) !== String(item.incidentId)) return prev;
                      return {
                        ...prev,
                        activeTicketCount: Number(plan?.activeTicketCount ?? plan?.ActiveTicketCount ?? prev.activeTicketCount) || 0,
                        onboardPassengerCount: Number(plan?.onboardPassengerCount ?? plan?.OnboardPassengerCount ?? prev.onboardPassengerCount) || 0,
                        futurePassengerCount: Number(plan?.futurePassengerCount ?? plan?.FuturePassengerCount ?? prev.futurePassengerCount) || 0,
                      };
                    });

                    const planHasNextTrips = Boolean(plan?.hasNextTrips ?? plan?.HasNextTrips);
                    const planRequiresReplacement = Boolean(
                      plan?.requiresPassengerReplacement ?? plan?.RequiresPassengerReplacement,
                    );
                    // Không có khách và không có chuyến kế tiếp: chỉ cần tàu cứu hộ,
                    // không gọi API tàu Passenger không cần thiết.
                    if (!planHasNextTrips && !planRequiresReplacement) return;

                    try {
                      const replacementBoats = await fetchAvailableReplacementBoats(item.incidentId);
                      setAvailableReplacementBoats(replacementBoats);
                    } catch (error) {
                      console.error("Failed to load available replacement boats:", error);
                      setReplacementBoatLoadError(lang === "VN"
                        ? "Chưa tải được danh sách tàu thay thế phù hợp từ hệ thống."
                        : "Unable to load eligible replacement boats.");
                    }
                  })
                  .catch((error) => {
                    console.error("Failed to load incident dispatch plan:", error);
                    setDispatchPlanError(lang === "VN"
                      ? "Chưa tải được kế hoạch điều tàu từ hệ thống. Vui lòng thử lại sau."
                      : "Unable to load the dispatch plan. Please try again later.");
                  })
                  .finally(() => setDispatchPlanLoading(false));
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
                        {listTab === "open" ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:col-span-2 dark:border-slate-700 dark:bg-slate-800">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {lang === "VN" ? "Ghi chú đóng" : "Resolution note"}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {item.resolutionNote || "—"}
                              </p>
                            </div>
                          </>
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

      {rescueForm.incidentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleRescue}
            className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <LifeBuoy size={19} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Xử lý sự cố" : "Incident response"}</p>
                  <h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Điều tàu cứu hộ" : "Assign rescue boat"}</h2>
                </div>
              </div>
              <button type="button" onClick={() => setRescueForm(EMPTY_RESCUE_FORM)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900" title={lang === "VN" ? "Đóng" : "Close"}>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-5 p-6">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {rescueForm.incidentBoatCode || "—"}
              {" · "}
              {lang === "VN" ? "Vé active" : "Active tickets"}: {rescueForm.activeTicketCount}
              {" · "}
              {lang === "VN" ? "Trên tàu" : "Onboard"}: {resolveIncidentOnboardCount(rescueForm)}
              {" · "}
              {lang === "VN" ? "Chặng sau" : "Future"}: {rescueForm.futurePassengerCount}
            </p>
            {dispatchPlanLoading ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
                {lang === "VN" ? "Đang kiểm tra kế hoạch điều tàu và tàu thay thế phù hợp..." : "Checking dispatch plan and eligible replacement boats..."}
              </p>
            ) : null}
            {dispatchPlanError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{dispatchPlanError}</p>
            ) : null}
            {!dispatchPlanLoading && !dispatchPlanError && !hasNextTrips ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                {lang === "VN" ? "Không có chuyến kế tiếp bị ảnh hưởng. Chỉ cần điều tàu cứu hộ." : "There are no affected following trips. Only dispatch the rescue boat."}
              </p>
            ) : null}
            {hasNextTrips ? (
              <section className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                  <p className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 dark:text-slate-200">
                    {lang === "VN" ? `Chuyến kế tiếp bị ảnh hưởng (${nextTrips.length})` : `Affected following trips (${nextTrips.length})`}
                  </p>
                  <span className="text-[11px] font-semibold text-slate-500">{lang === "VN" ? "Delay chỉ áp dụng cho danh sách này" : "Delay applies only to these trips"}</span>
                </div>
                <div className="max-h-40 overflow-auto divide-y divide-slate-100 dark:divide-slate-700">
                  {nextTrips.map((trip) => (
                    <div key={trip.tripId || trip.TripId || trip.tripCode || trip.TripCode} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-200">{trip.tripCode || trip.TripCode || "—"}</span>
                      <span className="text-slate-500">{trip.operatingDate || trip.OperatingDate || ""} · {trip.effectiveDepartureTime || trip.EffectiveDepartureTime || trip.departureTime || trip.DepartureTime || "—"} - {trip.effectiveArrivalTime || trip.EffectiveArrivalTime || trip.arrivalTime || trip.ArrivalTime || "—"}</span>
                      <span className="text-slate-500">{lang === "VN" ? "Khách/vé" : "Passengers/tickets"}: {trip.activeTicketCount ?? trip.ActiveTicketCount ?? 0}/{trip.capacitySnapshot ?? trip.CapacitySnapshot ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Tàu cứu hộ (kéo)" : "Rescue boat"}<RequiredStar />
              </span>
              <FormSelect
                value={rescueForm.rescueBoatId}
                onChange={(nextRescueId) => {
                  setRescueForm((prev) => ({
                    ...prev,
                    rescueBoatId: nextRescueId,
                    replacementBoatId: String(prev.replacementBoatId) === String(nextRescueId)
                      ? ""
                      : prev.replacementBoatId,
                  }));
                }}
                placeholder={lang === "VN" ? "Chọn tàu Rescue" : "Select Rescue boat"}
                searchable
                searchPlaceholder={lang === "VN" ? "Tìm tàu cứu hộ..." : "Search rescue boat..."}
                emptyLabel={lang === "VN" ? "Không tìm thấy tàu phù hợp" : "No matching boats"}
                options={rescueCandidateBoats.map((boat) => ({
                  value: boat.boatId || boat.id,
                  label: `${boat.boatCode || boat.code} · ${boat.boatName || boat.name || ""}`,
                }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-900"
              />
              {rescueCandidateBoats.length === 0 ? (
                <p className="text-[11px] font-medium text-amber-600">
                  {lang === "VN"
                    ? "Chưa có tàu Active + serviceType=Rescue."
                    : "No Active Rescue boats available."}
                </p>
              ) : null}
            </label>
            {hasNextTrips ? (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {requiresPassengerReplacement
                    ? <>{lang === "VN" ? "Tàu thay thế (chở khách)" : "Replacement passenger boat"}<RequiredStar /></>
                    : (lang === "VN" ? "Tàu thay thế (tuỳ chọn)" : "Replacement boat (optional)")}
                </span>
                <FormSelect
                  value={rescueForm.replacementBoatId}
                  onChange={(replacementBoatId) => setRescueForm((prev) => ({ ...prev, replacementBoatId }))}
                  placeholder={lang === "VN" ? "Chọn tàu Passenger" : "Select Passenger boat"}
                  searchable
                  searchPlaceholder={lang === "VN" ? "Tìm tàu thay thế..." : "Search replacement boat..."}
                  emptyLabel={lang === "VN" ? "Không tìm thấy tàu phù hợp" : "No matching boats"}
                  options={replacementCandidateBoats.map((boat) => ({
                    value: boat.boatId || boat.id,
                    label: `${boat.boatCode || boat.code} · ${boat.boatName || boat.name || ""}`,
                  }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-900"
                />
            {replacementListEmpty ? (
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    {requiresPassengerReplacement
                      ? (lang === "VN" ? "Không có tàu thay thế đủ điều kiện. Chưa thể điều tàu vì còn khách cần chuyển." : "No eligible replacement boat is available. Dispatch cannot continue while passengers need transfer.")
                      : (lang === "VN" ? "Không có tàu thay thế phù hợp. Bắt buộc nhập thời gian trễ lớn hơn 0 phút." : "No eligible replacement boat is available. Enter a delay greater than 0 minutes.")}
                  </p>
                ) : null}
                {replacementBoatLoadError ? (
                  <p className="text-[11px] font-medium text-rose-700 dark:text-rose-300">{replacementBoatLoadError}</p>
                ) : null}
              </label>
            ) : null}
            {hasNextTrips ? (<label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Thời gian trễ (phút)" : "Delay (min)"}{mustEnterDelay ? <RequiredStar /> : null}
              </span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={rescueForm.delayMinutes}
                onChange={(e) => setRescueForm((prev) => ({ ...prev, delayMinutes: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
              />
              <p className="text-[11px] font-medium text-slate-400">{lang === "VN" ? "Chỉ áp dụng cho các chuyến kế tiếp ở trên, không áp dụng cho chuyến đang gặp sự cố." : "Applies only to the following trips above, not the trip currently in incident."}</p>
            </label>) : null}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">Note</span>
              <textarea
                rows={2}
                value={rescueForm.note}
                onChange={(e) => setRescueForm((prev) => ({ ...prev, note: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setRescueForm(EMPTY_RESCUE_FORM)}
                className="rounded-lg px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={
                  !rescueForm.rescueBoatId
                  || dispatchPlanLoading
                  || Boolean(dispatchPlanError)
                  || (requiresPassengerReplacement && !rescueForm.replacementBoatId)
                  || (mustEnterDelay && !hasValidDelay)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <LifeBuoy size={15} aria-hidden="true" />
                {lang === "VN" ? "Điều tàu" : "Dispatch"}
              </button>
            </div>
            </div>
          </form>
        </div>
      ) : null}

      {resolveForm.incidentId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleResolve}
            className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><CheckCircle2 size={19} aria-hidden="true" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{lang === "VN" ? "Hoàn tất xử lý" : "Resolution"}</p><h2 className="font-headline text-lg font-black text-[#124757] dark:text-yellow-400">{lang === "VN" ? "Đóng sự cố" : "Resolve incident"}</h2></div>
              </div>
              <button type="button" onClick={() => setResolveForm((prev) => ({ ...prev, incidentId: "", boatCode: "" }))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900" title={lang === "VN" ? "Đóng" : "Close"}><X size={18} aria-hidden="true" /></button>
            </div>
            <div className="space-y-5 p-6">
            <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
              <Info className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-300" size={17} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] font-headline font-black uppercase tracking-wider text-sky-700 dark:text-sky-300">{lang === "VN" ? "Lưu ý" : "Note"}</p>
                <p className="mt-1 text-xs font-medium leading-5 text-sky-800 dark:text-sky-100">
                  {lang === "VN"
                    ? "Chỉ dùng để đóng thủ công khi GPS chưa cập nhật việc kéo tàu về bến. Khi GPS xác nhận hoàn tất kéo cứu, hệ thống sẽ tự đóng sự cố và chuyển tàu sang bảo trì."
                    : "Use if GPS has not reported tow completion. Main flow: after GPS finishes towing to dock, the incident closes and the boat moves to maintenance."}
                </p>
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                {lang === "VN" ? "Ghi chú xử lý" : "Resolution note"}<RequiredStar />
              </span>
              <textarea
                required
                rows={3}
                value={resolveForm.resolutionNote}
                onChange={(e) => setResolveForm((prev) => ({ ...prev, resolutionNote: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Trạng thái tàu" : "Boat status"}</span>
                <FormSelect
                  value={resolveForm.boatStatus}
                  onChange={(boatStatus) => setResolveForm((prev) => ({ ...prev, boatStatus }))}
                  options={[
                    { value: "UnderMaintenance", label: lang === "VN" ? "Đang bảo trì" : "Under maintenance" },
                    { value: "Incident", label: lang === "VN" ? "Đang có sự cố" : "Incident" },
                    { value: "Active", label: lang === "VN" ? "Đang hoạt động" : "Active" },
                    { value: "Inactive", label: lang === "VN" ? "Tạm ngừng" : "Inactive" },
                    { value: "Retired", label: lang === "VN" ? "Ngừng khai thác" : "Retired" },
                  ]}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">{lang === "VN" ? "Trạng thái chuyến" : "Trip status"}</span>
                <FormSelect
                  value={resolveForm.tripStatus}
                  onChange={(tripStatus) => setResolveForm((prev) => ({ ...prev, tripStatus }))}
                  options={[
                    { value: "", label: lang === "VN" ? "Để trống (mặc định hệ thống)" : "Leave empty (system default)" },
                    { value: "Cancelled", label: lang === "VN" ? "Đã hủy" : "Cancelled" },
                    { value: "Delayed", label: lang === "VN" ? "Trễ chuyến" : "Delayed" },
                    { value: "Completed", label: lang === "VN" ? "Hoàn thành" : "Completed" },
                  ]}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setResolveForm((prev) => ({ ...prev, incidentId: "", boatCode: "" }))}
                className="rounded-lg px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {lang === "VN" ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-headline font-black uppercase tracking-wider text-white hover:bg-emerald-700"
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                {lang === "VN" ? "Xác nhận đóng" : "Confirm resolve"}
              </button>
            </div>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
