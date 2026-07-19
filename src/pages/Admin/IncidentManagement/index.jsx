import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { useSelector } from "react-redux";
import { isAdminUser, isManagerUser, isStaffUser } from "../../../utils/roleHelpers";
import { useLiveIncidents } from "../../../hooks/useLiveIncidents";
import { fetchActiveBoatsByServiceType, fetchAllBoats } from "../../../services/boatService";
import { fetchAllTrips } from "../../../services/tripService";
import { fetchManagerUsers } from "../../../services/userService";
import {
  assignManagerToIncident,
  closeIncident,
  dispatchReplacementBoat,
  getApiErrorMessage,
  getIncidentTypeLabel,
  getSeverityLabel,
  INCIDENT_SEVERITIES,
  INCIDENT_TYPES,
  reportIncident,
} from "../../../services/incidentService";
import { notify, showToast } from "../../../utils/swalToast";

const ACTIVE_TRIP_STATUSES = new Set([
  "scheduled",
  "boarding",
  "departed",
  "inprogress",
  "delayed",
]);

const EMPTY_RESCUE_FORM = {
  incidentId: "",
  incidentBoatId: "",
  incidentBoatCode: "",
  incidentDescription: "",
  tripId: "",
  activeTicketCount: 0,
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

    fetchAllTrips()
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

  const needsReplacementBoat = Number(rescueForm.activeTicketCount) > 0;

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

  const tripsForSelectedBoat = useMemo(() => {
    if (!selectedBoat) return [];
    const boatId = String(selectedBoat.boatId || selectedBoat.id || "");
    const boatCode = String(selectedBoat.boatCode || selectedBoat.code || "").toLowerCase();

    return trips.filter((trip) => {
      const status = String(trip.status || "").toLowerCase();
      if (status && !ACTIVE_TRIP_STATUSES.has(status)) return false;

      const tripBoatId = String(trip.boatId || trip.boat?.boatId || "");
      const tripBoatCode = String(trip.boatCode || trip.boat?.boatCode || "").toLowerCase();
      if (boatId && tripBoatId && tripBoatId === boatId) return true;
      if (boatCode && tripBoatCode && tripBoatCode === boatCode) return true;
      return false;
    });
  }, [trips, selectedBoat]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enrichedIncidents;
    return enrichedIncidents.filter((item) =>
      String(item.boatCode || "").toLowerCase().includes(q)
      || String(item.description || "").toLowerCase().includes(q)
      || String(item.incidentType || "").toLowerCase().includes(q)
      || String(item.managerName || "").toLowerCase().includes(q),
    );
  }, [enrichedIncidents, query]);

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
    return { open, high, rescued, unassigned };
  }, [enrichedIncidents]);

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
      await reportIncident({
        boatId: reportForm.boatId,
        tripId: reportForm.tripId || null,
        incidentType: reportForm.incidentType,
        severity: reportForm.severity,
        description: reportForm.description.trim(),
        occurredAt: new Date().toISOString(),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã báo sự cố" : "Incident reported",
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
          ? "Có vé active — cần tàu chở khách thay thế."
          : "Active tickets — a replacement passenger boat is required.",
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
      // FE chỉ gọi Azure JWT — BE forward lệnh sang GPS hook.
      await dispatchReplacementBoat(rescueForm.incidentId, {
        rescueBoatId: rescueForm.rescueBoatId,
        replacementBoatId: needsReplacementBoat ? rescueForm.replacementBoatId : null,
        delayMinutes: needsReplacementBoat
          ? (Number.isFinite(delayRaw) ? Math.trunc(delayRaw) : 30)
          : 0,
        note: rescueForm.note.trim() || (needsReplacementBoat
          ? (lang === "VN" ? "Điều tàu cứu hộ và tàu thay thế tiếp tục hành trình" : "Dispatch rescue and replacement")
          : (lang === "VN" ? "Điều tàu cứu hộ kéo tàu lỗi về" : "Dispatch rescue to tow broken boat")),
      });

      showToast({
        icon: "success",
        title: lang === "VN" ? "Đã điều tàu cứu hộ" : "Rescue boat assigned",
      });
      setRescueForm(EMPTY_RESCUE_FORM);
      await refresh();
    } catch (error) {
      notify({
        icon: "error",
        title: lang === "VN" ? "Điều tàu thất bại" : "Dispatch failed",
        text: getApiErrorMessage(error) || error?.message || "",
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
                ? "Danh sách Open · điều cứu hộ · đóng sự cố. Báo sự cố trên Bản đồ."
                : "Danh sách Open · điều cứu hộ · đóng sự cố.")
              : (hideReport
                ? "Open list · dispatch rescue · resolve. Report on the Live map."
                : "Open list · dispatch rescue · resolve.")}
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
        {errorMsg ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
            {errorMsg}
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        {isInitialLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm font-medium text-slate-400">
            {lang === "VN" ? "Không có sự cố đang Open." : "No open incidents."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-headline font-black uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
                  <th className="px-4 py-3">{lang === "VN" ? "Tàu" : "Boat"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Loại" : "Type"}</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Mô tả" : "Description"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Manager" : "Manager"}</th>
                  <th className="px-4 py-3">{lang === "VN" ? "Thời điểm" : "When"}</th>
                  <th className="px-4 py-3 text-right">{lang === "VN" ? "Thao tác" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.incidentId} className="border-b border-slate-50 dark:border-slate-700/60">
                    <td className="px-4 py-3">
                      <p className="font-headline text-sm font-black text-[#124757] dark:text-yellow-400">
                        {item.boatCode || "—"}
                      </p>
                      <p className="text-[11px] font-medium text-slate-400">
                        {item.tripCode || (item.tripId ? `trip ${String(item.tripId).slice(0, 8)}…` : (lang === "VN" ? "Chưa gắn chuyến" : "No trip"))}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {getIncidentTypeLabel(item.incidentType, lang)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-headline font-black uppercase tracking-wider ring-1 ${severityClass(item.severity)}`}>
                        {getSeverityLabel(item.severity, lang)}
                      </span>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <p className="line-clamp-2">{item.description || "—"}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">
                        {lang === "VN" ? "Vé active" : "Active tickets"}: {item.activeTicketCount ?? 0}
                      </p>
                      {item.rescueBoatName || item.rescueBoatCode || item.rescueBoatId ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300">
                          {lang === "VN" ? "Cứu hộ" : "Rescue"}: {item.rescueBoatName || item.rescueBoatCode || String(item.rescueBoatId).slice(0, 8)}
                          {item.rescueDispatchedAt ? ` · ${formatWhen(item.rescueDispatchedAt)}` : ""}
                        </p>
                      ) : null}
                      {item.replacementBoatName || item.replacementBoatCode || item.replacementBoatId ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-300">
                          {lang === "VN" ? "Thay thế" : "Replacement"}: {item.replacementBoatName || item.replacementBoatCode || String(item.replacementBoatId).slice(0, 8)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.managerName || (item.managerUserId ? String(item.managerUserId).slice(0, 8) : "—")}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-400">
                      {formatWhen(item.occurredAt)}
                    </td>
                    <td className="px-4 py-3">
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
                            onClick={() => {
                              const ticketCount = Number(item.activeTicketCount) || 0;
                              setRescueForm({
                                incidentId: item.incidentId,
                                incidentBoatId: item.boatId || "",
                                incidentBoatCode: item.boatCode || "",
                                incidentDescription: item.description || "",
                                tripId: item.tripId || "",
                                activeTicketCount: ticketCount,
                                rescueBoatId: "",
                                replacementBoatId: "",
                                delayMinutes: ticketCount > 0 ? 30 : 0,
                                note: lang === "VN"
                                  ? (ticketCount > 0
                                    ? `Điều tàu cứu hộ và tàu thay thế cho ${item.boatCode || ""}`
                                    : `Điều tàu cứu hộ cho ${item.boatCode || ""}`)
                                  : (ticketCount > 0
                                    ? `Dispatch rescue and replacement for ${item.boatCode || ""}`
                                    : `Dispatch rescue for ${item.boatCode || ""}`),
                              });
                              fetchActiveBoatsByServiceType("Rescue")
                                .then((data) => setRescueBoats(Array.isArray(data) ? data : []))
                                .catch(() => {});
                              if (ticketCount > 0) {
                                fetchActiveBoatsByServiceType("Passenger")
                                  .then((data) => setPassengerBoats(Array.isArray(data) ? data : []))
                                  .catch(() => {});
                              }
                            }}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                onChange={(e) => setReportForm((prev) => ({
                  ...prev,
                  boatId: e.target.value,
                  tripId: "",
                }))}
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
                    {trip.status ? ` · ${trip.status}` : ""}
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
              {rescueForm.tripId
                ? `trip ${String(rescueForm.tripId).slice(0, 8)}…`
                : (lang === "VN" ? "Không có chuyến" : "No trip")}
            </p>
            {!rescueForm.tripId ? (
              <p className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900/50 dark:text-slate-300 dark:ring-slate-700">
                {lang === "VN"
                  ? "Không có trip — vẫn điều được tàu cứu hộ (kéo về). Không cần tàu thay thế."
                  : "No trip — rescue boat can still be dispatched (tow). No replacement needed."}
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
            {needsReplacementBoat ? (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                  {lang === "VN" ? "Tàu thay thế (chở khách) *" : "Replacement passenger boat *"}
                </span>
                <select
                  required
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
                  ? "Không có vé active — chỉ điều tàu cứu hộ (replacementBoatId = null)."
                  : "No active tickets — rescue only (replacementBoatId = null)."}
              </p>
            )}
            <label className="block space-y-1.5">
              <span className="text-[11px] font-headline font-black uppercase tracking-wider text-slate-400">
                Delay (min)
              </span>
              <input
                type="number"
                min={0}
                disabled={!needsReplacementBoat}
                value={rescueForm.delayMinutes}
                onChange={(e) => setRescueForm((prev) => ({ ...prev, delayMinutes: e.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
              />
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
