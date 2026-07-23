import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import { fetchStaffMeAssignments, fetchStaffMeTrips, normalizeStaffTrip } from "../../../services/staffMeService";
import { ASSIGNMENT_TYPE } from "../../../services/staffAssignmentService";
import { fetchAllTrips, fetchTripDetail, resumeTripDelay, startTripDelay, toOperatingDateQuery } from "../../../services/tripService";
import { trackingHub } from "../../../services/trackingHubClient";
import {
  addDays,
  assignmentCoversDay,
  parseDateKey,
  toDateKey,
} from "../../../utils/staffAssignmentCalendarUtils";
import { getApiErrorMessage } from "../../../utils/apiError";
import { notify, showToast } from "../../../utils/swalToast";
import {
  applyDelayPayloadToTrip,
  canResumeTripDelay,
  canStartTripDelay,
  formatActiveDelayLine,
  formatPostResumeDelayLine,
  getTripDelayTooEarlyMessage,
  isDelayActive,
  mergeAffectedTripsIntoList,
  pickAffectedTrips,
  pickDelayMinutes,
  pickDisplayArrival,
  pickDisplayDeparture,
  pickStationNameForStopOrder,
  resolveDelayStartStopOrder,
} from "../../../utils/tripDelay";

/** Staff chỉ xem chuyến từ 3 ngày trước ngày vận hành đến đúng ngày đó. */
const PREVIEW_DAYS_BEFORE = 3;

const pad2 = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatDateTime = (value, lang) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDayLabel = (ymd, lang) => {
  const date = parseDateKey(ymd);
  if (Number.isNaN(date.getTime())) return ymd;
  return date.toLocaleDateString(lang === "VN" ? "vi-VN" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

/** today nằm trong [tripDate - 3 ngày, tripDate]. */
const canStaffPreviewTripDate = (tripDateYmd, todayYmd = todayKey()) => {
  if (!tripDateYmd || !todayYmd) return false;
  const trip = parseDateKey(tripDateYmd);
  const today = parseDateKey(todayYmd);
  if (Number.isNaN(trip.getTime()) || Number.isNaN(today.getTime())) return false;
  const earliest = addDays(trip, -PREVIEW_DAYS_BEFORE);
  return today >= earliest && today <= trip;
};

const earliestPreviewKey = (tripDateYmd) => {
  const trip = parseDateKey(tripDateYmd);
  if (Number.isNaN(trip.getTime())) return "";
  return toDateKey(addDays(trip, -PREVIEW_DAYS_BEFORE));
};

const unwrapTrips = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.trips)) return data.trips;
  return [];
};

const tripMatchesAssignment = (trip, assignment) => {
  if (!trip || !assignment) return false;
  if (assignment.assignmentType === ASSIGNMENT_TYPE.BOAT) {
    const boatId = String(assignment.boat?.boatId || assignment.boatId || "").trim();
    const boatCode = String(assignment.boat?.boatCode || assignment.boatCode || "").trim().toUpperCase();
    const tripBoatId = String(
      trip.boatId || trip.boat?.vesselId || trip.boat?.boatId || "",
    ).trim();
    const tripBoatCode = String(trip.boatCode || trip.boat?.boatCode || "").trim().toUpperCase();
    if (boatId && tripBoatId && boatId === tripBoatId) return true;
    if (boatCode && tripBoatCode && boatCode === tripBoatCode) return true;
    return false;
  }
  if (assignment.assignmentType === ASSIGNMENT_TYPE.STATION) {
    const stationId = String(assignment.station?.stationId || assignment.stationId || "").trim();
    const stationCode = String(assignment.station?.stationCode || assignment.stationCode || "").trim().toUpperCase();
    if (!stationId && !stationCode) return false;
    const fromId = String(trip.fromStationId || trip.fromStation?.stationId || "").trim();
    const toId = String(trip.toStationId || trip.toStation?.stationId || "").trim();
    // Ưu tiên khớp stationId; fallback stop.stationId trên trip.
    const stopIds = Array.isArray(trip.stops)
      ? trip.stops.map((s) => String(s?.stationId || "").trim()).filter(Boolean)
      : [];
    if (stationId && (stationId === fromId || stationId === toId || stopIds.includes(stationId))) {
      return true;
    }
    const fromCode = String(trip.fromStationCode || trip.fromStation?.stationCode || "").trim().toUpperCase();
    const toCode = String(trip.toStationCode || trip.toStation?.stationCode || "").trim().toUpperCase();
    if (stationCode && (stationCode === fromCode || stationCode === toCode)) return true;
    return false;
  }
  return false;
};

const mergeUniqueTrips = (lists) => {
  const map = new Map();
  lists.flat().forEach((trip) => {
    if (!trip) return;
    const key = String(trip.tripId || trip.tripCode || JSON.stringify(trip)).trim();
    if (!key || map.has(key)) return;
    map.set(key, trip);
  });
  return [...map.values()];
};

export function StaffMyTripsPage() {
  const { lang } = useApp();
  const [date, setDate] = useState(todayKey);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [emptyReason, setEmptyReason] = useState("");
  const [delayBusyId, setDelayBusyId] = useState("");

  const today = todayKey();
  const previewAllowed = useMemo(() => canStaffPreviewTripDate(date, today), [date, today]);
  const previewFromLabel = useMemo(
    () => formatDayLabel(earliestPreviewKey(date), lang),
    [date, lang],
  );
  const boatIdsKey = useMemo(
    () => [...new Set(trips.map((t) => String(t?.boatId || t?.boat?.boatId || "").trim()).filter(Boolean))].sort().join("|"),
    [trips],
  );

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setEmptyReason("");

      if (!canStaffPreviewTripDate(date, todayKey())) {
        setTrips([]);
        setEmptyReason("too_early");
        return;
      }

      // 1) BE suy trip từ ca (chuẩn)
      let fromMe = [];
      try {
        fromMe = await fetchStaffMeTrips({ date });
      } catch {
        fromMe = [];
      }

      // 2) Fallback: ca của tôi + GET /trips (Staff được quyền) lọc theo tàu/bến ca
      let fromFallback = [];
      try {
        const [assignments, tripRows] = await Promise.all([
          fetchStaffMeAssignments({ fromDate: date, toDate: date }),
          fetchAllTrips({ operatingDate: toOperatingDateQuery(date) }),
        ]);
        const dayAssignments = (assignments || []).filter((row) => assignmentCoversDay(row, date));
        const boatAssignments = dayAssignments.filter((a) => a.assignmentType === ASSIGNMENT_TYPE.BOAT);
        // Check vé / chuyến của staff: ưu tiên ca OnBoard (Boat); Ground chỉ fallback.
        const relevantAssignments = boatAssignments.length > 0 ? boatAssignments : dayAssignments;
        if (relevantAssignments.length === 0 && fromMe.length === 0) {
          setTrips([]);
          setEmptyReason("no_assignment");
          return;
        }
        const rawTrips = unwrapTrips(tripRows);
        fromFallback = rawTrips
          .filter((trip) => relevantAssignments.some((a) => tripMatchesAssignment(trip, a)))
          .map(normalizeStaffTrip)
          .filter(Boolean);
      } catch {
        fromFallback = [];
      }

      const merged = mergeUniqueTrips([fromMe, fromFallback]);
      setTrips(merged);
      if (merged.length === 0) {
        setEmptyReason("no_trips");
      }
    } catch {
      setTrips([]);
      setEmptyReason("error");
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const boatIds = boatIdsKey ? boatIdsKey.split("|") : [];
    if (!boatIds.length) return undefined;
    boatIds.forEach((id) => trackingHub.joinBoat(id).catch(() => {}));
    const unsub = trackingHub.subscribeTripDelayUpdated((payload) => {
      if (!payload) return;
      setTrips((prev) => {
        let next = prev.map((trip) => applyDelayPayloadToTrip(trip, payload));
        return mergeAffectedTripsIntoList(next, pickAffectedTrips(payload));
      });
    });
    return () => {
      unsub();
      boatIds.forEach((id) => trackingHub.leaveBoat(id).catch(() => {}));
    };
  }, [boatIdsKey]);

  const handleStartDelay = async (trip) => {
    const tripId = trip?.tripId || trip?.id;
    if (!tripId || !canStartTripDelay(trip) || delayBusyId) return;

    const tooEarly = getTripDelayTooEarlyMessage(trip, lang);
    if (tooEarly) {
      await notify({
        dialog: true,
        icon: "warning",
        title: lang === "VN" ? "Chưa đến giờ xuất phát" : "Before departure time",
        text: tooEarly,
        confirmButtonText: lang === "VN" ? "Đã hiểu" : "OK",
        confirmButtonColor: "#124757",
      });
      return;
    }

    setDelayBusyId(String(tripId));
    try {
      const detail = await fetchTripDetail(tripId).catch(() => trip);
      const tooEarlyDetail = getTripDelayTooEarlyMessage(detail || trip, lang);
      if (tooEarlyDetail) {
        await notify({
          dialog: true,
          icon: "warning",
          title: lang === "VN" ? "Chưa đến giờ xuất phát" : "Before departure time",
          text: tooEarlyDetail,
          confirmButtonText: lang === "VN" ? "Đã hiểu" : "OK",
          confirmButtonColor: "#124757",
        });
        return;
      }
      const stops = detail?.stops || trip?.stops || [];
      const stopOrder = resolveDelayStartStopOrder(stops);
      const stationName = pickStationNameForStopOrder(stops, stopOrder);
      const defaultReason = stationName
        ? (lang === "VN" ? `Tàu đang dừng tại bến ${stationName}` : `Boat stopped at ${stationName}`)
        : (lang === "VN" ? "Tàu đang dừng" : "Boat is delayed");
      const result = await notify({
        dialog: true,
        icon: "question",
        title: lang === "VN" ? "Bắt đầu Delay" : "Start Delay",
        input: "text",
        inputValue: defaultReason,
        showCancelButton: true,
        confirmButtonText: "Delay",
        cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
        inputValidator: (value) => (
          String(value || "").trim()
            ? null
            : (lang === "VN" ? "Nhập lý do delay." : "Enter a delay reason.")
        ),
      });
      if (!result?.isConfirmed) return;
      const response = await startTripDelay(tripId, {
        reason: String(result.value || defaultReason).trim(),
        startStopOrder: stopOrder,
      });
      setTrips((prev) => prev.map((row) => (
        String(row.tripId || row.id) === String(tripId)
          ? applyDelayPayloadToTrip(row, {
            ...response,
            tripId,
            delayInfo: {
              isDelayActive: true,
              delayStartedAt: new Date().toISOString(),
              reason: String(result.value || defaultReason).trim(),
              stationName,
              startStopOrder: stopOrder,
              ...(response?.delayInfo || {}),
            },
          })
          : row
      )));
      showToast({ icon: "success", title: lang === "VN" ? "Đã bắt đầu delay" : "Delay started" });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không start được delay" : "Unable to start delay",
        text: getApiErrorMessage(error),
      });
    } finally {
      setDelayBusyId("");
    }
  };

  const handleResumeDelay = async (trip) => {
    const tripId = trip?.tripId || trip?.id;
    if (!tripId || !canResumeTripDelay(trip) || delayBusyId) return;
    const result = await notify({
      dialog: true,
      icon: "question",
      title: lang === "VN" ? "Tiếp tục hành trình" : "Resume trip",
      input: "text",
      inputValue: lang === "VN" ? "Tàu tiếp tục hành trình" : "Boat continues journey",
      showCancelButton: true,
      confirmButtonText: lang === "VN" ? "Tiếp tục" : "Resume",
      cancelButtonText: lang === "VN" ? "Hủy" : "Cancel",
    });
    if (!result?.isConfirmed) return;
    setDelayBusyId(String(tripId));
    try {
      const response = await resumeTripDelay(tripId, {
        note: String(result.value || "Tàu tiếp tục hành trình").trim(),
      });
      setTrips((prev) => {
        let next = prev.map((row) => (
          String(row.tripId || row.id) === String(tripId)
            ? applyDelayPayloadToTrip(row, {
              ...response,
              tripId,
              delayInfo: {
                ...(row.delayInfo || {}),
                isDelayActive: false,
                delayMinutes: pickDelayMinutes(response) || pickDelayMinutes(row),
              },
            })
            : row
        ));
        return mergeAffectedTripsIntoList(next, pickAffectedTrips(response));
      });
      showToast({ icon: "success", title: lang === "VN" ? "Đã tiếp tục chuyến" : "Trip resumed" });
    } catch (error) {
      showToast({
        icon: "error",
        title: lang === "VN" ? "Không resume được" : "Unable to resume",
        text: getApiErrorMessage(error),
      });
    } finally {
      setDelayBusyId("");
    }
  };

  const emptyMessage = (() => {
    if (emptyReason === "too_early") {
      return lang === "VN"
        ? `Chuyến ngày ${formatDayLabel(date, lang)} chỉ xem được từ ${previewFromLabel} (trước 3 ngày). Admin/Manager xem toàn bộ ở Quản lý chuyến tàu.`
        : `Trips on ${formatDayLabel(date, lang)} are visible from ${previewFromLabel} (3 days before). Admins/Managers see all trips in Trip Management.`;
    }
    if (emptyReason === "no_assignment") {
      return lang === "VN"
        ? "Bạn chưa có ca OnBoard (Boat) trong ngày này. Check vé dùng nhân viên trên tàu."
        : "You have no OnBoard (Boat) duty this day. Ticket check uses boat crew.";
    }
    if (emptyReason === "no_trips") {
      return lang === "VN"
        ? "Có ca nhưng chưa có chuyến khớp tàu/bến trong ngày — Admin cần tạo trip trước."
        : "You have a shift but no matching trips that day — Admin must create trips first.";
    }
    if (emptyReason === "error") {
      return lang === "VN" ? "Không tải được danh sách chuyến." : "Unable to load trips.";
    }
    return lang === "VN" ? "Không có chuyến trong ngày này." : "No trips on this day.";
  })();

  return (
    <div className="space-y-6 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-headline font-black text-[#124757] dark:text-yellow-400">
            {lang === "VN" ? "Chuyến của tôi" : "My trips"}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {lang === "VN"
              ? "Ưu tiên chuyến theo ca OnBoard trên tàu. Quét vé dành cho nhân viên trên tàu, không dùng nhân viên bến làm chính."
              : "Trips prefer your OnBoard boat duty. Ticket scan is for boat crew, not primarily station staff."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block mb-1">
              {lang === "VN" ? "Ngày chuyến" : "Trip date"}
            </span>
            <AppDateInput
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
          <button
            type="button"
            onClick={() => setDate(today)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {lang === "VN" ? "Hôm nay" : "Today"}
          </button>
          <Link
            to="/admin/staff/ticket-scan"
            className="inline-flex items-center gap-2 rounded-xl bg-[#124757] px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
          >
            <span className="material-symbols-outlined text-base">qr_code_scanner</span>
            {lang === "VN" ? "Quét vé" : "Scan"}
          </Link>
        </div>
      </div>

      {!previewAllowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {lang === "VN"
            ? `Cửa sổ xem: từ ${previewFromLabel} đến ${formatDayLabel(date, lang)}.`
            : `View window: from ${previewFromLabel} to ${formatDayLabel(date, lang)}.`}
        </div>
      ) : null}

      <div className="rounded-4xl border border-slate-100 bg-white shadow-sm overflow-hidden dark:border-slate-700/50 dark:bg-slate-800">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <p className="px-6 py-14 text-center text-xs font-bold text-slate-400 leading-relaxed max-w-lg mx-auto">
            {emptyMessage}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {trips.map((trip) => {
              const tripId = String(trip.tripId || trip.id || "");
              const active = isDelayActive(trip);
              const mins = pickDelayMinutes(trip);
              const busy = delayBusyId === tripId;
              return (
                <li key={tripId || trip.tripCode} className="px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-slate-900/20">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 dark:text-white truncate">{trip.routeName}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {[trip.tripCode, trip.boatName || trip.boat?.vesselName || trip.boatId].filter(Boolean).join(" · ")}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {[trip.fromStationName, trip.toStationName].filter(Boolean).join(" → ") || "—"}
                      </p>
                      {active ? (
                        <p className="mt-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          {formatActiveDelayLine(trip, { lang })}
                        </p>
                      ) : mins > 0 ? (
                        <p className="mt-1.5 text-[11px] font-bold text-orange-700 dark:text-orange-300">
                          {formatPostResumeDelayLine(trip, lang)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-stretch gap-2 sm:items-end shrink-0">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 sm:text-right">
                        <p>{formatDateTime(pickDisplayDeparture(trip) || trip.departureAt, lang)}</p>
                        {(pickDisplayArrival(trip) || trip.arrivalAt) && (
                          <p className="text-slate-400 mt-0.5">
                            → {formatDateTime(pickDisplayArrival(trip) || trip.arrivalAt, lang)}
                          </p>
                        )}
                        {trip.status && (
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{trip.status}</p>
                        )}
                        {active ? (
                          <span className="mt-1 inline-flex rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-headline font-black uppercase text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                            {lang === "VN" ? "Đang dừng / Delay" : "Stopped / Delay"}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {canStartTripDelay(trip) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleStartDelay(trip)}
                            className="inline-flex items-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-amber-800 disabled:opacity-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
                          >
                            Delay
                          </button>
                        ) : null}
                        {canResumeTripDelay(trip) ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleResumeDelay(trip)}
                            className="inline-flex items-center rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[10px] font-headline font-black uppercase tracking-wider text-emerald-800 disabled:opacity-50 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200"
                          >
                            {lang === "VN" ? "Tiếp tục" : "Resume"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
