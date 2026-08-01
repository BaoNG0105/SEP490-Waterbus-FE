import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { getMovementStatusLabel, getMovementStatusTone } from "../../../services/operationsService";

/** Staff chỉ xem chuyến từ 3 ngày trước ngày vận hành đến đúng ngày đó. */
const PREVIEW_DAYS_BEFORE = 3;

const pad2 = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const formatClock = (value) => {
  if (!value) return "--:--";
  const text = String(value).trim();
  // BE: +07:00 = giờ tường VN; Z/+00:00 = đổi sang Asia/Ho_Chi_Minh (không lấy HH:mm UTC trần).
  const wall = text.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?([Zz]|[+-]\d{2}:?\d{2})?/)
    || text.match(/^(\d{1,2}):(\d{2})(:\d{2})?$/);
  if (wall) {
    const offset = wall[3] || "";
    const normalized = offset.toUpperCase() === "Z"
      ? "Z"
      : offset.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
    if (!normalized || normalized === "+07:00") {
      return `${pad2(Number(wall[1]))}:${wall[2]}`;
    }
  }
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) {
    if (wall) return `${pad2(Number(wall[1]))}:${wall[2]}`;
    return "--:--";
  }
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  let hour = parts.hour || "00";
  if (hour === "24") hour = "00";
  return `${hour}:${parts.minute || "00"}`;
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
    if (!key) return;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, trip);
      return;
    }
    // Giữ bản đầu, bổ sung bến/stops nếu thiếu (staff/me/trips thường không có).
    map.set(key, {
      ...existing,
      fromStationName: existing.fromStationName || trip.fromStationName || "",
      toStationName: existing.toStationName || trip.toStationName || "",
      stationName: existing.stationName || trip.stationName || "",
      routeName: (existing.routeName && existing.routeName !== "—")
        ? existing.routeName
        : (trip.routeName || existing.routeName || "—"),
      stops: (Array.isArray(existing.stops) && existing.stops.length)
        ? existing.stops
        : (trip.stops || existing.stops || []),
      boatName: existing.boatName || trip.boatName || "",
      boatCode: existing.boatCode || trip.boatCode || "",
    });
  });
  return [...map.values()];
};

/** 0 = đang vận hành, 1 = chưa chạy / chuẩn bị, 2 = hoàn tất (đồng bộ với Lịch vận hành). */
const tripStatusBucket = (trip) => {
  const raw = String(trip?.status || trip?.tripStatus || trip?.movementStatus || "").toLowerCase().replace(/[\s_-]/g, "");
  if (
    raw.includes("inprogress")
    || raw.includes("ongoing")
    || raw.includes("running")
    || raw.includes("moving")
    || raw.includes("departed")
    || raw.includes("arriving")
    || raw.includes("atstation")
  ) {
    return 0;
  }
  if (
    raw.includes("complete")
    || raw.includes("finished")
    || raw.includes("hoantat")
    || raw.includes("cancel")
  ) {
    return 2;
  }
  // Scheduled / boarding / unknown
  return 1;
};

const tripStatusRaw = (trip) => (
  trip?.movementStatus || trip?.status || trip?.tripStatus || ""
);

const tripDepartureMs = (trip) => {
  const raw = pickDisplayDeparture(trip) || trip?.departureAt || trip?.startAt || "";
  const text = String(raw || "").trim();
  if (!text) return 0;
  // Sort theo giờ tường trên chuỗi (tránh lệch TZ làm sai thứ tự trong ngày).
  const wall = text.match(/(?:T|\s)(\d{1,2}):(\d{2})/) || text.match(/^(\d{1,2}):(\d{2})$/);
  if (wall) return (Number(wall[1]) * 60 + Number(wall[2]));
  return Date.parse(text) || 0;
};

/** Trong ngày: xếp theo giờ khởi hành. */
const sortTripsForOps = (trips) => (
  [...(Array.isArray(trips) ? trips : [])].sort((a, b) => tripDepartureMs(a) - tripDepartureMs(b))
);

/** "LINH DONG" / "Bến Bạch Đằng" → dễ đọc hơn khi BE trả code hoa. */
const formatStationLabel = (value) => {
  const text = String(value || "").trim();
  if (!text || text === "—") return "—";
  if (/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(text)) {
    return text;
  }
  if (text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return text
      .toLowerCase()
      .split(/\s+/)
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
      .join(" ");
  }
  return text;
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

      const merged = sortTripsForOps(mergeUniqueTrips([fromMe, fromFallback]));
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
        return sortTripsForOps(mergeAffectedTripsIntoList(next, pickAffectedTrips(payload)));
      });
    });
    return () => {
      unsub();
      boatIds.forEach((id) => trackingHub.leaveBoat(id).catch(() => {}));
    };
  }, [boatIdsKey]);

  const sortedTrips = useMemo(() => sortTripsForOps(trips), [trips]);

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
      <div className="flex flex-col gap-4 rounded-4xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-headline font-black uppercase tracking-widest text-slate-400">
            {lang === "VN" ? "Ca OnBoard" : "OnBoard duty"}
          </p>
          <h2 className="mt-1 font-headline text-xl font-black uppercase tracking-wide text-[#124757] dark:text-yellow-400 md:text-2xl">
            {lang === "VN" ? "Chuyến của tôi" : "My trips"}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-300">
            {formatDayLabel(date, lang)}
            {!isLoading ? (
              <span className="text-slate-400">
                {" · "}
                {lang === "VN" ? `${trips.length} chuyến` : `${trips.length} trip(s)`}
              </span>
            ) : null}
          </p>
        </div>

        <div
          className="flex h-11 w-full items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 sm:w-auto dark:border-slate-700 dark:bg-slate-900"
          role="group"
          aria-label={lang === "VN" ? "Ngày chuyến" : "Trip date"}
        >
          <AppDateInput
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 min-w-38 flex-1 rounded-xl border-0 bg-white px-2.5 text-xs font-bold text-[#124757] shadow-sm dark:bg-slate-800 dark:text-yellow-400 sm:flex-none"
          />
          <button
            type="button"
            onClick={() => setDate(today)}
            aria-pressed={date === today}
            className={`h-9 shrink-0 rounded-xl px-3 text-[10px] font-headline font-black uppercase tracking-wider transition ${
              date === today
                ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-slate-900"
                : "text-slate-500 hover:bg-white hover:text-[#124757] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-yellow-400"
            }`}
          >
            {lang === "VN" ? "Hôm nay" : "Today"}
          </button>
        </div>
      </div>

      {!previewAllowed ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {lang === "VN"
            ? `Cửa sổ xem: từ ${previewFromLabel} đến ${formatDayLabel(date, lang)}.`
            : `View window: from ${previewFromLabel} to ${formatDayLabel(date, lang)}.`}
        </div>
      ) : null}

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center rounded-4xl border border-slate-100 bg-white py-16 dark:border-slate-700/50 dark:bg-slate-800">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400" />
          </div>
        ) : trips.length === 0 ? (
          <p className="mx-auto max-w-lg rounded-4xl border border-slate-100 bg-white px-6 py-14 text-center text-xs font-bold leading-relaxed text-slate-400 dark:border-slate-700/50 dark:bg-slate-800">
            {emptyMessage}
          </p>
        ) : (
          <section className="overflow-hidden rounded-4xl border border-slate-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {sortedTrips.map((trip) => {
                const tripId = String(trip.tripId || trip.id || "");
                const active = isDelayActive(trip);
                const mins = pickDelayMinutes(trip);
                const busy = delayBusyId === tripId;
                const depart = pickDisplayDeparture(trip) || trip.departureAt || trip.startAt;
                const arrive = pickDisplayArrival(trip) || trip.arrivalAt || trip.endAt;
                const fromName = formatStationLabel(trip.fromStationName || trip.stationName || "");
                const toName = formatStationLabel(trip.toStationName || "");
                const routeLabel = String(trip.routeName || "").trim();
                const titleLabel = (routeLabel && routeLabel !== "—")
                  ? routeLabel
                  : `${fromName} → ${toName}`;
                const boatLabel = trip.boatName || trip.boatCode || "";
                const bucket = tripStatusBucket(trip);
                const statusRaw = tripStatusRaw(trip);
                const tone = getMovementStatusTone(statusRaw);
                const label = getMovementStatusLabel(statusRaw, lang) || (lang === "VN" ? "Chưa chạy" : "Scheduled");
                const hasDelayActions = canStartTripDelay(trip) || canResumeTripDelay(trip);

                return (
                  <li key={tripId || trip.tripCode}>
                    <div className={`grid grid-cols-[5.5rem_1fr] items-start gap-3 px-4 py-3.5 sm:grid-cols-[5.5rem_1fr_auto] sm:items-center sm:gap-4 sm:px-5 ${
                      bucket === 0 ? "bg-emerald-50/60 dark:bg-emerald-500/5" : ""
                    }`}>
                      <button
                        type="button"
                        onClick={() => openSeatBoard(trip)}
                        className="contents text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-headline text-base font-black tabular-nums leading-tight text-[#124757] dark:text-yellow-400 sm:text-lg">
                            {formatClock(depart)}
                          </p>
                          <p className="mt-0.5 text-[11px] font-bold tabular-nums text-slate-400">
                            → {formatClock(arrive)}
                          </p>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
                            {titleLabel}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-[9px] font-headline font-black uppercase tracking-wide ${tone}`}>
                              {label}
                            </span>
                            {active ? (
                              <span className="rounded-lg border border-amber-500 bg-amber-400 px-2 py-0.5 text-[9px] font-headline font-black uppercase text-amber-950">
                                Delay
                              </span>
                            ) : null}
                            {trip.tripCode ? (
                              <span className="truncate text-[10px] font-bold text-slate-400">
                                {trip.tripCode}
                              </span>
                            ) : null}
                          </div>
                          {boatLabel ? (
                            <p className="truncate text-[11px] font-medium text-slate-400">{boatLabel}</p>
                          ) : null}
                          {active ? (
                            <p className="text-[11px] font-black text-amber-800 dark:text-amber-200">
                              {formatActiveDelayLine(trip, { lang, stops: trip.stops })}
                            </p>
                          ) : mins > 0 ? (
                            <p className="text-[11px] font-black text-orange-800 dark:text-orange-200">
                              {formatPostResumeDelayLine(trip, lang)}
                            </p>
                          ) : null}
                        </div>

                        <span className="col-span-2 hidden shrink-0 text-[11px] font-headline font-black uppercase tracking-wider text-[#124757] sm:col-auto sm:inline dark:text-yellow-400">
                          {lang === "VN" ? "Chi tiết →" : "Open →"}
                        </span>
                      </button>

                      {hasDelayActions ? (
                        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-3 sm:justify-end">
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
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
