import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext";
import { AppDateInput } from "../../../components/AppDateInput";
import { fetchStaffMeAssignments, fetchStaffMeTrips, normalizeStaffTrip } from "../../../services/staffMeService";
import { ASSIGNMENT_TYPE } from "../../../services/staffAssignmentService";
import {
  fetchAllTrips,
  fetchTripDetail,
  resumeTripDelay,
  startTripDelay,
  toOperatingDateQuery,
} from "../../../services/tripService";
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

const formatClock = (value) => {
  if (!value) return "--:--";
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) {
    const m = String(value).match(/(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : "--:--";
  }
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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
  return [...map.values()].sort((a, b) => {
    const aMs = Date.parse(String(a.departureAt || "")) || 0;
    const bMs = Date.parse(String(b.departureAt || "")) || 0;
    return aMs - bMs;
  });
};

export function StaffMyTripsPage() {
  const { lang } = useApp();
  const navigate = useNavigate();
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

      let fromMe = [];
      try {
        fromMe = await fetchStaffMeTrips({ date });
      } catch {
        fromMe = [];
      }

      let fromFallback = [];
      try {
        const [assignments, tripRows] = await Promise.all([
          fetchStaffMeAssignments({ fromDate: date, toDate: date }),
          fetchAllTrips({ operatingDate: toOperatingDateQuery(date) }),
        ]);
        const dayAssignments = (assignments || []).filter((row) => assignmentCoversDay(row, date));
        const boatAssignments = dayAssignments.filter((a) => a.assignmentType === ASSIGNMENT_TYPE.BOAT);
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

  const openSeatBoard = (trip) => {
    const tripId = String(trip?.tripId || trip?.id || "").trim();
    if (!tripId) {
      showToast({
        icon: "warning",
        title: lang === "VN" ? "Thiếu tripId" : "Missing tripId",
      });
      return;
    }
    navigate(`/admin/trips/${encodeURIComponent(tripId)}/seat-board?from=${encodeURIComponent("/admin/staff/my-trips")}`);
  };

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
        ? `Chuyến ngày ${formatDayLabel(date, lang)} chỉ xem được từ ${previewFromLabel} (trước 3 ngày).`
        : `Trips on ${formatDayLabel(date, lang)} are visible from ${previewFromLabel} (3 days before).`;
    }
    if (emptyReason === "no_assignment") {
      return lang === "VN"
        ? "Bạn chưa có ca OnBoard (Boat) trong ngày này."
        : "You have no OnBoard (Boat) duty this day.";
    }
    if (emptyReason === "no_trips") {
      return lang === "VN"
        ? "Có ca nhưng chưa có chuyến khớp tàu trong ngày."
        : "You have a shift but no matching trips that day.";
    }
    if (emptyReason === "error") {
      return lang === "VN" ? "Không tải được danh sách chuyến." : "Unable to load trips.";
    }
    return lang === "VN" ? "Không có chuyến trong ngày này." : "No trips on this day.";
  })();

  return (
    <div className="space-y-5 pb-10 font-body">
      <div className="rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6">
        <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
          {lang === "VN" ? "Ca OnBoard" : "OnBoard duty"}
        </p>
        <div className="mt-1 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-headline text-2xl font-black text-[#124757] dark:text-yellow-400">
              {lang === "VN" ? "Chuyến của tôi" : "My trips"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-300">
              {lang === "VN"
                ? "Bấm chuyến để mở trang sơ đồ ghế theo bến (ai xuống / ai lên / ai đi tiếp). Quét vé dành cho nhân viên trên tàu."
                : "Open a trip for the full-page station seat board (alight / board / through). Ticket scan is for boat crew."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {lang === "VN" ? "Ngày chuyến" : "Trip date"}
              </span>
              <AppDateInput
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={() => setDate(today)}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {lang === "VN" ? "Hôm nay" : "Today"}
            </button>
            <Link
              to="/admin/staff/ticket-scan"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#124757] px-4 py-2.5 text-[11px] font-headline font-black uppercase tracking-wider text-white dark:bg-yellow-400 dark:text-slate-900"
            >
              <span className="material-symbols-outlined text-base" aria-hidden>qr_code_scanner</span>
              {lang === "VN" ? "Quét vé" : "Scan"}
            </Link>
          </div>
        </div>
      </div>

      {!previewAllowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {lang === "VN"
            ? `Cửa sổ xem: từ ${previewFromLabel} đến ${formatDayLabel(date, lang)}.`
            : `View window: from ${previewFromLabel} to ${formatDayLabel(date, lang)}.`}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
          </div>
        ) : trips.length === 0 ? (
          <p className="mx-auto max-w-lg px-6 py-14 text-center text-xs font-bold leading-relaxed text-slate-400">
            {emptyMessage}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {trips.map((trip) => {
              const tripId = String(trip.tripId || trip.id || "");
              const active = isDelayActive(trip);
              const mins = pickDelayMinutes(trip);
              const busy = delayBusyId === tripId;
              const depart = pickDisplayDeparture(trip) || trip.departureAt;
              const arrive = pickDisplayArrival(trip) || trip.arrivalAt;
              const fromName = trip.fromStationName || trip.stationName || "";
              const toName = trip.toStationName || "";
              const boatLabel = trip.boatName || trip.boatCode || "";
              return (
                <li key={tripId || trip.tripCode}>
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => openSeatBoard(trip)}
                      className="min-w-0 flex-1 text-left transition hover:opacity-90"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline text-lg font-black tabular-nums text-[#124757] dark:text-yellow-400">
                          {formatClock(depart)}
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="font-headline text-lg font-black tabular-nums text-[#124757] dark:text-yellow-400">
                          {formatClock(arrive)}
                        </span>
                        {trip.tripCode ? (
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                            {trip.tripCode}
                          </span>
                        ) : null}
                        {trip.status ? (
                          <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] font-headline font-black uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-300">
                            {trip.status}
                          </span>
                        ) : null}
                        {active ? (
                          <span className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-headline font-black uppercase text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
                            Delay
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                        {trip.routeName || "—"}
                      </p>
                      {(fromName || toName) ? (
                        <p className="mt-0.5 text-[12px] font-medium text-slate-500">
                          {fromName || "—"} → <span className="text-[#124757] dark:text-yellow-400">{toName || "—"}</span>
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                        {[boatLabel, trip.routeCode].filter(Boolean).join(" · ") || "—"}
                      </p>
                      {active ? (
                        <p className="mt-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          {formatActiveDelayLine(trip, { lang, stops: trip.stops })}
                        </p>
                      ) : mins > 0 ? (
                        <p className="mt-1.5 text-[11px] font-bold text-orange-700 dark:text-orange-300">
                          {formatPostResumeDelayLine(trip, lang)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] font-bold text-[#124757] dark:text-yellow-400">
                        {lang === "VN" ? "Sơ đồ ghế / khách →" : "Seat board / passengers →"}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
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
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
